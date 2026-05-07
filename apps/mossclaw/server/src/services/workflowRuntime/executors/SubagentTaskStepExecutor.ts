import { SubagentTaskHandleAdapter } from '../SubagentTaskHandleAdapter';
import type {
  RuntimeExecutionContext,
  RuntimeStep,
  RuntimeStepResult,
  RuntimeWaitingHandle,
  SubagentTaskHandleResult
} from '../types';

export class SubagentTaskStepExecutor {
  constructor(private readonly handleAdapter: Pick<SubagentTaskHandleAdapter, 'start' | 'getStatus'>) {}

  async execute(step: RuntimeStep, context: RuntimeExecutionContext): Promise<RuntimeStepResult> {
    const existingHandle = this.getExistingHandle(step.nodeId, context);
    if (!existingHandle) {
      const handle = await this.handleAdapter.start(step, context);
      return {
        status: 'waiting',
        handle
      };
    }

    const handleStatus = await this.handleAdapter.getStatus(existingHandle.childTaskId);
    return this.mapHandleResult(existingHandle, handleStatus);
  }

  private getExistingHandle(
    nodeId: string,
    context: RuntimeExecutionContext
  ): RuntimeWaitingHandle | undefined {
    const rawNodeState = context.stateSnapshot.nodeStates[nodeId];
    if (!isRecord(rawNodeState) || !isRecord(rawNodeState.waitingHandle)) {
      return undefined;
    }

    return typeof rawNodeState.waitingHandle.childTaskId === 'string'
      ? { childTaskId: rawNodeState.waitingHandle.childTaskId }
      : undefined;
  }

  private mapHandleResult(
    handle: RuntimeWaitingHandle,
    result: SubagentTaskHandleResult
  ): RuntimeStepResult {
    if (result.status === 'completed') {
      return {
        status: 'succeeded',
        output: result.output ?? {}
      };
    }

    if (result.status === 'failed' || result.status === 'cancelled' || result.status === 'timeout') {
      return {
        status: 'failed',
        error:
          result.error ?? {
            code: 'STEP_EXECUTION_FAILED',
            message: `Child task ended in status "${result.status}"`
          }
      };
    }

    return {
      status: 'waiting',
      handle
    };
  }
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null;
}
