import type { ToolInvokeResultDto } from '@mossclaw/shared';
import type { RuntimeExecutionContext, RuntimeStep, RuntimeStepResult } from '../types';

export class ToolGatewayStepExecutor {
  constructor(
    private readonly toolGatewayService: {
      invoke(toolName: string, payload: { arguments?: Record<string, unknown> }): Promise<ToolInvokeResultDto>;
    }
  ) {}

  async execute(step: RuntimeStep, _context: RuntimeExecutionContext): Promise<RuntimeStepResult> {
    const toolName = step.executionTarget ?? step.actionId;

    try {
      const result = await this.toolGatewayService.invoke(toolName, {
        arguments: step.inputs ?? {}
      });

      if (!result.ok) {
        return {
          status: 'failed',
          error: {
            code: result.errorCode,
            message: result.error
          }
        };
      }

      return {
        status: 'succeeded',
        output: isRecord(result.result) ? result.result : { value: result.result }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tool gateway execution failed';
      return {
        status: 'failed',
        error: {
          code: isTimeoutMessage(message) ? 'STEP_TIMEOUT' : 'STEP_EXECUTION_FAILED',
          message,
          ...(isTimeoutMessage(message) ? { retryable: true } : {})
        }
      };
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isTimeoutMessage(message: string): boolean {
  return /timeout|timed out/i.test(message);
}
