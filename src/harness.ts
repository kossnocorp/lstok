import { spawn } from "node:child_process";
import type { Harness } from "./args.ts";
import { createReport, type Report } from "./report.ts";

export type Stats = Record<string, number>;

type ObjectValue = Record<string, unknown>;

function object(value: unknown): ObjectValue {
  return value !== null && typeof value === "object" ? (value as ObjectValue) : {};
}

export function createUsageCollector(harness: Harness) {
  const stats: Stats = {};
  const seen = new Set<string>();
  let found = false;
  let piError: string | undefined;
  const models = new Set<string>();
  const providers = new Set<string>();

  function metadata(model: unknown, provider?: unknown) {
    if (typeof model === "string" && model) models.add(model);
    if (typeof provider === "string" && provider) providers.add(provider);
  }

  function add(key: string, value: unknown) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      stats[key] = (stats[key] ?? 0) + value;
      found = true;
    }
  }

  function addPiUsage(value: unknown) {
    const usage = object(value);

    add("input", usage.input);
    add("total_output", usage.output);
    add("cache_read", usage.cacheRead);
    add("cache_write", usage.cacheWrite);
    add("cost", object(usage.cost).total);
  }

  return {
    accept(line: string) {
      if (!line.trim()) return;

      let event: ObjectValue;

      try {
        event = object(JSON.parse(line));
      } catch {
        throw new Error(`${harness} returned invalid JSON output.`);
      }

      if (event.type === "error" || event.type === "turn.failed") {
        const error = object(event.error);

        throw new Error(`${harness}: ${error.message ?? event.message ?? "run failed"}`);
      }

      if (harness === "claude" && event.type === "system" && event.subtype === "init")
        metadata(event.model);
      if (harness === "claude" && event.type === "assistant") metadata(object(event.message).model);
      if (harness === "claude" && event.type === "result")
        for (const model of Object.keys(object(event.modelUsage))) metadata(model);
      if (harness === "codex" && event.type === "thread.started")
        metadata(event.model, event.provider);

      if (harness === "codex" && event.type === "turn.completed") {
        const usage = object(event.usage);

        add("total_input", usage.input_tokens);
        add("cache_read", usage.cached_input_tokens);
        add("total_output", usage.output_tokens);
        add("reasoning", usage.reasoning_output_tokens);
        if (typeof usage.input_tokens === "number" && typeof usage.cached_input_tokens === "number")
          add("input", usage.input_tokens - usage.cached_input_tokens);
        if (
          typeof usage.output_tokens === "number" &&
          typeof usage.reasoning_output_tokens === "number"
        )
          add("output", usage.output_tokens - usage.reasoning_output_tokens);
      }

      if (harness === "claude" && event.type === "result") {
        if (
          event.is_error === true ||
          (typeof event.subtype === "string" && event.subtype !== "success")
        )
          throw new Error(
            `claude: ${Array.isArray(event.errors) ? event.errors.join("; ") : (event.result ?? event.subtype ?? "run failed")}`,
          );

        // Result usage is cumulative; a later result replaces the earlier snapshot.
        for (const key of Object.keys(stats)) delete stats[key];
        found = false;

        const usage = object(event.usage);

        add("input", usage.input_tokens);
        add("total_output", usage.output_tokens);
        add("cache_read", usage.cache_read_input_tokens);
        add("cache_write", usage.cache_creation_input_tokens);
        add("cost", event.total_cost_usd);
      }

      if (harness === "pi") {
        if (event.type === "message_end") {
          const message = object(event.message);

          if (message.role === "assistant") {
            metadata(message.model, message.provider);
            addPiUsage(message.usage);

            // Pi can retry failed responses. Wait until exit to judge the final outcome.
            piError =
              message.stopReason === "error" ||
              message.stopReason === "aborted" ||
              message.stopReason === "length"
                ? String(message.errorMessage ?? `Response ended: ${message.stopReason}`)
                : undefined;
          }
        }

        if (event.type === "compaction_end") addPiUsage(object(event.result).usage);

        if (event.type === "auto_retry_end" && event.success === false)
          piError = String(event.finalError ?? "Retries exhausted");

        if (event.type === "agent_settled" && event.aborted === true) piError = "Run aborted";
      }

      if (harness === "opencode" && event.type === "step_finish") {
        const part = object(event.part);

        if (typeof part.id === "string") {
          if (seen.has(part.id)) return;

          seen.add(part.id);
        }

        const tokens = object(part.tokens);

        add("input", tokens.input);
        add("output", tokens.output);
        add("reasoning", tokens.reasoning);
        add("cache_read", object(tokens.cache).read);
        add("cache_write", object(tokens.cache).write);
        add("cost", part.cost);
      }
    },

    result() {
      if (piError) throw new Error(`pi: ${piError}`);
      if (!found) throw new Error(`${harness} did not report usage statistics.`);

      const result = { ...stats };
      function sum(key: string, parts: string[]) {
        if (parts.every((part) => result[part] !== undefined))
          result[key] = parts.reduce((total, part) => total + result[part]!, 0);
      }

      if (harness !== "codex") sum("total_input", ["input", "cache_read", "cache_write"]);
      if (harness === "opencode") sum("total_output", ["output", "reasoning"]);
      sum("total", ["total_input", "total_output"]);

      return result;
    },

    metadata(options: HarnessOptions = {}) {
      return {
        model: models.size ? (models.size === 1 ? [...models][0]! : null) : (options.model ?? null),
        provider: providers.size
          ? providers.size === 1
            ? [...providers][0]!
            : null
          : (options.provider ?? null),
      };
    },
  };
}

