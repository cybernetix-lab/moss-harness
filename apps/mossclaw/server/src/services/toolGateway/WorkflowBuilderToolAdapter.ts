import type {
  CompileWorkflowPlanResponseDto,
  SimulateWorkflowPlanResponseDto,
  ToolInvokeRequestDto,
  ValidateWorkflowPlanResponseDto
} from '@mossclaw/shared';
import { WorkflowBuilderService } from '../workflowBuilder/WorkflowBuilderService';
import { WorkflowBuilderBoundary } from '../workflowBuilder/WorkflowBuilderBoundary';

export type WorkflowBuilderToolName =
  | 'workflow_builder.validate_plan'
  | 'workflow_builder.compile'
  | 'workflow_builder.simulate';

const WORKFLOW_BUILDER_TOOL_NAMES = [
  'workflow_builder.validate_plan',
  'workflow_builder.compile',
  'workflow_builder.simulate'
] as const satisfies readonly WorkflowBuilderToolName[];

type WorkflowBuilderToolResult =
  | ValidateWorkflowPlanResponseDto
  | CompileWorkflowPlanResponseDto
  | SimulateWorkflowPlanResponseDto;

export function isWorkflowBuilderToolName(value: string): value is WorkflowBuilderToolName {
  return (WORKFLOW_BUILDER_TOOL_NAMES as readonly string[]).includes(value);
}

export class WorkflowBuilderToolAdapter {
  constructor(
    private readonly workflowBuilderService: Pick<
      WorkflowBuilderService,
      'validatePlan' | 'compilePlan' | 'simulatePlan'
    >,
    private readonly workflowBuilderBoundary = new WorkflowBuilderBoundary()
  ) {}

  async invoke(
    toolName: WorkflowBuilderToolName,
    payload: ToolInvokeRequestDto = {}
  ): Promise<WorkflowBuilderToolResult> {
    switch (toolName) {
      case 'workflow_builder.validate_plan': {
        const request = this.workflowBuilderBoundary.normalizeValidateRequest(payload.arguments);
        return this.workflowBuilderService.validatePlan(request);
      }
      case 'workflow_builder.compile': {
        const request = this.workflowBuilderBoundary.normalizeCompileRequest(payload.arguments);
        return this.workflowBuilderService.compilePlan(request);
      }
      case 'workflow_builder.simulate': {
        const request = this.workflowBuilderBoundary.normalizeSimulateRequest(payload.arguments);
        return this.workflowBuilderService.simulatePlan(request);
      }
    }

    return assertNever(toolName);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled workflow builder tool: ${String(value)}`);
}
