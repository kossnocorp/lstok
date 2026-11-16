import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { Tokenizer } from "@huggingface/tokenizers";
import { fileReport } from "./report.ts";

type TokenizerFiles = ConstructorParameters<typeof Tokenizer>;

async function loadTokenizer(selector: string): Promise<TokenizerFiles> {
  if (!selector.startsWith("hf:")) {
    return Promise.all(
      ["tokenizer.json", "tokenizer_config.json"].map(async (name) =>
        JSON.parse(await readFile(join(selector, name), "utf8")),
      ),
    ) as Promise<TokenizerFiles>;
  }
  const match = /^hf:([\w.-]+\/[\w.-]+)(?:@(.+))?$/.exec(selector);
  if (!match) throw new Error("Use --tokenizer hf:<owner>/<repo>[@revision] or a local directory.");
  const repo = match[1]!;
  const revision = match[2] ?? "main";
  const directory = join(
    process.env.XDG_CACHE_HOME || join(homedir(), ".cache"),
    "lstok",
    "tokenizers",
  );
  const cache = join(
    directory,
    `${createHash("sha256").update(`${repo}@${revision}`).digest("hex")}.json`,
  );
  try {
    return JSON.parse(await readFile(cache, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const headers: Record<string, string> = {};
  if (process.env.HF_TOKEN) headers.authorization = `Bearer ${process.env.HF_TOKEN}`;
  const files = (await Promise.all(
    ["tokenizer.json", "tokenizer_config.json"].map(async (name) => {
      const response = await fetch(
        `https://huggingface.co/${repo}/resolve/${encodeURIComponent(revision)}/${name}`,
        {
          headers,
          signal: AbortSignal.timeout(30_000),
        },
      );
      if (!response.ok)
        throw new Error(`Cannot download ${selector}/${name} (HTTP ${response.status}).`);
      return response.json();
    }),
  )) as TokenizerFiles;
  // Validate before caching, and publish the complete pair atomically.
  new Tokenizer(...files);
  await mkdir(directory, { recursive: true });
  const temporary = `${cache}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, JSON.stringify(files));
    await rename(temporary, cache);
  } finally {
    await rm(temporary, { force: true });
  }
  return files;
}

export async function countTokenizer(text: string, selector: string) {
  const tokenizer = new Tokenizer(...(await loadTokenizer(selector)));
  const start = performance.now();
  const input = tokenizer.encode(text, { add_special_tokens: false }).ids.length;
  return fileReport(input, selector, performance.now() - start);
}
