import type { ClaimResult } from "../model/run.js";
import { runProcess } from "../shared/process.js";
import { getScriptPath } from "../shared/runtime.js";

interface ClaimTaskInput {
  lane: string;
  taskId: string;
  runId: string;
  stage: string;
  flowSequence: number;
}

export class ClaimEngineAdapter {
  claimTask(input: ClaimTaskInput): ClaimResult {
    const output = runProcess(getScriptPath("claim-engine.sh"), {
      args: [
        "claim",
        "--lane",
        input.lane,
        "--task-id",
        input.taskId,
        "--run-id",
        input.runId,
        "--stage",
        input.stage,
        "--flow-sequence",
        String(input.flowSequence),
      ],
    });

    return JSON.parse(output) as ClaimResult;
  }
}
