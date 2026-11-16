import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { countApi } from "../src/api.ts";
import { apis } from "../src/args.ts";
import { temporaryDirectory } from "./helpers.ts";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("counting APIs", () => {
  const directory = temporaryDirectory();
  it.each(apis)("sends text and auth to %s", async (api) => {
    vi.stubEnv("ANTHROPIC_API_KEY", "anthropic-key");
    vi.stubEnv("OPENAI_API_KEY", "openai-key");
    vi.stubEnv("GOOGLE_API_KEY", "google-key");
    vi.stubEnv("GEMINI_API_KEY", "gemini-key");
    const fetch = vi.fn().mockResolvedValue(Response.json({ input_tokens: 12, totalTokens: 12 }));
    vi.stubGlobal("fetch", fetch);
    expect(await countApi("hello 世界", api, "test-model")).toMatchObject({
      input: 12,
      total: 12,
      model: "test-model",
      encoding: null,
      cost: null,
      output: 0,
      provider: api === "claude" ? "anthropic" : api === "gemini" ? "google" : "openai",
    });
    const [url, request] = fetch.mock.calls[0]!;
    const expected = {
      claude: [
        "https://api.anthropic.com/v1/messages/count_tokens",
        "x-api-key",
        "anthropic-key",
        { model: "test-model", messages: [{ role: "user", content: "hello 世界" }] },
      ],
      gemini: [
        "https://generativelanguage.googleapis.com/v1beta/models/test-model:countTokens",
        "x-goog-api-key",
        "google-key",
        { contents: [{ role: "user", parts: [{ text: "hello 世界" }] }] },
      ],
      openai: [
        "https://api.openai.com/v1/responses/input_tokens",
        "authorization",
        "Bearer openai-key",
        { model: "test-model", input: "hello 世界" },
      ],
    }[api];
    expect(url).toBe(expected[0]);
    expect(request.headers[expected[1] as string]).toBe(expected[2]);
    expect(JSON.parse(request.body)).toEqual(expected[3]);
    expect(request.method).toBe("POST");
  });

  it("supports Gemini's alternate key and models/ prefix", async () => {
    vi.stubEnv("GOOGLE_API_KEY", undefined);
    vi.stubEnv("GEMINI_API_KEY", "alternate");
    const fetch = vi.fn().mockResolvedValue(Response.json({ totalTokens: 0 }));
    vi.stubGlobal("fetch", fetch);
    expect((await countApi("", "gemini", "models/test")).total).toBe(0);
    expect(fetch.mock.calls[0]![0]).toContain("/models/test:countTokens");
    expect(fetch.mock.calls[0]![1].headers["x-goog-api-key"]).toBe("alternate");
  });

  it("rejects missing credentials before fetching", async () => {
    for (const key of ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_API_KEY", "GEMINI_API_KEY"])
      vi.stubEnv(key, undefined);
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    for (const api of apis) await expect(countApi("text", api, "model")).rejects.toThrow("Set ");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects HTTP failures and malformed counts", async () => {
    vi.stubEnv("OPENAI_API_KEY", "key");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    fetch.mockResolvedValue(new Response("private error details", { status: 401 }));
    await expect(countApi("text", "openai", "model")).rejects.toThrow("HTTP 401");
    for (const input_tokens of [undefined, null, "12", -1, 1.5]) {
      fetch.mockResolvedValue(Response.json({ input_tokens }));
      await expect(countApi("text", "openai", "model")).rejects.toThrow("invalid token count");
    }
  });

  it("counts file and prompt text through the CLI", () => {
    const file = join(directory, "input.md");
    writeFileSync(file, "hello 世界");
    const mock = `globalThis.fetch = async (url, request) => {
      if (JSON.parse(request.body).input !== "hello 世界") throw Error("Wrong input");
      return Response.json({input_tokens: 42});
    };`;
    for (const input of [[file], ["--prompt", "hello 世界"]]) {
      const result = spawnSync(
        process.execPath,
        [
          "--import",
          `data:text/javascript,${encodeURIComponent(mock)}`,
          resolve("src/bin.ts"),
          ...input,
          "--api",
          "openai",
          "--model",
          "test",
          "--json",
        ],
        {
          encoding: "utf8",
          env: { ...process.env, OPENAI_API_KEY: "test-key" },
        },
      );
      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
      expect(JSON.parse(result.stdout)).toMatchObject({
        total: 42,
        model: "test",
        provider: "openai",
      });
    }
  });
});
