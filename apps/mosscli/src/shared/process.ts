import { spawnSync } from "node:child_process";

import { getProjectRoot } from "./runtime.js";

interface RunProcessOptions {
  args: string[];
}

export function runProcess(command: string, options: RunProcessOptions): string {
  const result = spawnSync(command, options.args, {
    cwd: getProjectRoot(),
    env: process.env,
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const stderr = result.stderr.trim();
    const stdout = result.stdout.trim();
    const detail = stderr || stdout || `${command} exited with status ${String(result.status)}`;
    throw new Error(detail);
  }

  return result.stdout.trim();
}
