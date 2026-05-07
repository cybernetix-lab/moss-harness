import type { OntologyProjectionSubgraphDto } from '@mossclaw/shared';

export function createCyclicProjectionFixture(): OntologyProjectionSubgraphDto {
  return {
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
        id: 'projection:Review:review-001:artifact:Artifact:artifact-001',
        source: 'Review:review-001',
        target: 'Artifact:artifact-001',
        kind: 'projection',
        label: 'artifact',
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
  };
}
