import type {
  CompileWorkflowPlanRequestDto,
  SimulateWorkflowPlanRequestDto,
  ValidateWorkflowPlanRequestDto,
  WorkflowActionCandidateDto,
  WorkflowBuilderDiagnosticDto,
  WorkflowGoalRefDto,
  WorkflowPlanDto,
  WorkflowPlanStepDto
} from '@mossclaw/shared';
import { BadRequestError, requireObject, requireTrimmedString } from '../../lib/validation';

export class WorkflowBuilderBoundary {
  normalizeValidateRequest(value: unknown): ValidateWorkflowPlanRequestDto {
    const payload = requireObject(value, 'Workflow validate request');
    assertAllowedKeys(payload, ['goal', 'plan'], 'Workflow validate request');

    return {
      goal: normalizeGoal(payload.goal),
      plan: normalizePlan(payload.plan)
    };
  }

  normalizeCompileRequest(value: unknown): CompileWorkflowPlanRequestDto {
    const payload = requireObject(value, 'Workflow compile request');
    assertAllowedKeys(payload, ['goal', 'plan', 'options'], 'Workflow compile request');

    const normalized: CompileWorkflowPlanRequestDto = {
      goal: normalizeGoal(payload.goal),
      plan: normalizePlan(payload.plan)
    };

    if (payload.options !== undefined) {
      normalized.options = normalizeOptions(payload.options);
    }

    return normalized;
  }

  normalizeSimulateRequest(value: unknown): SimulateWorkflowPlanRequestDto {
    const payload = requireObject(value, 'Workflow simulate request');
    assertAllowedKeys(payload, ['goal', 'plan'], 'Workflow simulate request');

    return {
      goal: normalizeGoal(payload.goal),
      plan: normalizePlan(payload.plan)
    };
  }

  createInvalidPlanDiagnostic(message: string, stepId?: string): WorkflowBuilderDiagnosticDto {
    return {
      code: 'INVALID_PLAN_STRUCTURE',
      severity: 'error',
      message,
      ...(stepId ? { stepId } : {})
    };
  }

  createNoEligibleActionDiagnostic(
    step: Pick<WorkflowPlanStepDto, 'stepId' | 'title'>
  ): WorkflowBuilderDiagnosticDto {
    return {
      code: 'NO_ELIGIBLE_ACTION',
      severity: 'error',
      message: `No eligible action matched workflow step "${step.title}"`,
      stepId: step.stepId
    };
  }

  createAmbiguousActionDiagnostic(
    step: Pick<WorkflowPlanStepDto, 'stepId' | 'title'>,
    candidates: WorkflowActionCandidateDto[]
  ): WorkflowBuilderDiagnosticDto {
    return {
      code: 'AMBIGUOUS_ACTION_MATCH',
      severity: 'error',
      message: `Multiple actions matched workflow step "${step.title}"`,
      stepId: step.stepId,
      actionCandidates: candidates
    };
  }
}

function normalizeGoal(value: unknown): WorkflowGoalRefDto {
  const goal = requireObject(value, 'Workflow goal');
  assertAllowedKeys(goal, ['title', 'objective', 'objectType', 'objectId', 'context'], 'Workflow goal');

  const normalized: WorkflowGoalRefDto = {
    title: requireTrimmedString(goal.title, 'Workflow goal.title')
  };

  if (goal.objective !== undefined) {
    normalized.objective = requireTrimmedString(goal.objective, 'Workflow goal.objective');
  }

  if (goal.objectType !== undefined) {
    normalized.objectType = requireTrimmedString(goal.objectType, 'Workflow goal.objectType');
  }

  if (goal.objectId !== undefined) {
    normalized.objectId = requireTrimmedString(goal.objectId, 'Workflow goal.objectId');
  }

  if (goal.context !== undefined) {
    normalized.context = requireObject(goal.context, 'Workflow goal.context');
  }

  return normalized;
}

function normalizePlan(value: unknown): WorkflowPlanDto {
  const plan = requireObject(value, 'Workflow plan');
  assertAllowedKeys(plan, ['steps'], 'Workflow plan');

  if (!Array.isArray(plan.steps) || plan.steps.length === 0) {
    throw new BadRequestError('Workflow plan must include at least one step');
  }

  return {
    steps: plan.steps.map((step, index) => normalizeStep(step, index))
  };
}

function normalizeStep(value: unknown, index: number): WorkflowPlanStepDto {
  const step = requireObject(value, `Workflow plan.steps[${index}]`);
  assertAllowedKeys(
    step,
    ['stepId', 'title', 'description', 'capabilityTags', 'context'],
    `Workflow plan.steps[${index}]`
  );

  const normalized: WorkflowPlanStepDto = {
    stepId: requireTrimmedString(step.stepId, `Workflow plan.steps[${index}].stepId`),
    title: requireTrimmedString(step.title, `Workflow plan.steps[${index}].title`)
  };

  if (step.description !== undefined) {
    normalized.description = requireTrimmedString(
      step.description,
      `Workflow plan.steps[${index}].description`
    );
  }

  if (step.capabilityTags !== undefined) {
    normalized.capabilityTags = normalizeCapabilityTags(step.capabilityTags, index);
  }

  if (step.context !== undefined) {
    normalized.context = requireObject(step.context, `Workflow plan.steps[${index}].context`);
  }

  return normalized;
}

function normalizeCapabilityTags(value: unknown, index: number): string[] {
  if (!Array.isArray(value)) {
    throw new BadRequestError(`Workflow plan.steps[${index}].capabilityTags must be an array`);
  }

  return value.map((tag, tagIndex) =>
    requireTrimmedString(tag, `Workflow plan.steps[${index}].capabilityTags[${tagIndex}]`)
  );
}

function normalizeOptions(value: unknown): NonNullable<CompileWorkflowPlanRequestDto['options']> {
  const options = requireObject(value, 'Workflow compile request.options');
  assertAllowedKeys(options, ['preserveDiagnostics'], 'Workflow compile request.options');

  const normalized: NonNullable<CompileWorkflowPlanRequestDto['options']> = {};
  if (options.preserveDiagnostics !== undefined) {
    if (typeof options.preserveDiagnostics !== 'boolean') {
      throw new BadRequestError('Workflow compile request.options.preserveDiagnostics must be a boolean');
    }

    normalized.preserveDiagnostics = options.preserveDiagnostics;
  }

  return normalized;
}

function assertAllowedKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  labelPrefix: string
): void {
  for (const key of Object.keys(value)) {
    if (!allowedKeys.includes(key)) {
      throw new BadRequestError(`${labelPrefix}.${key} is not supported`);
    }
  }
}
