import express from 'express';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createStorage, DEFAULT_STORAGE_CONFIG } from '../../../../../../runtime/storage';
import type { IStorage } from '@agent-harness/core/storage/types';
import {
  OntologyIngestController,
  registerOntologyIngestRoutes
} from './OntologyIngestController';
import { createOntologyIngestService } from '../../services/ontologyIngest/createOntologyIngestService';
import { ensureOntologySchema } from '../../infrastructure/database/ontologySchema';
import { ensureOntologyIngestSchema } from '../../infrastructure/database/ontologyIngestSchema';

describe('OntologyIngest API smoke', () => {
  let storage: IStorage;
  let server: Server;
  let baseUrl: string;

  beforeEach(async () => {
    storage = await createStorage({
      ...DEFAULT_STORAGE_CONFIG,
      backend: 'memory',
      connection: {
        filepath: ':memory:'
      }
    });

    await ensureOntologySchema(storage);
    await ensureOntologyIngestSchema(storage);

    const service = createOntologyIngestService(storage, {
      now: () => new Date('2026-04-29T10:00:00.000Z'),
      createJobId: () => 'ingest-job-001'
    });
    const controller = new OntologyIngestController(service);

    const app = express();
    app.use(express.json());
    registerOntologyIngestRoutes(app, controller);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve ontology ingest smoke test server address');
    }

    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });

    await storage.close();
  });

  it('POST /preview validates HTTP to service path without mutating storage', async () => {
    const response = await fetch(`${baseUrl}/api/ontology/ingest/preview`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        source: {
          kind: 'json',
          records: [{ objectId: 'order-preview-001' }]
        },
        objects: [
          {
            objectType: 'Order',
            objectId: 'order-preview-001',
            displayName: 'Order Preview 001',
            state: 'PendingReview',
            properties: {
              amount: 100
            }
          }
        ]
      })
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      preview: {
        dryRun: true,
        summary: {
          totalRecords: 1,
          acceptedRecords: 1,
          rejectedRecords: 0,
          createdObjects: 0,
          updatedObjects: 0,
          skippedObjects: 1
        },
        diagnostics: [],
        sampleObjects: [
          {
            objectType: 'Order',
            objectId: 'order-preview-001',
            displayName: 'Order Preview 001',
            state: 'PendingReview',
            properties: {
              amount: 100
            }
          }
        ]
      }
    });

    const jobs = await storage.execute('SELECT jobId FROM ontology_ingest_jobs');
    const reports = await storage.execute('SELECT jobId FROM ontology_ingest_reports');
    const objects = await storage.execute(
      'SELECT objectId FROM ontology_objects WHERE objectId = ?',
      ['order-preview-001']
    );

    expect(jobs.rows).toEqual([]);
    expect(reports.rows).toEqual([]);
    expect(objects.rows).toEqual([]);
  });

  it('submit endpoint persists job/report/object and get endpoints read them back', async () => {
    const submitResponse = await fetch(`${baseUrl}/api/ontology/ingest/submit`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        source: {
          kind: 'json',
          records: [{ objectId: 'order-002' }]
        },
        objects: [
          {
            objectType: 'Order',
            objectId: 'order-002',
            displayName: 'Order 002',
            state: 'PendingReview',
            properties: {
              amount: 80,
              riskLevel: 'Low'
            }
          }
        ],
        options: {
          upsert: true
        }
      })
    });

    expect(submitResponse.status).toBe(200);
    expect(await submitResponse.json()).toEqual({
      ok: true,
      job: {
        jobId: 'ingest-job-001',
        status: 'succeeded',
        createdAt: '2026-04-29T10:00:00.000Z',
        startedAt: '2026-04-29T10:00:00.000Z',
        finishedAt: '2026-04-29T10:00:00.000Z',
        source: {
          kind: 'json',
          records: [{ objectId: 'order-002' }]
        },
        summary: {
          totalRecords: 1,
          acceptedRecords: 1,
          rejectedRecords: 0,
          createdObjects: 1,
          updatedObjects: 0,
          skippedObjects: 0
        }
      }
    });

    const getJobResponse = await fetch(`${baseUrl}/api/ontology/ingest/jobs/ingest-job-001`);
    expect(getJobResponse.status).toBe(200);
    expect(await getJobResponse.json()).toEqual({
      job: {
        jobId: 'ingest-job-001',
        status: 'succeeded',
        createdAt: '2026-04-29T10:00:00.000Z',
        startedAt: '2026-04-29T10:00:00.000Z',
        finishedAt: '2026-04-29T10:00:00.000Z',
        source: {
          kind: 'json',
          records: [{ objectId: 'order-002' }]
        },
        summary: {
          totalRecords: 1,
          acceptedRecords: 1,
          rejectedRecords: 0,
          createdObjects: 1,
          updatedObjects: 0,
          skippedObjects: 0
        }
      }
    });

    const getReportResponse = await fetch(`${baseUrl}/api/ontology/ingest/jobs/ingest-job-001/report`);
    expect(getReportResponse.status).toBe(200);
    expect(await getReportResponse.json()).toEqual({
      report: {
        jobId: 'ingest-job-001',
        dryRun: false,
        summary: {
          totalRecords: 1,
          acceptedRecords: 1,
          rejectedRecords: 0,
          createdObjects: 1,
          updatedObjects: 0,
          skippedObjects: 0
        },
        diagnostics: [],
        sampleObjects: [
          {
            objectType: 'Order',
            objectId: 'order-002',
            displayName: 'Order 002',
            state: 'PendingReview',
            properties: {
              amount: 80,
              riskLevel: 'Low'
            }
          }
        ]
      }
    });

    const jobs = await storage.execute('SELECT jobId, status FROM ontology_ingest_jobs');
    const reports = await storage.execute('SELECT jobId, dryRun FROM ontology_ingest_reports');
    const objects = await storage.execute(
      'SELECT objectType, objectId, displayName, state FROM ontology_objects WHERE objectId = ?',
      ['order-002']
    );

    expect(jobs.rows).toEqual([{ jobId: 'ingest-job-001', status: 'succeeded' }]);
    expect(reports.rows).toEqual([{ jobId: 'ingest-job-001', dryRun: 0 }]);
    expect(objects.rows).toEqual([
      {
        objectType: 'Order',
        objectId: 'order-002',
        displayName: 'Order 002',
        state: 'PendingReview'
      }
    ]);
  });
});
