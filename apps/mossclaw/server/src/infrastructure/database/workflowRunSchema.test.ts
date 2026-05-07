import { afterEach, describe, expect, it } from 'vitest';
import { createStorage, DEFAULT_STORAGE_CONFIG } from '../../../../../../runtime/storage';
import type { IStorage } from '../../../../../../runtime/storage/types';
import { ensureWorkflowRunTableShape } from './workflowRunSchema';

const openedStorages: IStorage[] = [];

async function createTestStorage(): Promise<IStorage> {
  const storage = await createStorage({
    ...DEFAULT_STORAGE_CONFIG,
    backend: 'memory',
    connection: {
      filepath: ':memory:'
    }
  });

  openedStorages.push(storage);
  return storage;
}

afterEach(async () => {
  while (openedStorages.length > 0) {
    await openedStorages.pop()?.close();
  }
});

describe('ensureWorkflowRunTableShape', () => {
  it('幂等创建 workflow_runs 和 workflow_execution_logs 表', async () => {
    const storage = await createTestStorage();

    await ensureWorkflowRunTableShape(storage);
    await ensureWorkflowRunTableShape(storage);

    await expect(
      storage.execute(
        `INSERT INTO workflow_runs (
          runId, workflowId, workflowVersion, status, definitionSnapshot, stateSnapshot, startedAt, completedAt, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          'run-001',
          'wf-001',
          'v1',
          'created',
          JSON.stringify({ workflowId: 'wf-001', version: 'v1', goal: { title: 'Handle order' }, nodes: [], edges: [] }),
          JSON.stringify({ currentNodeIds: [], completedNodeIds: [], waitingNodeIds: [], nodeStates: {}, variables: {} }),
          null,
          null,
          '2026-04-29T11:00:00.000Z',
          '2026-04-29T11:00:00.000Z'
        ]
      )
    ).resolves.toBeDefined();

    await expect(
      storage.execute(
        `INSERT INTO workflow_execution_logs (
          logId, runId, nodeId, eventType, payload, createdAt
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          'log-001',
          'run-001',
          'node-step-1',
          'run_created',
          JSON.stringify({ status: 'created' }),
          '2026-04-29T11:00:00.000Z'
        ]
      )
    ).resolves.toBeDefined();

    const runRows = await storage.query('workflow_runs').get();
    const logRows = await storage.query('workflow_execution_logs').get();

    expect(runRows).toHaveLength(1);
    expect(logRows).toHaveLength(1);
  });
});
