import { describe, expect, it } from 'vitest';
import type { WorkflowDefinitionDto } from '@mossclaw/shared';
import type { WorkflowRunRecord } from '../../domain/repositories/IWorkflowRunRepository';
import type { RuntimeExecutionContext, RuntimeStepResult, StepExecutor } from './types';
import { ExecutionEngine } from './ExecutionEngine';
import { ExecutionStateStore } from './ExecutionStateStore';
import { RunPolicyGuard } from './RunPolicyGuard';
import { StepExecutorRegistry } from './StepExecutorRegistry';

function createWorkflow(nodes: WorkflowDefinitionDto['nodes']): WorkflowDefinitionDto {
  return {
    workflowId: 'wf-001',
    version: 'v1',
    goal: {
      title: 'Handle high risk order'
    },
    nodes,
    edges:
      nodes.length > 1
        ? nodes.slice(1).map((node, index) => ({
            edgeId: `edge-${index + 1}`,
            fromNodeId: nodes[index].nodeId,
            toNodeId: node.nodeId,
            type: 'sequence' as const
          }))
        : []
  };
}

function createRun(definitionSnapshot: WorkflowDefinitionDto): WorkflowRunRecord {
  return {
    runId: 'run-001',
    workflowId: definitionSnapshot.workflowId,
    workflowVersion: definitionSnapshot.version,
    status: 'created',
    definitionSnapshot,
    stateSnapshot: {
      currentNodeIds: [],
      completedNodeIds: [],
      waitingNodeIds: [],
      nodeStates: {},
      variables: {}
    },
    startedAt: null,
    completedAt: null
  };
}

function createExecutor(
  handler: (
    stepId: string,
    context: RuntimeExecutionContext
  ) => Promise<RuntimeStepResult> | RuntimeStepResult
): StepExecutor {
  return {
    async execute(step, context) {
      return handler(step.stepId, context);
    }
  };
}

describe('ExecutionEngine', () => {
  it('executes ready nodes in dependency order and marks the run succeeded', async () => {
    const executionOrder: string[] = [];
    const registry = new StepExecutorRegistry();
    registry.register(
      'tool_gateway',
      createExecutor(async (stepId) => {
        executionOrder.push(stepId);
        return {
          status: 'succeeded',
          output: {
            completedStepId: stepId
          }
        };
      })
    );

    const engine = new ExecutionEngine(
      registry,
      new ExecutionStateStore(),
      new RunPolicyGuard()
    );
    const workflow = createWorkflow([
      {
        nodeId: 'node-1',
        stepId: 'step-1',
        actionId: 'ontology.query',
        title: 'Find orders',
        executionKind: 'tool_gateway'
      },
      {
        nodeId: 'node-2',
        stepId: 'step-2',
        actionId: 'ontology.get_object',
        title: 'Fetch order',
        executionKind: 'tool_gateway'
      }
    ]);

    const result = await engine.tick(createRun(workflow));

    expect(executionOrder).toEqual(['step-1', 'step-2']);
    expect(result.run.status).toBe('succeeded');
    expect(result.run.completedAt).not.toBeNull();
    expect(result.stateSnapshot.completedNodeIds).toEqual(['node-1', 'node-2']);
    expect(result.stateSnapshot.currentNodeIds).toEqual([]);
    expect(result.logs.map((log) => log.eventType)).toEqual([
      'step_started',
      'step_succeeded',
      'step_started',
      'step_succeeded',
      'run_succeeded'
    ]);
  });

  it('marks the run waiting when a step returns an async handle', async () => {
    const registry = new StepExecutorRegistry();
    registry.register(
      'tool_gateway',
      createExecutor(() => ({
        status: 'waiting',
        handle: {
          childTaskId: 'child-task-001'
        }
      }))
    );

    const engine = new ExecutionEngine(
      registry,
      new ExecutionStateStore(),
      new RunPolicyGuard()
    );
    const workflow = createWorkflow([
      {
        nodeId: 'node-1',
        stepId: 'step-1',
        actionId: 'delegate.agent',
        title: 'Delegate work',
        executionKind: 'tool_gateway'
      }
    ]);

    const result = await engine.tick(createRun(workflow));

    expect(result.run.status).toBe('waiting');
    expect(result.run.completedAt).toBeNull();
    expect(result.stateSnapshot.currentNodeIds).toEqual(['node-1']);
    expect(result.stateSnapshot.waitingNodeIds).toEqual(['node-1']);
    expect(result.stateSnapshot.nodeStates).toEqual({
      'node-1': {
        retryCount: 0,
        waitingHandle: {
          childTaskId: 'child-task-001'
        }
      }
    });
    expect(result.logs.map((log) => log.eventType)).toEqual(['step_started', 'step_waiting']);
  });

  it('marks the run failed when a step execution fails', async () => {
    const registry = new StepExecutorRegistry();
    registry.register(
      'tool_gateway',
      createExecutor(() => ({
        status: 'failed',
        error: {
          code: 'STEP_TIMEOUT',
          message: 'executor timed out',
          retryable: true
        }
      }))
    );

    const engine = new ExecutionEngine(
      registry,
      new ExecutionStateStore(),
      new RunPolicyGuard()
    );
    const workflow = createWorkflow([
      {
        nodeId: 'node-1',
        stepId: 'step-1',
        actionId: 'ontology.query',
        title: 'Find orders',
        executionKind: 'tool_gateway'
      }
    ]);

    const result = await engine.tick(createRun(workflow));

    expect(result.run.status).toBe('failed');
    expect(result.run.failureCode).toBe('STEP_TIMEOUT');
    expect(result.run.failureMessage).toBe('executor timed out');
    expect(result.run.completedAt).not.toBeNull();
    expect(result.stateSnapshot.nodeStates).toEqual({
      'node-1': {
        retryCount: 0,
        lastError: {
          code: 'STEP_TIMEOUT',
          message: 'executor timed out'
        }
      }
    });
    expect(result.logs.map((log) => log.eventType)).toEqual([
      'step_started',
      'step_failed',
      'run_failed'
    ]);
  });
});
