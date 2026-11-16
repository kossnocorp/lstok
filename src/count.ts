import { readFile } from "node:fs/promises";
import { get_encoding, type TiktokenEncoding } from "tiktoken";
import { defaultEncoding } from "./args.ts";
import { fileReport } from "./report.ts";

export function countTokens(text: string, encoding = defaultEncoding): number {
  return measureTokens(text, encoding).input!;
}

export function measureTokens(text: string, encoding = defaultEncoding) {
  const encoder = get_encoding(encoding as TiktokenEncoding);

  try {
    // Treat special-token-looking strings as ordinary text.
    const start = performance.now();
    const input = encoder.encode(text, [], []).length;
    const time = performance.now() - start;
    return fileReport(input, "tiktoken", encoding, time);
  } finally {
    encoder.free();
  }
}

export async function countFile(file: string, encoding = defaultEncoding) {
  return measureTokens(await readFile(file, "utf8"), encoding);
}
