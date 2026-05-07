import { describe, expect, it, vi } from 'vitest';
import type {
  PersistedWorkflowRunRecord,
  WorkflowRunRecord
} from '../../domain/repositories/IWorkflowRunRepository';
import type { WorkflowExecutionLogRecord } from '../../domain/repositories/IWorkflowExecutionLogRepository';
import { WorkflowRuntimeBoundary } from './WorkflowRuntimeBoundary';
import { WorkflowRuntimeService } from './WorkflowRuntimeService';

function createRunRecord(overrides: Partial<WorkflowRunRecord> = {}): WorkflowRunRecord {
  return {
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
      nodes: [
        {
          nodeId: 'node-1',
          stepId: 'step-1',
          actionId: 'ontology.query',
          title: 'Find orders',
          executionKind: 'tool_gateway'
        }
      ],
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
    completedAt: null,
    ...overrides
  };
}

function toPersistedRun(record: WorkflowRunRecord): PersistedWorkflowRunRecord {
  return {
    ...record,
    startedAt: record.startedAt ? new Date(record.startedAt) : null,
    completedAt: record.completedAt ? new Date(record.completedAt) : null,
    createdAt: new Date('2026-04-29T11:00:00.000Z'),
    updatedAt: new Date('2026-04-29T11:00:00.000Z')
  };
}

function createLogRecord(overrides: Partial<WorkflowExecutionLogRecord> = {}): WorkflowExecutionLogRecord {
  return {
    logId: 'log-001',
    runId: 'run-001',
    eventType: 'run_created',
    payload: {
      status: 'created'
    },
    createdAt: new Date('2026-04-29T11:00:00.000Z'),
    ...overrides
  };
}

