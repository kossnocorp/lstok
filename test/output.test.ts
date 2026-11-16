import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { runCli, temporaryDirectory } from "./helpers.ts";

describe("jq output", () => {
  const directory = temporaryDirectory();
  const filter = '.total_input | "tokens: \\(.)"';

  writeFileSync(
    join(directory, "codex"),
    `#!${process.execPath}
console.log(JSON.stringify({type: "turn.completed", usage: {input_tokens: 42, output_tokens: 2}}));
setTimeout(() => {}, 100);
`,
    { mode: 0o755 },
  );
  writeFileSync(
    join(directory, "jq"),
    `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
const raw = args[0] === '--raw-output';
const filter = args.at(-1);
if (args.at(-2) !== '--') process.exit(9);
if (filter === 'invalid') { process.stderr.write('jq: invalid filter\\n'); process.exit(3); }
const data = JSON.parse(fs.readFileSync(0, 'utf8'));
if (filter !== ${JSON.stringify(filter)} || data.total !== 44) process.exit(8);
process.stdout.write(raw ? 'tokens: 42' : '"tokens: 42"\\n');
`,
    { mode: 0o755 },
  );

  it.each(["--jq", "--jq-raw"])("passes %s filters literally and preserves jq output", (flag) => {
    const result = runCli(["--codex", flag, filter], directory);
    expect(result.status).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe(flag === "--jq" ? '"tokens: 42"\n' : "tokens: 42");
  });

  it("preserves jq errors and exit status", () => {
    const result = runCli(["--codex", "--jq", "invalid"], directory);
    expect(result.status).toBe(3);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("jq: invalid filter\n");
  });

  it.each(["--jq", "--jq-raw"])("tees events before the %s result", (flag) => {
    const result = runCli(["--codex", "--tee", "--json", flag, filter], directory);
    expect(result.status).toBe(0);
    const [event, ...output] = result.stdout.split("\n");
    expect(JSON.parse(event!)).toHaveProperty("type", "turn.completed");
    expect(output.join("\n")).toBe(flag === "--jq" ? '"tokens: 42"\n' : "tokens: 42");
  });

  it("prints the total by default and a complete schema with --json", () => {
    expect(runCli(["--codex"], directory).stdout).toBe("44\n");
    const result = runCli(["--codex", "--json"], directory);
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({
      input: null,
      cache_read: null,
      cache_write: null,
      output: null,
      reasoning: null,
      cost: null,
      time: expect.any(Number),
      total_input: 42,
      total_output: 2,
      total: 44,
      model: null,
      provider: null,
      encoding: null,
    });
    expect(JSON.parse(result.stdout).time).toBeGreaterThanOrEqual(100);
  });
});
