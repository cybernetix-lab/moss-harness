import { v4 as uuidv4 } from 'uuid';
import type { IStorage } from '@agent-harness/core/storage/types';
import type { SubAgentTask } from '@agent-harness/core/subagent/types';
import type {
  RuntimeExecutionContext,
  RuntimeStep,
  RuntimeStepError,
  RuntimeWaitingHandle,
  SubagentTaskHandleResult
} from './types';

export class SubagentTaskHandleAdapter {
  constructor(
    private readonly storage: IStorage,
    private readonly scheduler: {
      schedule(task: SubAgentTask): Promise<string>;
    }
  ) {}

  async start(step: RuntimeStep, context: RuntimeExecutionContext): Promise<RuntimeWaitingHandle> {
    const childTaskId = uuidv4();
    const task: SubAgentTask = {
      id: childTaskId,
      agentName: step.executionTarget ?? step.actionId,
      prompt: step.title,
      context: {
        runId: context.runId,
        nodeId: step.nodeId,
        actionId: step.actionId,
        variables: context.variables
      },
      status: 'pending',
      priority: 'normal',
      createdAt: new Date(),
      metadata: {
        sessionId: 'workflow-runtime',
        workflowId: context.workflow.workflowId,
        iteration: 0,
        depth: 0,
        tags: ['workflow-runtime'],
        customData: {
          runId: context.runId,
          nodeId: step.nodeId
        }
      }
    };

    await this.scheduler.schedule(task);
    return { childTaskId };
  }

  async getStatus(childTaskId: string): Promise<SubagentTaskHandleResult> {
    const result = await this.storage.execute(
      'SELECT status, result, error FROM subagent_tasks WHERE id = ?',
      [childTaskId]
    );

    if (result.rows.length === 0) {
      return {
        status: 'failed',
        error: {
          code: 'STEP_EXECUTION_FAILED',
          message: `Child task "${childTaskId}" not found`
        }
      };
    }

    const row = result.rows[0];
    const status = String(row.status) as SubagentTaskHandleResult['status'];

    if (status === 'completed') {
      const parsedResult = parseJson(row.result);
      const output = isRecord(parsedResult?.structuredData)
        ? parsedResult.structuredData
        : isRecord(parsedResult)
          ? parsedResult
          : undefined;

      return {
        status,
        ...(output ? { output } : {})
      };
    }

    if (status === 'failed' || status === 'cancelled' || status === 'timeout') {
      const parsedError = parseJson(row.error);
      return {
        status,
        error: toRuntimeError(status, parsedError)
      };
    }

    return { status };
  }

  async cancel(childTaskId: string): Promise<void> {
    await this.storage.execute('UPDATE subagent_tasks SET status = ? WHERE id = ?', [
      'cancelled',
      childTaskId
    ]);
  }
}

function parseJson(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'string' || value.length === 0) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function toRuntimeError(
  status: SubagentTaskHandleResult['status'],
  parsedError?: Record<string, unknown>
): RuntimeStepError {
  if (status === 'cancelled') {
    return {
      code: 'RUN_CANCELLED',
      message: 'Child task was cancelled'
    };
  }

  if (status === 'timeout') {
    return {
      code: 'STEP_TIMEOUT',
      message:
        typeof parsedError?.message === 'string' ? parsedError.message : 'Child task timed out',
      retryable: true
    };
  }

  return {
    code:
      typeof parsedError?.code === 'string' ? parsedError.code : 'STEP_EXECUTION_FAILED',
    message:
      typeof parsedError?.message === 'string' ? parsedError.message : 'Child task failed'
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