describe('WorkflowRuntimeService', () => {
  it('starts a run, advances execution once, and returns the current run snapshot', async () => {
    const boundary = new WorkflowRuntimeBoundary();
    const createdRun = createRunRecord();
    const tickedRun = createRunRecord({
      status: 'succeeded',
      startedAt: '2026-04-29T11:00:00.000Z',
      completedAt: '2026-04-29T11:00:01.000Z',
      stateSnapshot: {
        currentNodeIds: [],
        completedNodeIds: ['node-1'],
        waitingNodeIds: [],
        nodeStates: {
          'node-1': {
            retryCount: 0,
            output: {
              objectIds: ['order-001']
            }
          }
        },
        variables: {}
      }
    });
    const runRepository = {
      create: vi.fn().mockResolvedValue(undefined),
      getById: vi.fn(),
      update: vi.fn().mockResolvedValue(undefined)
    };
    const logRepository = {
      append: vi.fn().mockResolvedValue(undefined),
      findByRunId: vi.fn()
    };
    const engine = {
      tick: vi.fn().mockResolvedValue({
        run: tickedRun,
        status: 'succeeded',
        stateSnapshot: tickedRun.stateSnapshot,
        logs: [
          {
            logId: 'log-step-1',
            runId: 'run-001',
            nodeId: 'node-1',
            eventType: 'step_succeeded',
            payload: {
              output: {
                objectIds: ['order-001']
              }
            },
            createdAt: '2026-04-29T11:00:01.000Z'
          }
        ]
      })
    };
    const service = new WorkflowRuntimeService(
      runRepository as never,
      logRepository as never,
      engine as never,
      boundary,
      () => 'run-001'
    );

    const result = await service.startRun({
      workflow: createdRun.definitionSnapshot
    });

    expect(result).toEqual({
      ok: true,
      accepted: true,
      run: {
        runId: 'run-001',
        workflowId: 'wf-001',
        workflowVersion: 'v1',
        status: 'succeeded',
        startedAt: '2026-04-29T11:00:00.000Z',
        completedAt: '2026-04-29T11:00:01.000Z',
        currentNodeIds: [],
        lastCompletedNodeIds: ['node-1'],
        steps: [
          {
            nodeId: 'node-1',
            stepId: 'step-1',
            actionId: 'ontology.query',
            executionKind: 'tool_gateway',
            status: 'succeeded',
            attempt: 1,
            startedAt: null,
            completedAt: '2026-04-29T11:00:01.000Z',
            output: {
              objectIds: ['order-001']
            }
          }
        ]
      },
      diagnostics: []
    });
    expect(runRepository.create).toHaveBeenCalledWith(createdRun);
    expect(logRepository.append).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-001',
        eventType: 'run_created'
      })
    );
    expect(runRepository.update).toHaveBeenCalledWith(tickedRun);
  });

  it('resumes a waiting run and reuses persisted snapshot state', async () => {
    const persistedRun = toPersistedRun(
      createRunRecord({
        status: 'waiting',
        startedAt: '2026-04-29T11:00:00.000Z',
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
        }
      })
    );
    const resumedRun = createRunRecord({
      status: 'succeeded',
      startedAt: '2026-04-29T11:00:00.000Z',
      completedAt: '2026-04-29T11:00:05.000Z',
      stateSnapshot: {
        currentNodeIds: [],
        completedNodeIds: ['node-1'],
        waitingNodeIds: [],
        nodeStates: {
          'node-1': {
            retryCount: 0,
            output: {
              summary: 'done'
            }
          }
        },
        variables: {}
      }
    });
    const runRepository = {
      create: vi.fn(),
      getById: vi.fn().mockResolvedValue(persistedRun),
      update: vi.fn().mockResolvedValue(undefined)
    };
    const logRepository = {
      append: vi.fn().mockResolvedValue(undefined),
      findByRunId: vi.fn()
    };
    const engine = {
      tick: vi.fn().mockResolvedValue({
        run: resumedRun,
        status: 'succeeded',
        stateSnapshot: resumedRun.stateSnapshot,
        logs: []
      })
    };
    const service = new WorkflowRuntimeService(
      runRepository as never,
      logRepository as never,
      engine as never,
      new WorkflowRuntimeBoundary()
    );

    const result = await service.resumeRun('run-001');

    expect(result.accepted).toBe(true);
    expect(result.run?.status).toBe('succeeded');
    expect(engine.tick).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-001',
        status: 'waiting',
        stateSnapshot: persistedRun.stateSnapshot
      })
    );
    expect(logRepository.append).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-001',
        eventType: 'run_resumed'
      })
    );
  });

  it('cancels an active run and leaves a run_cancelled log', async () => {
    const persistedRun = toPersistedRun(
      createRunRecord({
        status: 'running',
        startedAt: '2026-04-29T11:00:00.000Z'
      })
    );
    const runRepository = {
      create: vi.fn(),
      getById: vi.fn().mockResolvedValue(persistedRun),
      update: vi.fn().mockResolvedValue(undefined)
    };
    const logRepository = {
      append: vi.fn().mockResolvedValue(undefined),
      findByRunId: vi.fn()
    };
    const engine = {
      tick: vi.fn()
    };
    const service = new WorkflowRuntimeService(
      runRepository as never,
      logRepository as never,
      engine as never,
      new WorkflowRuntimeBoundary()
    );

    const result = await service.cancelRun('run-001');

    expect(result.accepted).toBe(true);
    expect(result.run?.status).toBe('cancelled');
    expect(result.run?.completedAt).not.toBeNull();
    expect(logRepository.append).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-001',
        eventType: 'run_cancelled'
      })
    );
    expect(engine.tick).not.toHaveBeenCalled();
  });

  it('returns the mapped run snapshot and ordered run logs', async () => {
    const persistedRun = toPersistedRun(
      createRunRecord({
        status: 'failed',
        startedAt: '2026-04-29T11:00:00.000Z',
        completedAt: '2026-04-29T11:00:02.000Z',
        failureCode: 'STEP_TIMEOUT',
        failureMessage: 'executor timed out'
      })
    );
    const runRepository = {
      create: vi.fn(),
      getById: vi.fn().mockResolvedValue(persistedRun),
      update: vi.fn()
    };
    const logRepository = {
      append: vi.fn(),
      findByRunId: vi.fn().mockResolvedValue([
        createLogRecord(),
        createLogRecord({
          logId: 'log-002',
          nodeId: 'node-1',
          eventType: 'step_failed',
          payload: {
            errorCode: 'STEP_TIMEOUT'
          },
          createdAt: new Date('2026-04-29T11:00:02.000Z')
        })
      ])
    };
    const service = new WorkflowRuntimeService(
      runRepository as never,
      logRepository as never,
      { tick: vi.fn() } as never,
      new WorkflowRuntimeBoundary()
    );

    await expect(service.getRun('run-001')).resolves.toMatchObject({
      ok: true,
      accepted: true,
      run: {
        runId: 'run-001',
        status: 'failed',
        failureCode: 'STEP_TIMEOUT',
        failureMessage: 'executor timed out'
      }
    });

    await expect(service.getRunLogs('run-001')).resolves.toEqual({
      ok: true,
      logs: [
        {
          logId: 'log-001',
          runId: 'run-001',
          eventType: 'run_created',
          timestamp: '2026-04-29T11:00:00.000Z',
          payload: {
            status: 'created'
          }
        },
        {
          logId: 'log-002',
          runId: 'run-001',
          nodeId: 'node-1',
          eventType: 'step_failed',
          timestamp: '2026-04-29T11:00:02.000Z',
          payload: {
            errorCode: 'STEP_TIMEOUT'
          }
        }
      ]
    });
  });

  it('returns structured diagnostics when resume is rejected by run status', async () => {
    const runRepository = {
      create: vi.fn(),
      getById: vi.fn().mockResolvedValue(
        toPersistedRun(
          createRunRecord({
            status: 'succeeded',
            startedAt: '2026-04-29T11:00:00.000Z',
            completedAt: '2026-04-29T11:00:01.000Z'
          })
        )
      ),
      update: vi.fn()
    };
    const service = new WorkflowRuntimeService(
      runRepository as never,
      {
        append: vi.fn(),
        findByRunId: vi.fn()
      } as never,
      { tick: vi.fn() } as never,
      new WorkflowRuntimeBoundary()
    );

    await expect(service.resumeRun('run-001')).resolves.toEqual({
      ok: true,
      accepted: false,
      run: null,
      diagnostics: [
        {
          code: 'INVALID_RUN_TRANSITION',
          message: 'Cannot resume workflow run from status "succeeded"'
        }
      ]
    });
  });
});
