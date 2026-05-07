import { describe, expect, it, vi } from 'vitest';
import type { RuntimeExecutionContext } from '../types';
import { SubagentTaskStepExecutor } from './SubagentTaskStepExecutor';

describe('SubagentTaskStepExecutor', () => {
  it('starts a child task and returns waiting when no handle exists yet', async () => {
    const adapter = {
      start: vi.fn().mockResolvedValue({ childTaskId: 'child-task-001' }),
      getStatus: vi.fn(),
      cancel: vi.fn()
    };
    const executor = new SubagentTaskStepExecutor(adapter as never);

    const result = await executor.execute(
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
      } satisfies RuntimeExecutionContext
    );

    expect(result).toEqual({
      status: 'waiting',
      handle: {
        childTaskId: 'child-task-001'
      }
    });
    expect(adapter.start).toHaveBeenCalledTimes(1);
    expect(adapter.getStatus).not.toHaveBeenCalled();
  });

  it('returns succeeded when an existing child task handle completes', async () => {
    const adapter = {
      start: vi.fn(),
      getStatus: vi.fn().mockResolvedValue({
        status: 'completed',
        output: {
          summary: 'done'
        }
      }),
      cancel: vi.fn()
    };
    const executor = new SubagentTaskStepExecutor(adapter as never);

    const result = await executor.execute(
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
          currentNodeIds: ['node-1'],
          completedNodeIds: [],
          waitingNodeIds: ['node-1'],
          nodeStates: {
            'node-1': {
              retryCount: 0,
              waitingHandle: {
                childTaskId: 'child-task-001'
              }
            }
          },
          variables: {}
        },
        objectRefs: [],
        variables: {}
      } satisfies RuntimeExecutionContext
    );

    expect(result).toEqual({
      status: 'succeeded',
      output: {
        summary: 'done'
      }
    });
    expect(adapter.getStatus).toHaveBeenCalledWith('child-task-001');
    expect(adapter.start).not.toHaveBeenCalled();
  });

  it('returns failed when an existing child task handle fails', async () => {
    const adapter = {
      start: vi.fn(),
      getStatus: vi.fn().mockResolvedValue({
        status: 'failed',
        error: {
          code: 'STEP_EXECUTION_FAILED',
          message: 'child task failed'
        }
      }),
      cancel: vi.fn()
    };
    const executor = new SubagentTaskStepExecutor(adapter as never);

    const result = await executor.execute(
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
          currentNodeIds: ['node-1'],
          completedNodeIds: [],
          waitingNodeIds: ['node-1'],
          nodeStates: {
            'node-1': {
              retryCount: 0,
              waitingHandle: {
                childTaskId: 'child-task-001'
              }
            }
          },
          variables: {}
        },
        objectRefs: [],
        variables: {}
      } satisfies RuntimeExecutionContext
    );

    expect(result).toEqual({
      status: 'failed',
      error: {
        code: 'STEP_EXECUTION_FAILED',
        message: 'child task failed'
      }
    });
  });
});
