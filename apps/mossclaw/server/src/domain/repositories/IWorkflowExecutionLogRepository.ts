import type { WorkflowRunLogEventTypeDto } from '@mossclaw/shared';

export interface WorkflowExecutionLogRecord {
  logId: string;
  runId: string;
  nodeId?: string;
  eventType: WorkflowRunLogEventTypeDto;
  payload: Record<string, unknown>;
  createdAt: Date;
}

export interface WorkflowExecutionLogInput extends Omit<WorkflowExecutionLogRecord, 'createdAt'> {
  createdAt: string;
}

export interface IWorkflowExecutionLogRepository {
  append(log: WorkflowExecutionLogInput): Promise<void>;
  findByRunId(runId: string): Promise<WorkflowExecutionLogRecord[]>;
}
