import { describe, expect, it, vi } from 'vitest';
import type { ToolDescriptorDto } from '@mossclaw/shared';
import { BadRequestError } from '../../lib/validation';
import { createDefaultToolRegistry } from './ToolRegistry';
import { ToolGatewayService } from './ToolGatewayService';

function buildToolGatewayService(options: {
  tool?: ToolDescriptorDto;
  adapterResult?: unknown;
  adapterError?: unknown;
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

  return {
    toolGatewayService: new ToolGatewayService(registry, ontologyToolAdapter),
    ontologyToolAdapter,
    registry
  };
}

describe('ToolGatewayService', () => {
  it('lists ontology tools from the registry', () => {
    const { toolGatewayService } = buildToolGatewayService();

    expect(toolGatewayService.listTools().map((tool) => tool.name)).toEqual([
      'ontology.get_object',
      'ontology.get_schema',
      'ontology.query'
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
      'Unsupported ontology tool registration: non-ontology.tool'
    );
  });
});
