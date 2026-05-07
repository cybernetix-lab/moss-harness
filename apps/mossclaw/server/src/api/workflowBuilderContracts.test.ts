import { describe, expectTypeOf, it } from 'vitest';
import type {
  CompileWorkflowPlanRequestDto,
  CompileWorkflowPlanResponseDto,
  SimulateWorkflowPlanRequestDto,
  SimulateWorkflowPlanResponseDto,
  ValidateWorkflowPlanRequestDto,
  ValidateWorkflowPlanResponseDto,
  WorkflowBuilderDiagnosticDto,
  WorkflowDefinitionDto,
  WorkflowEdgeDto,
  WorkflowGoalRefDto,
  WorkflowNodeDto,
  WorkflowPlanDto,
  WorkflowPlanStepDto
} from '@mossclaw/shared';

describe('workflow builder shared contracts', () => {
  it('暴露稳定的 workflow builder dto 契约', () => {
    const goal = {
      title: 'Review pending orders',
      objective: 'Identify risky orders that need manual review'
    } satisfies WorkflowGoalRefDto;

    const planStep = {
      stepId: 'step-1',
      title: 'Find pending orders',
      description: 'Query pending orders from ontology',
      capabilityTags: ['ontology.query'],
      context: {
        objectType: 'Order'
      }
    } satisfies WorkflowPlanStepDto;

    const plan = {
      steps: [planStep]
    } satisfies WorkflowPlanDto;

    const diagnostic = {
      code: 'NO_ELIGIBLE_ACTION',
      severity: 'error',
      message: 'No compile-time action matched the plan step',
      stepId: 'step-1',
      actionCandidates: [
        {
          actionId: 'ontology.query',
          name: 'ontology.query',
          reason: 'Closest action candidate'
        }
      ]
    } satisfies WorkflowBuilderDiagnosticDto;

    const node = {
      nodeId: 'node-step-1',
      stepId: 'step-1',
      actionId: 'ontology.query',
      title: 'Find pending orders',
      executionKind: 'tool_gateway',
      executionTarget: 'ontology.query',
      inputs: {
        objectType: 'Order'
      }
    } satisfies WorkflowNodeDto;

    const edge = {
      edgeId: 'edge-step-1-step-2',
      fromNodeId: 'node-step-1',
      toNodeId: 'node-step-2',
      type: 'sequence'
    } satisfies WorkflowEdgeDto;

    const definition = {
      workflowId: 'wf-review-pending-orders',
      version: 'v1',
      goal,
      nodes: [node],
      edges: [edge]
    } satisfies WorkflowDefinitionDto;

    const validateRequest = {
      goal,
      plan
    } satisfies ValidateWorkflowPlanRequestDto;

    const validateResponse = {
      ok: true,
      normalizedGoal: goal,
      normalizedPlan: plan,
      diagnostics: []
    } satisfies ValidateWorkflowPlanResponseDto;

    const compileRequest = {
      goal,
      plan,
      options: {
        preserveDiagnostics: true
      }
    } satisfies CompileWorkflowPlanRequestDto;

    const compileResponse = {
      ok: true,
      accepted: true,
      workflow: definition,
      diagnostics: []
    } satisfies CompileWorkflowPlanResponseDto;

    const simulateRequest = {
      goal,
      plan
    } satisfies SimulateWorkflowPlanRequestDto;

    const simulateResponse = {
      ok: true,
      preview: {
        nodeCount: 1,
        edgeCount: 0,
        actionIds: ['ontology.query']
      },
      diagnostics: [diagnostic]
    } satisfies SimulateWorkflowPlanResponseDto;

    expectTypeOf(goal).toMatchTypeOf<WorkflowGoalRefDto>();
    expectTypeOf(planStep).toMatchTypeOf<WorkflowPlanStepDto>();
    expectTypeOf(plan).toMatchTypeOf<WorkflowPlanDto>();
    expectTypeOf(diagnostic).toMatchTypeOf<WorkflowBuilderDiagnosticDto>();
    expectTypeOf(node).toMatchTypeOf<WorkflowNodeDto>();
    expectTypeOf(edge).toMatchTypeOf<WorkflowEdgeDto>();
    expectTypeOf(definition).toMatchTypeOf<WorkflowDefinitionDto>();
    expectTypeOf(validateRequest).toMatchTypeOf<ValidateWorkflowPlanRequestDto>();
    expectTypeOf(validateResponse).toMatchTypeOf<ValidateWorkflowPlanResponseDto>();
    expectTypeOf(compileRequest).toMatchTypeOf<CompileWorkflowPlanRequestDto>();
    expectTypeOf(compileResponse).toMatchTypeOf<CompileWorkflowPlanResponseDto>();
    expectTypeOf(simulateRequest).toMatchTypeOf<SimulateWorkflowPlanRequestDto>();
    expectTypeOf(simulateResponse).toMatchTypeOf<SimulateWorkflowPlanResponseDto>();
  });
});
