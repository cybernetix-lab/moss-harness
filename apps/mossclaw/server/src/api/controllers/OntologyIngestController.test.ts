import type { Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { BadRequestError } from '../../lib/validation';
import { OntologyIngestController } from './OntologyIngestController';

function buildMockResponse() {
  const response = {} as Response;
  response.status = vi.fn().mockReturnValue(response);
  response.json = vi.fn().mockReturnValue(response);
  return response;
}

function buildOntologyIngestServiceMock(overrides: Record<string, unknown> = {}) {
  return {
    previewIngest: vi.fn(),
    submitIngest: vi.fn(),
    getIngestJob: vi.fn(),
    getIngestReport: vi.fn(),
    ...overrides
  };
}

function buildController(
  serviceOverrides: Record<string, unknown> = {},
  boundaryOverrides: Record<string, unknown> = {}
) {
  const ontologyIngestService = buildOntologyIngestServiceMock(serviceOverrides);
  const ontologyIngestBoundary = {
    normalizePreviewRequest: vi.fn((value) => value),
    normalizeSubmitRequest: vi.fn((value) => value),
    normalizeJobId: vi.fn((value) => value),
    ...boundaryOverrides
  };
  const controller = new OntologyIngestController(
    ontologyIngestService as never,
    ontologyIngestBoundary as never
  );
  return { controller, ontologyIngestService, ontologyIngestBoundary };
}

describe('OntologyIngestController', () => {
  it('returns 200 with preview result', async () => {
    const result = {
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
        sampleObjects: []
      }
    };
    const normalizedRequest = {
      source: {
        kind: 'json',
        records: [{ objectId: 'order-001' }]
      },
      objects: []
    };
    const { controller, ontologyIngestService, ontologyIngestBoundary } = buildController(
      {
        previewIngest: vi.fn().mockResolvedValue(result)
      },
      {
        normalizePreviewRequest: vi.fn().mockReturnValue(normalizedRequest)
      }
    );
    const req = {
      body: {
        source: {
          kind: 'json',
          records: [{ objectId: 'order-001' }]
        },
        objects: []
      }
    } as Request;
    const res = buildMockResponse();

    await controller.previewIngest(req, res);

    expect(ontologyIngestBoundary.normalizePreviewRequest).toHaveBeenCalledWith(req.body);
    expect(ontologyIngestService.previewIngest).toHaveBeenCalledWith(normalizedRequest);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(result);
  });

  it('returns 200 with submitted job payload', async () => {
    const result = {
      ok: true,
      job: {
        jobId: 'ingest-job-001',
        status: 'succeeded'
      }
    };
    const normalizedRequest = {
      source: {
        kind: 'json',
        records: [{ objectId: 'order-001' }]
      },
      objects: []
    };
    const { controller, ontologyIngestService, ontologyIngestBoundary } = buildController(
      {
        submitIngest: vi.fn().mockResolvedValue(result)
      },
      {
        normalizeSubmitRequest: vi.fn().mockReturnValue(normalizedRequest)
      }
    );
    const req = {
      body: {
        source: {
          kind: 'json',
          records: [{ objectId: 'order-001' }]
        },
        objects: []
      }
    } as Request;
    const res = buildMockResponse();

    await controller.submitIngest(req, res);

    expect(ontologyIngestBoundary.normalizeSubmitRequest).toHaveBeenCalledWith(req.body);
    expect(ontologyIngestService.submitIngest).toHaveBeenCalledWith(normalizedRequest);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(result);
  });

  it('returns 200 with job payload', async () => {
    const result = {
      jobId: 'ingest-job-001',
      status: 'succeeded'
    };
    const { controller, ontologyIngestService, ontologyIngestBoundary } = buildController(
      {
        getIngestJob: vi.fn().mockResolvedValue(result)
      },
      {
        normalizeJobId: vi.fn().mockReturnValue('ingest-job-001')
      }
    );
    const req = {
      params: {
        jobId: 'ingest-job-001'
      }
    } as unknown as Request;
    const res = buildMockResponse();

    await controller.getIngestJob(req, res);

    expect(ontologyIngestBoundary.normalizeJobId).toHaveBeenCalledWith('ingest-job-001');
    expect(ontologyIngestService.getIngestJob).toHaveBeenCalledWith('ingest-job-001');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ job: result });
  });

  it('returns 404 when job is missing', async () => {
    const { controller } = buildController(
      {
        getIngestJob: vi.fn().mockResolvedValue(null)
      },
      {
        normalizeJobId: vi.fn().mockReturnValue('missing-job')
      }
    );
    const req = {
      params: {
        jobId: 'missing-job'
      }
    } as unknown as Request;
    const res = buildMockResponse();

    await controller.getIngestJob(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Ontology ingest job not found'
    });
  });

  it('returns 200 with report payload', async () => {
    const result = {
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
      sampleObjects: []
    };
    const { controller, ontologyIngestService, ontologyIngestBoundary } = buildController(
      {
        getIngestReport: vi.fn().mockResolvedValue(result)
      },
      {
        normalizeJobId: vi.fn().mockReturnValue('ingest-job-001')
      }
    );
    const req = {
      params: {
        jobId: 'ingest-job-001'
      }
    } as unknown as Request;
    const res = buildMockResponse();

    await controller.getIngestReport(req, res);

    expect(ontologyIngestBoundary.normalizeJobId).toHaveBeenCalledWith('ingest-job-001');
    expect(ontologyIngestService.getIngestReport).toHaveBeenCalledWith('ingest-job-001');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ report: result });
  });

  it('returns 404 when report is missing', async () => {
    const { controller } = buildController(
      {
        getIngestReport: vi.fn().mockResolvedValue(null)
      },
      {
        normalizeJobId: vi.fn().mockReturnValue('missing-job')
      }
    );
    const req = {
      params: {
        jobId: 'missing-job'
      }
    } as unknown as Request;
    const res = buildMockResponse();

    await controller.getIngestReport(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Ontology ingest report not found'
    });
  });

  it('returns 400 when request payload is malformed', async () => {
    const { controller, ontologyIngestService, ontologyIngestBoundary } = buildController(
      {},
      {
        normalizePreviewRequest: vi.fn(() => {
          throw new BadRequestError('ingest request must be an object');
        })
      }
    );
    const req = {
      body: null
    } as unknown as Request;
    const res = buildMockResponse();

    await controller.previewIngest(req, res);

    expect(ontologyIngestBoundary.normalizePreviewRequest).toHaveBeenCalledWith(req.body);
    expect(ontologyIngestService.previewIngest).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'ingest request must be an object'
    });
  });

  it('returns stable 500 when submit throws unexpectedly', async () => {
    const { controller } = buildController({
      submitIngest: vi.fn().mockRejectedValue(new Error('database offline'))
    });
    const req = {
      body: {
        source: {
          kind: 'json',
          records: [{ objectId: 'order-001' }]
        },
        objects: []
      }
    } as Request;
    const res = buildMockResponse();

    await controller.submitIngest(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Failed to submit ontology ingest'
    });
  });
});
