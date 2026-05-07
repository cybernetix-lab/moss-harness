import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { WorkflowRuntimeController } from './WorkflowRuntimeController';

function buildMockResponse() {
  const response = {} as Response;
  response.status = vi.fn().mockReturnValue(response);
  response.json = vi.fn().mockReturnValue(response);
  return response;
}

function buildServiceMock(overrides: Record<string, unknown> = {}) {
  return {
    startRun: vi.fn(),
    resumeRun: vi.fn(),
    cancelRun: vi.fn(),
    getRun: vi.fn(),
    getRunLogs: vi.fn(),
    ...overrides
  };
}

describe('WorkflowRuntimeController', () => {
  it('returns 200 with runtime start payload', async () => {
    const service = buildServiceMock({
      startRun: vi.fn().mockResolvedValue({
        ok: true,
        accepted: true,
        run: {
          runId: 'run-001',
          workflowId: 'wf-001',
          workflowVersion: 'v1',
          status: 'waiting',
          startedAt: '2026-04-29T11:00:00.000Z',
          completedAt: null,
          currentNodeIds: ['node-1'],
          lastCompletedNodeIds: [],
          steps: []
        },
        diagnostics: []
      })
    });
    const controller = new WorkflowRuntimeController(service as never);
    const req = {
      body: {
        workflow: {
          workflowId: 'wf-001',
          version: 'v1',
          goal: { title: 'Handle high risk order' },
          nodes: [],
          edges: []
        }
      }
    } as Request;
    const res = buildMockResponse();

    await controller.startRun(req, res);

    expect(service.startRun).toHaveBeenCalledWith(req.body);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 200 for resume, cancel, get and logs endpoints', async () => {
    const service = buildServiceMock({
      resumeRun: vi.fn().mockResolvedValue({ ok: true, accepted: true, run: null, diagnostics: [] }),
      cancelRun: vi.fn().mockResolvedValue({ ok: true, accepted: true, run: null, diagnostics: [] }),
      getRun: vi.fn().mockResolvedValue({ ok: true, accepted: true, run: null, diagnostics: [] }),
      getRunLogs: vi.fn().mockResolvedValue({ ok: true, logs: [] })
    });
    const controller = new WorkflowRuntimeController(service as never);
    const req = {
      params: {
        runId: 'run-001'
      }
    } as unknown as Request;
    const res = buildMockResponse();

    await controller.resumeRun(req, res);
    await controller.cancelRun(req, res);
    await controller.getRun(req, res);
    await controller.getRunLogs(req, res);

    expect(service.resumeRun).toHaveBeenCalledWith('run-001');
    expect(service.cancelRun).toHaveBeenCalledWith('run-001');
    expect(service.getRun).toHaveBeenCalledWith('run-001');
    expect(service.getRunLogs).toHaveBeenCalledWith('run-001');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns stable 500 when runtime service throws unexpectedly', async () => {
    const service = buildServiceMock({
      startRun: vi.fn().mockRejectedValue(new Error('database offline'))
    });
    const controller = new WorkflowRuntimeController(service as never);
    const req = {
      body: {
        workflow: {
          workflowId: 'wf-001',
          version: 'v1',
          goal: { title: 'Handle high risk order' },
          nodes: [],
          edges: []
        }
      }
    } as Request;
    const res = buildMockResponse();

    await controller.startRun(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Failed to start workflow run'
    });
  });
});
