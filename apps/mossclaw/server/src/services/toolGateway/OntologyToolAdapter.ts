import type {
  OntologyObjectDto,
  OntologyQueryResponseDto,
  OntologySchemaResponseDto,
  ToolInvokeRequestDto
} from '@mossclaw/shared';
import { OntologyService } from '../OntologyService';
import { OntologyToolBoundary, type OntologyToolName } from './OntologyToolBoundary';

type OntologyToolResult =
  | OntologySchemaResponseDto
  | OntologyQueryResponseDto
  | OntologyObjectDto
  | null;

const GET_OBJECT_ARGUMENT_LABELS = {
  objectType: 'Tool arguments.objectType',
  objectId: 'Tool arguments.objectId'
} as const;

const QUERY_ARGUMENT_LABELS = {
  payload: 'Tool arguments',
  objectType: 'Tool arguments.objectType',
  state: 'Tool arguments.state'
} as const;

export class OntologyToolAdapter {
  constructor(
    private readonly ontologyService: Pick<
      OntologyService,
      'getSchema' | 'getObject' | 'queryObjects'
    >,
    private readonly ontologyToolBoundary = new OntologyToolBoundary()
  ) {}

  async invoke(
    toolName: OntologyToolName,
    payload: ToolInvokeRequestDto = {}
  ): Promise<OntologyToolResult> {
    switch (toolName) {
      case 'ontology.get_schema':
        this.ontologyToolBoundary.normalizeGetSchemaArguments(payload.arguments);
        return this.ontologyService.getSchema();
      case 'ontology.get_object': {
        const { objectType, objectId } = this.ontologyToolBoundary.normalizeGetObjectArguments(
          payload.arguments,
          GET_OBJECT_ARGUMENT_LABELS
        );

        return this.ontologyService.getObject(objectType, objectId);
      }
      case 'ontology.query': {
        const query = this.ontologyToolBoundary.normalizeQueryArguments(
          payload.arguments,
          QUERY_ARGUMENT_LABELS
        );

        return this.ontologyService.queryObjects(query);
      }
    }

    return assertNever(toolName);
  }
}

function assertNever(value: never): never {
  throw new Error(`Unhandled ontology tool: ${String(value)}`);
}
