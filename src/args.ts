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
      model: { type: "string" },
      provider: { type: "string" },
      encoding: { type: "string" },
      econding: { type: "string" },
      jq: { type: "string" },
      json: { type: "boolean" },
      "jq-raw": { type: "string" },
    },
  });

  if (values.help) return { mode: "help" } as const;

  if (values.jq !== undefined && values["jq-raw"] !== undefined)
    throw new Error("Choose only one of --jq or --jq-raw.");

  const jq = values.jq ?? values["jq-raw"];
  const jqRaw = values["jq-raw"] !== undefined;

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

    if (values.provider !== undefined && harness !== "pi")
      throw new Error("--provider is only supported with --pi.");

    return {
      mode: "harness",
      harness,
      prompt: values.prompt ?? defaultPrompt,
      model: values.model,
      provider: values.provider,
      jq,
      jqRaw,
      json: values.json,
    } as const;
  }

  if (values.prompt !== undefined)
    throw new Error("--prompt requires --opencode, --codex, --claude, or --pi.");

  if (values.model !== undefined || values.provider !== undefined)
    throw new Error("--model and --provider require --opencode, --codex, --claude, or --pi.");

  if (positionals.length !== 1) throw new Error("Usage: lstok <file> [--encoding <name>]");

  return {
    mode: "file",
    file: positionals[0]!,
    encoding: values.encoding ?? values.econding ?? defaultEncoding,
    jq,
    jqRaw,
    json: values.json,
  } as const;
}
