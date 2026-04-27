import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { OntologyController } from './OntologyController';

function buildMockResponse() {
  const response = {} as Response;
  response.status = vi.fn().mockReturnValue(response);
  response.json = vi.fn().mockReturnValue(response);
  return response;
}

describe('OntologyController', () => {
  it('returns schema through ontology schema endpoint', async () => {
    const getSchema = vi.fn().mockResolvedValue({
      objectTypes: [
        {
          objectType: 'Order',
          description: '订单对象',
          properties: [{ name: 'amount', type: 'number', required: true }]
        }
      ]
    });
    const controller = new OntologyController({
      getSchema
    } as never);

    const req = {} as Request;
    const res = buildMockResponse();

    await controller.getSchema(req, res);

    expect(getSchema).toHaveBeenCalledTimes(1);
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
    const getObject = vi.fn().mockResolvedValue({
      objectType: 'Order',
      objectId: 'order-001',
      displayName: 'Order 001',
      state: 'PendingReview',
      properties: { amount: 1250 }
    });
    const controller = new OntologyController({
      getObject
    } as never);

    const req = {
      params: {
        objectType: '  Order  ',
        objectId: '  order-001  '
      }
    } as unknown as Request;
    const res = buildMockResponse();

    await controller.getObject(req, res);

    expect(getObject).toHaveBeenCalledWith('Order', 'order-001');
    expect(res.json).toHaveBeenCalledWith({
      objectType: 'Order',
      objectId: 'order-001',
      displayName: 'Order 001',
      state: 'PendingReview',
      properties: { amount: 1250 }
    });
  });

  it('returns 404 when ontology object is not found', async () => {
    const getObject = vi.fn().mockResolvedValue(null);
    const controller = new OntologyController({
      getObject
    } as never);

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
    const queryObjects = vi.fn().mockResolvedValue({
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
    const controller = new OntologyController({
      queryObjects
    } as never);

    const req = {
      body: {
        objectType: '  Order  ',
        state: '  PendingReview  '
      }
    } as Request;
    const res = buildMockResponse();

    await controller.queryObjects(req, res);

    expect(queryObjects).toHaveBeenCalledWith({
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
    const getObject = vi.fn();
    const controller = new OntologyController({
      getObject
    } as never);

    const req = {
      params: {
        objectType: '   ',
        objectId: 'order-001'
      }
    } as unknown as Request;
    const res = buildMockResponse();

    await controller.getObject(req, res);

    expect(getObject).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Ontology objectType is required'
    });
  });

  it('returns 400 when ontology query payload is invalid', async () => {
    const queryObjects = vi.fn();
    const controller = new OntologyController({
      queryObjects
    } as never);

    const req = {
      body: []
    } as unknown as Request;
    const res = buildMockResponse();

    await controller.queryObjects(req, res);

    expect(queryObjects).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Ontology query payload must be an object'
    });
  });

  it('returns 500 when ontology service throws an unexpected error', async () => {
    const controller = new OntologyController({
      getSchema: vi.fn().mockRejectedValue(new Error('schema unavailable'))
    } as never);

    const req = {} as Request;
    const res = buildMockResponse();

    await controller.getSchema(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Failed to load ontology schema'
    });
  });

  it('returns stable 500 message when getObject fails unexpectedly', async () => {
    const controller = new OntologyController({
      getObject: vi.fn().mockRejectedValue(new Error('database offline'))
    } as never);

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
    const controller = new OntologyController({
      queryObjects: vi.fn().mockRejectedValue(new Error('query timeout'))
    } as never);

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
