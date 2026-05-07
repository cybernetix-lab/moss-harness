import { describe, expect, it, vi } from 'vitest';
import type { ToolDescriptorDto } from '@mossclaw/shared';
import { BadRequestError } from '../../lib/validation';
import { createDefaultToolRegistry } from './ToolRegistry';
import { ToolGatewayService } from './ToolGatewayService';

function buildToolGatewayService(options: {
  tool?: ToolDescriptorDto;
  adapterResult?: unknown;
  adapterError?: unknown;
  workflowAdapterResult?: unknown;
  workflowAdapterError?: unknown;
  ingestAdapterResult?: unknown;
  ingestAdapterError?: unknown;
} = {}) {
  const tool = options.tool;
  const registry = tool
    ? {
        list: vi.fn(() => [tool]),
        get: vi.fn((name: string) => (name === tool.name ? tool : undefined))
      }
    : createDefaultToolRegistry();

  const ontologyToolAdapter = {
    invoke: options.adapterError
      ? vi.fn().mockRejectedValue(options.adapterError)
      : vi.fn().mockResolvedValue(options.adapterResult)
  };
  const workflowBuilderToolAdapter = {
    invoke: options.workflowAdapterError
      ? vi.fn().mockRejectedValue(options.workflowAdapterError)
      : vi.fn().mockResolvedValue(options.workflowAdapterResult)
  };
  const ontologyIngestToolAdapter = {
    invoke: options.ingestAdapterError
      ? vi.fn().mockRejectedValue(options.ingestAdapterError)
      : vi.fn().mockResolvedValue(options.ingestAdapterResult)
  };

  return {
    toolGatewayService: new ToolGatewayService(
      registry,
      ontologyToolAdapter as never,
      workflowBuilderToolAdapter as never,
      ontologyIngestToolAdapter as never
    ),
    ontologyToolAdapter,
    workflowBuilderToolAdapter,
    ontologyIngestToolAdapter,
    registry
  };
}

