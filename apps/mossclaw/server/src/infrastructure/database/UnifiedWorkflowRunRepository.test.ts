import { afterEach, describe, expect, it } from 'vitest';
import { createStorage, DEFAULT_STORAGE_CONFIG } from '../../../../../../runtime/storage';
import type { IStorage } from '../../../../../../runtime/storage/types';
import { UnifiedWorkflowRunRepository } from './UnifiedWorkflowRunRepository';
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

describe('UnifiedWorkflowRunRepository', () => {
  it('persists workflow runs with definition snapshots and state snapshots', async () => {
    const storage = await createTestStorage();
    await ensureWorkflowRunTableShape(storage);
    const repository = new UnifiedWorkflowRunRepository(storage);

    await repository.create({
      runId: 'run-001',
      workflowId: 'wf-001',
      workflowVersion: 'v1',
      status: 'created',
      definitionSnapshot: {
        workflowId: 'wf-001',
        version: 'v1',
        goal: {
          title: 'Handle high risk order'
        },
        nodes: [],
        edges: []
      },
      stateSnapshot: {
        currentNodeIds: [],
        completedNodeIds: [],
        waitingNodeIds: [],
        nodeStates: {},
        variables: {}
      },
      startedAt: null,
      completedAt: null
    });

    await expect(repository.getById('run-001')).resolves.toMatchObject({
      runId: 'run-001',
      workflowId: 'wf-001',
      workflowVersion: 'v1',
      status: 'created',
      definitionSnapshot: {
        workflowId: 'wf-001',
        version: 'v1'
      },
      stateSnapshot: {
        currentNodeIds: [],
        completedNodeIds: [],
        waitingNodeIds: [],
        nodeStates: {},
        variables: {}
      }
    });
  });

  it('updates workflow run status and failure summary', async () => {
    const storage = await createTestStorage();
    await ensureWorkflowRunTableShape(storage);
    const repository = new UnifiedWorkflowRunRepository(storage);

    await repository.create({
      runId: 'run-002',
      workflowId: 'wf-002',
      workflowVersion: 'v1',
      status: 'running',
      definitionSnapshot: {
        workflowId: 'wf-002',
        version: 'v1',
        goal: {
          title: 'Review pending orders'
        },
        nodes: [],
        edges: []
      },
      stateSnapshot: {
        currentNodeIds: ['node-step-1'],
        completedNodeIds: [],
        waitingNodeIds: [],
        nodeStates: {},
        variables: {}
      },
      startedAt: '2026-04-29T11:00:00.000Z',
      completedAt: null
    });

    await repository.update({
      runId: 'run-002',
      workflowId: 'wf-002',
      workflowVersion: 'v1',
      status: 'failed',
      definitionSnapshot: {
        workflowId: 'wf-002',
        version: 'v1',
        goal: {
          title: 'Review pending orders'
        },
        nodes: [],
        edges: []
      },
      stateSnapshot: {
        currentNodeIds: [],
        completedNodeIds: [],
        waitingNodeIds: [],
        nodeStates: {},
        variables: {}
      },
      startedAt: '2026-04-29T11:00:00.000Z',
      completedAt: '2026-04-29T11:00:05.000Z',
      failureCode: 'STEP_TIMEOUT',
      failureMessage: 'Step timed out'
    });

    await expect(repository.getById('run-002')).resolves.toMatchObject({
      runId: 'run-002',
      status: 'failed',
      failureCode: 'STEP_TIMEOUT',
      failureMessage: 'Step timed out',
      completedAt: new Date('2026-04-29T11:00:05.000Z')
    });
  });
});
