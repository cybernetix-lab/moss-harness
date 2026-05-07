import type {
  PreviewOntologyIngestResponseDto,
  SubmitOntologyIngestResponseDto,
  ToolInvokeRequestDto
} from '@mossclaw/shared';
import type { OntologyIngestService } from '../ontologyIngest/OntologyIngestService';
import {
  OntologyIngestToolBoundary,
  type OntologyIngestToolName
} from './OntologyIngestToolBoundary';

type OntologyIngestToolResult = PreviewOntologyIngestResponseDto | SubmitOntologyIngestResponseDto;

export class OntologyIngestToolAdapter {
  constructor(
    private readonly ontologyIngestService: Pick<OntologyIngestService, 'previewIngest' | 'submitIngest'>,
    private readonly ontologyIngestToolBoundary = new OntologyIngestToolBoundary()
  ) {}

  async invoke(
    toolName: OntologyIngestToolName,
    payload: ToolInvokeRequestDto = {}
  ): Promise<OntologyIngestToolResult> {
    switch (toolName) {
      case 'ontology.ingest_preview': {
        const request = this.ontologyIngestToolBoundary.normalizePreviewArguments(payload.arguments);
        return this.ontologyIngestService.previewIngest(request);
      }
      case 'ontology.ingest_submit': {
        const request = this.ontologyIngestToolBoundary.normalizeSubmitArguments(payload.arguments);
        return this.ontologyIngestService.submitIngest(request);
      }
    }

    return assertNever(toolName);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled ontology ingest tool: ${String(value)}`);
}
