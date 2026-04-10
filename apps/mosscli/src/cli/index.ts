#!/usr/bin/env node

import { executeRunCommand } from "../commands/run.js";
import { executeTraceCommand } from "../commands/trace.js";
import { executeEvaluateCommand } from "../commands/evaluate.js";
import { executeServeCommand } from "../commands/serve.js";
import { executeStatusCommand } from "../commands/status.js";

const COMMANDS = ["run", "status", "trace", "evaluate", "serve"] as const;
type CommandName = (typeof COMMANDS)[number];

function renderCommandHelp(command: CommandName) {
  const descriptions: Record<CommandName, string> = {
    run: "Create a new mosscli flow run and bootstrap the first planner stage.",
    status: "Show the current state of a mosscli run from the runtime snapshot.",
    trace: "Output the execution tracing timeline for one run based on the fact chain.",
    evaluate: "Render an evaluation and analytics report for a moss-harness run.",
    serve: "Start the read-only Mosscli web panel.",
  };

  const usageLines: Record<CommandName, string[]> = {
    run: ["  mosscli run --goal <goal>", "  mosscli run --help"],
    status: ["  mosscli status [--run-id <run_id>]", "  mosscli status --help"],
    trace: ["  mosscli trace --run-id <run_id>", "  mosscli trace --help"],
    evaluate: ["  mosscli evaluate --run-id <run_id> [--format <md|json>]", "  mosscli evaluate --help"],
    serve: ["  mosscli serve [--port <port>]", "  mosscli serve --help"],
  };

  return [
    `mosscli ${command}`,
    "",
    descriptions[command],
    "",
    "Usage:",
    ...usageLines[command],
  ].join("\n");
}

function renderHelp() {
  const commandList = COMMANDS.map((command) => `  ${command}`).join("\n");

  return [
    "mosscli",
    "",
    "Minimal MVP CLI for validating the Agent Harness closed loop.",
    "",
    "Usage:",
    "  mosscli <command>",
    "  mosscli --help",
    "",
    "Commands:",
    commandList,
  ].join("\n");
}

function isCommandName(value: string): value is CommandName {
  return COMMANDS.includes(value as CommandName);
}

function readOptionValue(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  if (index === -1) {
    return undefined;
  }

  const value = args[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`Option ${name} requires a value.`);
  }

  return value;
}

function runCommand(args: string[]) {
  const goal = readOptionValue(args, "--goal") ?? "Untitled Mosscli run";
  process.stdout.write(`${executeRunCommand({ goal })}\n`);
  return 0;
}

function statusCommand(args: string[]) {
  const runId = readOptionValue(args, "--run-id");
  process.stdout.write(`${executeStatusCommand({ runId })}\n`);
  return 0;
}

function traceCommand(args: string[]) {
  const runId = readOptionValue(args, "--run-id");
  if (!runId) {
    throw new Error("Option --run-id requires a value.");
  }

  process.stdout.write(`${executeTraceCommand({ runId })}\n`);
  return 0;
}

function evaluateCommand(args: string[]) {
  const runId = readOptionValue(args, "--run-id");
  if (!runId) {
    throw new Error("Option --run-id requires a value.");
  }

  const formatValue = readOptionValue(args, "--format") ?? "md";
  if (formatValue !== "md" && formatValue !== "json") {
    throw new Error("Option --format must be either md or json.");
  }

  process.stdout.write(`${executeEvaluateCommand({ runId, format: formatValue })}\n`);
  return 0;
}

async function serveCommand(args: string[]) {
  const portValue = readOptionValue(args, "--port") ?? "4310";
  const port = Number.parseInt(portValue, 10);
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("Option --port must be a positive integer.");
  }

  await executeServeCommand({ port });
  return 0;
}

async function main(argv: string[]) {
  const args = argv.slice(2);
  const firstArg = args[0];
  const secondArg = args[1];

  if (firstArg === undefined || firstArg === "--help" || firstArg === "-h") {
    process.stdout.write(`${renderHelp()}\n`);
    return 0;
  }

  if (isCommandName(firstArg)) {
    if (secondArg === "--help" || secondArg === "-h") {
      process.stdout.write(`${renderCommandHelp(firstArg)}\n`);
      return 0;
    }

    try {
      if (firstArg === "run") {
        return runCommand(args.slice(1));
      }

      if (firstArg === "status") {
        return statusCommand(args.slice(1));
      }

      if (firstArg === "trace") {
        return traceCommand(args.slice(1));
      }

      if (firstArg === "evaluate") {
        return evaluateCommand(args.slice(1));
      }

      if (firstArg === "serve") {
        return await serveCommand(args.slice(1));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      process.stderr.write(`mosscli: ${message}\n`);
      return 1;
    }

    process.stdout.write(
      `mosscli: command "${firstArg}" is not implemented in MVP Task 1.\n`,
    );
    return 0;
  }

  process.stderr.write(`mosscli: unknown command "${firstArg}".\n`);
  process.stderr.write('Run "mosscli --help" to see available commands.\n');
  return 1;
}

main(process.argv)
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`mosscli: ${message}\n`);
    process.exitCode = 1;
  });
