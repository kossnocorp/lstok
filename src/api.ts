import type { Api } from "./args.ts";
import { createReport } from "./report.ts";

export async function countApi(text: string, api: Api, model: string) {
  const key =
    api === "claude"
      ? process.env.ANTHROPIC_API_KEY
      : api === "openai"
        ? process.env.OPENAI_API_KEY
        : process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!key?.trim()) {
    const name =
      api === "claude"
        ? "ANTHROPIC_API_KEY"
        : api === "openai"
          ? "OPENAI_API_KEY"
          : "GOOGLE_API_KEY or GEMINI_API_KEY";
    throw new Error(`Set ${name} to use --api ${api}.`);
  }

  const headers: Record<string, string> = { "content-type": "application/json" };
  let url: string;
  let body: unknown;
  if (api === "claude") {
    url = "https://api.anthropic.com/v1/messages/count_tokens";
    headers["x-api-key"] = key;
    headers["anthropic-version"] = "2023-06-01";
    body = { model, messages: [{ role: "user", content: text }] };
  } else if (api === "gemini") {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model.replace(/^models\//, ""))}:countTokens`;
    headers["x-goog-api-key"] = key;
    body = { contents: [{ role: "user", parts: [{ text }] }] };
  } else {
    url = "https://api.openai.com/v1/responses/input_tokens";
    headers.authorization = `Bearer ${key}`;
    body = { model, input: text };
  }

  const start = performance.now();
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok)
    throw new Error(
      `${api} token counting failed (HTTP ${response.status} ${response.statusText}).`,
    );
  const data = (await response.json()) as Record<string, unknown>;
  const input = data?.[api === "gemini" ? "totalTokens" : "input_tokens"];
  if (typeof input !== "number" || !Number.isSafeInteger(input) || input < 0)
    throw new Error(`${api} returned an invalid token count.`);
  return createReport({
    mode: "api",
    input,
    total_input: input,
    total: input,
    cache_read: 0,
    cache_write: 0,
    output: 0,
    reasoning: 0,
    total_output: 0,
    provider: api === "claude" ? "anthropic" : api === "gemini" ? "google" : "openai",
    model,
    time: performance.now() - start,
  });
}
