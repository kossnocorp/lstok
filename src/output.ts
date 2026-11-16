import { spawn } from "node:child_process";

export async function printOutput(value: unknown, filter?: string, raw = false) {
  const json = JSON.stringify(value, null, 2) + "\n";
  if (filter === undefined) {
    process.stdout.write(json);
    return;
  }

  const child = spawn("jq", [...(raw ? ["--raw-output"] : []), "--", filter], {
    stdio: ["pipe", "inherit", "inherit"],
  });
  await new Promise<void>((resolve, reject) => {
    child.on("error", (error) => reject(new Error(`Could not start jq: ${error.message}`)));
    child.stdin.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code !== "EPIPE") reject(error);
    });
    child.on("close", (code, signal) => {
      if (signal) reject(new Error(`jq exited with ${signal}.`));
      else {
        process.exitCode = code ?? 1;
        resolve();
      }
    });
    child.stdin.end(json);
  });
}
