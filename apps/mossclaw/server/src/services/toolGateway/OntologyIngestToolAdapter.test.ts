import { describe, expect, it, vi } from 'vitest';
import { OntologyIngestToolAdapter } from './OntologyIngestToolAdapter';

function buildOntologyIngestServiceMock(overrides: Record<string, unknown> = {}) {
  return {
    previewIngest: vi.fn(),
    submitIngest: vi.fn(),
    ...overrides
  };
}

function buildAdapter(
  serviceOverrides: Record<string, unknown> = {},
  boundaryOverrides: Record<string, unknown> = {}
) {
  const ontologyIngestService = buildOntologyIngestServiceMock(serviceOverrides);
  const ontologyIngestToolBoundary = {
    normalizePreviewArguments: vi.fn((value) => value),
    normalizeSubmitArguments: vi.fn((value) => value),
    ...boundaryOverrides
  };

  return {
    ontologyIngestToolAdapter: new OntologyIngestToolAdapter(
      ontologyIngestService as never,
      ontologyIngestToolBoundary as never
    ),
    ontologyIngestService,
    ontologyIngestToolBoundary
  };
}

describe('OntologyIngestToolAdapter', () => {
  it('dispatches ontology.ingest_preview with normalized arguments', async () => {
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
    const normalized = {
      source: {
        kind: 'json'
      },
      objects: []
    };
    const { ontologyIngestToolAdapter, ontologyIngestService, ontologyIngestToolBoundary } =
      buildAdapter(
        {
          previewIngest: vi.fn().mockResolvedValue(result)
        },
        {
          normalizePreviewArguments: vi.fn().mockReturnValue(normalized)
        }
      );

    await expect(
      ontologyIngestToolAdapter.invoke('ontology.ingest_preview', {
        arguments: {
          source: { kind: 'json' },
          objects: []
        }
      })
    ).resolves.toEqual(result);

    expect(ontologyIngestToolBoundary.normalizePreviewArguments).toHaveBeenCalledWith({
      source: { kind: 'json' },
      objects: []
    });
    expect(ontologyIngestService.previewIngest).toHaveBeenCalledWith(normalized);
  });

  it('dispatches ontology.ingest_submit with normalized arguments', async () => {
    const result = {
      ok: true,
      job: {
        jobId: 'ingest-job-001',
        status: 'succeeded'
      }
    };
    const normalized = {
      source: {
        kind: 'json'
      },
      objects: [],
      options: {
        upsert: true
      }
    };
    const { ontologyIngestToolAdapter, ontologyIngestService, ontologyIngestToolBoundary } =
      buildAdapter(
        {
          submitIngest: vi.fn().mockResolvedValue(result)
        },
        {
          normalizeSubmitArguments: vi.fn().mockReturnValue(normalized)
        }
      );

    await expect(
      ontologyIngestToolAdapter.invoke('ontology.ingest_submit', {
        arguments: {
          source: { kind: 'json' },
          objects: [],
          options: {
            upsert: true
          }
        }
      })
    ).resolves.toEqual(result);

    expect(ontologyIngestToolBoundary.normalizeSubmitArguments).toHaveBeenCalledWith({
      source: { kind: 'json' },
      objects: [],
      options: {
        upsert: true
      }
    });
    expect(ontologyIngestService.submitIngest).toHaveBeenCalledWith(normalized);
  });
});
