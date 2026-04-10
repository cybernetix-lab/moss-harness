import { FlowRunner } from "../core/flow-runner.js";

interface RunCommandOptions {
  goal: string;
}

export function executeRunCommand(options: RunCommandOptions): string {
  const runner = new FlowRunner();
  const { run } = runner.run(options);

  return JSON.stringify({
    run_id: run.run_id,
    status: run.status,
    current_stage: run.current_stage,
    task_id: run.task_id,
    selected_agent: run.selected_agent,
    request_id: run.request_id,
  });
}
