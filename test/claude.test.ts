import { describe, expect, it } from "vitest";
import { createUsageCollector, harnessArguments } from "../src/harness.ts";
import { checkHarnessArguments, checkStream, temporaryDirectory } from "./helpers.ts";

const event = {
  type: "result",
  subtype: "success",
  is_error: false,
  usage: {
    input_tokens: 100,
    output_tokens: 10,
    cache_read_input_tokens: 30,
    cache_creation_input_tokens: 20,
  },
  total_cost_usd: 0.01,
};

const expected = {
  input: 100,
  total_output: 10,
  cache_read: 30,
  cache_write: 20,
  cost: 0.01,
  total_input: 150,
  total: 160,
};

describe("Claude", () => {
  const directory = temporaryDirectory();

  it("accepts default and custom prompts", () => checkHarnessArguments("claude"));

  it("counts only the final cumulative result", () => {
    const collector = createUsageCollector("claude");

    collector.accept(JSON.stringify({ type: "assistant", message: { usage: event.usage } }));
    collector.accept(JSON.stringify(event));
    collector.accept(JSON.stringify(event));

    expect(collector.result()).toEqual(expected);
  });

  it("rejects unsuccessful results", () => {
    const collector = createUsageCollector("claude");

    expect(() =>
      collector.accept(
        JSON.stringify({ ...event, is_error: true, errors: ["Authentication failed"] }),
      ),
    ).toThrow("Authentication failed");
    expect(() =>
      collector.accept(JSON.stringify({ ...event, subtype: "error_max_turns" })),
    ).toThrow("error_max_turns");
  });

  it("handles missing and zero usage", () => {
    const collector = createUsageCollector("claude");

    expect(() => collector.result()).toThrow("did not report");

    collector.accept('{"type":"result","usage":{"input_tokens":0}}');

    expect(collector.result()).toEqual({ input: 0 });
  });

  it("uses noninteractive structured-output arguments", () => {
    expect(harnessArguments("claude", "--custom")).toEqual([
      "--print",
      "--output-format",
      "stream-json",
      "--verbose",
      "--",
      "--custom",
    ]);
  });

  it("parses output and delivers the prompt literally", () => {
    checkStream(directory, "claude", [event], expected);
  });
});
