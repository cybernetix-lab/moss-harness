import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import type { ToolDescriptorDto } from '@mossclaw/shared';
import { OntologyController } from './OntologyController';
import { OntologyToolBoundary } from '../../services/toolGateway/OntologyToolBoundary';
import { createDefaultToolRegistry } from '../../services/toolGateway/ToolRegistry';

function buildMockResponse() {
  const response = {} as Response;
  response.status = vi.fn().mockReturnValue(response);
  response.json = vi.fn().mockReturnValue(response);
  return response;
}

function buildOntologyServiceMock(overrides: Record<string, unknown> = {}) {
  return {
    getSchema: vi.fn(),
    getObject: vi.fn(),
    queryObjects: vi.fn(),
    ...overrides
  };
}

function buildController(serviceOverrides: Record<string, unknown> = {}) {
  const ontologyService = buildOntologyServiceMock(serviceOverrides);
  const controller = new OntologyController(
    ontologyService as never,
    new OntologyToolBoundary()
  );

  return { controller, ontologyService };
}

function assertCompleteToolMetadata(tool: ToolDescriptorDto) {
  expect(tool.name.trim().length).toBeGreaterThan(0);
  expect(tool.category.trim().length).toBeGreaterThan(0);
  expect(tool.description.trim().length).toBeGreaterThan(0);

  expect(tool.inputSchema).toMatchObject({
    type: 'object',
    additionalProperties: false
  });
  expect(tool.outputSchema).toMatchObject({
    type: 'object',
    additionalProperties: false
  });
  expect(tool.outputSchema).toEqual(
    expect.objectContaining({
      required: expect.arrayContaining(['ok', 'toolName', 'result'])
    })
  );

  expect(tool.errors.length).toBeGreaterThan(0);
  for (const error of tool.errors) {
    expect(error.errorCode.trim().length).toBeGreaterThan(0);
    expect(error.description.trim().length).toBeGreaterThan(0);
  }

  expect(tool.examples?.length).toBeGreaterThan(0);
  for (const example of tool.examples ?? []) {
    expect(example.input).toEqual(expect.any(Object));
    expect(example.output).toEqual(
      expect.objectContaining({
        ok: true,
        toolName: tool.name,
        result: expect.anything()
      })
    );
  }
}

