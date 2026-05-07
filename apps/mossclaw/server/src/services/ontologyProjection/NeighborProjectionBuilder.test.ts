import { describe, expect, it } from 'vitest';
import type { OntologyObjectDto } from '@mossclaw/shared';
import {
  buildProjectionNeighbors,
  buildProjectionNodeId
} from './NeighborProjectionBuilder';

describe('NeighborProjectionBuilder', () => {
  it('derives outbound edges only from explicit object references', () => {
    const focus: OntologyObjectDto = {
      objectType: 'Order',
      objectId: 'order-001',
      displayName: 'Order 001',
      state: 'PendingReview',
      properties: {
        owner: {
          objectType: 'User',
          objectId: 'user-007'
        },
        auditTrail: [
          {
            objectType: 'Artifact',
            objectId: 'artifact-001'
          }
        ],
        suspiciousText: 'User:user-007',
        count: 3
      }
    };

    const neighbors = buildProjectionNeighbors({
      focus,
      candidates: []
    });

    expect([...neighbors.outboundEdges].sort((left, right) => left.id.localeCompare(right.id))).toEqual([
      {
        id: 'projection:Order:order-001:auditTrail[0]:Artifact:artifact-001',
        source: 'Order:order-001',
        target: 'Artifact:artifact-001',
        kind: 'projection',
        label: 'auditTrail[0]',
        edgeSource: 'property-reference'
      },
      {
        id: 'projection:Order:order-001:owner:User:user-007',
        source: 'Order:order-001',
        target: 'User:user-007',
        kind: 'projection',
        label: 'owner',
        edgeSource: 'property-reference'
      }
    ]);
  });

  it('derives inbound edges from other objects that explicitly reference the focus object', () => {
    const focus: OntologyObjectDto = {
      objectType: 'Order',
      objectId: 'order-001',
      displayName: 'Order 001',
      state: 'PendingReview',
      properties: {}
    };
    const review: OntologyObjectDto = {
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
    };

    const neighbors = buildProjectionNeighbors({
      focus,
      candidates: [review]
    });

    expect(neighbors.inboundEdges).toEqual([
      {
        id: 'projection:Review:review-001:subject:Order:order-001',
        source: 'Review:review-001',
        target: 'Order:order-001',
        kind: 'projection',
        label: 'subject',
        edgeSource: 'property-reference'
      }
    ]);
    expect(neighbors.neighborIds).toEqual(['Review:review-001']);
  });

  it('deduplicates repeated references to the same target by edge id and node id', () => {
    const focus: OntologyObjectDto = {
      objectType: 'Order',
      objectId: 'order-001',
      displayName: 'Order 001',
      state: 'PendingReview',
      properties: {
        primaryReview: {
          objectType: 'Review',
          objectId: 'review-001'
        },
        nested: {
          review: {
            objectType: 'Review',
            objectId: 'review-001'
          }
        }
      }
    };

    const neighbors = buildProjectionNeighbors({
      focus,
      candidates: []
    });

    expect(neighbors.neighborIds).toEqual([buildProjectionNodeId('Review', 'review-001')]);
    expect(neighbors.outboundEdges).toHaveLength(2);
    expect(new Set(neighbors.outboundEdges.map((edge) => edge.id)).size).toBe(2);
  });
});
