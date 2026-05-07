import { afterEach, describe, expect, it } from 'vitest';
import { createStorage, DEFAULT_STORAGE_CONFIG } from '../../../../../../runtime/storage';
import type { IStorage } from '../../../../../../runtime/storage/types';
import { UnifiedWorkflowExecutionLogRepository } from './UnifiedWorkflowExecutionLogRepository';
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

describe('UnifiedWorkflowExecutionLogRepository', () => {
  it('appends logs and reads them back in creation order', async () => {
    const storage = await createTestStorage();
    await ensureWorkflowRunTableShape(storage);
    await storage.execute(
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
    );

    const repository = new UnifiedWorkflowExecutionLogRepository(storage);

    await repository.append({
      logId: 'log-001',
      runId: 'run-001',
      eventType: 'run_created',
      payload: {
        status: 'created'
      },
      createdAt: '2026-04-29T11:00:00.000Z'
    });
    await repository.append({
      logId: 'log-002',
      runId: 'run-001',
      nodeId: 'node-step-1',
      eventType: 'step_started',
      payload: {
        attempt: 1
      },
      createdAt: '2026-04-29T11:00:01.000Z'
    });

    await expect(repository.findByRunId('run-001')).resolves.toEqual([
      {
        logId: 'log-001',
        runId: 'run-001',
        nodeId: undefined,
        eventType: 'run_created',
        payload: {
          status: 'created'
        },
        createdAt: new Date('2026-04-29T11:00:00.000Z')
      },
      {
        logId: 'log-002',
        runId: 'run-001',
        nodeId: 'node-step-1',
        eventType: 'step_started',
        payload: {
          attempt: 1
        },
        createdAt: new Date('2026-04-29T11:00:01.000Z')
      }
    ]);
  });
});
