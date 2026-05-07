import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { OntologyProjectionController } from './OntologyProjectionController';

function buildMockResponse() {
  const response = {} as Response;
  response.status = vi.fn().mockReturnValue(response);
  response.json = vi.fn().mockReturnValue(response);
  return response;
}

function buildController(overrides: Record<string, unknown> = {}) {
  const handlers = {
    getTypes: vi.fn().mockResolvedValue({
      nodes: [],
      edges: []
    }),
    getNeighbors: vi.fn().mockImplementation(async ({ objectType, objectId, depth }) => ({
      focusNodeId: `${objectType}:${objectId}`,
      nodes: [],
      edges: [],
      depth: depth ?? 1,
      truncated: false
    })),
    getSubgraph: vi.fn().mockImplementation(async ({ objectType, objectId, depth }) => ({
      focusNodeId: `${objectType}:${objectId}`,
      nodes: [],
      edges: [],
      depth: depth ?? 1,
      truncated: false
    })),
    analyzeLoops: vi.fn().mockResolvedValue({
      loops: []
    }),
    ...overrides
  };

  const controller = new OntologyProjectionController(handlers);
  return { controller, handlers };
}

describe('OntologyProjectionController', () => {
  it('returns 200 with stable types payload', async () => {
    const { controller, handlers } = buildController();
    const req = {} as Request;
    const res = buildMockResponse();

    await controller.getTypes(req, res);

    expect(handlers.getTypes).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      nodes: [],
      edges: []
    });
  });

  it('returns 200 with validated neighbors payload', async () => {
    const { controller, handlers } = buildController();
    const req = {
      params: {
        objectType: 'Order',
        objectId: 'order-001'
      },
      query: {
        depth: '1'
      }
    } as unknown as Request;
    const res = buildMockResponse();

    await controller.getNeighbors(req, res);

    expect(handlers.getNeighbors).toHaveBeenCalledWith({
      objectType: 'Order',
      objectId: 'order-001',
      depth: 1
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      focusNodeId: 'Order:order-001',
      nodes: [],
      edges: [],
      depth: 1,
      truncated: false
    });
  });

  it('returns 200 with validated subgraph payload', async () => {
    const { controller, handlers } = buildController();
    const req = {
      body: {
        objectType: 'Order',
        objectId: 'order-001',
        depth: 2
      }
    } as Request;
    const res = buildMockResponse();

    await controller.getSubgraph(req, res);

    expect(handlers.getSubgraph).toHaveBeenCalledWith({
      objectType: 'Order',
      objectId: 'order-001',
      depth: 2
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      focusNodeId: 'Order:order-001',
      nodes: [],
      edges: [],
      depth: 2,
      truncated: false
    });
  });

  it('returns 200 with stable loop analysis payload', async () => {
    const { controller, handlers } = buildController();
    const req = {
      body: {
        subgraph: {
          focusNodeId: 'Order:order-001',
          nodes: [],
          edges: [],
          depth: 1,
          truncated: false
        }
      }
    } as Request;
    const res = buildMockResponse();

    await controller.analyzeLoops(req, res);

    expect(handlers.analyzeLoops).toHaveBeenCalledWith(req.body);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ loops: [] });
  });

  it('returns 400 when neighbors params are malformed', async () => {
    const { controller, handlers } = buildController();
    const req = {
      params: {
        objectType: 'Order',
        objectId: ' '
      },
      query: {}
    } as unknown as Request;
    const res = buildMockResponse();

    await controller.getNeighbors(req, res);

    expect(handlers.getNeighbors).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'objectId is required'
    });
  });

  it('returns 400 when subgraph depth is invalid', async () => {
    const { controller, handlers } = buildController();
    const req = {
      body: {
        objectType: 'Order',
        objectId: 'order-001',
        depth: 0
      }
    } as Request;
    const res = buildMockResponse();

    await controller.getSubgraph(req, res);

    expect(handlers.getSubgraph).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'depth must be a positive integer'
    });
  });

  it('returns stable 500 when loop analysis throws unexpectedly', async () => {
    const { controller } = buildController({
      analyzeLoops: vi.fn().mockRejectedValue(new Error('database offline'))
    });
    const req = {
      body: {
        subgraph: {
          focusNodeId: 'Order:order-001',
          nodes: [],
          edges: [],
          depth: 1,
          truncated: false
        }
      }
    } as Request;
    const res = buildMockResponse();

    await controller.analyzeLoops(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Failed to analyze ontology projection loops'
    });
  });
});
