import type {
  ToolDescriptorDto,
  ToolInvokeRequestDto,
  ToolInvokeResultDto
} from '@mossclaw/shared';
import { isBadRequestError } from '../../lib/validation';
import { ToolRegistry } from './ToolRegistry';
import { OntologyToolAdapter } from './OntologyToolAdapter';
import {
  isOntologyIngestToolName,
  OntologyIngestToolBoundary,
  type OntologyIngestToolName
} from './OntologyIngestToolBoundary';
import { OntologyIngestToolAdapter } from './OntologyIngestToolAdapter';
import {
  isOntologyToolName,
  OntologyToolBoundary,
  type OntologyToolName
} from './OntologyToolBoundary';
import {
  isWorkflowBuilderToolName,
  type WorkflowBuilderToolName,
  WorkflowBuilderToolAdapter
} from './WorkflowBuilderToolAdapter';

type ToolInvokeError = Extract<ToolInvokeResultDto, { ok: false }>;
type RegisteredToolName = OntologyToolName | WorkflowBuilderToolName | OntologyIngestToolName;

export class ToolGatewayService {
  constructor(
    private readonly toolRegistry: Pick<ToolRegistry, 'list' | 'get'>,
    private readonly ontologyToolAdapter: Pick<OntologyToolAdapter, 'invoke'>,
    private readonly workflowBuilderToolAdapter: Pick<WorkflowBuilderToolAdapter, 'invoke'>,
    private readonly ontologyIngestToolAdapter: Pick<OntologyIngestToolAdapter, 'invoke'>,
    private readonly ontologyToolBoundary = new OntologyToolBoundary(),
    private readonly ontologyIngestToolBoundary = new OntologyIngestToolBoundary()
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

    const registeredToolName = resolveRegisteredToolName(tool);

    try {
      const result = await this.invokeRegisteredTool(registeredToolName, payload);

      if (registeredToolName === 'ontology.get_object' && !result) {
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
      return this.mapInvokeError(registeredToolName, toolName, error);
    }
  }

  private invokeRegisteredTool(
    toolName: RegisteredToolName,
    payload: ToolInvokeRequestDto
  ): Promise<unknown> {
    if (isOntologyToolName(toolName)) {
      return this.ontologyToolAdapter.invoke(toolName, payload);
    }

    if (isOntologyIngestToolName(toolName)) {
      return this.ontologyIngestToolAdapter.invoke(toolName, payload);
    }

    return this.workflowBuilderToolAdapter.invoke(toolName, payload);
  }

  private mapInvokeError(
    registeredToolName: RegisteredToolName,
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
      case 'workflow_builder.validate_plan':
        return {
          ok: false,
          toolName: requestedToolName,
          error: 'Failed to validate workflow plan',
          errorCode: 'VALIDATE_PLAN_FAILED'
        };
      case 'workflow_builder.compile':
        return {
          ok: false,
          toolName: requestedToolName,
          error: 'Failed to compile workflow plan',
          errorCode: 'COMPILE_FAILED'
        };
      case 'workflow_builder.simulate':
        return {
          ok: false,
          toolName: requestedToolName,
          error: 'Failed to simulate workflow plan',
          errorCode: 'SIMULATE_FAILED'
        };
      case 'ontology.ingest_preview':
        return {
          ok: false,
          toolName: requestedToolName,
          error: this.ontologyIngestToolBoundary.getPreviewErrorMessage(),
          errorCode: 'INGEST_PREVIEW_FAILED'
        };
      case 'ontology.ingest_submit':
        return {
          ok: false,
          toolName: requestedToolName,
          error: this.ontologyIngestToolBoundary.getSubmitErrorMessage(),
          errorCode: 'INGEST_SUBMIT_FAILED'
        };
    }

    return assertNever(registeredToolName);
  }
}

function resolveRegisteredToolName(tool: ToolDescriptorDto): RegisteredToolName {
  if (isOntologyToolName(tool.name)) {
    return tool.name;
  }

  if (isWorkflowBuilderToolName(tool.name)) {
    return tool.name;
  }

  if (isOntologyIngestToolName(tool.name)) {
    return tool.name;
  }

  throw new Error(`Unsupported tool registration: ${tool.name}`);
}

function assertNever(value: never): never {
  throw new Error(`Unhandled tool: ${String(value)}`);
}
