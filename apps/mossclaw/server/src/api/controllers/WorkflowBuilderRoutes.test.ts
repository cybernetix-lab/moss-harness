import express from 'express';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerWorkflowBuilderRoutes } from './WorkflowBuilderController';

describe('registerWorkflowBuilderRoutes', () => {
  let server: Server;
  let baseUrl: string;

  const workflowBuilderController = {
    validatePlan: vi.fn((req, res) => {
      res.status(200).json({
        route: 'validate',
        body: req.body
      });
    }),
    compilePlan: vi.fn((req, res) => {
      res.status(200).json({
        route: 'compile',
        body: req.body
      });
    }),
    simulatePlan: vi.fn((req, res) => {
      res.status(200).json({
        route: 'simulate',
        body: req.body
      });
    })
  };

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    registerWorkflowBuilderRoutes(app, workflowBuilderController as never);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve workflow builder route test server address');
    }

    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('mounts POST /api/workflow-builder/validate', async () => {
    const response = await fetch(`${baseUrl}/api/workflow-builder/validate`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
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
      })
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      route: 'validate',
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
    });
    expect(workflowBuilderController.validatePlan).toHaveBeenCalledTimes(1);
  });

  it('mounts POST /api/workflow-builder/compile', async () => {
    const response = await fetch(`${baseUrl}/api/workflow-builder/compile`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
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
      })
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      route: 'compile',
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
    });
    expect(workflowBuilderController.compilePlan).toHaveBeenCalledTimes(1);
  });

  it('mounts POST /api/workflow-builder/simulate', async () => {
    const response = await fetch(`${baseUrl}/api/workflow-builder/simulate`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
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
      })
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      route: 'simulate',
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
    });
    expect(workflowBuilderController.simulatePlan).toHaveBeenCalledTimes(1);
  });
});
