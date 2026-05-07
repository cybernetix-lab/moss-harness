import type { IStorage } from '@agent-harness/core/storage/types';
import type {
  IWorkflowRunRepository,
  PersistedWorkflowRunRecord,
  WorkflowRunRecord
} from '../../domain/repositories/IWorkflowRunRepository';

export class UnifiedWorkflowRunRepository implements IWorkflowRunRepository {
  private readonly tableName = 'workflow_runs';

  constructor(private readonly storage: IStorage) {}

  async create(run: WorkflowRunRecord): Promise<void> {
    const timestamp = new Date().toISOString();

    await this.storage.query(this.tableName).insert({
      runId: run.runId,
      workflowId: run.workflowId,
      workflowVersion: run.workflowVersion,
      status: run.status,
      definitionSnapshot: JSON.stringify(run.definitionSnapshot),
      stateSnapshot: JSON.stringify(run.stateSnapshot),
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      failureCode: run.failureCode ?? null,
      failureMessage: run.failureMessage ?? null,
      createdAt: timestamp,
      updatedAt: timestamp
    });
  }

  async getById(runId: string): Promise<PersistedWorkflowRunRecord | null> {
    const row = await this.storage.query(this.tableName).where('runId', '=', runId).first();
    if (!row) {
      return null;
    }

    return {
      runId: String(row.runId),
      workflowId: String(row.workflowId),
      workflowVersion: String(row.workflowVersion),
      status: row.status as PersistedWorkflowRunRecord['status'],
      definitionSnapshot: this.parseJson(row.definitionSnapshot, {
        workflowId: '',
        version: 'v1',
        goal: { title: '' },
        nodes: [],
        edges: []
      }),
      stateSnapshot: this.parseJson(row.stateSnapshot, {
        currentNodeIds: [],
        completedNodeIds: [],
        waitingNodeIds: [],
        nodeStates: {},
        variables: {}
      }),
      startedAt: row.startedAt ? new Date(String(row.startedAt)) : null,
      completedAt: row.completedAt ? new Date(String(row.completedAt)) : null,
      failureCode: row.failureCode ? String(row.failureCode) : undefined,
      failureMessage: row.failureMessage ? String(row.failureMessage) : undefined,
      createdAt: new Date(String(row.createdAt)),
      updatedAt: new Date(String(row.updatedAt))
    };
  }

  async update(run: WorkflowRunRecord): Promise<void> {
    await this.storage
      .query(this.tableName)
      .where('runId', '=', run.runId)
      .update({
        workflowId: run.workflowId,
        workflowVersion: run.workflowVersion,
        status: run.status,
        definitionSnapshot: JSON.stringify(run.definitionSnapshot),
        stateSnapshot: JSON.stringify(run.stateSnapshot),
        startedAt: run.startedAt,
        completedAt: run.completedAt,
        failureCode: run.failureCode ?? null,
        failureMessage: run.failureMessage ?? null,
        updatedAt: new Date().toISOString()
      });
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
