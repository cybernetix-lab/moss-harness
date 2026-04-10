import { runProcess } from "../shared/process.js";
import { getScriptPath } from "../shared/runtime.js";

interface CreateTaskInput {
  lane: string;
  taskId: string;
  taskType: string;
  tags: string[];
  priority: string;
  runId: string;
  stage: string;
  flowSequence: number;
}

export class TaskBoardAdapter {
  createTask(input: CreateTaskInput): void {
    runProcess(getScriptPath("task-board.sh"), {
      args: [
        "create",
        "--lane",
        input.lane,
        "--task-id",
        input.taskId,
        "--task-type",
        input.taskType,
        "--tags",
        input.tags.join(","),
        "--priority",
        input.priority,
        "--run-id",
        input.runId,
        "--stage",
        input.stage,
        "--flow-sequence",
        String(input.flowSequence),
      ],
    });
  }
}
