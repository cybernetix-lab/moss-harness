import type {
  PreviewOntologyIngestRequestDto,
  SubmitOntologyIngestRequestDto
} from '@mossclaw/shared';
import { BadRequestError, requireObject, requireTrimmedString } from '../../lib/validation';

export class OntologyIngestBoundary {
  normalizePreviewRequest(value: unknown): PreviewOntologyIngestRequestDto {
    return normalizeIngestRequest(value) as PreviewOntologyIngestRequestDto;
  }

  normalizeSubmitRequest(value: unknown): SubmitOntologyIngestRequestDto {
    return normalizeIngestRequest(value) as SubmitOntologyIngestRequestDto;
  }

  normalizeJobId(value: unknown): string {
    return requireTrimmedString(value, 'jobId');
  }
}

function normalizeIngestRequest(value: unknown) {
  const payload = requireObject(value, 'ingest request');
  const source = requireObject(payload.source, 'source');

  if (payload.objects !== undefined && !Array.isArray(payload.objects)) {
    throw new BadRequestError('objects must be an array');
  }

  return {
    source: {
      kind: requireTrimmedString(source.kind, 'source.kind') as
        | 'json'
        | 'csv'
        | 'api'
        | 'rdf',
      uri: source.uri === undefined ? undefined : requireTrimmedString(source.uri, 'source.uri'),
      contentType:
        source.contentType === undefined
          ? undefined
          : requireTrimmedString(source.contentType, 'source.contentType'),
      payload: source.payload as Record<string, unknown> | undefined,
      records: source.records as Record<string, unknown>[] | undefined
    },
    objects: (payload.objects ?? []) as Array<{
      objectType: string;
      objectId: string;
      displayName: string;
      state: string;
      properties: Record<string, unknown>;
    }>,
    options: payload.options as { dryRun?: boolean; upsert?: boolean } | undefined
  };
}
