import { describe, expect, it } from 'vitest';
import type { WorkflowActionCandidateDto } from '@mossclaw/shared';
import { BadRequestError } from '../../lib/validation';
import { WorkflowBuilderBoundary } from './WorkflowBuilderBoundary';

describe('WorkflowBuilderBoundary', () => {
  it('normalizes validate payloads and trims strings', () => {
    const boundary = new WorkflowBuilderBoundary();

    expect(
      boundary.normalizeValidateRequest({
        goal: {
          title: '  Review pending orders  ',
          objective: '  Identify risky orders  ',
          context: {
            objectType: 'Order'
          }
        },
        plan: {
          steps: [
            {
              stepId: '  step-1  ',
              title: '  Find pending orders  ',
              description: '  Query ontology for pending orders  ',
              capabilityTags: ['  query  ', ' ontology '],
              context: {
                state: 'PendingReview'
              }
            }
          ]
        }
      })
    ).toEqual({
      goal: {
        title: 'Review pending orders',
        objective: 'Identify risky orders',
        context: {
          objectType: 'Order'
        }
      },
      plan: {
        steps: [
          {
            stepId: 'step-1',
            title: 'Find pending orders',
            description: 'Query ontology for pending orders',
            capabilityTags: ['query', 'ontology'],
            context: {
              state: 'PendingReview'
            }
          }
        ]
      }
    });
  });

  it('rejects invalid plan structures', () => {
    const boundary = new WorkflowBuilderBoundary();

    expect(() =>
      boundary.normalizeValidateRequest({
        goal: {
          title: 'Review pending orders'
        },
        plan: {
          steps: []
        }
      })
    ).toThrowError(new BadRequestError('Workflow plan must include at least one step'));
  });

  it('rejects unsupported top-level and nested keys', () => {
    const boundary = new WorkflowBuilderBoundary();

    expect(() =>
      boundary.normalizeCompileRequest({
        goal: {
          title: 'Review pending orders',
          unsupported: true
        },
        plan: {
          steps: [
            {
              stepId: 'step-1',
              title: 'Find pending orders',
              invalid: true
            }
          ]
        },
        extra: true
      })
    ).toThrowError(new BadRequestError('Workflow compile request.extra is not supported'));
  });

  it('normalizes compile and simulate payloads through the same request semantics', () => {
    const boundary = new WorkflowBuilderBoundary();

    expect(
      boundary.normalizeCompileRequest({
        goal: {
          title: '  Review pending orders  '
        },
        plan: {
          steps: [
            {
              stepId: '  step-1  ',
              title: '  Find pending orders  '
            }
          ]
        },
        options: {
          preserveDiagnostics: true
        }
      })
    ).toEqual({
      goal: {
        title: 'Review pending orders'
      },
      plan: {
        steps: [
          {
            stepId: 'step-1',
            title: 'Find pending orders'
          }
        ]
      },
      options: {
        preserveDiagnostics: true
      }
    });

    expect(
      boundary.normalizeSimulateRequest({
        goal: {
          title: '  Review pending orders  '
        },
        plan: {
          steps: [
            {
              stepId: '  step-1  ',
              title: '  Find pending orders  '
            }
          ]
        }
      })
    ).toEqual({
      goal: {
        title: 'Review pending orders'
      },
      plan: {
        steps: [
          {
            stepId: 'step-1',
            title: 'Find pending orders'
          }
        ]
      }
    });
  });

  it('creates stable diagnostics for invalid structure, no eligible action, and ambiguous match', () => {
    const boundary = new WorkflowBuilderBoundary();
    const candidates: WorkflowActionCandidateDto[] = [
      {
        actionId: 'risk.review',
        name: 'risk.review',
        reason: 'Capability tag overlap'
      },
      {
        actionId: 'risk.summarize',
        name: 'risk.summarize',
        reason: 'Capability tag overlap'
      }
    ];

    expect(boundary.createInvalidPlanDiagnostic('Workflow plan must include at least one step')).toEqual({
      code: 'INVALID_PLAN_STRUCTURE',
      severity: 'error',
      message: 'Workflow plan must include at least one step'
    });

    expect(
      boundary.createNoEligibleActionDiagnostic({
        stepId: 'step-1',
        title: 'Send a Slack message'
      })
    ).toEqual({
      code: 'NO_ELIGIBLE_ACTION',
      severity: 'error',
      message: 'No eligible action matched workflow step "Send a Slack message"',
      stepId: 'step-1'
    });

    expect(
      boundary.createAmbiguousActionDiagnostic(
        {
          stepId: 'step-2',
          title: 'Analyze risk signals'
        },
        candidates
      )
    ).toEqual({
      code: 'AMBIGUOUS_ACTION_MATCH',
      severity: 'error',
      message: 'Multiple actions matched workflow step "Analyze risk signals"',
      stepId: 'step-2',
      actionCandidates: candidates
    });
  });
});
