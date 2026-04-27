import express from 'express';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerOntologyRoutes } from './OntologyController';

describe('registerOntologyRoutes', () => {
  let server: Server;
  let baseUrl: string;

  const ontologyController = {
    getSchema: vi.fn((_req, res) => {
      res.json({ route: 'schema' });
    }),
    getObject: vi.fn((req, res) => {
      res.json({
        route: 'object',
        objectType: req.params.objectType,
        objectId: req.params.objectId
      });
    }),
    queryObjects: vi.fn((req, res) => {
      res.json({
        route: 'query',
        body: req.body
      });
    })
  };

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    registerOntologyRoutes(app, ontologyController as never);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve ontology route test server address');
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

  it('mounts GET /api/ontology/schema', async () => {
    const response = await fetch(`${baseUrl}/api/ontology/schema`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ route: 'schema' });
    expect(ontologyController.getSchema).toHaveBeenCalledTimes(1);
  });

  it('mounts GET /api/ontology/objects/:objectType/:objectId', async () => {
    const response = await fetch(`${baseUrl}/api/ontology/objects/Order/order-001`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      route: 'object',
      objectType: 'Order',
      objectId: 'order-001'
    });
    expect(ontologyController.getObject).toHaveBeenCalledTimes(1);
  });

  it('mounts POST /api/ontology/query', async () => {
    const response = await fetch(`${baseUrl}/api/ontology/query`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        objectType: 'Order',
        state: 'PendingReview'
      })
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      route: 'query',
      body: {
        objectType: 'Order',
        state: 'PendingReview'
      }
    });
    expect(ontologyController.queryObjects).toHaveBeenCalledTimes(1);
  });
});
