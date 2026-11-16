import { describe, expect, it } from "vitest";
import { harnesses, parseArguments } from "../src/args.ts";

describe("arguments", () => {
  it.each([
    [],
    ["--encoding", "cl100k_base", "--json"],
    ["--tokenizer", "hf:Qwen/Qwen3-8B"],
    ["--api", "claude", "--model", "sonnet"],
  ])("accepts an explicit file with options %j", (...options) => {
    expect(parseArguments(["--file", "file.md", ...options])).toEqual(
      parseArguments(["file.md", ...options]),
    );
  });

  it.each(harnesses)("accepts explicit agent %s", (harness) => {
    const options = ["--model", "custom", "--prompt", "hello", "--tee", "--json"];
    if (harness === "pi") options.push("--provider", "anthropic");
    options.push("--", "--file", "forwarded.md", "--agent", "forwarded");
    expect(parseArguments(["--agent", harness, ...options])).toEqual(
      parseArguments([`--${harness}`, ...options]),
    );
    for (const flag of harnesses)
      expect(() => parseArguments(["--agent", harness, `--${flag}`])).toThrow("Choose only one");
  });

  it("preserves agent arguments after the separator", () => {
    for (const harness of harnesses) {
      const agentArgs = ["--model", "custom model", "--json", "--tee", "--", "literal"];
      expect(parseArguments([`--${harness}`, "--tee", "--", ...agentArgs])).toMatchObject({
        mode: "harness",
        tee: true,
        agentArgs,
      });
    }
    expect(() => parseArguments(["--codex", "file", "--", "--custom"])).toThrow();
  });

  it("preserves option terminators for filenames", () => {
    expect(parseArguments(["--", "--tee"])).toMatchObject({ mode: "file", file: "--tee" });
  });

  it("rejects every pair of harness flags", () => {
    for (const a of harnesses)
      for (const b of harnesses) {
        if (a !== b) expect(() => parseArguments([`--${a}`, `--${b}`])).toThrow("Choose only one");
      }
  });

  it.each([
    [],
    ["--file"],
    ["--agent"],
    ["--agent", "unknown"],
    ["--agent", ""],
    ["--file", "a", "a"],
    ["--file", "a", "--prompt", "hello"],
    ["--file", "a", "--claude"],
    ["--file", "a", "--agent", "claude"],
    ["--agent", "claude", "a"],
    ["--agent", "claude", "--encoding", "o200k_base"],
    ["--agent", "claude", "--tokenizer", "tiktoken"],
    ["--agent", "claude", "--api", "claude", "--model", "x"],
    ["--agent", "claude", "--provider", "anthropic"],
    ["a", "b"],
    ["file.md", "--prompt", "hello"],
    ["--prompt", "hello", "--model", "custom"],
    ["file.md", "--model", "custom"],
    ["file.md", "--provider", "custom"],
    ["--codex", "--provider", "custom"],
    ["--claude", "--provider", "custom"],
    ["--opencode", "--provider", "custom"],
    ["--pi", "--model"],
    ["--pi", "--provider"],
    ["--codex", "--opencode"],
    ["--codex", "file"],
    ["--codex", "--encoding", "o200k_base"],
    ["--opencode", "--prompt", " "],
    ["--unknown"],
    ["file.md", "--tee"],
    ["--prompt", "hello", "--tee"],
    ["--codex", "--jq"],
    ["--codex", "--jq-raw"],
    ["--codex", "--jq", ".", "--jq-raw", "."],
    ["a", "--encoding", "gpt2", "--econding", "cl100k_base"],
    ["a", "--api", "unknown", "--model", "x"],
    ["a", "--api", "claude"],
    ["a", "--api", "claude", "--model", " "],
    ["--claude", "--api", "claude", "--model", "x"],
    ["a", "--api", "claude", "--model", "x", "--encoding", "o200k_base"],
    ["a", "--api", "claude", "--model", "x", "--tokenizer", "tiktoken"],
    ["a", "--tokenizer", "hf:Qwen/Qwen3-8B", "--encoding", "o200k_base"],
    ["a", "--tokenizer", ""],
    ["--claude", "--tokenizer", "tiktoken"],
  ])("rejects invalid arguments %j", (...args) => {
    expect(() => parseArguments(args)).toThrow();
  });
});
