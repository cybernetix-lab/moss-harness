import type { WorkflowDefinitionDto, WorkflowGoalRefDto } from './workflowBuilder';

export type WorkflowRunStatusDto =
  | 'created'
  | 'ready'
  | 'running'
  | 'waiting'
  | 'failed'
  | 'succeeded'
  | 'cancelled';

export type WorkflowStepExecutionStatusDto =
  | 'pending'
  | 'running'
  | 'waiting'
  | 'failed'
  | 'succeeded'
  | 'cancelled';

export type WorkflowRuntimeDiagnosticCodeDto =
  | 'INVALID_RUNTIME_REQUEST'
  | 'INVALID_RUN_TRANSITION'
  | 'POLICY_VIOLATION'
  | 'UNSUPPORTED_EXECUTOR'
  | 'STEP_INPUT_INVALID'
  | 'STEP_EXECUTION_FAILED'
  | 'STEP_TIMEOUT'
  | 'STEP_RETRY_EXHAUSTED'
  | 'RUN_CANCELLED'
  | 'RUN_RECOVERY_BLOCKED'
  | 'RUNTIME_INTERNAL_ERROR';

export type WorkflowRunLogEventTypeDto =
  | 'run_created'
  | 'run_started'
  | 'step_started'
  | 'step_waiting'
  | 'step_succeeded'
  | 'step_failed'
  | 'step_cancelled'
  | 'run_failed'
  | 'run_succeeded'
  | 'run_cancelled'
  | 'run_resumed';

export interface WorkflowObjectRefDto {
  objectType: string;
  objectId: string;
}

export interface WorkflowRuntimeDiagnosticDto {
  code: WorkflowRuntimeDiagnosticCodeDto;
  message: string;
  nodeId?: string;
  retryable?: boolean;
}

export interface WorkflowRuntimeContextDto {
  goal?: WorkflowGoalRefDto;
  objectRefs?: WorkflowObjectRefDto[];
  variables?: Record<string, unknown>;
}

export interface WorkflowRuntimeStartRunRequestDto {
  workflow: WorkflowDefinitionDto;
  context?: WorkflowRuntimeContextDto;
}

export interface WorkflowRuntimeResumeRunRequestDto {
  runId: string;
}

export interface WorkflowRuntimeCancelRunRequestDto {
  runId: string;
}

export interface WorkflowStepExecutionDto {
  nodeId: string;
  stepId: string;
  actionId: string;
  executionKind: 'tool_gateway' | 'subagent_task';
  status: WorkflowStepExecutionStatusDto;
  attempt: number;
  startedAt: string | null;
  completedAt: string | null;
  output?: Record<string, unknown>;
  errorCode?: string;
}

export interface WorkflowRunDto {
  runId: string;
  workflowId: string;
  workflowVersion: string;
  status: WorkflowRunStatusDto;
  startedAt: string | null;
  completedAt: string | null;
  currentNodeIds: string[];
  lastCompletedNodeIds: string[];
  failureCode?: string;
  failureMessage?: string;
  steps: WorkflowStepExecutionDto[];
}

export interface WorkflowRunLogDto {
  logId: string;
  runId: string;
  nodeId?: string;
  eventType: WorkflowRunLogEventTypeDto;
  timestamp: string;
  payload: Record<string, unknown>;
}

export interface WorkflowRuntimeRunResultDto {
  ok: boolean;
  accepted: boolean;
  run: WorkflowRunDto | null;
  diagnostics: WorkflowRuntimeDiagnosticDto[];
}

export interface WorkflowRuntimeGetRunLogsResponseDto {
  ok: true;
  logs: WorkflowRunLogDto[];
}
