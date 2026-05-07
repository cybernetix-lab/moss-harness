import { describe, expectTypeOf, it } from 'vitest';
import type {
  OntologyLoopAnalysisRequestDto,
  OntologyLoopAnalysisResponseDto,
  OntologyLoopCategoryDto,
  OntologyPlaneDto,
  OntologyProjectionEdgeDto,
  OntologyProjectionEdgeKindDto,
  OntologyProjectionNeighborsRequestDto,
  OntologyProjectionNeighborsResponseDto,
  OntologyProjectionNodeDto,
  OntologyProjectionNodeKindDto,
  OntologyProjectionStatsDto,
  OntologyProjectionSubgraphDto,
  OntologyProjectionSubgraphRequestDto,
  OntologyProjectionTypesRequestDto,
  OntologyProjectionTypesResponseDto
} from '@mossclaw/shared';

describe('ontology explorer shared contracts', () => {
  it('暴露稳定的 explorer projection dto 契约', () => {
    const plane = 'execution' satisfies OntologyPlaneDto;
    const nodeKind = 'instance' satisfies OntologyProjectionNodeKindDto;
    const edgeKind = 'projection' satisfies OntologyProjectionEdgeKindDto;
    const loopCategory = 'structural' satisfies OntologyLoopCategoryDto;

    const node = {
      id: 'Order:order-001',
      kind: nodeKind,
      label: 'Order 001',
      objectType: 'Order',
      objectId: 'order-001',
      plane,
      state: 'PendingReview',
      metadata: {
        source: 'seed'
      }
    } satisfies OntologyProjectionNodeDto;

    const edge = {
      id: 'edge-order-execution',
      source: 'Order:order-001',
      target: 'Review:review-001',
      kind: edgeKind,
      label: 'projects_to',
      edgeSource: 'projection-rule'
    } satisfies OntologyProjectionEdgeDto;

    const stats = {
      nodeCount: 2,
      edgeCount: 1,
      loopCount: 0
    } satisfies OntologyProjectionStatsDto;

    const subgraphRequest = {
      objectType: 'Order',
      objectId: 'order-001',
      depth: 1
    } satisfies OntologyProjectionSubgraphRequestDto;

    const subgraph = {
      focusNodeId: node.id,
      nodes: [node],
      edges: [edge],
      depth: 1,
      truncated: false,
      stats
    } satisfies OntologyProjectionSubgraphDto;

    const typesRequest = {} satisfies OntologyProjectionTypesRequestDto;

    const typesResponse = {
      nodes: [node],
      edges: [edge]
    } satisfies OntologyProjectionTypesResponseDto;

    const neighborsRequest = {
      objectType: 'Order',
      objectId: 'order-001',
      depth: 1
    } satisfies OntologyProjectionNeighborsRequestDto;

    const neighborsResponse = {
      focusNodeId: node.id,
      nodes: [node],
      edges: [edge],
      depth: 1,
      truncated: false,
      stats
    } satisfies OntologyProjectionNeighborsResponseDto;

    const loopRequest = {
      subgraph
    } satisfies OntologyLoopAnalysisRequestDto;

    const loopResponse = {
      loops: [
        {
          loopId: 'loop-1',
          nodeIds: [node.id, 'Review:review-001'],
          edgeIds: [edge.id],
          length: 2,
          category: loopCategory,
          confidence: 0.8
        }
      ]
    } satisfies OntologyLoopAnalysisResponseDto;

    expectTypeOf(node.plane).toMatchTypeOf<OntologyPlaneDto | undefined>();
    expectTypeOf(node).toMatchTypeOf<OntologyProjectionNodeDto>();
    expectTypeOf(edge).toMatchTypeOf<OntologyProjectionEdgeDto>();
    expectTypeOf(stats).toMatchTypeOf<OntologyProjectionStatsDto>();
    expectTypeOf(subgraphRequest).toMatchTypeOf<OntologyProjectionSubgraphRequestDto>();
    expectTypeOf(subgraph).toMatchTypeOf<OntologyProjectionSubgraphDto>();
    expectTypeOf(typesRequest).toMatchTypeOf<OntologyProjectionTypesRequestDto>();
    expectTypeOf(typesResponse).toMatchTypeOf<OntologyProjectionTypesResponseDto>();
    expectTypeOf(neighborsRequest).toMatchTypeOf<OntologyProjectionNeighborsRequestDto>();
    expectTypeOf(neighborsResponse).toMatchTypeOf<OntologyProjectionNeighborsResponseDto>();
    expectTypeOf(loopRequest).toMatchTypeOf<OntologyLoopAnalysisRequestDto>();
    expectTypeOf(loopResponse).toMatchTypeOf<OntologyLoopAnalysisResponseDto>();
  });
});
