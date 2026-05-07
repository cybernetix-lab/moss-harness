import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { WorkflowBuilderController } from './WorkflowBuilderController';

function buildMockResponse() {
  const response = {} as Response;
  response.status = vi.fn().mockReturnValue(response);
  response.json = vi.fn().mockReturnValue(response);
  return response;
}

function buildWorkflowBuilderServiceMock(overrides: Record<string, unknown> = {}) {
  return {
    validatePlan: vi.fn(),
    compilePlan: vi.fn(),
    simulatePlan: vi.fn(),
    ...overrides
  };
}

function buildController(serviceOverrides: Record<string, unknown> = {}) {
  const workflowBuilderService = buildWorkflowBuilderServiceMock(serviceOverrides);
  const controller = new WorkflowBuilderController(workflowBuilderService as never);
  return { controller, workflowBuilderService };
}

describe('WorkflowBuilderController', () => {
  it('returns 200 with structured validation result', async () => {
    const result = {
      ok: true,
      normalizedGoal: {
        title: 'Review pending orders'
      },
      normalizedPlan: {
        steps: [
          {
            stepId: 'step-1',
            title: 'Find pending orders',
            capabilityTags: ['query']
          }
        ]
      },
      diagnostics: []
    };
    const { controller, workflowBuilderService } = buildController({
      validatePlan: vi.fn().mockReturnValue(result)
    });
    const req = {
      body: {
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
    } as Request;
    const res = buildMockResponse();

    await controller.validatePlan(req, res);

    expect(workflowBuilderService.validatePlan).toHaveBeenCalledWith(req.body);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(result);
  });

  it('returns 200 with compile business rejection payload', async () => {
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
    const { controller, workflowBuilderService } = buildController({
      compilePlan: vi.fn().mockReturnValue(result)
    });
    const req = {
      body: {
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
    } as Request;
    const res = buildMockResponse();

    await controller.compilePlan(req, res);

    expect(workflowBuilderService.compilePlan).toHaveBeenCalledWith(req.body);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(result);
  });

  it('returns 200 with simulate preview payload', async () => {
    const result = {
      ok: true,
      preview: {
        nodeCount: 1,
        edgeCount: 0,
        actionIds: ['ontology.query']
      },
      diagnostics: []
    };
    const { controller, workflowBuilderService } = buildController({
      simulatePlan: vi.fn().mockReturnValue(result)
    });
    const req = {
      body: {
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
    } as Request;
    const res = buildMockResponse();

    await controller.simulatePlan(req, res);

    expect(workflowBuilderService.simulatePlan).toHaveBeenCalledWith(req.body);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(result);
  });

  it('returns 400 when validate payload is malformed', async () => {
    const { controller, workflowBuilderService } = buildController({
      validatePlan: vi.fn(() => {
        throw new Error('should not be reached');
      })
    });
    const req = {
      body: {
        goal: {
          title: 'Review pending orders'
        },
        plan: {
          steps: []
        }
      }
    } as Request;
    const res = buildMockResponse();

    await controller.validatePlan(req, res);

    expect(workflowBuilderService.validatePlan).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Workflow plan must include at least one step'
    });
  });

  it('returns stable 500 when compile throws unexpectedly', async () => {
    const { controller } = buildController({
      compilePlan: vi.fn().mockRejectedValue(new Error('database offline'))
    });
    const req = {
      body: {
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
      }
    } as Request;
    const res = buildMockResponse();

    await controller.compilePlan(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Failed to compile workflow plan'
    });
  });

  it('returns stable 500 when simulate throws unexpectedly', async () => {
    const { controller } = buildController({
      simulatePlan: vi.fn().mockRejectedValue(new Error('runtime unavailable'))
    });
    const req = {
      body: {
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
      }
    } as Request;
    const res = buildMockResponse();

    await controller.simulatePlan(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Failed to simulate workflow plan'
    });
  });
});
