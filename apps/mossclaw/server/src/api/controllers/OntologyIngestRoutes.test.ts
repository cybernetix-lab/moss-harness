import express from 'express';
import type { Server } from 'node:http';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerOntologyIngestRoutes } from './OntologyIngestController';

describe('registerOntologyIngestRoutes', () => {
  let server: Server;
  let baseUrl: string;

  const ontologyIngestController = {
    previewIngest: vi.fn((req, res) => {
      res.status(200).json({
        route: 'preview',
        body: req.body
      });
    }),
    submitIngest: vi.fn((req, res) => {
      res.status(200).json({
        route: 'submit',
        body: req.body
      });
    }),
    getIngestJob: vi.fn((req, res) => {
      res.status(200).json({
        route: 'job',
        jobId: req.params.jobId
      });
    }),
    getIngestReport: vi.fn((req, res) => {
      res.status(200).json({
        route: 'report',
        jobId: req.params.jobId
      });
    })
  };

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    registerOntologyIngestRoutes(app, ontologyIngestController as never);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve ontology ingest route test server address');
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

  it('mounts POST /api/ontology/ingest/preview', async () => {
    const response = await fetch(`${baseUrl}/api/ontology/ingest/preview`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        source: {
          kind: 'json',
          records: [{ objectId: 'order-001' }]
        },
        objects: []
      })
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      route: 'preview',
      body: {
        source: {
          kind: 'json',
          records: [{ objectId: 'order-001' }]
        },
        objects: []
      }
    });
    expect(ontologyIngestController.previewIngest).toHaveBeenCalledTimes(1);
  });

  it('mounts POST /api/ontology/ingest/submit', async () => {
    const response = await fetch(`${baseUrl}/api/ontology/ingest/submit`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        source: {
          kind: 'json',
          records: [{ objectId: 'order-001' }]
        },
        objects: []
      })
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      route: 'submit',
      body: {
        source: {
          kind: 'json',
          records: [{ objectId: 'order-001' }]
        },
        objects: []
      }
    });
    expect(ontologyIngestController.submitIngest).toHaveBeenCalledTimes(1);
  });

  it('mounts GET /api/ontology/ingest/jobs/:jobId', async () => {
    const response = await fetch(`${baseUrl}/api/ontology/ingest/jobs/ingest-job-001`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      route: 'job',
      jobId: 'ingest-job-001'
    });
    expect(ontologyIngestController.getIngestJob).toHaveBeenCalledTimes(1);
  });

  it('mounts GET /api/ontology/ingest/jobs/:jobId/report', async () => {
    const response = await fetch(`${baseUrl}/api/ontology/ingest/jobs/ingest-job-001/report`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      route: 'report',
      jobId: 'ingest-job-001'
    });
    expect(ontologyIngestController.getIngestReport).toHaveBeenCalledTimes(1);
  });
});
