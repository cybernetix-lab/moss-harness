import type {
  WorkflowDefinitionDto,
  WorkflowRunStatusDto,
  WorkflowRuntimeDiagnosticDto,
  WorkflowRuntimeStartRunRequestDto
} from '@mossclaw/shared';

type NormalizedRuntimeContext = {
  objectRefs: Array<{
    objectType: string;
    objectId: string;
  }>;
  variables: Record<string, unknown>;
};

export type WorkflowRuntimeBoundaryRejectResult = {
  ok: false;
  diagnostics: WorkflowRuntimeDiagnosticDto[];
};

export type WorkflowRuntimeBoundaryAcceptResult<T> = {
  ok: true;
  value: T;
};

export class WorkflowRuntimeBoundary {
  normalizeStartRunRequest(
    payload: unknown
  ): WorkflowRuntimeBoundaryAcceptResult<{
    workflow: WorkflowDefinitionDto;
    context: NormalizedRuntimeContext;
  }> | WorkflowRuntimeBoundaryRejectResult {
    if (!isObject(payload) || !isWorkflowDefinition(payload.workflow)) {
      return {
        ok: false,
        diagnostics: [
          this.createInvalidRuntimeRequestDiagnostic(
            'Workflow runtime request must include a workflow definition'
          )
        ]
      };
    }

    return {
      ok: true,
      value: {
        workflow: payload.workflow,
        context: normalizeRuntimeContext(payload)
      }
    };
  }

  assertResumeAllowed(
    status: WorkflowRunStatusDto
  ): { ok: true } | WorkflowRuntimeBoundaryRejectResult {
    if (status === 'failed' || status === 'waiting') {
      return { ok: true };
    }

    return {
      ok: false,
      diagnostics: [this.createInvalidRunTransitionDiagnostic('resume', status)]
    };
  }

  assertCancelAllowed(
    status: WorkflowRunStatusDto
  ): { ok: true } | WorkflowRuntimeBoundaryRejectResult {
    if (status === 'created' || status === 'ready' || status === 'running' || status === 'waiting') {
      return { ok: true };
    }

    return {
      ok: false,
      diagnostics: [this.createInvalidRunTransitionDiagnostic('cancel', status)]
    };
  }

  createInvalidRuntimeRequestDiagnostic(message: string): WorkflowRuntimeDiagnosticDto {
    return {
      code: 'INVALID_RUNTIME_REQUEST',
      message
    };
  }

  createInvalidRunTransitionDiagnostic(
    action: 'resume' | 'cancel',
    currentStatus: WorkflowRunStatusDto
  ): WorkflowRuntimeDiagnosticDto {
    return {
      code: 'INVALID_RUN_TRANSITION',
      message: `Cannot ${action} workflow run from status "${currentStatus}"`
    };
  }
}

function normalizeRuntimeContext(payload: {
  context?: WorkflowRuntimeStartRunRequestDto['context'];
}): NormalizedRuntimeContext {
  return {
    objectRefs: payload.context?.objectRefs ?? [],
    variables: payload.context?.variables ?? {}
  };
}

function isObject(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null;
}

function isWorkflowDefinition(value: unknown): value is WorkflowDefinitionDto {
  return (
    isObject(value) &&
    typeof value.workflowId === 'string' &&
    typeof value.version === 'string' &&
    isObject(value.goal) &&
    typeof value.goal.title === 'string' &&
    Array.isArray(value.nodes) &&
    Array.isArray(value.edges)
  );
}