export interface HarnessOptions {
  model?: string;
  provider?: string;
  agentArgs?: string[];
  tee?: boolean;
}

export function harnessArguments(harness: Harness, prompt: string, options: HarnessOptions = {}) {
  const args: string[] = [];
  if (options.model !== undefined) args.push("--model", options.model);
  if (options.provider !== undefined) {
    if (harness !== "pi") throw new Error("--provider is only supported with --pi.");
    args.push("--provider", options.provider);
  }
  args.push(...(options.agentArgs ?? []));

  switch (harness) {
    case "opencode":
      return ["run", "--format", "json", ...args, "--", prompt];

    case "codex":
      return ["exec", "--json", ...args, "--", prompt];

    case "claude":
      return ["--print", "--output-format", "stream-json", "--verbose", ...args, "--", prompt];

    // Send Pi's prompt over stdin: even after -- it treats @-prefixed arguments as files.
    case "pi":
      return ["--print", "--mode", "json", ...args];
  }
}

export async function runHarness(
  harness: Harness,
  prompt: string,
  options: HarnessOptions = {},
): Promise<Report> {
  const start = performance.now();
  const child = spawn(harness, harnessArguments(harness, prompt, options), {
    cwd: process.cwd(),
    stdio: ["pipe", "pipe", "inherit"],
  });
  const collector = createUsageCollector(harness);

  child.stdout.setEncoding("utf8");

  let buffer = "";
  let parseError: Error | undefined;
  let time: number | null = null;

  child.on("exit", () => {
    time = performance.now() - start;
  });

  const interrupt = () => child.kill("SIGINT");
  process.on("SIGINT", interrupt);

  try {
    await new Promise<void>((resolve, reject) => {
      child.on("error", (error) =>
        reject(new Error(`Could not start ${harness}: ${error.message}`)),
      );

      const accept = (line: string) => {
        if (parseError) return;

        try {
          collector.accept(line);
        } catch (error) {
          parseError = error as Error;
          child.kill();
        }
      };

      child.stdout.on("data", (chunk: string) => {
        if (options.tee) process.stdout.write(chunk);
        buffer += chunk;

        let newline: number;

        while ((newline = buffer.indexOf("\n")) !== -1) {
          accept(buffer.slice(0, newline).replace(/\r$/, ""));
          buffer = buffer.slice(newline + 1);
        }
      });

      child.stdout.on("end", () => {
        if (buffer) accept(buffer);
      });

      child.stdin.on("error", (error: NodeJS.ErrnoException) => {
        if (error.code !== "EPIPE") reject(error);
      });

      child.stdin.end(harness === "pi" ? prompt : undefined);

      child.on("close", (code, signal) => {
        if (parseError) reject(parseError);
        else if (code !== 0)
          reject(new Error(`${harness} exited with ${signal ?? `code ${code}`}.`));
        else resolve();
      });
    });

    const metadata = collector.metadata(options);
    if (harness === "opencode" && metadata.provider === null && options.model?.includes("/"))
      metadata.provider = options.model.slice(0, options.model.indexOf("/"));
    return createReport({ ...collector.result(), ...metadata, time, mode: "agent" });
  } finally {
    process.off("SIGINT", interrupt);
  }
}
