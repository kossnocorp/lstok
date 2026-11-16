#!/usr/bin/env node

import { parseArguments } from "./args.ts";
import { countFile } from "./count.ts";
import { runHarness } from "./harness.ts";
import { printOutput } from "./output.ts";
import { fileReport } from "./report.ts";

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
  --json            Print the full statistics schema instead of total tokens
  -h, --help         Show help

Harnesses run in the current directory with their installed configuration.
Both modes print total tokens by default. --json prints the full schema.
--jq and --jq-raw filter the full schema, even without --json.`);
      break;

    case "file": {
      const report = fileReport(await countFile(options.file, options.encoding), options.encoding);
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
