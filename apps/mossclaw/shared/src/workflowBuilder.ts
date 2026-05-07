export type WorkflowBuilderDiagnosticCodeDto =
  | 'INVALID_PLAN_STRUCTURE'
  | 'NO_ELIGIBLE_ACTION'
  | 'AMBIGUOUS_ACTION_MATCH';

export type WorkflowBuilderDiagnosticSeverityDto = 'error' | 'warning' | 'info';

export interface WorkflowGoalRefDto {
  title: string;
  objective?: string;
  objectType?: string;
  objectId?: string;
  context?: Record<string, unknown>;
}

export interface WorkflowPlanStepDto {
  stepId: string;
  title: string;
  description?: string;
  capabilityTags?: string[];
  context?: Record<string, unknown>;
}

export interface WorkflowPlanDto {
  steps: WorkflowPlanStepDto[];
}

export interface WorkflowActionCandidateDto {
  actionId: string;
  name: string;
  reason: string;
}

export interface WorkflowBuilderDiagnosticDto {
  code: WorkflowBuilderDiagnosticCodeDto;
  severity: WorkflowBuilderDiagnosticSeverityDto;
  message: string;
  stepId?: string;
  actionCandidates?: WorkflowActionCandidateDto[];
}

export interface ValidateWorkflowPlanRequestDto {
  goal: WorkflowGoalRefDto;
  plan: WorkflowPlanDto;
}

export interface ValidateWorkflowPlanResponseDto {
  ok: true;
  normalizedGoal: WorkflowGoalRefDto;
  normalizedPlan: WorkflowPlanDto;
  diagnostics: WorkflowBuilderDiagnosticDto[];
}

export interface CompileWorkflowPlanOptionsDto {
  preserveDiagnostics?: boolean;
}

export interface CompileWorkflowPlanRequestDto {
  goal: WorkflowGoalRefDto;
  plan: WorkflowPlanDto;
  options?: CompileWorkflowPlanOptionsDto;
}

export interface WorkflowNodeDto {
  nodeId: string;
  stepId: string;
  actionId: string;
  title: string;
  executionKind: 'tool_gateway' | 'subagent_task';
  executionTarget?: string;
  inputs?: Record<string, unknown>;
}

export interface WorkflowEdgeDto {
  edgeId: string;
  fromNodeId: string;
  toNodeId: string;
  type: 'sequence';
}

export interface WorkflowDefinitionDto {
  workflowId: string;
  version: string;
  goal: WorkflowGoalRefDto;
  nodes: WorkflowNodeDto[];
  edges: WorkflowEdgeDto[];
}

export interface CompileWorkflowPlanResponseDto {
  ok: true;
  accepted: boolean;
  workflow?: WorkflowDefinitionDto;
  diagnostics: WorkflowBuilderDiagnosticDto[];
}

export interface SimulateWorkflowPlanRequestDto {
  goal: WorkflowGoalRefDto;
  plan: WorkflowPlanDto;
}

export interface WorkflowSimulationPreviewDto {
  nodeCount: number;
  edgeCount: number;
  actionIds: string[];
}

export interface SimulateWorkflowPlanResponseDto {
  ok: true;
  preview: WorkflowSimulationPreviewDto;
  diagnostics: WorkflowBuilderDiagnosticDto[];
}
