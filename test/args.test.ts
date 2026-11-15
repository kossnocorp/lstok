import { describe, expect, it } from "vitest";
import { harnesses, parseArguments } from "../src/args.ts";

describe("arguments", () => {
  it("rejects every pair of harness flags", () => {
    for (const a of harnesses)
      for (const b of harnesses) {
        if (a !== b) expect(() => parseArguments([`--${a}`, `--${b}`])).toThrow("Choose only one");
      }
  });

  it.each([
    [],
    ["a", "b"],
    ["--prompt", "hello"],
    ["--codex", "--opencode"],
    ["--codex", "file"],
    ["--codex", "--encoding", "o200k_base"],
    ["--opencode", "--prompt", " "],
    ["--unknown"],
    ["a", "--encoding", "gpt2", "--econding", "cl100k_base"],
  ])("rejects invalid arguments %j", (...args) => {
    expect(() => parseArguments(args)).toThrow();
  });
});
