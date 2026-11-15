import { readFile } from "node:fs/promises";
import { get_encoding, type TiktokenEncoding } from "tiktoken";
import { defaultEncoding } from "./args.ts";

export function countTokens(text: string, encoding = defaultEncoding): number {
  const encoder = get_encoding(encoding as TiktokenEncoding);

  try {
    // Treat special-token-looking strings in files as ordinary text.
    return encoder.encode(text, [], []).length;
  } finally {
    encoder.free();
  }
}

export async function countFile(file: string, encoding = defaultEncoding) {
  return countTokens(await readFile(file, "utf8"), encoding);
}
