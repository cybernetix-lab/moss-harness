import { describe, expect, it, vi } from 'vitest';
import { OntologyToolAdapter } from './OntologyToolAdapter';

function buildOntologyServiceMock(overrides: Record<string, unknown> = {}) {
  return {
    getSchema: vi.fn(),
    getObject: vi.fn(),
    queryObjects: vi.fn(),
    ...overrides
  };
}

function buildAdapter(serviceOverrides: Record<string, unknown> = {}) {
  const ontologyService = buildOntologyServiceMock(serviceOverrides);

  return {
    ontologyToolAdapter: new OntologyToolAdapter(ontologyService),
    ontologyService
  };
}

describe('OntologyToolAdapter', () => {
  it('rejects arguments for ontology.get_schema', async () => {
    const { ontologyToolAdapter, ontologyService } = buildAdapter();

    await expect(
      ontologyToolAdapter.invoke('ontology.get_schema', {
        arguments: {
          unexpected: true
        }
      })
    ).rejects.toThrow('Tool arguments must be empty');
    expect(ontologyService.getSchema).not.toHaveBeenCalled();
  });

  it('rejects unknown arguments for ontology.get_object', async () => {
    const { ontologyToolAdapter, ontologyService } = buildAdapter();

    await expect(
      ontologyToolAdapter.invoke('ontology.get_object', {
        arguments: {
          objectType: 'Order',
          objectId: 'order-001',
          extra: 'forbidden'
        }
      })
    ).rejects.toThrow('Tool arguments.extra is not supported');
    expect(ontologyService.getObject).not.toHaveBeenCalled();
  });

  it('rejects unknown arguments for ontology.query', async () => {
    const { ontologyToolAdapter, ontologyService } = buildAdapter();

    await expect(
      ontologyToolAdapter.invoke('ontology.query', {
        arguments: {
          objectType: 'Order',
          status: 'PendingReview'
        }
      })
    ).rejects.toThrow('Tool arguments.status is not supported');
    expect(ontologyService.queryObjects).not.toHaveBeenCalled();
  });

  it('trims supported arguments before invoking ontology service', async () => {
    const { ontologyToolAdapter, ontologyService } = buildAdapter({
      getObject: vi.fn().mockResolvedValue({
        objectType: 'Order',
        objectId: 'order-001',
        displayName: 'Order 001',
        state: 'PendingReview',
        properties: { amount: 1250 }
      })
    });

    await expect(
      ontologyToolAdapter.invoke('ontology.get_object', {
        arguments: {
          objectType: '  Order  ',
          objectId: '  order-001  '
        }
      })
    ).resolves.toEqual({
      objectType: 'Order',
      objectId: 'order-001',
      displayName: 'Order 001',
      state: 'PendingReview',
      properties: { amount: 1250 }
    });
    expect(ontologyService.getObject).toHaveBeenCalledWith('Order', 'order-001');
  });
});
