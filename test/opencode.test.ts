import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createUsageCollector, harnessArguments } from "../src/harness.ts";
import { checkHarnessArguments, runCli, temporaryDirectory } from "./helpers.ts";

describe("OpenCode", () => {
  const directory = temporaryDirectory();

  it("accepts default and custom prompts", () => checkHarnessArguments("opencode"));

  it("sums steps once and preserves cache, reasoning, and cost", () => {
    const collector = createUsageCollector("opencode");
    const event = (id: string) =>
      JSON.stringify({
        type: "step_finish",
        part: {
          id,
          tokens: { input: 10, output: 3, reasoning: 1, cache: { read: 20, write: 5 } },
          cost: 0.01,
        },
      });

    collector.accept('{"type":"text","part":{"text":"project"}}');
    collector.accept(event("a"));
    collector.accept(event("a"));
    collector.accept(event("b"));

    expect(collector.result()).toEqual({
      input: 20,
      output: 6,
      reasoning: 2,
      cache_read: 40,
      cache_write: 10,
      cost: 0.02,
      total_input: 70,
      total_output: 8,
      total: 78,
    });
    expect(collector.result().total).toBe(78);
  });

  it("passes the prompt after --", () => {
    expect(harnessArguments("opencode", "hello")).toEqual([
      "run",
      "--format",
      "json",
      "--",
      "hello",
    ]);
  });

  it("surfaces nonzero harness exits", () => {
    writeFileSync(
      join(directory, "opencode"),
      `#!${process.execPath}\nconsole.error("provider failed"); process.exit(7);\n`,
      { mode: 0o755 },
    );

    const result = runCli(["--opencode"], directory);

    expect(result.status).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("provider failed");
    expect(result.stderr).toContain("code 7");
  });
});
