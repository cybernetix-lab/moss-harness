import { describe, expect, it } from 'vitest';
import { createCyclicProjectionFixture } from './cyclicProjectionFixture';
import { LoopAnalysisService } from './LoopAnalysisService';

describe('LoopAnalysisService', () => {
  it('returns structural loop summaries for a cyclic subgraph', async () => {
    const service = new LoopAnalysisService();

    await expect(
      service.analyze({
        subgraph: createCyclicProjectionFixture()
      })
    ).resolves.toEqual({
      loops: [
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
      ]
    });
  });

  it('returns an empty loop list when no cycle exists', async () => {
    const service = new LoopAnalysisService();

    await expect(
      service.analyze({
        subgraph: {
          focusNodeId: 'Order:order-001',
          nodes: [
            {
              id: 'Order:order-001',
              kind: 'instance',
              label: 'Order 001',
              objectType: 'Order',
              objectId: 'order-001'
            }
          ],
          edges: [],
          depth: 1,
          truncated: false
        }
      })
    ).resolves.toEqual({
      loops: []
    });
  });
});