describe('ToolGatewayService', () => {
  it('lists ontology and workflow builder tools from the registry', () => {
    const { toolGatewayService } = buildToolGatewayService();

    expect(toolGatewayService.listTools().map((tool) => tool.name)).toEqual([
      'ontology.get_object',
      'ontology.get_schema',
      'ontology.ingest_preview',
      'ontology.ingest_submit',
      'ontology.query',
      'workflow_builder.compile',
      'workflow_builder.simulate',
      'workflow_builder.validate_plan'
    ]);
  });

  it('dispatches registered tools to the ontology adapter', async () => {
    const tool = createDefaultToolRegistry().get('ontology.get_schema');
    const { toolGatewayService, ontologyToolAdapter } = buildToolGatewayService({
      tool,
      adapterResult: {
        objectTypes: [
          {
            objectType: 'Order',
            description: 'Order business object',
            properties: []
          }
        ]
      }
    });
    const payload = {};

    await expect(toolGatewayService.invoke('ontology.get_schema', payload)).resolves.toEqual({
      ok: true,
      toolName: 'ontology.get_schema',
      result: {
        objectTypes: [
          {
            objectType: 'Order',
            description: 'Order business object',
            properties: []
          }
        ]
      }
    });
    expect(ontologyToolAdapter.invoke).toHaveBeenCalledWith('ontology.get_schema', payload);
  });

  it('returns OBJECT_NOT_FOUND when ontology.get_object misses', async () => {
    const tool = createDefaultToolRegistry().get('ontology.get_object');
    const { toolGatewayService, ontologyToolAdapter } = buildToolGatewayService({
      tool,
      adapterResult: null
    });

    await expect(
      toolGatewayService.invoke('ontology.get_object', {
        arguments: {
          objectType: 'Order',
          objectId: 'missing'
        }
      })
    ).resolves.toEqual({
      ok: false,
      toolName: 'ontology.get_object',
      error: 'Ontology object not found',
      errorCode: 'OBJECT_NOT_FOUND'
    });
    expect(ontologyToolAdapter.invoke).toHaveBeenCalledWith('ontology.get_object', {
      arguments: {
        objectType: 'Order',
        objectId: 'missing'
      }
    });
  });

  it('returns TOOL_NOT_FOUND for unknown tools', async () => {
    const { toolGatewayService, ontologyToolAdapter } = buildToolGatewayService();

    await expect(toolGatewayService.invoke('unknown.tool', {})).resolves.toEqual({
      ok: false,
      toolName: 'unknown.tool',
      error: 'Tool not found',
      errorCode: 'TOOL_NOT_FOUND'
    });
    expect(ontologyToolAdapter.invoke).not.toHaveBeenCalled();
  });

  it('maps bad request errors to INVALID_ARGUMENT', async () => {
    const tool = createDefaultToolRegistry().get('ontology.query');
    const { toolGatewayService } = buildToolGatewayService({
      tool,
      adapterError: new BadRequestError('Tool arguments.objectType is required')
    });

    await expect(toolGatewayService.invoke('ontology.query', { arguments: {} })).resolves.toEqual({
      ok: false,
      toolName: 'ontology.query',
      error: 'Tool arguments.objectType is required',
      errorCode: 'INVALID_ARGUMENT'
    });
  });

  it('maps schema load failures to SCHEMA_LOAD_FAILED', async () => {
    const tool = createDefaultToolRegistry().get('ontology.get_schema');
    const { toolGatewayService } = buildToolGatewayService({
      tool,
      adapterError: new Error('db offline')
    });

    await expect(toolGatewayService.invoke('ontology.get_schema', {})).resolves.toEqual({
      ok: false,
      toolName: 'ontology.get_schema',
      error: 'Failed to load ontology schema',
      errorCode: 'SCHEMA_LOAD_FAILED'
    });
  });

  it('fails fast when registry returns an unsupported tool definition', async () => {
    const { toolGatewayService } = buildToolGatewayService({
      tool: {
        name: 'non-ontology.tool',
        category: 'ontology',
        description: 'Unsupported test tool',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        outputSchema: { type: 'object', properties: {}, additionalProperties: false },
        errors: []
      }
    });

    await expect(toolGatewayService.invoke('non-ontology.tool', {})).rejects.toThrow(
      'Unsupported tool registration: non-ontology.tool'
    );
  });

  it('dispatches workflow_builder tools to the workflow builder adapter', async () => {
    const tool = createDefaultToolRegistry().get('workflow_builder.compile');
    const { toolGatewayService, workflowBuilderToolAdapter, ontologyToolAdapter } =
      buildToolGatewayService({
        tool,
        workflowAdapterResult: {
          ok: true,
          accepted: false,
          diagnostics: [
            {
              code: 'NO_ELIGIBLE_ACTION',
              severity: 'error',
              message: 'No eligible action matched workflow step "Send a Slack message"',
              stepId: 'step-1'
            }
          ]
        }
      });
    const payload = {
      arguments: {
        goal: {
          title: 'Review pending orders'
        },
        plan: {
          steps: [
            {
              stepId: 'step-1',
              title: 'Send a Slack message',
              capabilityTags: ['notify']
            }
          ]
        }
      }
    };

    await expect(toolGatewayService.invoke('workflow_builder.compile', payload)).resolves.toEqual({
      ok: true,
      toolName: 'workflow_builder.compile',
      result: {
        ok: true,
        accepted: false,
        diagnostics: [
          {
            code: 'NO_ELIGIBLE_ACTION',
            severity: 'error',
            message: 'No eligible action matched workflow step "Send a Slack message"',
            stepId: 'step-1'
          }
        ]
      }
    });
    expect(workflowBuilderToolAdapter.invoke).toHaveBeenCalledWith('workflow_builder.compile', payload);
    expect(ontologyToolAdapter.invoke).not.toHaveBeenCalled();
  });

  it('dispatches ontology ingest tools to the ingest adapter', async () => {
    const tool = {
      name: 'ontology.ingest_preview',
      category: 'ontology',
      description: 'Preview ontology ingest',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      outputSchema: { type: 'object', properties: {}, additionalProperties: false },
      errors: []
    };
    const { toolGatewayService, ontologyIngestToolAdapter, ontologyToolAdapter, workflowBuilderToolAdapter } =
      buildToolGatewayService({
        tool,
        ingestAdapterResult: {
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
        }
      });
    const payload = {
      arguments: {
        source: {
          kind: 'json'
        },
        objects: []
      }
    };

    await expect(toolGatewayService.invoke('ontology.ingest_preview', payload)).resolves.toEqual({
      ok: true,
      toolName: 'ontology.ingest_preview',
      result: {
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
      }
    });
    expect(ontologyIngestToolAdapter.invoke).toHaveBeenCalledWith('ontology.ingest_preview', payload);
    expect(ontologyToolAdapter.invoke).not.toHaveBeenCalled();
    expect(workflowBuilderToolAdapter.invoke).not.toHaveBeenCalled();
  });
});
