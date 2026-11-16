#!/usr/bin/env node

import { parseArguments } from "./args.ts";
import { readFile } from "node:fs/promises";
import { measureTokens } from "./count.ts";
import { countApi } from "./api.ts";
import { countTokenizer } from "./tokenizer.ts";
import { runHarness } from "./harness.ts";
import { printOutput } from "./output.ts";

async function main() {
  const options = parseArguments(process.argv.slice(2));

  switch (options.mode) {
    case "help":
      console.log(`Usage:
  lstok <file> [--encoding <name>]
  lstok --file <path> [--encoding <name>]
  lstok --agent <claude|opencode|codex|pi> [--prompt <prompt>] [--model <model>]
  lstok --prompt <prompt> [--encoding <name>]
  lstok <file> --tokenizer <tiktoken|hf:owner/repo[@revision]|directory>
  lstok <file> --api <claude|gemini|openai> --model <model>
  lstok --prompt <prompt> --api <claude|gemini|openai> --model <model>
  lstok --opencode [--prompt <prompt>] [--model <model>]
  lstok --codex [--prompt <prompt>] [--model <model>]
  lstok --claude [--prompt <prompt>] [--model <model>]
  lstok --pi [--prompt <prompt>] [--model <model>] [--provider <provider>]

Options:
  --file <path>      File to count (alternative to a positional path)
  --agent <name>     Agent to run: claude, opencode, codex, pi
  --encoding <name>  Tiktoken encoding (default: o200k_base)
  --tokenizer <id>   tiktoken (default), hf:owner/repo[@revision], or local directory
  --api <provider>   Count via claude, gemini, or openai API (requires --model)
  --econding <name>  Alias for --encoding
  --prompt <prompt>  Text to count, or agent prompt (default: What is the project name?)
  --model <model>    API model ID, or model passed unchanged to the agent CLI
  --provider <name>  Provider passed unchanged to Pi (--pi or --agent pi only)
  --jq <filter>      Filter output through installed jq
  --jq-raw <filter>  Filter output through installed jq with raw string output
  --json            Print the full statistics schema instead of total tokens
  --tee             Stream raw agent output before the final statistics
  -- <args...>      Pass remaining arguments directly to the selected agent
  -h, --help         Show help

Harnesses run in the current directory with their installed configuration.
--tee forwards agent stdout and stderr to their respective streams.
With --tee, --json and --jq apply only to the final statistics.
All modes print total tokens by default. --json prints the full schema.
--jq and --jq-raw filter the full schema, even without --json.`);
      break;

    case "file":
    case "prompt": {
      const text = options.mode === "file" ? await readFile(options.file, "utf8") : options.prompt;
      const report = options.api
        ? await countApi(text, options.api, options.model!)
        : options.tokenizer === "tiktoken"
          ? measureTokens(text, options.encoding)
          : await countTokenizer(text, options.tokenizer);
      await printOutput(
        options.json || options.jq !== undefined ? report : report.total,
        options.jq,
        options.jqRaw,
      );
      break;
    }

    case "harness": {
      const report = await runHarness(options.harness, options.prompt, options);
      await printOutput(
        options.json || options.jq !== undefined ? report : report.total,
        options.jq,
        options.jqRaw,
      );
      break;
    }
  }
}

main().catch((error: unknown) => {
  console.error(`lstok: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
