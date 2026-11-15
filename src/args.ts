import { parseArgs } from "node:util";

export const defaultPrompt = "What is the project name?";
export const defaultEncoding = "o200k_base";
export const harnesses = ["opencode", "codex", "claude", "pi"] as const;

export type Harness = (typeof harnesses)[number];

export function parseArguments(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      help: { type: "boolean", short: "h" },
      opencode: { type: "boolean" },
      codex: { type: "boolean" },
      claude: { type: "boolean" },
      pi: { type: "boolean" },
      prompt: { type: "string" },
      encoding: { type: "string" },
      econding: { type: "string" },
    },
  });

  if (values.help) return { mode: "help" } as const;

  const selected = harnesses.filter((name) => values[name]);

  if (selected.length > 1)
    throw new Error("Choose only one harness: --opencode, --codex, --claude, or --pi.");

  if (values.encoding && values.econding && values.encoding !== values.econding)
    throw new Error("--encoding and --econding must agree.");

  const harness = selected[0];

  if (harness) {
    if (positionals.length || values.encoding !== undefined || values.econding !== undefined)
      throw new Error("Harness mode does not accept a file or encoding.");

    if (values.prompt !== undefined && !values.prompt.trim())
      throw new Error("--prompt must not be empty.");

    return { mode: "harness", harness, prompt: values.prompt ?? defaultPrompt } as const;
  }

  if (values.prompt !== undefined)
    throw new Error("--prompt requires --opencode, --codex, --claude, or --pi.");

  if (positionals.length !== 1) throw new Error("Usage: lstok <file> [--encoding <name>]");

  return {
    mode: "file",
    file: positionals[0]!,
    encoding: values.encoding ?? values.econding ?? defaultEncoding,
  } as const;
}
