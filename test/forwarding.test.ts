import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { harnesses } from "../src/args.ts";
import { runCli, temporaryDirectory } from "./helpers.ts";

describe("agent forwarding", () => {
  const directory = temporaryDirectory();
  const events = {
    codex: { type: "turn.completed", usage: { input_tokens: 3, output_tokens: 2 } },
    claude: { type: "result", subtype: "success", usage: { input_tokens: 3, output_tokens: 2 } },
    opencode: { type: "step_finish", part: { tokens: { input: 3, output: 2, reasoning: 0 } } },
    pi: { type: "message_end", message: { role: "assistant", usage: { input: 3, output: 2 } } },
  };
  const agentArgs = ["--custom", "space; $HOME 🦊", "--model", "native-model"];
  const prompt = "@literal prompt";

  for (const harness of harnesses) {
    const output = `${JSON.stringify({ type: "text", text: "🦊" })}\r\n${JSON.stringify(events[harness])}`;
    writeFileSync(
      join(directory, harness),
      `#!${process.execPath}
const fs = require('node:fs');
const args = process.argv.slice(2);
const start = args.indexOf('--custom');
if (JSON.stringify(args.slice(start)) !== ${JSON.stringify(JSON.stringify([...agentArgs, ...(harness === "pi" ? [] : ["--", prompt])]))}) process.exit(2);
if (fs.readFileSync(0, 'utf8') !== ${JSON.stringify(harness === "pi" ? prompt : "")}) process.exit(3);
process.stderr.write('agent diagnostic\\n');
for (const byte of Buffer.from(${JSON.stringify(output)})) fs.writeSync(1, Buffer.from([byte]));
`,
      { mode: 0o755 },
    );

    it.each([false, true])(`${harness} forwards arguments and streams with tee=%s`, (tee) => {
      const result = runCli(
        [
          `--${harness}`,
          "--prompt",
          prompt,
          "--json",
          ...(tee ? ["--tee"] : []),
          "--",
          ...agentArgs,
        ],
        directory,
      );
      expect(result.status).toBe(0);
      expect(result.stderr).toBe("agent diagnostic\n");
      if (tee) expect(result.stdout.startsWith(output)).toBe(true);
      expect(JSON.parse(result.stdout.slice(tee ? output.length : 0))).toMatchObject({
        total_output: 2,
      });
    });
  }
});
