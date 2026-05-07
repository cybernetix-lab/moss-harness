import { describe, expect, it, vi } from 'vitest';
import { WorkflowBuilderToolAdapter } from './WorkflowBuilderToolAdapter';

function buildWorkflowBuilderServiceMock(overrides: Record<string, unknown> = {}) {
  return {
    validatePlan: vi.fn(),
    compilePlan: vi.fn(),
    simulatePlan: vi.fn(),
    ...overrides
  };
}

function buildAdapter(serviceOverrides: Record<string, unknown> = {}) {
  const workflowBuilderService = buildWorkflowBuilderServiceMock(serviceOverrides);

  return {
    workflowBuilderToolAdapter: new WorkflowBuilderToolAdapter(workflowBuilderService as never),
    workflowBuilderService
  };
}

describe('WorkflowBuilderToolAdapter', () => {
  it('rejects invalid arguments for workflow_builder.validate_plan', async () => {
    const { workflowBuilderToolAdapter, workflowBuilderService } = buildAdapter();

    await expect(
      workflowBuilderToolAdapter.invoke('workflow_builder.validate_plan', {
        arguments: {
          goal: {
            title: 'Review pending orders'
          },
          plan: {
            steps: []
          }
        }
      })
    ).rejects.toThrow('Workflow plan must include at least one step');
    expect(workflowBuilderService.validatePlan).not.toHaveBeenCalled();
  });

  it('dispatches workflow_builder.validate_plan with normalized arguments', async () => {
    const result = {
      ok: true,
      normalizedGoal: {
        title: 'Review pending orders'
      },
      normalizedPlan: {
        steps: [
          {
            stepId: 'step-1',
            title: 'Find pending orders'
          }
        ]
      },
      diagnostics: []
    };
    const { workflowBuilderToolAdapter, workflowBuilderService } = buildAdapter({
      validatePlan: vi.fn().mockReturnValue(result)
    });

    await expect(
      workflowBuilderToolAdapter.invoke('workflow_builder.validate_plan', {
        arguments: {
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
        }
      })
    ).resolves.toEqual(result);
    expect(workflowBuilderService.validatePlan).toHaveBeenCalledWith({
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

  it('dispatches workflow_builder.compile and preserves business rejection payload', async () => {
    const result = {
      ok: true,
      accepted: false,
      diagnostics: [
        {
          code: 'NO_ELIGIBLE_ACTION',
          severity: 'error',
          message: 'No eligible action matched workflow step "Send a Slack message"',
          stepId: 'step-1'
        }
      ]
    };
    const { workflowBuilderToolAdapter, workflowBuilderService } = buildAdapter({
      compilePlan: vi.fn().mockReturnValue(result)
    });

    await expect(
      workflowBuilderToolAdapter.invoke('workflow_builder.compile', {
        arguments: {
          goal: {
            title: 'Review pending orders'
          },
          plan: {
            steps: [
              {
                stepId: 'step-1',
                title: 'Send a Slack message',
                capabilityTags: ['notify']
              }
            ]
          }
        }
      })
    ).resolves.toEqual(result);
    expect(workflowBuilderService.compilePlan).toHaveBeenCalledWith({
      goal: {
        title: 'Review pending orders'
      },
      plan: {
        steps: [
          {
            stepId: 'step-1',
            title: 'Send a Slack message',
            capabilityTags: ['notify']
          }
        ]
      }
    });
  });

  it('dispatches workflow_builder.simulate with normalized arguments', async () => {
    const result = {
      ok: true,
      preview: {
        nodeCount: 1,
        edgeCount: 0,
        actionIds: ['ontology.query']
      },
      diagnostics: []
    };
    const { workflowBuilderToolAdapter, workflowBuilderService } = buildAdapter({
      simulatePlan: vi.fn().mockReturnValue(result)
    });

    await expect(
      workflowBuilderToolAdapter.invoke('workflow_builder.simulate', {
        arguments: {
          goal: {
            title: 'Review pending orders'
          },
          plan: {
            steps: [
              {
                stepId: 'step-1',
                title: 'Find pending orders',
                capabilityTags: ['query']
              }
            ]
          }
        }
      })
    ).resolves.toEqual(result);
    expect(workflowBuilderService.simulatePlan).toHaveBeenCalledWith({
      goal: {
        title: 'Review pending orders'
      },
      plan: {
        steps: [
          {
            stepId: 'step-1',
            title: 'Find pending orders',
            capabilityTags: ['query']
          }
        ]
      }
    });
  });
});
