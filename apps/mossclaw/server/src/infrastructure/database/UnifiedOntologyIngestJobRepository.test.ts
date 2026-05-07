import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStorage, DEFAULT_STORAGE_CONFIG } from '../../../../../../runtime/storage';
import type { IStorage } from '@agent-harness/core/storage/types';
import { ensureOntologyIngestSchema } from './ontologyIngestSchema';
import {
  UnifiedOntologyIngestJobRepository,
  type OntologyIngestJob,
  type OntologyIngestReport
} from './UnifiedOntologyIngestJobRepository';

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

function createJob(overrides: Partial<OntologyIngestJob> = {}): OntologyIngestJob {
  return {
    jobId: 'ingest-job-001',
    status: 'pending',
    createdAt: new Date('2026-04-29T10:00:00.000Z'),
    source: {
      kind: 'json',
      records: [{ id: 'order-001' }]
    },
    ...overrides
  };
}

function createReport(overrides: Partial<OntologyIngestReport> = {}): OntologyIngestReport {
  return {
    jobId: 'ingest-job-001',
    dryRun: false,
    summary: {
      totalRecords: 2,
      acceptedRecords: 2,
      rejectedRecords: 0,
      createdObjects: 1,
      updatedObjects: 1,
      skippedObjects: 0
    },
    diagnostics: [],
    sampleObjects: [
      {
        objectType: 'Order',
        objectId: 'order-001',
        displayName: 'Order 001',
        state: 'PendingReview',
        properties: {
          amount: 100
        }
      }
    ],
    ...overrides
  };
}

afterEach(async () => {
  vi.restoreAllMocks();

  while (openedStorages.length > 0) {
    await openedStorages.pop()?.close();
  }
});

describe('UnifiedOntologyIngestJobRepository', () => {
  it('创建 job 后可按 jobId 读回', async () => {
    const storage = await createTestStorage();
    await ensureOntologyIngestSchema(storage);
    const repository = new UnifiedOntologyIngestJobRepository(storage);

    const job = createJob();
    await repository.createJob(job);

    await expect(repository.getJobById(job.jobId)).resolves.toEqual(job);
  });

  it('更新 job 后返回最新状态与 summary', async () => {
    const storage = await createTestStorage();
    await ensureOntologyIngestSchema(storage);
    const repository = new UnifiedOntologyIngestJobRepository(storage);

    await repository.createJob(createJob());
    const updatedJob = createJob({
      status: 'succeeded',
      startedAt: new Date('2026-04-29T10:01:00.000Z'),
      finishedAt: new Date('2026-04-29T10:02:00.000Z'),
      summary: {
        totalRecords: 1,
        acceptedRecords: 1,
        rejectedRecords: 0,
        createdObjects: 1,
        updatedObjects: 0,
        skippedObjects: 0
      }
    });

    await repository.updateJob(updatedJob);

    await expect(repository.getJobById(updatedJob.jobId)).resolves.toEqual(updatedJob);
  });

  it('保存 report 后可按 jobId 读回', async () => {
    const storage = await createTestStorage();
    await ensureOntologyIngestSchema(storage);
    const repository = new UnifiedOntologyIngestJobRepository(storage);

    const report = createReport();
    await repository.createJob(createJob({ jobId: report.jobId }));
    await repository.saveReport(report.jobId, report);

    await expect(repository.getReportByJobId(report.jobId)).resolves.toEqual(report);
  });

  it('不存在的 jobId 返回 null', async () => {
    const storage = await createTestStorage();
    await ensureOntologyIngestSchema(storage);
    const repository = new UnifiedOntologyIngestJobRepository(storage);

    await expect(repository.getJobById('missing-job')).resolves.toBeNull();
    await expect(repository.getReportByJobId('missing-job')).resolves.toBeNull();
  });

  it('底层 execute 失败时透传异常', async () => {
    const expectedError = new Error('database unavailable');
    const repository = new UnifiedOntologyIngestJobRepository({
      query: () => ({
        insert: async () => {
          throw expectedError;
        },
        where: () => ({
          update: async () => {
            throw expectedError;
          },
          first: async () => {
            throw expectedError;
          },
          exists: async () => {
            throw expectedError;
          }
        })
      }),
      execute: async () => {
        throw expectedError;
      }
    } as never);

    await expect(repository.createJob(createJob())).rejects.toBe(expectedError);
    await expect(repository.getJobById('ingest-job-001')).rejects.toBe(expectedError);
  });
});
