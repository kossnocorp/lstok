#!/usr/bin/env node

import { parseArguments } from "./args.ts";
import { countFile } from "./count.ts";
import { runHarness } from "./harness.ts";
import { printOutput } from "./output.ts";

async function main() {
  const options = parseArguments(process.argv.slice(2));

  switch (options.mode) {
    case "help":
      console.log(`Usage:
  lstok <file> [--encoding <name>]
  lstok --opencode [--prompt <prompt>] [--model <model>]
  lstok --codex [--prompt <prompt>] [--model <model>]
  lstok --claude [--prompt <prompt>] [--model <model>]
  lstok --pi [--prompt <prompt>] [--model <model>] [--provider <provider>]

Options:
  --encoding <name>  Tiktoken encoding (default: o200k_base)
  --econding <name>  Alias for --encoding
  --prompt <prompt>  Default: What is the project name?
  --model <model>    Model passed unchanged to the agent CLI
  --provider <name>  Provider passed unchanged to Pi (--pi only)
  --jq <filter>      Filter output through installed jq
  --jq-raw <filter>  Filter output through installed jq with raw string output
  -h, --help         Show help

Harnesses run in the current directory with their installed configuration.
File mode prints a token count; harness mode prints reported statistics as JSON.`);
      break;

    case "file":
      await printOutput(await countFile(options.file, options.encoding), options.jq, options.jqRaw);
      break;

    case "harness":
      await printOutput(
        await runHarness(options.harness, options.prompt, options),
        options.jq,
        options.jqRaw,
      );
      break;
  }
}

main().catch((error: unknown) => {
  console.error(`lstok: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
