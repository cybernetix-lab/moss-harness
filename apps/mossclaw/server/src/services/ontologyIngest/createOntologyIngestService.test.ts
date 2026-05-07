import { afterEach, describe, expect, it } from 'vitest';
import { createStorage, DEFAULT_STORAGE_CONFIG } from '../../../../../../runtime/storage';
import type { IStorage } from '@agent-harness/core/storage/types';
import { ensureOntologySchema } from '../../infrastructure/database/ontologySchema';
import { ensureOntologyIngestSchema } from '../../infrastructure/database/ontologyIngestSchema';
import { createOntologyIngestService } from './createOntologyIngestService';

const openedStorages: IStorage[] = [];

async function createTestStorage(): Promise<IStorage> {
  const storage = await createStorage({
    ...DEFAULT_STORAGE_CONFIG,
    backend: 'memory',
    connection: {
      filepath: ':memory:'
    }
  });

  openedStorages.push(storage);
  return storage;
}

afterEach(async () => {
  while (openedStorages.length > 0) {
    await openedStorages.pop()?.close();
  }
});

describe('createOntologyIngestService', () => {
  it('使用 UnifiedStorage 装配后可完成提交并写入 job、report 与 ontology object', async () => {
    const storage = await createTestStorage();
    await ensureOntologySchema(storage);
    await ensureOntologyIngestSchema(storage);
    const service = createOntologyIngestService(storage, {
      now: () => new Date('2026-04-29T10:00:00.000Z'),
      createJobId: () => 'ingest-job-001'
    });

    await expect(
      service.submitIngest({
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
        ]
      })
    ).resolves.toMatchObject({
      ok: true,
      job: {
        jobId: 'ingest-job-001',
        status: 'succeeded'
      }
    });

    const jobs = await storage.execute('SELECT jobId, status FROM ontology_ingest_jobs');
    const reports = await storage.execute('SELECT jobId, dryRun FROM ontology_ingest_reports');
    const objects = await storage.execute(
      `SELECT objectType, objectId, displayName, state
       FROM ontology_objects
       WHERE objectId = ?
       LIMIT 1`,
      ['order-002']
    );

    expect(jobs.rows).toEqual([
      {
        jobId: 'ingest-job-001',
        status: 'succeeded'
      }
    ]);
    expect(reports.rows).toEqual([
      {
        jobId: 'ingest-job-001',
        dryRun: 0
      }
    ]);
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
