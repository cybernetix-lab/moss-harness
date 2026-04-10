import { MosscliFileStore } from "../store/file-store.js";

interface StatusCommandOptions {
  runId?: string;
}

export function executeStatusCommand(options: StatusCommandOptions): string {
  const store = new MosscliFileStore();
  const run = store.readRun(options.runId);
  const snapshot = store.readStageSnapshot(
    run.run_id,
    run.current_stage_sequence,
    run.current_stage,
  );

  return [
    `Run ID: ${run.run_id}`,
    `Goal: ${run.goal}`,
    `Status: ${run.status}`,
    `Current Stage: ${run.current_stage}`,
    `Selected Agent: ${snapshot.selected_agent}`,
    `Task ID: ${snapshot.task_id}`,
  ].join("\n");
}
