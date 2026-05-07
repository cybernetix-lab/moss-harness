import type {
  CompileWorkflowPlanRequestDto,
  CompileWorkflowPlanResponseDto,
  SimulateWorkflowPlanRequestDto,
  SimulateWorkflowPlanResponseDto,
  ValidateWorkflowPlanRequestDto,
  ValidateWorkflowPlanResponseDto,
  WorkflowActionCandidateDto,
  WorkflowDefinitionDto,
  WorkflowEdgeDto,
  WorkflowNodeDto,
  WorkflowPlanStepDto
} from '@mossclaw/shared';
import {
  ActionCatalog,
  type WorkflowActionDefinition,
  type WorkflowActionMatchResult
} from './ActionCatalog';
import { WorkflowBuilderBoundary } from './WorkflowBuilderBoundary';

export class WorkflowBuilderService {
  constructor(
    private readonly actionCatalog = new ActionCatalog(),
    private readonly workflowBuilderBoundary = new WorkflowBuilderBoundary()
  ) {}

  validatePlan(payload: unknown): ValidateWorkflowPlanResponseDto {
    const normalized = this.workflowBuilderBoundary.normalizeValidateRequest(
      payload as ValidateWorkflowPlanRequestDto
    );

    return {
      ok: true,
      normalizedGoal: normalized.goal,
      normalizedPlan: normalized.plan,
      diagnostics: []
    };
  }

  compilePlan(payload: unknown): CompileWorkflowPlanResponseDto {
    const normalized = this.workflowBuilderBoundary.normalizeCompileRequest(
      payload as CompileWorkflowPlanRequestDto
    );

    const nodes: WorkflowNodeDto[] = [];
    const diagnostics = this.collectDiagnostics(normalized.plan.steps, nodes);

    if (diagnostics.length > 0) {
      return {
        ok: true,
        accepted: false,
        diagnostics
      };
    }

    return {
      ok: true,
      accepted: true,
      workflow: {
        workflowId: buildWorkflowId(normalized.goal.title),
        version: 'v1',
        goal: normalized.goal,
        nodes,
        edges: buildEdges(nodes)
      },
      diagnostics: []
    };
  }

  simulatePlan(payload: unknown): SimulateWorkflowPlanResponseDto {
    const normalized = this.workflowBuilderBoundary.normalizeSimulateRequest(
      payload as SimulateWorkflowPlanRequestDto
    );

    const nodes: WorkflowNodeDto[] = [];
    const diagnostics = this.collectDiagnostics(normalized.plan.steps, nodes);

    return {
      ok: true,
      preview: {
        nodeCount: nodes.length,
        edgeCount: Math.max(nodes.length - 1, 0),
        actionIds: nodes.map((node) => node.actionId)
      },
      diagnostics
    };
  }

  private collectDiagnostics(
    steps: WorkflowPlanStepDto[],
    nodes: WorkflowNodeDto[]
  ): CompileWorkflowPlanResponseDto['diagnostics'] {
    const diagnostics: CompileWorkflowPlanResponseDto['diagnostics'] = [];

    for (const step of steps) {
      const match = this.actionCatalog.resolveStep(step);

      switch (match.kind) {
        case 'matched':
          nodes.push(buildNode(step, match.action));
          break;
        case 'no_match':
          diagnostics.push(this.workflowBuilderBoundary.createNoEligibleActionDiagnostic(step));
          break;
        case 'ambiguous':
          diagnostics.push(
            this.workflowBuilderBoundary.createAmbiguousActionDiagnostic(
              step,
              match.candidates.map(toActionCandidate)
            )
          );
          break;
      }
    }

    return diagnostics;
  }
}

function buildNode(step: WorkflowPlanStepDto, action: WorkflowActionDefinition): WorkflowNodeDto {
  const node: WorkflowNodeDto = {
    nodeId: `node-${step.stepId}`,
    stepId: step.stepId,
    actionId: action.actionId,
    title: step.title,
    executionKind: 'tool_gateway',
    executionTarget: action.actionId
  };

  if (step.context) {
    node.inputs = step.context;
  }

  return node;
}

function buildEdges(nodes: WorkflowNodeDto[]): WorkflowEdgeDto[] {
  const edges: WorkflowEdgeDto[] = [];

  for (let index = 1; index < nodes.length; index += 1) {
    const previousNode = nodes[index - 1];
    const currentNode = nodes[index];
    edges.push({
      edgeId: `edge-${previousNode.stepId}-${currentNode.stepId}`,
      fromNodeId: previousNode.nodeId,
      toNodeId: currentNode.nodeId,
      type: 'sequence'
    });
  }

  return edges;
}

function toActionCandidate(action: WorkflowActionDefinition): WorkflowActionCandidateDto {
  return {
    actionId: action.actionId,
    name: action.name,
    reason: 'Capability tags matched'
  };
}

function buildWorkflowId(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `wf-${slug || 'workflow'}`;
}
