import { describe, expect, it, vi } from 'vitest';
import type { RuntimeExecutionContext } from '../types';
import { ToolGatewayStepExecutor } from './ToolGatewayStepExecutor';

describe('ToolGatewayStepExecutor', () => {
  it('maps successful tool gateway responses into succeeded runtime step results', async () => {
    const toolGatewayService = {
      invoke: vi.fn().mockResolvedValue({
        ok: true,
        toolName: 'ontology.query',
        result: {
          objectIds: ['order-001']
        }
      })
    };
    const executor = new ToolGatewayStepExecutor(toolGatewayService as never);

    const result = await executor.execute(
      {
        nodeId: 'node-1',
        stepId: 'step-1',
        actionId: 'ontology.query',
        title: 'Find orders',
        executionKind: 'tool_gateway',
        executionTarget: 'ontology.query',
        inputs: {
          objectType: 'Order'
        }
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
      status: 'succeeded',
      output: {
        objectIds: ['order-001']
      }
    });
    expect(toolGatewayService.invoke).toHaveBeenCalledWith('ontology.query', {
      arguments: {
        objectType: 'Order'
      }
    });
  });

  it('maps structured tool gateway failures into failed runtime step results', async () => {
    const toolGatewayService = {
      invoke: vi.fn().mockResolvedValue({
        ok: false,
        toolName: 'ontology.query',
        error: 'Query failed',
        errorCode: 'QUERY_FAILED'
      })
    };
    const executor = new ToolGatewayStepExecutor(toolGatewayService as never);

    const result = await executor.execute(
      {
        nodeId: 'node-1',
        stepId: 'step-1',
        actionId: 'ontology.query',
        title: 'Find orders',
        executionKind: 'tool_gateway',
        executionTarget: 'ontology.query'
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
      status: 'failed',
      error: {
        code: 'QUERY_FAILED',
        message: 'Query failed'
      }
    });
  });

  it('maps thrown timeouts into retryable STEP_TIMEOUT failures', async () => {
    const toolGatewayService = {
      invoke: vi.fn().mockRejectedValue(new Error('executor timed out after 5000ms'))
    };
    const executor = new ToolGatewayStepExecutor(toolGatewayService as never);

    const result = await executor.execute(
      {
        nodeId: 'node-1',
        stepId: 'step-1',
        actionId: 'ontology.query',
        title: 'Find orders',
        executionKind: 'tool_gateway',
        executionTarget: 'ontology.query'
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
      status: 'failed',
      error: {
        code: 'STEP_TIMEOUT',
        message: 'executor timed out after 5000ms',
        retryable: true
      }
    });
  });
});
