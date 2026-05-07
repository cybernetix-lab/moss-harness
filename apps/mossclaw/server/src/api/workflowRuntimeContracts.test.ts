import { describe, expectTypeOf, it } from 'vitest';
import type {
  WorkflowRuntimeGetRunDebugResponseDto,
  WorkflowRunDto,
  WorkflowRunDebugDto,
  WorkflowRunDebugStateSnapshotDto,
  WorkflowRunListItemDto,
  WorkflowRuntimeDiagnosticDto,
  WorkflowRuntimeGetRunLogsResponseDto,
  WorkflowRuntimeListRunsResponseDto,
  WorkflowRuntimeRunResultDto,
  WorkflowRuntimeStartRunRequestDto,
  WorkflowRunLogDto,
  WorkflowStepExecutionDto
} from '@mossclaw/shared';

describe('workflow runtime shared contracts', () => {
  it('暴露稳定的 workflow runtime dto 契约', () => {
    const request: WorkflowRuntimeStartRunRequestDto = {
      workflow: {
        workflowId: 'wf-001',
        version: 'v1',
        goal: {
          title: 'Handle high risk order',
          objective: '处理高风险订单'
        },
        nodes: [],
        edges: []
      },
      context: {
        objectRefs: []
      }
    };

    const step: WorkflowStepExecutionDto = {
      nodeId: 'node-step-1',
      stepId: 'step-1',
      actionId: 'ontology.query',
      executionKind: 'tool_gateway',
      status: 'succeeded',
      attempt: 1,
      startedAt: '2026-04-29T11:00:00.000Z',
      completedAt: '2026-04-29T11:00:01.000Z',
      output: {
        objectIds: ['order-001']
      }
    };

    const run: WorkflowRunDto = {
      runId: 'run-001',
      workflowId: 'wf-001',
      workflowVersion: 'v1',
      status: 'waiting',
      startedAt: '2026-04-29T11:00:00.000Z',
      completedAt: null,
      currentNodeIds: ['node-step-2'],
      lastCompletedNodeIds: ['node-step-1'],
      steps: [step]
    };

    const diagnostic: WorkflowRuntimeDiagnosticDto = {
      code: 'STEP_TIMEOUT',
      message: 'Step timed out while waiting for executor response',
      nodeId: 'node-step-2',
      retryable: true
    };

    const log: WorkflowRunLogDto = {
      logId: 'log-001',
      runId: 'run-001',
      nodeId: 'node-step-1',
      eventType: 'step_succeeded',
      timestamp: '2026-04-29T11:00:01.000Z',
      payload: {
        durationMs: 1000
      }
    };

    const runResult: WorkflowRuntimeRunResultDto = {
      ok: true,
      accepted: true,
      run,
      diagnostics: [diagnostic]
    };

    const logsResponse: WorkflowRuntimeGetRunLogsResponseDto = {
      ok: true,
      logs: [log]
    };

    const listItem: WorkflowRunListItemDto = {
      runId: 'run-001',
      workflowId: 'wf-001',
      workflowVersion: 'v1',
      goal: {
        title: 'Handle high risk order',
        objective: '处理高风险订单'
      },
      status: 'waiting',
      startedAt: '2026-04-29T11:00:00.000Z',
      completedAt: null,
      createdAt: '2026-04-29T10:59:59.000Z',
      updatedAt: '2026-04-29T11:00:01.000Z',
      currentNodeIds: ['node-step-2'],
      lastCompletedNodeIds: ['node-step-1']
    };

    const debugStateSnapshot: WorkflowRunDebugStateSnapshotDto = {
      currentNodeIds: ['node-step-2'],
      completedNodeIds: ['node-step-1'],
      waitingNodeIds: ['node-step-2'],
      nodeStates: {
        'node-step-2': {
          retryCount: 1,
          lastError: {
            code: 'STEP_TIMEOUT',
            message: 'Step timed out while waiting for executor response'
          }
        }
      },
      variables: {
        orderId: 'order-001'
      }
    };

    const debug: WorkflowRunDebugDto = {
      definitionSnapshot: request.workflow,
      stateSnapshot: debugStateSnapshot
    };

    const listResponse: WorkflowRuntimeListRunsResponseDto = {
      ok: true,
      runs: [listItem]
    };

    const debugResponse: WorkflowRuntimeGetRunDebugResponseDto = {
      ok: true,
      debug
    };

    expectTypeOf(request.workflow.workflowId).toEqualTypeOf<string>();
    expectTypeOf<WorkflowStepExecutionDto>().toMatchTypeOf(step);
    expectTypeOf<WorkflowRunDto>().toMatchTypeOf(run);
    expectTypeOf<WorkflowRuntimeDiagnosticDto>().toMatchTypeOf(diagnostic);
    expectTypeOf<WorkflowRunLogDto>().toMatchTypeOf(log);
    expectTypeOf<WorkflowRunListItemDto>().toMatchTypeOf(listItem);
    expectTypeOf<WorkflowRunDebugStateSnapshotDto>().toMatchTypeOf(debugStateSnapshot);
    expectTypeOf<WorkflowRunDebugDto>().toMatchTypeOf(debug);
    expectTypeOf<WorkflowRuntimeRunResultDto>().toMatchTypeOf(runResult);
    expectTypeOf<WorkflowRuntimeGetRunLogsResponseDto>().toMatchTypeOf(logsResponse);
    expectTypeOf<WorkflowRuntimeListRunsResponseDto>().toMatchTypeOf(listResponse);
    expectTypeOf<WorkflowRuntimeGetRunDebugResponseDto>().toMatchTypeOf(debugResponse);
  });
});
