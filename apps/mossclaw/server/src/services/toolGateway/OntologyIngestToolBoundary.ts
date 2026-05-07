import type {
  PreviewOntologyIngestRequestDto,
  SubmitOntologyIngestRequestDto,
  ToolErrorDto
} from '@mossclaw/shared';
import { BadRequestError } from '../../lib/validation';
import { OntologyIngestBoundary } from '../ontologyIngest/OntologyIngestBoundary';

export type OntologyIngestToolName = 'ontology.ingest_preview' | 'ontology.ingest_submit';

const ONTOLOGY_INGEST_TOOL_ERROR_CATALOG = Object.freeze({
  invalidArguments: {
    errorCode: 'INVALID_ARGUMENT',
    description: 'Tool arguments must contain a valid ontology ingest payload'
  },
  previewFailed: {
    errorCode: 'INGEST_PREVIEW_FAILED',
    description: 'Ontology ingest preview could not be completed',
    responseMessage: 'Failed to preview ontology ingest'
  },
  submitFailed: {
    errorCode: 'INGEST_SUBMIT_FAILED',
    description: 'Ontology ingest submit could not be completed',
    responseMessage: 'Failed to submit ontology ingest'
  }
});

const TOOL_ERROR_DIRECTORY: Record<
  OntologyIngestToolName,
  ReadonlyArray<keyof typeof ONTOLOGY_INGEST_TOOL_ERROR_CATALOG>
> = {
  'ontology.ingest_preview': ['invalidArguments', 'previewFailed'],
  'ontology.ingest_submit': ['invalidArguments', 'submitFailed']
};

const ONTOLOGY_INGEST_TOOL_NAMES = [
  'ontology.ingest_preview',
  'ontology.ingest_submit'
] as const satisfies readonly OntologyIngestToolName[];

export function isOntologyIngestToolName(value: string): value is OntologyIngestToolName {
  return (ONTOLOGY_INGEST_TOOL_NAMES as readonly string[]).includes(value);
}

export class OntologyIngestToolBoundary {
  constructor(private readonly ontologyIngestBoundary = new OntologyIngestBoundary()) {}

  normalizePreviewArguments(value: unknown): PreviewOntologyIngestRequestDto {
    return this.ontologyIngestBoundary.normalizePreviewRequest(value);
  }

  normalizeSubmitArguments(value: unknown): SubmitOntologyIngestRequestDto {
    return this.ontologyIngestBoundary.normalizeSubmitRequest(value);
  }

  getToolErrors(toolName: OntologyIngestToolName): ToolErrorDto[] {
    return TOOL_ERROR_DIRECTORY[toolName].map((key) => {
      const error = ONTOLOGY_INGEST_TOOL_ERROR_CATALOG[key];
      return { errorCode: error.errorCode, description: error.description };
    });
  }

  getPreviewErrorMessage(): string {
    return ONTOLOGY_INGEST_TOOL_ERROR_CATALOG.previewFailed.responseMessage;
  }

  getSubmitErrorMessage(): string {
    return ONTOLOGY_INGEST_TOOL_ERROR_CATALOG.submitFailed.responseMessage;
  }
}

export function assertOntologyIngestToolArguments(value: unknown): void {
  if (value === undefined) {
    throw new BadRequestError('Tool arguments must be an object');
  }
}
