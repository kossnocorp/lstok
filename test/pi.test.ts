import { describe, expect, it } from "vitest";
import { createUsageCollector, harnessArguments } from "../src/harness.ts";
import { checkHarnessArguments, checkStream, temporaryDirectory } from "./helpers.ts";

const usage = {
  input: 100,
  output: 10,
  cacheRead: 30,
  cacheWrite: 20,
  totalTokens: 160,
  cost: { total: 0.01 },
};

const message = { role: "assistant", stopReason: "stop", usage };
const event = { type: "message_end", message };

describe("Pi", () => {
  const directory = temporaryDirectory();

  it("accepts default and custom prompts", () => checkHarnessArguments("pi"));

  it("sums completed assistant messages and compaction, not repeated snapshots", () => {
    const collector = createUsageCollector("pi");

    for (const item of [
      { type: "session" },
      { type: "message_start", message },
      { type: "message_update", usage },
      event,
      { type: "turn_end", message },
      { type: "agent_end", messages: [message] },
      { type: "message_end", message: { role: "toolResult", usage } },
      event,
      { type: "compaction_end", result: { usage } },
    ])
      collector.accept(JSON.stringify(item));

    expect(collector.result()).toEqual({
      input_tokens: 300,
      output_tokens: 30,
      cached_input_tokens: 90,
      cache_write_tokens: 60,
      total_tokens: 480,
      cost_usd: 0.03,
    });
  });

  it("reports failures even with successful exits and allows retry recovery", () => {
    const collector = createUsageCollector("pi");

    collector.accept(
      JSON.stringify({
        type: "message_end",
        message: { ...message, stopReason: "error", errorMessage: "overloaded" },
      }),
    );
    expect(() => collector.result()).toThrow("overloaded");

    collector.accept(JSON.stringify(event));
    expect(collector.result().input_tokens).toBe(200);

    collector.accept('{"type":"auto_retry_end","success":false,"finalError":"Retries exhausted"}');
    expect(() => collector.result()).toThrow("Retries exhausted");
  });

  it("rejects aborted runs", () => {
    const collector = createUsageCollector("pi");

    collector.accept(JSON.stringify(event));
    collector.accept('{"type":"agent_settled","aborted":true}');

    expect(() => collector.result()).toThrow("Run aborted");
  });

  it("handles missing and zero usage", () => {
    const collector = createUsageCollector("pi");

    expect(() => collector.result()).toThrow("did not report");

    collector.accept('{"type":"message_end","message":{"role":"assistant","usage":{"input":0}}}');

    expect(collector.result()).toEqual({ input_tokens: 0 });
  });

  it("uses noninteractive structured-output arguments", () => {
    expect(harnessArguments("pi", "@custom")).toEqual(["--print", "--mode", "json"]);
  });

  it("parses output and delivers the prompt literally", () => {
    checkStream(
      directory,
      "pi",
      [
        { type: "message_update", assistantMessageEvent: { delta: "Unicode: \u2028\u2029\r🙂" } },
        event,
      ],
      {
        input_tokens: 100,
        output_tokens: 10,
        cached_input_tokens: 30,
        cache_write_tokens: 20,
        total_tokens: 160,
        cost_usd: 0.01,
      },
    );
  });
});
