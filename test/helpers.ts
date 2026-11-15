import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { afterAll, expect } from "vitest";
import { parseArguments, type Harness } from "../src/args.ts";

export function temporaryDirectory() {
  const directory = mkdtempSync(join(tmpdir(), "lstok-test-"));

  afterAll(() => rmSync(directory, { recursive: true, force: true }));

  return directory;
}

export function runCli(args: string[], directory?: string) {
  return spawnSync(process.execPath, [resolve("src/bin.ts"), ...args], {
    cwd: directory,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: directory ? directory + delimiter + process.env.PATH : process.env.PATH,
    },
  });
}

export function checkHarnessArguments(harness: Harness) {
  expect(parseArguments([`--${harness}`])).toEqual({
    mode: "harness",
    harness,
    prompt: "What is the project name?",
  });
  expect(parseArguments([`--${harness}`, "--prompt", "custom"])).toHaveProperty("prompt", "custom");
  expect(() => parseArguments([`--${harness}`, "file.md"])).toThrow();
  expect(() => parseArguments([`--${harness}`, "--encoding", "gpt2"])).toThrow();
}

export function checkStream(
  directory: string,
  harness: Harness,
  events: unknown[],
  expected: Record<string, number>,
) {
  const prompt = "@literal prompt; $HOME\nsecond line";
  const model = "Custom/Model:high#Variant; $HOME";
  const provider = "Custom-Provider";
  const output = events.map((event) => JSON.stringify(event)).join("\r\n");

  writeFileSync(
    join(directory, harness),
    `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
if (args[args.indexOf('--model') + 1] !== ${JSON.stringify(model)}) process.exit(3);
if (${harness === "pi"} && args[args.indexOf('--provider') + 1] !== ${JSON.stringify(provider)}) process.exit(4);
if (args.includes('--') && args.indexOf('--model') > args.indexOf('--')) process.exit(5);
const prompt = ${harness === "pi" ? "fs.readFileSync(0, 'utf8')" : "process.argv.at(-1)"};
if (prompt !== ${JSON.stringify(prompt)} || process.cwd() !== ${JSON.stringify(directory)}) process.exit(2);
const bytes = Buffer.from(${JSON.stringify(output)});
// Split UTF-8 and JSON records across writes, without a final newline.
for (const byte of bytes) fs.writeSync(1, Buffer.from([byte]));
`,
    { mode: 0o755 },
  );

  const result = runCli(
    [
      `--${harness}`,
      "--prompt",
      prompt,
      "--model",
      model,
      ...(harness === "pi" ? ["--provider", provider] : []),
    ],
    directory,
  );

  expect(result.stderr).toBe("");
  expect(result.status).toBe(0);
  expect(JSON.parse(result.stdout)).toEqual(expected);
}
