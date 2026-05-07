import { describe, expect, it, vi } from 'vitest';
import { OntologyIngestService } from './OntologyIngestService';
import type {
  IOntologyIngestJobRepository,
  OntologyIngestJob,
  OntologyIngestReport
} from '../../domain/repositories/IOntologyIngestJobRepository';
import type {
  OntologyIngestObjectCandidateDto,
  OntologyMutationResult
} from '../../infrastructure/database/UnifiedOntologyMutationGateway';

function createObjects(): OntologyIngestObjectCandidateDto[] {
  return [
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
  ];
}

function createJobRepositoryStub(): IOntologyIngestJobRepository {
  return {
    createJob: vi.fn(async () => undefined),
    updateJob: vi.fn(async () => undefined),
    saveReport: vi.fn(async () => undefined),
    getJobById: vi.fn(async () => null),
    getReportByJobId: vi.fn(async () => null)
  };
}

function createMutationGatewayStub(
  result: OntologyMutationResult = {
    createdCount: 1,
    updatedCount: 0,
    skippedCount: 0
  }
) {
  return {
    persistObjects: vi.fn(async () => result)
  };
}

describe('OntologyIngestService', () => {
  it('previewIngest 返回 dry-run 报告且不创建 job、不调用 gateway', async () => {
    const jobRepository = createJobRepositoryStub();
    const mutationGateway = createMutationGatewayStub();
    const service = new OntologyIngestService(jobRepository, mutationGateway, {
      now: () => new Date('2026-04-29T10:00:00.000Z'),
      createJobId: () => 'ignored'
    });

    await expect(
      service.previewIngest({
        source: {
          kind: 'json',
          records: [{ objectId: 'order-002' }]
        },
        objects: createObjects()
      })
    ).resolves.toEqual({
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
        sampleObjects: createObjects()
      }
    });

    expect(jobRepository.createJob).not.toHaveBeenCalled();
    expect(jobRepository.saveReport).not.toHaveBeenCalled();
    expect(mutationGateway.persistObjects).not.toHaveBeenCalled();
  });

  it('submitIngest 在 dryRun=true 时创建 job 和 report，但不写入 ontology object', async () => {
    const jobRepository = createJobRepositoryStub();
    const mutationGateway = createMutationGatewayStub();
    const service = new OntologyIngestService(jobRepository, mutationGateway, {
      now: () => new Date('2026-04-29T10:00:00.000Z'),
      createJobId: () => 'ingest-job-001'
    });

    await expect(
      service.submitIngest({
        source: {
          kind: 'json',
          records: [{ objectId: 'order-002' }]
        },
        objects: createObjects(),
        options: {
          dryRun: true
        }
      })
    ).resolves.toEqual({
      ok: true,
      job: {
        jobId: 'ingest-job-001',
        status: 'succeeded',
        createdAt: '2026-04-29T10:00:00.000Z',
        finishedAt: '2026-04-29T10:00:00.000Z',
        source: {
          kind: 'json',
          records: [{ objectId: 'order-002' }]
        },
        summary: {
          totalRecords: 1,
          acceptedRecords: 1,
          rejectedRecords: 0,
          createdObjects: 0,
          updatedObjects: 0,
          skippedObjects: 1
        }
      }
    });

    expect(jobRepository.createJob).toHaveBeenCalledTimes(1);
    expect(jobRepository.saveReport).toHaveBeenCalledTimes(1);
    expect(jobRepository.updateJob).toHaveBeenCalledTimes(1);
    expect(mutationGateway.persistObjects).not.toHaveBeenCalled();
  });

  it('submitIngest 在真实提交时调用 gateway 并保存返回的 summary', async () => {
    const jobRepository = createJobRepositoryStub();
    const mutationGateway = createMutationGatewayStub({
      createdCount: 1,
      updatedCount: 0,
      skippedCount: 0
    });
    const service = new OntologyIngestService(jobRepository, mutationGateway, {
      now: () => new Date('2026-04-29T10:00:00.000Z'),
      createJobId: () => 'ingest-job-002'
    });

    await expect(
      service.submitIngest({
        source: {
          kind: 'json',
          records: [{ objectId: 'order-002' }]
        },
        objects: createObjects(),
        options: {
          upsert: true
        }
      })
    ).resolves.toMatchObject({
      ok: true,
      job: {
        jobId: 'ingest-job-002',
        status: 'succeeded',
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

    expect(mutationGateway.persistObjects).toHaveBeenCalledWith(createObjects(), { upsert: true });
    expect(jobRepository.createJob).toHaveBeenCalledTimes(1);
    expect(jobRepository.saveReport).toHaveBeenCalledTimes(1);
    expect(jobRepository.updateJob).toHaveBeenCalledTimes(2);
  });
});
