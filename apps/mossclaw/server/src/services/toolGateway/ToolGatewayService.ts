import type {
  ToolDescriptorDto,
  ToolInvokeRequestDto,
  ToolInvokeResultDto
} from '@mossclaw/shared';
import { isBadRequestError } from '../../lib/validation';
import { ToolRegistry } from './ToolRegistry';
import { OntologyToolAdapter } from './OntologyToolAdapter';
import {
  isOntologyToolName,
  OntologyToolBoundary,
  type OntologyToolName
} from './OntologyToolBoundary';

type ToolInvokeError = Extract<ToolInvokeResultDto, { ok: false }>;

export class ToolGatewayService {
  constructor(
    private readonly toolRegistry: Pick<ToolRegistry, 'list' | 'get'>,
    private readonly ontologyToolAdapter: Pick<OntologyToolAdapter, 'invoke'>,
    private readonly ontologyToolBoundary = new OntologyToolBoundary()
  ) {}

  listTools(): ToolDescriptorDto[] {
    return this.toolRegistry.list();
  }

  async invoke(toolName: string, payload: ToolInvokeRequestDto = {}): Promise<ToolInvokeResultDto> {
    const tool = this.toolRegistry.get(toolName);
    if (!tool) {
      return {
        ok: false,
        toolName,
        error: 'Tool not found',
        errorCode: 'TOOL_NOT_FOUND'
      };
    }

    const ontologyToolName = resolveOntologyToolName(tool);

    try {
      const result = await this.ontologyToolAdapter.invoke(ontologyToolName, payload);

      if (ontologyToolName === 'ontology.get_object' && !result) {
        return {
          ok: false,
          toolName,
          error: this.ontologyToolBoundary.getObjectNotFoundMessage(),
          errorCode: 'OBJECT_NOT_FOUND'
        };
      }

      return {
        ok: true,
        toolName,
        result
      };
    } catch (error) {
      return this.mapInvokeError(ontologyToolName, toolName, error);
    }
  }

  private mapInvokeError(
    registeredToolName: OntologyToolName,
    requestedToolName: string,
    error: unknown
  ): ToolInvokeError {
    if (isBadRequestError(error)) {
      return {
        ok: false,
        toolName: requestedToolName,
        error: error.message,
        errorCode: 'INVALID_ARGUMENT'
      };
    }

    switch (registeredToolName) {
      case 'ontology.get_schema':
        return {
          ok: false,
          toolName: requestedToolName,
          error: this.ontologyToolBoundary.getSchemaLoadErrorMessage(),
          errorCode: 'SCHEMA_LOAD_FAILED'
        };
      case 'ontology.get_object':
        return {
          ok: false,
          toolName: requestedToolName,
          error: this.ontologyToolBoundary.getObjectLoadErrorMessage(),
          errorCode: 'OBJECT_LOAD_FAILED'
        };
      case 'ontology.query':
        return {
          ok: false,
          toolName: requestedToolName,
          error: this.ontologyToolBoundary.getQueryObjectsErrorMessage(),
          errorCode: 'QUERY_FAILED'
        };
    }

    return assertNever(registeredToolName);
  }
}

function resolveOntologyToolName(tool: ToolDescriptorDto): OntologyToolName {
  if (isOntologyToolName(tool.name)) {
    return tool.name;
  }

  throw new Error(`Unsupported ontology tool registration: ${tool.name}`);
}

function assertNever(value: never): never {
  throw new Error(`Unhandled ontology tool: ${String(value)}`);
}
