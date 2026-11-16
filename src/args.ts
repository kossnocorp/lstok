import { parseArgs } from "node:util";

export const defaultPrompt = "What is the project name?";
export const defaultEncoding = "o200k_base";
export const apis = ["claude", "gemini", "openai"] as const;
export type Api = (typeof apis)[number];
export const harnesses = ["opencode", "codex", "claude", "pi"] as const;

export type Harness = (typeof harnesses)[number];

export function parseArguments(args: string[]) {
  const { values, positionals, tokens } = parseArgs({
    args,
    tokens: true,
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
      tokenizer: { type: "string" },
      api: { type: "string" },
      econding: { type: "string" },
      jq: { type: "string" },
      json: { type: "boolean" },
      tee: { type: "boolean" },
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
  const encoding = values.encoding ?? values.econding;
  const tokenizer = values.tokenizer ?? "tiktoken";

  if (!tokenizer.trim()) throw new Error("--tokenizer must not be empty.");
  if (values.api !== undefined && !apis.includes(values.api as Api))
    throw new Error("--api must be claude, gemini, or openai.");
  if (values.api !== undefined) {
    if (harness || encoding !== undefined || values.tokenizer !== undefined)
      throw new Error("--api cannot be combined with an agent, --encoding, or --tokenizer.");
    if (!values.model?.trim()) throw new Error("--api requires --model.");
  }
  if (tokenizer !== "tiktoken" && encoding !== undefined)
    throw new Error("--encoding is only supported with --tokenizer tiktoken.");

  if (harness) {
    if (values.tokenizer !== undefined)
      throw new Error("Harness mode does not accept --tokenizer.");
    const separator = tokens.find((token) => token.kind === "option-terminator")?.index;
    const hasPositionals = tokens.some(
      (token) =>
        token.kind === "positional" && (separator === undefined || token.index < separator),
    );
    if (hasPositionals || values.encoding !== undefined || values.econding !== undefined)
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
      agentArgs: separator === undefined ? undefined : args.slice(separator + 1),
      tee: values.tee,
      jq,
      jqRaw,
      json: values.json,
    } as const;
  }

  if (values.tee) throw new Error("--tee requires --opencode, --codex, --claude, or --pi.");

  if ((values.model !== undefined && values.api === undefined) || values.provider !== undefined)
    throw new Error("--model requires --api or an agent; --provider requires --pi.");

  if (values.prompt !== undefined) {
    if (positionals.length) throw new Error("Choose either a file or --prompt.");

    return {
      mode: "prompt",
      prompt: values.prompt,
      encoding: values.encoding ?? values.econding ?? defaultEncoding,
      tokenizer,
      api: values.api as Api | undefined,
      model: values.model,
      jq,
      jqRaw,
      json: values.json,
    } as const;
  }

  if (positionals.length !== 1) throw new Error("Usage: lstok <file> [--encoding <name>]");

  return {
    mode: "file",
    file: positionals[0]!,
    encoding: values.encoding ?? values.econding ?? defaultEncoding,
    tokenizer,
    api: values.api as Api | undefined,
    model: values.model,
    jq,
    jqRaw,
    json: values.json,
  } as const;
}
