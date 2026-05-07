import { afterEach, describe, expect, it } from 'vitest';
import { createStorage, DEFAULT_STORAGE_CONFIG } from '../../../../../../runtime/storage';
import type { IStorage } from '../../../../../../runtime/storage/types';
import { TaskScheduler } from '../../../../../../runtime/subagent';
import { SubagentTaskHandleAdapter } from './SubagentTaskHandleAdapter';

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

describe('SubagentTaskHandleAdapter integration', () => {
  it('drives a child task from start to completed through the real scheduler', async () => {
    const storage = await createTestStorage();
    const scheduler = new TaskScheduler(storage, 1);
    await scheduler.initialize();
    await scheduler.start();
    const adapter = new SubagentTaskHandleAdapter(storage, scheduler);

    const handle = await adapter.start(
      {
        nodeId: 'node-1',
        stepId: 'step-1',
        actionId: 'delegate.agent',
        title: 'Delegate work',
        executionKind: 'subagent_task',
        executionTarget: 'researcher'
      },
      {
        runId: 'run-001',
        workflow: {
          workflowId: 'wf-001',
          version: 'v1',
          goal: { title: 'Handle high risk order' },
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
        objectRefs: [],
        variables: {}
      }
    );

    await sleep(1200);

    await expect(adapter.getStatus(handle.childTaskId)).resolves.toMatchObject({
      status: 'completed'
    });
  }, 5000);
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
