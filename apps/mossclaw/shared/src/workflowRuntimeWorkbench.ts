import type { WorkflowDefinitionDto, WorkflowGoalRefDto } from './workflowBuilder';
import type { WorkflowRunStatusDto } from './workflowRuntime';

export interface WorkflowRunListItemDto {
  runId: string;
  workflowId: string;
  workflowVersion: string;
  goal: WorkflowGoalRefDto;
  status: WorkflowRunStatusDto;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  currentNodeIds: string[];
  lastCompletedNodeIds: string[];
  failureCode?: string;
  failureMessage?: string;
}

export interface WorkflowRuntimeListRunsResponseDto {
  ok: true;
  runs: WorkflowRunListItemDto[];
}

export interface WorkflowRunDebugStateSnapshotDto {
  currentNodeIds: string[];
  completedNodeIds: string[];
  waitingNodeIds: string[];
  nodeStates: Record<string, unknown>;
  variables: Record<string, unknown>;
}

export interface WorkflowRunDebugDto {
  definitionSnapshot: WorkflowDefinitionDto;
  stateSnapshot: WorkflowRunDebugStateSnapshotDto;
}

export interface WorkflowRuntimeGetRunDebugResponseDto {
  ok: true;
  debug: WorkflowRunDebugDto;
}
