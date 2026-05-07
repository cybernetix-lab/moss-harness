import type { IStorage } from '@agent-harness/core/storage/types';
import type {
  IWorkflowExecutionLogRepository,
  WorkflowExecutionLogInput,
  WorkflowExecutionLogRecord
} from '../../domain/repositories/IWorkflowExecutionLogRepository';

export class UnifiedWorkflowExecutionLogRepository implements IWorkflowExecutionLogRepository {
  private readonly tableName = 'workflow_execution_logs';

  constructor(private readonly storage: IStorage) {}

  async append(log: WorkflowExecutionLogInput): Promise<void> {
    await this.storage.query(this.tableName).insert({
      logId: log.logId,
      runId: log.runId,
      nodeId: log.nodeId ?? null,
      eventType: log.eventType,
      payload: JSON.stringify(log.payload),
      createdAt: log.createdAt
    });
  }

  async findByRunId(runId: string): Promise<WorkflowExecutionLogRecord[]> {
    const rows = await this.storage.query(this.tableName).where('runId', '=', runId).get();

    return rows
      .map((row) => ({
        logId: String(row.logId),
        runId: String(row.runId),
        nodeId: row.nodeId ? String(row.nodeId) : undefined,
        eventType: row.eventType as WorkflowExecutionLogRecord['eventType'],
        payload: this.parseJson(row.payload, {}),
        createdAt: new Date(String(row.createdAt))
      }))
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime());
  }

  private parseJson<T>(value: unknown, fallback: T): T {
    if (value == null || value === '') {
      return fallback;
    }

    if (typeof value !== 'string') {
      return value as T;
    }

    try {
      return JSON.parse(value) as T;
    } catch {
      return fallback;
    }
  }
}
