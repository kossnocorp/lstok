import { spawn } from "node:child_process";
import type { Harness } from "./args.ts";

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

  function add(key: string, value: unknown) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      stats[key] = (stats[key] ?? 0) + value;
      found = true;
    }
  }

  function addPiUsage(value: unknown) {
    const usage = object(value);

    add("input_tokens", usage.input);
    add("output_tokens", usage.output);
    add("cached_input_tokens", usage.cacheRead);
    add("cache_write_tokens", usage.cacheWrite);
    add("total_tokens", usage.totalTokens);
    add("cost_usd", object(usage.cost).total);
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

      if (harness === "codex" && event.type === "turn.completed") {
        const usage = object(event.usage);

        for (const [key, value] of Object.entries(usage)) add(key, value);
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

        add("input_tokens", usage.input_tokens);
        add("output_tokens", usage.output_tokens);
        add("cached_input_tokens", usage.cache_read_input_tokens);
        add("cache_write_tokens", usage.cache_creation_input_tokens);
        add("cost_usd", event.total_cost_usd);
      }

      if (harness === "pi") {
        if (event.type === "message_end") {
          const message = object(event.message);

          if (message.role === "assistant") {
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

        add("input_tokens", tokens.input);
        add("output_tokens", tokens.output);
        add("reasoning_tokens", tokens.reasoning);
        add("total_tokens", tokens.total);
        add("cached_input_tokens", object(tokens.cache).read);
        add("cache_write_tokens", object(tokens.cache).write);
        add("cost_usd", part.cost);
      }
    },

    result() {
      if (piError) throw new Error(`pi: ${piError}`);
      if (!found) throw new Error(`${harness} did not report usage statistics.`);

      return stats;
    },
  };
}

export function harnessArguments(harness: Harness, prompt: string) {
  switch (harness) {
    case "opencode":
      return ["run", "--format", "json", "--", prompt];

    case "codex":
      return ["exec", "--json", "--", prompt];

    case "claude":
      return ["--print", "--output-format", "stream-json", "--verbose", "--", prompt];

    // Send Pi's prompt over stdin: even after -- it treats @-prefixed arguments as files.
    case "pi":
      return ["--print", "--mode", "json"];
  }
}

export async function runHarness(harness: Harness, prompt: string): Promise<Stats> {
  const child = spawn(harness, harnessArguments(harness, prompt), {
    cwd: process.cwd(),
    stdio: ["pipe", "pipe", "inherit"],
  });
  const collector = createUsageCollector(harness);

  child.stdout.setEncoding("utf8");

  let buffer = "";
  let parseError: Error | undefined;

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

    return collector.result();
  } finally {
    process.off("SIGINT", interrupt);
  }
}
