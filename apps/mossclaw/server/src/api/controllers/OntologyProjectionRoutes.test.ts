import express from 'express';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerOntologyProjectionRoutes } from './OntologyProjectionRoutes';

describe('registerOntologyProjectionRoutes', () => {
  let server: Server;
  let baseUrl: string;

  const ontologyProjectionController = {
    getTypes: vi.fn((_req, res) => {
      res.status(200).json({
        route: 'types'
      });
    }),
    getNeighbors: vi.fn((req, res) => {
      res.status(200).json({
        route: 'neighbors',
        objectType: req.params.objectType,
        objectId: req.params.objectId,
        depth: req.query.depth ?? null
      });
    }),
    getSubgraph: vi.fn((req, res) => {
      res.status(200).json({
        route: 'subgraph',
        body: req.body
      });
    }),
    analyzeLoops: vi.fn((req, res) => {
      res.status(200).json({
        route: 'loops',
        body: req.body
      });
    })
  };

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    registerOntologyProjectionRoutes(app, ontologyProjectionController as never);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve ontology projection route test server address');
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

  it('mounts GET /api/ontology/projection/types', async () => {
    const response = await fetch(`${baseUrl}/api/ontology/projection/types`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ route: 'types' });
    expect(ontologyProjectionController.getTypes).toHaveBeenCalledTimes(1);
  });

  it('mounts GET /api/ontology/projection/objects/:objectType/:objectId/neighbors', async () => {
    const response = await fetch(
      `${baseUrl}/api/ontology/projection/objects/Order/order-001/neighbors?depth=1`
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      route: 'neighbors',
      objectType: 'Order',
      objectId: 'order-001',
      depth: '1'
    });
    expect(ontologyProjectionController.getNeighbors).toHaveBeenCalledTimes(1);
  });

  it('mounts POST /api/ontology/projection/subgraph', async () => {
    const response = await fetch(`${baseUrl}/api/ontology/projection/subgraph`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        objectType: 'Order',
        objectId: 'order-001',
        depth: 1
      })
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      route: 'subgraph',
      body: {
        objectType: 'Order',
        objectId: 'order-001',
        depth: 1
      }
    });
    expect(ontologyProjectionController.getSubgraph).toHaveBeenCalledTimes(1);
  });

  it('mounts POST /api/ontology/projection/loops/analyze', async () => {
    const response = await fetch(`${baseUrl}/api/ontology/projection/loops/analyze`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        subgraph: {
          focusNodeId: 'Order:order-001',
          nodes: [],
          edges: [],
          depth: 1,
          truncated: false
        }
      })
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      route: 'loops',
      body: {
        subgraph: {
          focusNodeId: 'Order:order-001',
          nodes: [],
          edges: [],
          depth: 1,
          truncated: false
        }
      }
    });
    expect(ontologyProjectionController.analyzeLoops).toHaveBeenCalledTimes(1);
  });
});
