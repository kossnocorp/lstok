import { describe, expect, it } from "vitest";
import { createUsageCollector, harnessArguments } from "../src/harness.ts";
import { checkHarnessArguments, checkStream, temporaryDirectory } from "./helpers.ts";

describe("Codex", () => {
  const directory = temporaryDirectory();

  it("accepts default and custom prompts", () => checkHarnessArguments("codex"));

  it("retains usage without adding cached input twice", () => {
    const collector = createUsageCollector("codex");
    const usage = {
      input_tokens: 100,
      cached_input_tokens: 80,
      output_tokens: 5,
      reasoning_output_tokens: 0,
    };

    collector.accept('{"type":"turn.started"}');
    collector.accept(JSON.stringify({ type: "turn.completed", usage }));

    expect(collector.result()).toEqual(usage);
  });

  it("reports zero usage and rejects missing usage, malformed output, and failures", () => {
    const collector = createUsageCollector("codex");

    expect(() => collector.result()).toThrow("did not report");
    expect(() => collector.accept("not json")).toThrow("invalid JSON");
    expect(() =>
      collector.accept('{"type":"turn.failed","error":{"message":"bad model"}}'),
    ).toThrow("bad model");

    collector.accept('{"type":"turn.completed","usage":{"input_tokens":0}}');

    expect(collector.result()).toEqual({ input_tokens: 0 });
  });

  it("passes prompts as a single argument after --", () => {
    expect(harnessArguments("codex", "--hello; echo hi")).toEqual([
      "exec",
      "--json",
      "--",
      "--hello; echo hi",
    ]);
  });

  it("reads a harness JSONL stream in the caller's directory", () => {
    const usage = { input_tokens: 42, output_tokens: 2 };

    checkStream(directory, "codex", [{ type: "turn.completed", usage }], usage);
  });
});
