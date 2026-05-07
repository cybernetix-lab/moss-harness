import { describe, expect, it, vi } from 'vitest';
import type { OntologyObjectDto, OntologyQueryResponseDto } from '@mossclaw/shared';
import { BadRequestError } from '../../lib/validation';
import { SubgraphProjectionService } from './SubgraphProjectionService';

function createOntologyServiceStub(objects: OntologyObjectDto[]) {
  return {
    getObject: vi.fn(async (objectType: string, objectId: string) => {
      return objects.find((item) => item.objectType === objectType && item.objectId === objectId) ?? null;
    }),
    queryObjects: vi.fn(async (): Promise<OntologyQueryResponseDto> => ({
      objects
    }))
  };
}

describe('SubgraphProjectionService', () => {
  it('returns focus, outbound neighbors, inbound neighbors, and deduplicated edges for depth 1', async () => {
    const objects: OntologyObjectDto[] = [
      {
        objectType: 'Order',
        objectId: 'order-001',
        displayName: 'Order 001',
        state: 'PendingReview',
        properties: {
          review: {
            objectType: 'Review',
            objectId: 'review-001'
          }
        }
      },
      {
        objectType: 'Review',
        objectId: 'review-001',
        displayName: 'Review 001',
        state: 'Open',
        properties: {
          subject: {
            objectType: 'Order',
            objectId: 'order-001'
          }
        }
      },
      {
        objectType: 'Artifact',
        objectId: 'artifact-001',
        displayName: 'Artifact 001',
        state: 'Captured',
        properties: {
          relatedOrder: {
            objectType: 'Order',
            objectId: 'order-001'
          }
        }
      }
    ];
    const ontologyService = createOntologyServiceStub(objects);
    const service = new SubgraphProjectionService(ontologyService);

    await expect(
      service.getSubgraph({
        objectType: 'Order',
        objectId: 'order-001',
        depth: 1
      })
    ).resolves.toEqual({
      focusNodeId: 'Order:order-001',
      nodes: [
        {
          id: 'Artifact:artifact-001',
          kind: 'instance',
          label: 'Artifact 001',
          objectType: 'Artifact',
          objectId: 'artifact-001',
          plane: 'evidence',
          state: 'Captured',
          metadata: {
            displayName: 'Artifact 001'
          }
        },
        {
          id: 'Order:order-001',
          kind: 'instance',
          label: 'Order 001',
          objectType: 'Order',
          objectId: 'order-001',
          plane: 'execution',
          state: 'PendingReview',
          metadata: {
            displayName: 'Order 001'
          }
        },
        {
          id: 'Review:review-001',
          kind: 'instance',
          label: 'Review 001',
          objectType: 'Review',
          objectId: 'review-001',
          plane: 'execution',
          state: 'Open',
          metadata: {
            displayName: 'Review 001'
          }
        }
      ],
      edges: [
        {
          id: 'projection:Artifact:artifact-001:relatedOrder:Order:order-001',
          source: 'Artifact:artifact-001',
          target: 'Order:order-001',
          kind: 'projection',
          label: 'relatedOrder',
          edgeSource: 'property-reference'
        },
        {
          id: 'projection:Order:order-001:review:Review:review-001',
          source: 'Order:order-001',
          target: 'Review:review-001',
          kind: 'projection',
          label: 'review',
          edgeSource: 'property-reference'
        },
        {
          id: 'projection:Review:review-001:subject:Order:order-001',
          source: 'Review:review-001',
          target: 'Order:order-001',
          kind: 'projection',
          label: 'subject',
          edgeSource: 'property-reference'
        }
      ],
      depth: 1,
      truncated: false,
      stats: {
        nodeCount: 3,
        edgeCount: 3,
        loopCount: 0
      }
    });
  });

  it('throws BadRequestError when depth is not 1 in the MVP', async () => {
    const ontologyService = createOntologyServiceStub([]);
    const service = new SubgraphProjectionService(ontologyService);

    await expect(
      service.getSubgraph({
        objectType: 'Order',
        objectId: 'order-001',
        depth: 2
      })
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it('throws BadRequestError when focus object is missing', async () => {
    const ontologyService = createOntologyServiceStub([]);
    const service = new SubgraphProjectionService(ontologyService);

    await expect(
      service.getSubgraph({
        objectType: 'Order',
        objectId: 'missing'
      })
    ).rejects.toThrow('Ontology object not found');
  });
});
