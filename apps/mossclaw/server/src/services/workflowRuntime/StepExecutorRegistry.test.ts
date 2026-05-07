import { describe, expect, it } from 'vitest';
import type { RuntimeExecutionContext, RuntimeStepResult, StepExecutor } from './types';
import { StepExecutorRegistry } from './StepExecutorRegistry';

function createExecutor(id: string): StepExecutor {
  return {
    async execute(): Promise<RuntimeStepResult> {
      return {
        status: 'succeeded',
        output: {
          executorId: id
        }
      };
    }
  };
}

describe('StepExecutorRegistry', () => {
  it('returns UNSUPPORTED_EXECUTOR when no executor is registered', () => {
    const registry = new StepExecutorRegistry();

    expect(() =>
      registry.resolve({
        nodeId: 'node-1',
        stepId: 'step-1',
        actionId: 'review.order',
        title: 'Review order',
        executionKind: 'tool_gateway'
      })
    ).toThrow('UNSUPPORTED_EXECUTOR: No executor registered for execution kind "tool_gateway"');
  });

  it('returns the executor registered for the node execution kind', async () => {
    const registry = new StepExecutorRegistry();
    const toolExecutor = createExecutor('tool');
    const subagentExecutor = createExecutor('subagent');

    registry.register('tool_gateway', toolExecutor);
    registry.register('subagent_task', subagentExecutor);

    expect(
      registry.resolve({
        nodeId: 'node-1',
        stepId: 'step-1',
        actionId: 'review.order',
        title: 'Review order',
        executionKind: 'tool_gateway'
      })
    ).toBe(toolExecutor);

    const result = await registry
      .resolve({
        nodeId: 'node-2',
        stepId: 'step-2',
        actionId: 'delegate.agent',
        title: 'Delegate to agent',
        executionKind: 'subagent_task'
      })
      .execute(
        {
          nodeId: 'node-2',
          stepId: 'step-2',
          actionId: 'delegate.agent',
          title: 'Delegate to agent',
          executionKind: 'subagent_task'
        },
        {} as RuntimeExecutionContext
      );

    expect(result).toEqual({
      status: 'succeeded',
      output: {
        executorId: 'subagent'
      }
    });
  });
});
