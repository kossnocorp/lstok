import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { countTokenizer } from "../src/tokenizer.ts";
import { runCli, temporaryDirectory } from "./helpers.ts";

// A small WordPiece vocabulary with a post-processor to detect accidental BOS/EOS.
const tokenizer = {
  version: "1.0",
  added_tokens: [],
  normalizer: null,
  pre_tokenizer: { type: "Whitespace" },
  decoder: { type: "WordPiece", prefix: "##", cleanup: true },
  model: {
    type: "WordPiece",
    unk_token: "[UNK]",
    continuing_subword_prefix: "##",
    max_input_chars_per_word: 100,
    vocab: { "[UNK]": 0, "[CLS]": 1, "[SEP]": 2, hello: 3, world: 4, "##s": 5 },
  },
  post_processor: { type: "BertProcessing", cls: ["[CLS]", 1], sep: ["[SEP]", 2] },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Hugging Face tokenizers", () => {
  const directory = temporaryDirectory();
  writeFileSync(join(directory, "tokenizer.json"), JSON.stringify(tokenizer));
  writeFileSync(join(directory, "tokenizer_config.json"), "{}");

  it("counts local tokenizers without adding special tokens", async () => {
    expect((await countTokenizer("hello worlds", directory)).total).toBe(3);
    expect((await countTokenizer("", directory)).total).toBe(0);
    expect((await countTokenizer("世界", directory)).total).toBe(1);
    for (const input of [["--prompt", "hello worlds"], [join(directory, "text.md")]]) {
      writeFileSync(join(directory, "text.md"), "hello worlds");
      const result = runCli([...input, "--tokenizer", directory, "--json"]);
      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({ total: 3, encoding: directory });
    }
  });

  it("downloads a pinned tokenizer once and reuses the cache offline", async () => {
    vi.stubEnv("XDG_CACHE_HOME", directory);
    vi.stubEnv("HF_TOKEN", "hf-test");
    const fetch = vi.fn(async (url: string) =>
      Response.json(url.endsWith("/tokenizer.json") ? tokenizer : {}),
    );
    vi.stubGlobal("fetch", fetch);
    expect((await countTokenizer("hello worlds", "hf:example/test@abc123")).total).toBe(3);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0]![0]).toContain("/resolve/abc123/");
    fetch.mockRejectedValue(new Error("offline"));
    expect((await countTokenizer("hello", "hf:example/test@abc123")).total).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("reports invalid selectors and failed downloads", async () => {
    await expect(countTokenizer("hello", "hf:invalid")).rejects.toThrow("owner");
    vi.stubEnv("XDG_CACHE_HOME", directory);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 403 })));
    await expect(countTokenizer("hello", "hf:example/gated")).rejects.toThrow("HTTP 403");
  });
});
