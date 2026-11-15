#!/usr/bin/env node

import { parseArguments } from "./args.ts";
import { countFile } from "./count.ts";
import { runHarness } from "./harness.ts";

async function main() {
  const options = parseArguments(process.argv.slice(2));

  switch (options.mode) {
    case "help":
      console.log(`Usage:
  lstok <file> [--encoding <name>]
  lstok --opencode [--prompt <prompt>]
  lstok --codex [--prompt <prompt>]
  lstok --claude [--prompt <prompt>]
  lstok --pi [--prompt <prompt>]

Options:
  --encoding <name>  Tiktoken encoding (default: o200k_base)
  --econding <name>  Alias for --encoding
  --prompt <prompt>  Default: What is the project name?
  -h, --help         Show help

Harnesses run in the current directory with their installed configuration.
File mode prints a token count; harness mode prints reported statistics as JSON.`);
      break;

    case "file":
      console.log(await countFile(options.file, options.encoding));
      break;

    case "harness":
      console.log(JSON.stringify(await runHarness(options.harness, options.prompt), null, 2));
      break;
  }
}

main().catch((error: unknown) => {
  console.error(`lstok: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