describe('OntologyController', () => {
  it('registers ontology tool descriptors with complete immutable metadata', () => {
    const registry = createDefaultToolRegistry();
    const tools = registry.list();
    const getObjectTool = registry.get('ontology.get_object');
    const getSchemaTool = registry.get('ontology.get_schema');
    const queryTool = registry.get('ontology.query');

    expect(tools.map((tool) => tool.name)).toEqual([
      'ontology.get_object',
      'ontology.get_schema',
      'ontology.query'
    ]);
    expect(getObjectTool).toBeDefined();
    expect(getSchemaTool).toBeDefined();
    expect(queryTool).toBeDefined();

    assertCompleteToolMetadata(getObjectTool!);
    assertCompleteToolMetadata(getSchemaTool!);
    assertCompleteToolMetadata(queryTool!);

    expect(getObjectTool?.errors).toEqual(
      expect.arrayContaining([
        {
          errorCode: 'OBJECT_NOT_FOUND',
          description: 'Ontology object not found'
        }
      ])
    );

    expect(Object.isFrozen(getObjectTool)).toBe(true);
    expect(Object.isFrozen(getObjectTool?.inputSchema)).toBe(true);
    expect(Object.isFrozen(getObjectTool?.outputSchema)).toBe(true);
    expect(Object.isFrozen(getObjectTool?.errors)).toBe(true);
    expect(Object.isFrozen(getObjectTool?.examples)).toBe(true);
    expect(Object.isFrozen(getObjectTool?.examples?.[0]?.output)).toBe(true);

    expect(() => {
      getObjectTool?.errors.push({
        errorCode: 'MUTATED',
        description: 'should fail'
      });
    }).toThrow(TypeError);
    expect(registry.get('ontology.get_object')?.errors).toEqual(
      expect.not.arrayContaining([
        {
          errorCode: 'MUTATED',
          description: 'should fail'
        }
      ])
    );
  });

  it('returns schema through ontology schema endpoint', async () => {
    const { controller, ontologyService } = buildController({
      getSchema: vi.fn().mockResolvedValue({
        objectTypes: [
          {
            objectType: 'Order',
            description: '订单对象',
            properties: [{ name: 'amount', type: 'number', required: true }]
          }
        ]
      })
    });
    const req = {} as Request;
    const res = buildMockResponse();

    await controller.getSchema(req, res);

    expect(ontologyService.getSchema).toHaveBeenCalledTimes(1);
    expect(res.json).toHaveBeenCalledWith({
      objectTypes: [
        {
          objectType: 'Order',
          description: '订单对象',
          properties: [{ name: 'amount', type: 'number', required: true }]
        }
      ]
    });
  });

  it('returns ontology object detail and trims route params', async () => {
    const { controller, ontologyService } = buildController({
      getObject: vi.fn().mockResolvedValue({
        objectType: 'Order',
        objectId: 'order-001',
        displayName: 'Order 001',
        state: 'PendingReview',
        properties: { amount: 1250 }
      })
    });
    const req = {
      params: {
        objectType: '  Order  ',
        objectId: '  order-001  '
      }
    } as unknown as Request;
    const res = buildMockResponse();

    await controller.getObject(req, res);

    expect(ontologyService.getObject).toHaveBeenCalledWith('Order', 'order-001');
    expect(res.json).toHaveBeenCalledWith({
      objectType: 'Order',
      objectId: 'order-001',
      displayName: 'Order 001',
      state: 'PendingReview',
      properties: { amount: 1250 }
    });
  });

  it('returns 404 when ontology object is not found', async () => {
    const { controller } = buildController({
      getObject: vi.fn().mockResolvedValue(null)
    });
    const req = {
      params: {
        objectType: 'Order',
        objectId: 'order-404'
      }
    } as unknown as Request;
    const res = buildMockResponse();

    await controller.getObject(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Ontology object not found'
    });
  });

  it('returns query results and trims optional filters', async () => {
    const { controller, ontologyService } = buildController({
      queryObjects: vi.fn().mockResolvedValue({
        objects: [
          {
            objectType: 'Order',
            objectId: 'order-001',
            displayName: 'Order 001',
            state: 'PendingReview',
            properties: { amount: 1250 }
          }
        ]
      })
    });
    const req = {
      body: {
        objectType: '  Order  ',
        state: '  PendingReview  '
      }
    } as Request;
    const res = buildMockResponse();

    await controller.queryObjects(req, res);

    expect(ontologyService.queryObjects).toHaveBeenCalledWith({
      objectType: 'Order',
      state: 'PendingReview'
    });
    expect(res.json).toHaveBeenCalledWith({
      objects: [
        {
          objectType: 'Order',
          objectId: 'order-001',
          displayName: 'Order 001',
          state: 'PendingReview',
          properties: { amount: 1250 }
        }
      ]
    });
  });

  it('returns 400 when ontology route params are blank', async () => {
    const { controller, ontologyService } = buildController();
    const req = {
      params: {
        objectType: '   ',
        objectId: 'order-001'
      }
    } as unknown as Request;
    const res = buildMockResponse();

    await controller.getObject(req, res);

    expect(ontologyService.getObject).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Ontology objectType is required'
    });
  });

  it('returns 400 when ontology query payload is invalid', async () => {
    const { controller, ontologyService } = buildController();
    const req = {
      body: []
    } as unknown as Request;
    const res = buildMockResponse();

    await controller.queryObjects(req, res);

    expect(ontologyService.queryObjects).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Ontology query payload must be an object'
    });
  });

  it('returns 500 when ontology service throws an unexpected error', async () => {
    const { controller } = buildController({
      getSchema: vi.fn().mockRejectedValue(new Error('schema unavailable'))
    });

    const req = {} as Request;
    const res = buildMockResponse();

    await controller.getSchema(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Failed to load ontology schema'
    });
  });

  it('returns stable 500 message when getObject fails unexpectedly', async () => {
    const { controller } = buildController({
      getObject: vi.fn().mockRejectedValue(new Error('database offline'))
    });

    const req = {
      params: {
        objectType: 'Order',
        objectId: 'order-001'
      }
    } as unknown as Request;
    const res = buildMockResponse();

    await controller.getObject(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Failed to load ontology object'
    });
  });

  it('returns stable 500 message when queryObjects fails unexpectedly', async () => {
    const { controller } = buildController({
      queryObjects: vi.fn().mockRejectedValue(new Error('query timeout'))
    });

    const req = {
      body: {
        objectType: 'Order'
      }
    } as unknown as Request;
    const res = buildMockResponse();

    await controller.queryObjects(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Failed to query ontology objects'
    });
  });
});
