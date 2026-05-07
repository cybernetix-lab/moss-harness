import type { WorkflowNodeDto } from '@mossclaw/shared';
import type { RuntimeExecutionKind, StepExecutor } from './types';

export class StepExecutorRegistry {
  private readonly executors = new Map<RuntimeExecutionKind, StepExecutor>();

  register(kind: RuntimeExecutionKind, executor: StepExecutor): void {
    this.executors.set(kind, executor);
  }

  resolve(node: WorkflowNodeDto): StepExecutor {
    const executor = this.executors.get(node.executionKind);
    if (!executor) {
      throw new Error(
        `UNSUPPORTED_EXECUTOR: No executor registered for execution kind "${node.executionKind}"`
      );
    }

    return executor;
  }
}
