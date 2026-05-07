import type {
  WorkflowDefinitionDto,
  WorkflowNodeDto,
  WorkflowObjectRefDto,
  WorkflowRunStatusDto
} from '@mossclaw/shared';
import type { WorkflowExecutionLogInput } from '../../domain/repositories/IWorkflowExecutionLogRepository';
import type { WorkflowRunRecord, WorkflowRunStateSnapshot } from '../../domain/repositories/IWorkflowRunRepository';

export type RuntimeStep = WorkflowNodeDto;
export type RuntimeExecutionKind = WorkflowNodeDto['executionKind'];

export interface RuntimeStepError {
  code: string;
  message: string;
  retryable?: boolean;
}

export interface RuntimeWaitingHandle {
  childTaskId: string;
}

export type SubagentTaskHandleStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'timeout';

export interface SubagentTaskHandleResult {
  status: SubagentTaskHandleStatus;
  output?: Record<string, unknown>;
  error?: RuntimeStepError;
}

export interface RuntimeNodeState {
  retryCount: number;
  output?: Record<string, unknown>;
  lastError?: RuntimeStepError;
  waitingHandle?: RuntimeWaitingHandle;
}

export interface RuntimeExecutionContext {
  runId: string;
  workflow: WorkflowDefinitionDto;
  stateSnapshot: WorkflowRunStateSnapshot;
  objectRefs: WorkflowObjectRefDto[];
  variables: Record<string, unknown>;
}

export type RuntimeStepResult =
  | {
      status: 'succeeded';
      output?: Record<string, unknown>;
      logs?: WorkflowExecutionLogInput[];
    }
  | {
      status: 'waiting';
      handle: RuntimeWaitingHandle;
      logs?: WorkflowExecutionLogInput[];
    }
  | {
      status: 'failed';
      error: RuntimeStepError;
      logs?: WorkflowExecutionLogInput[];
    };

export interface StepExecutor {
  execute(step: RuntimeStep, context: RuntimeExecutionContext): Promise<RuntimeStepResult>;
}

export interface ExecutionTickResult {
  run: WorkflowRunRecord;
  status: WorkflowRunStatusDto;
  stateSnapshot: WorkflowRunStateSnapshot;
  logs: WorkflowExecutionLogInput[];
}
