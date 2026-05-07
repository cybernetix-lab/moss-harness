import type { WorkflowDefinitionDto, WorkflowRunStatusDto } from '@mossclaw/shared';

export interface WorkflowRunStateSnapshot {
  currentNodeIds: string[];
  completedNodeIds: string[];
  waitingNodeIds: string[];
  nodeStates: Record<string, unknown>;
  variables: Record<string, unknown>;
}

export interface WorkflowRunRecord {
  runId: string;
  workflowId: string;
  workflowVersion: string;
  status: WorkflowRunStatusDto;
  definitionSnapshot: WorkflowDefinitionDto;
  stateSnapshot: WorkflowRunStateSnapshot;
  startedAt: string | null;
  completedAt: string | null;
  failureCode?: string;
  failureMessage?: string;
}

export interface PersistedWorkflowRunRecord extends Omit<WorkflowRunRecord, 'startedAt' | 'completedAt'> {
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWorkflowRunRepository {
  create(run: WorkflowRunRecord): Promise<void>;
  getById(runId: string): Promise<PersistedWorkflowRunRecord | null>;
  update(run: WorkflowRunRecord): Promise<void>;
}
