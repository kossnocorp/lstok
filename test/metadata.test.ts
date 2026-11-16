import { describe, expect, it } from "vitest";
import { createUsageCollector } from "../src/harness.ts";

describe("agent metadata", () => {
  it("prefers Pi's reported model and provider over CLI selections", () => {
    const collector = createUsageCollector("pi");
    collector.accept(
      JSON.stringify({
        type: "message_end",
        message: { role: "assistant", model: "resolved-model", provider: "actual-provider" },
      }),
    );
    expect(collector.metadata({ model: "alias", provider: "requested" })).toEqual({
      model: "resolved-model",
      provider: "actual-provider",
    });
  });

  it("reports null when multiple models contribute to Claude usage", () => {
    const collector = createUsageCollector("claude");
    collector.accept(JSON.stringify({ type: "result", modelUsage: { first: {}, second: {} } }));
    expect(collector.metadata({ model: "first" })).toEqual({ model: null, provider: null });
  });

  it("uses explicit selections when the CLI does not report metadata", () => {
    const collector = createUsageCollector("codex");
    expect(collector.metadata()).toEqual({ model: null, provider: null });
    expect(collector.metadata({ model: "Custom/Model#Variant" })).toEqual({
      model: "Custom/Model#Variant",
      provider: null,
    });
  });
});
