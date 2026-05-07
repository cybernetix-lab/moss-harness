import { describe, expect, it } from 'vitest';
import type { OntologyProjectionSubgraphDto } from '@mossclaw/shared';
import { createCyclicProjectionFixture } from './cyclicProjectionFixture';
import { detectStructuralCycles } from './detectStructuralCycles';

describe('detectStructuralCycles', () => {
  it('returns an empty list when the subgraph has no structural cycle', () => {
    const subgraph: OntologyProjectionSubgraphDto = {
      focusNodeId: 'Order:order-001',
      nodes: [
        {
          id: 'Order:order-001',
          kind: 'instance',
          label: 'Order 001',
          objectType: 'Order',
          objectId: 'order-001'
        },
        {
          id: 'Review:review-001',
          kind: 'instance',
          label: 'Review 001',
          objectType: 'Review',
          objectId: 'review-001'
        }
      ],
      edges: [
        {
          id: 'projection:Order:order-001:review:Review:review-001',
          source: 'Order:order-001',
          target: 'Review:review-001',
          kind: 'projection',
          label: 'review',
          edgeSource: 'property-reference'
        }
      ],
      depth: 1,
      truncated: false
    };

    expect(detectStructuralCycles(subgraph)).toEqual([]);
  });

  it('returns a stable single cycle from the cyclic projection fixture', () => {
    expect(detectStructuralCycles(createCyclicProjectionFixture())).toEqual([
      {
        loopId: 'loop:Artifact:artifact-001>Order:order-001>Review:review-001',
        nodeIds: [
          'Artifact:artifact-001',
          'Order:order-001',
          'Review:review-001'
        ],
        edgeIds: [
          'projection:Artifact:artifact-001:relatedOrder:Order:order-001',
          'projection:Order:order-001:review:Review:review-001',
          'projection:Review:review-001:artifact:Artifact:artifact-001'
        ],
        length: 3,
        category: 'structural',
        confidence: 1
      }
    ]);
  });

  it('returns stable multiple cycles without duplicates', () => {
    const subgraph = createCyclicProjectionFixture();
    subgraph.edges.push({
      id: 'projection:Review:review-001:subject:Order:order-001',
      source: 'Review:review-001',
      target: 'Order:order-001',
      kind: 'projection',
      label: 'subject',
      edgeSource: 'property-reference'
    });
    subgraph.stats = {
      nodeCount: 3,
      edgeCount: 4,
      loopCount: 0
    };

    expect(detectStructuralCycles(subgraph)).toEqual([
      {
        loopId: 'loop:Artifact:artifact-001>Order:order-001>Review:review-001',
        nodeIds: [
          'Artifact:artifact-001',
          'Order:order-001',
          'Review:review-001'
        ],
        edgeIds: [
          'projection:Artifact:artifact-001:relatedOrder:Order:order-001',
          'projection:Order:order-001:review:Review:review-001',
          'projection:Review:review-001:artifact:Artifact:artifact-001'
        ],
        length: 3,
        category: 'structural',
        confidence: 1
      },
      {
        loopId: 'loop:Order:order-001>Review:review-001',
        nodeIds: ['Order:order-001', 'Review:review-001'],
        edgeIds: [
          'projection:Order:order-001:review:Review:review-001',
          'projection:Review:review-001:subject:Order:order-001'
        ],
        length: 2,
        category: 'structural',
        confidence: 1
      }
    ]);
  });
});
