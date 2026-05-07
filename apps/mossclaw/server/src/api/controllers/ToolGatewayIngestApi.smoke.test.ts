import express from 'express';
import type { Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createStorage, DEFAULT_STORAGE_CONFIG } from '../../../../../../runtime/storage';
import type { IStorage } from '@agent-harness/core/storage/types';
import { ToolGatewayController, registerToolGatewayRoutes } from './ToolGatewayController';
import { createDefaultToolRegistry } from '../../services/toolGateway/ToolRegistry';
import { ToolGatewayService } from '../../services/toolGateway/ToolGatewayService';
import { OntologyToolAdapter } from '../../services/toolGateway/OntologyToolAdapter';
import { WorkflowBuilderToolAdapter } from '../../services/toolGateway/WorkflowBuilderToolAdapter';
import { OntologyIngestToolAdapter } from '../../services/toolGateway/OntologyIngestToolAdapter';
import { OntologyService } from '../../services/OntologyService';
import { WorkflowBuilderService } from '../../services/workflowBuilder/WorkflowBuilderService';
import { createOntologyIngestService } from '../../services/ontologyIngest/createOntologyIngestService';
import { UnifiedOntologyRepository } from '../../infrastructure/database/UnifiedOntologyRepository';
import { ensureOntologySchema } from '../../infrastructure/database/ontologySchema';
import { ensureOntologyIngestSchema } from '../../infrastructure/database/ontologyIngestSchema';

describe('ToolGateway ingest API smoke', () => {
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

    const ontologyService = new OntologyService(new UnifiedOntologyRepository(storage));
    const workflowBuilderService = new WorkflowBuilderService();
    const ontologyIngestService = createOntologyIngestService(storage, {
      now: () => new Date('2026-04-29T10:00:00.000Z'),
      createJobId: () => 'ingest-job-001'
    });
    const toolGatewayService = new ToolGatewayService(
      createDefaultToolRegistry(),
      new OntologyToolAdapter(ontologyService),
      new WorkflowBuilderToolAdapter(workflowBuilderService),
      new OntologyIngestToolAdapter(ontologyIngestService)
    );
    const controller = new ToolGatewayController(toolGatewayService);

    const app = express();
    app.use(express.json());
    registerToolGatewayRoutes(app, controller);

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });

    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Failed to resolve tool gateway ingest smoke test server address');
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

  it('ontology.ingest_preview returns dry-run result and does not persist job/report/object', async () => {
    const response = await fetch(`${baseUrl}/api/tools/ontology.ingest_preview/invoke`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        arguments: {
          source: {
            kind: 'json',
            records: [{ objectId: 'tool-preview-001' }]
          },
          objects: [
            {
              objectType: 'Order',
              objectId: 'tool-preview-001',
              displayName: 'Tool Preview 001',
              state: 'PendingReview',
              properties: {
                amount: 100
              }
            }
          ]
        }
      })
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      toolName: 'ontology.ingest_preview',
      result: {
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
              objectId: 'tool-preview-001',
              displayName: 'Tool Preview 001',
              state: 'PendingReview',
              properties: {
                amount: 100
              }
            }
          ]
        }
      }
    });

    const jobs = await storage.execute('SELECT jobId FROM ontology_ingest_jobs');
    const reports = await storage.execute('SELECT jobId FROM ontology_ingest_reports');
    const objects = await storage.execute(
      'SELECT objectId FROM ontology_objects WHERE objectId = ?',
      ['tool-preview-001']
    );

    expect(jobs.rows).toEqual([]);
    expect(reports.rows).toEqual([]);
    expect(objects.rows).toEqual([]);
  });

  it('ontology.ingest_submit persists and returns tool result envelope', async () => {
    const response = await fetch(`${baseUrl}/api/tools/ontology.ingest_submit/invoke`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        arguments: {
          source: {
            kind: 'json',
            records: [{ objectId: 'tool-submit-001' }]
          },
          objects: [
            {
              objectType: 'Order',
              objectId: 'tool-submit-001',
              displayName: 'Tool Submit 001',
              state: 'PendingReview',
              properties: {
                amount: 80
              }
            }
          ],
          options: {
            upsert: true
          }
        }
      })
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      toolName: 'ontology.ingest_submit',
      result: {
        ok: true,
        job: {
          jobId: 'ingest-job-001',
          status: 'succeeded',
          createdAt: '2026-04-29T10:00:00.000Z',
          startedAt: '2026-04-29T10:00:00.000Z',
          finishedAt: '2026-04-29T10:00:00.000Z',
          source: {
            kind: 'json',
            records: [{ objectId: 'tool-submit-001' }]
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
      }
    });

    const jobs = await storage.execute('SELECT jobId, status FROM ontology_ingest_jobs');
    const reports = await storage.execute('SELECT jobId, dryRun FROM ontology_ingest_reports');
    const objects = await storage.execute(
      'SELECT objectType, objectId, displayName, state FROM ontology_objects WHERE objectId = ?',
      ['tool-submit-001']
    );

    expect(jobs.rows).toEqual([{ jobId: 'ingest-job-001', status: 'succeeded' }]);
    expect(reports.rows).toEqual([{ jobId: 'ingest-job-001', dryRun: 0 }]);
    expect(objects.rows).toEqual([
      {
        objectType: 'Order',
        objectId: 'tool-submit-001',
        displayName: 'Tool Submit 001',
        state: 'PendingReview'
      }
    ]);
  });
});
