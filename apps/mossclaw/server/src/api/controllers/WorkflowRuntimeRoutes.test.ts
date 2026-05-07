import express from 'express';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerWorkflowRuntimeRoutes } from './WorkflowRuntimeController';

describe('registerWorkflowRuntimeRoutes', () => {
  let server: Server;
  let baseUrl: string;

  const workflowRuntimeController = {
    startRun: vi.fn((req, res) => {
      res.status(200).json({ route: 'start', body: req.body });
    }),
    resumeRun: vi.fn((req, res) => {
      res.status(200).json({ route: 'resume', runId: req.params.runId });
    }),
    cancelRun: vi.fn((req, res) => {
      res.status(200).json({ route: 'cancel', runId: req.params.runId });
    }),
    getRun: vi.fn((req, res) => {
      res.status(200).json({ route: 'get', runId: req.params.runId });
    }),
    getRunLogs: vi.fn((req, res) => {
      res.status(200).json({ route: 'logs', runId: req.params.runId });
    })
  };

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    registerWorkflowRuntimeRoutes(app, workflowRuntimeController as never);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve workflow runtime route test server address');
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

  it('mounts POST /api/workflow-runtime/runs', async () => {
    const response = await fetch(`${baseUrl}/api/workflow-runtime/runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        workflow: {
          workflowId: 'wf-001',
          version: 'v1',
          goal: { title: 'Handle high risk order' },
          nodes: [],
          edges: []
        }
      })
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      route: 'start',
      body: {
        workflow: {
          workflowId: 'wf-001',
          version: 'v1',
          goal: { title: 'Handle high risk order' },
          nodes: [],
          edges: []
        }
      }
    });
    expect(workflowRuntimeController.startRun).toHaveBeenCalledTimes(1);
  });

  it('mounts POST /api/workflow-runtime/runs/:runId/resume', async () => {
    const response = await fetch(`${baseUrl}/api/workflow-runtime/runs/run-001/resume`, {
      method: 'POST'
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      route: 'resume',
      runId: 'run-001'
    });
    expect(workflowRuntimeController.resumeRun).toHaveBeenCalledTimes(1);
  });

  it('mounts POST /api/workflow-runtime/runs/:runId/cancel', async () => {
    const response = await fetch(`${baseUrl}/api/workflow-runtime/runs/run-001/cancel`, {
      method: 'POST'
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      route: 'cancel',
      runId: 'run-001'
    });
    expect(workflowRuntimeController.cancelRun).toHaveBeenCalledTimes(1);
  });

  it('mounts GET /api/workflow-runtime/runs/:runId', async () => {
    const response = await fetch(`${baseUrl}/api/workflow-runtime/runs/run-001`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      route: 'get',
      runId: 'run-001'
    });
    expect(workflowRuntimeController.getRun).toHaveBeenCalledTimes(1);
  });

  it('mounts GET /api/workflow-runtime/runs/:runId/logs', async () => {
    const response = await fetch(`${baseUrl}/api/workflow-runtime/runs/run-001/logs`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      route: 'logs',
      runId: 'run-001'
    });
    expect(workflowRuntimeController.getRunLogs).toHaveBeenCalledTimes(1);
  });
});
