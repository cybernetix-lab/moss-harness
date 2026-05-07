import { describe, expect, it, vi } from 'vitest';
import type { IStorage } from '@agent-harness/core/storage/types';
import { SubagentTaskHandleAdapter } from './SubagentTaskHandleAdapter';

describe('SubagentTaskHandleAdapter', () => {
  it('creates a persistent child task handle and schedules the task', async () => {
    const scheduler = {
      schedule: vi.fn().mockResolvedValue('child-task-001')
    };
    const storage = {
      execute: vi.fn()
    };
    const adapter = new SubagentTaskHandleAdapter(storage as never, scheduler as never);

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
        variables: {
          severity: 'high'
        }
      }
    );

    expect(handle.childTaskId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(scheduler.schedule).toHaveBeenCalledTimes(1);
    expect(scheduler.schedule.mock.calls[0][0]).toMatchObject({
      id: handle.childTaskId,
      agentName: 'researcher',
      prompt: 'Delegate work',
      context: {
        runId: 'run-001',
        nodeId: 'node-1',
        actionId: 'delegate.agent',
        variables: {
          severity: 'high'
        }
      },
      status: 'pending'
    });
  });

  it('reads child task status and completed result from storage', async () => {
    const storage = {
      execute: vi.fn().mockResolvedValue({
        rows: [
          {
            status: 'completed',
            result: JSON.stringify({
              structuredData: {
                summary: 'done'
              }
            }),
            error: null
          }
        ],
        rowCount: 1,
        command: 'SELECT'
      })
    };
    const adapter = new SubagentTaskHandleAdapter(storage as never, {
      schedule: vi.fn()
    } as never);

    await expect(adapter.getStatus('child-task-001')).resolves.toEqual({
      status: 'completed',
      output: {
        summary: 'done'
      }
    });
  });

  it('cancels the child task by updating persisted status', async () => {
    const storage = {
      execute: vi.fn().mockResolvedValue({
        rows: [],
        rowCount: 1,
        command: 'UPDATE'
      })
    };
    const adapter = new SubagentTaskHandleAdapter(storage as never, {
      schedule: vi.fn()
    } as never);

    await adapter.cancel('child-task-001');

    expect(storage.execute).toHaveBeenCalledWith(
      'UPDATE subagent_tasks SET status = ? WHERE id = ?',
      ['cancelled', 'child-task-001']
    );
  });
});
