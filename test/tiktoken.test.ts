import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseArguments } from "../src/args.ts";
import { countTokens } from "../src/count.ts";
import { runCli, temporaryDirectory } from "./helpers.ts";

describe("tiktoken", () => {
  const directory = temporaryDirectory();

  it("defaults to o200k_base and supports both encoding spellings", () => {
    expect(parseArguments(["AGENTS.md"])).toEqual({
      mode: "file",
      jqRaw: false,
      file: "AGENTS.md",
      encoding: "o200k_base",
    });

    for (const flag of ["--encoding", "--econding"])
      expect(parseArguments(["AGENTS.md", flag, "cl100k_base"])).toHaveProperty(
        "encoding",
        "cl100k_base",
      );
  });

  it("counts empty, ASCII, Unicode, and special-token-looking text", () => {
    expect(countTokens("")).toBe(0);
    expect(countTokens("hello world")).toBe(2);
    expect(countTokens("お誕生日おめでとう", "o200k_base")).toBe(8);
    expect(countTokens("お誕生日おめでとう", "cl100k_base")).toBe(9);
    expect(countTokens("<|endoftext|>")).toBeGreaterThan(1);
  });

  it("rejects unsupported encodings", () => {
    expect(() => countTokens("hello", "invalid")).toThrow();
  });

  it("prints only the file token count and errors on missing files", () => {
    const file = join(directory, "file with spaces.md");

    writeFileSync(file, "hello world");

    expect(runCli([file]).stdout).toBe("2\n");
    const json = runCli([file, "--json", "--encoding", "cl100k_base"]);
    expect(json.status).toBe(0);
    expect(JSON.parse(json.stdout)).toEqual({
      input: 2,
      cache_read: 0,
      cache_write: 0,
      output: 0,
      reasoning: 0,
      cost: null,
      time: expect.any(Number),
      total_input: 2,
      total_output: 0,
      total: 2,
      provider: null,
      model: null,
      encoding: "cl100k_base",
    });

    const result = runCli([join(directory, "missing")]);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("lstok:");
    expect(result.stdout).toBe("");
  });
  it("counts standalone prompts, including empty text and selected encodings", () => {
    expect(runCli(["--prompt", "hello world"]).stdout).toBe("2\n");
    expect(runCli(["--prompt", ""]).stdout).toBe("0\n");
    const result = runCli([
      "--prompt",
      "お誕生日おめでとう",
      "--encoding",
      "cl100k_base",
      "--json",
    ]);
    expect(result.status).toBe(0);
    const report = JSON.parse(result.stdout);
    expect(report).toMatchObject({ input: 9, total: 9, encoding: "cl100k_base" });
    expect(report.time).toBeGreaterThanOrEqual(0);
  });
});
