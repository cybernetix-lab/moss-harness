import type { OntologyLoopSummaryDto, OntologyProjectionEdgeDto, OntologyProjectionSubgraphDto } from '@mossclaw/shared';

interface CanonicalCycle {
  nodeIds: string[];
  edgeIds: string[];
}

function rotateList<T>(items: T[], startIndex: number): T[] {
  return [...items.slice(startIndex), ...items.slice(0, startIndex)];
}

function canonicalizeCycle(nodeIds: string[], edgeIds: string[]): CanonicalCycle {
  let bestNodes = nodeIds;
  let bestEdges = edgeIds;
  let bestKey = nodeIds.join('>');

  for (let index = 1; index < nodeIds.length; index += 1) {
    const rotatedNodes = rotateList(nodeIds, index);
    const rotatedEdges = rotateList(edgeIds, index);
    const key = rotatedNodes.join('>');
    if (key < bestKey) {
      bestKey = key;
      bestNodes = rotatedNodes;
      bestEdges = rotatedEdges;
    }
  }

  return {
    nodeIds: bestNodes,
    edgeIds: bestEdges
  };
}

function buildAdjacency(edges: OntologyProjectionEdgeDto[]): Map<string, OntologyProjectionEdgeDto[]> {
  const adjacency = new Map<string, OntologyProjectionEdgeDto[]>();
  for (const edge of edges) {
    const existing = adjacency.get(edge.source) ?? [];
    existing.push(edge);
    adjacency.set(edge.source, existing);
  }

  for (const [nodeId, nodeEdges] of adjacency.entries()) {
    adjacency.set(
      nodeId,
      [...nodeEdges].sort((left, right) => left.id.localeCompare(right.id))
    );
  }

  return adjacency;
}

export function detectStructuralCycles(
  subgraph: OntologyProjectionSubgraphDto
): OntologyLoopSummaryDto[] {
  const adjacency = buildAdjacency(subgraph.edges);
  const cycles = new Map<string, OntologyLoopSummaryDto>();
  const sortedNodeIds = [...subgraph.nodes.map((node) => node.id)].sort((left, right) =>
    left.localeCompare(right)
  );

  function visit(
    startNodeId: string,
    currentNodeId: string,
    pathNodeIds: string[],
    pathEdgeIds: string[],
    visited: Set<string>
  ) {
    const outgoingEdges = adjacency.get(currentNodeId) ?? [];
    for (const edge of outgoingEdges) {
      if (edge.target === startNodeId && pathNodeIds.length >= 2) {
        const rawNodeIds = [...pathNodeIds];
        const rawEdgeIds = [...pathEdgeIds, edge.id];
        const canonical = canonicalizeCycle(rawNodeIds, rawEdgeIds);
        const loopId = `loop:${canonical.nodeIds.join('>')}`;
        cycles.set(loopId, {
          loopId,
          nodeIds: canonical.nodeIds,
          edgeIds: canonical.edgeIds,
          length: canonical.nodeIds.length,
          category: 'structural',
          confidence: 1
        });
        continue;
      }

      if (visited.has(edge.target)) {
        continue;
      }

      visited.add(edge.target);
      visit(
        startNodeId,
        edge.target,
        [...pathNodeIds, edge.target],
        [...pathEdgeIds, edge.id],
        visited
      );
      visited.delete(edge.target);
    }
  }

  for (const startNodeId of sortedNodeIds) {
    visit(startNodeId, startNodeId, [startNodeId], [], new Set([startNodeId]));
  }

  return [...cycles.values()].sort((left, right) => left.loopId.localeCompare(right.loopId));
}
