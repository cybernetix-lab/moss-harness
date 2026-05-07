import type {
  OntologyProjectionNeighborsRequestDto,
  OntologyProjectionNeighborsResponseDto,
  OntologyProjectionSubgraphDto,
  OntologyProjectionSubgraphRequestDto,
  OntologyQueryResponseDto
} from '@mossclaw/shared';
import { BadRequestError } from '../../lib/validation';
import type { OntologyService } from '../OntologyService';
import { buildProjectionNeighbors } from './NeighborProjectionBuilder';

type OntologyObjectReader = Pick<OntologyService, 'getObject' | 'queryObjects'> | {
  getObject: (objectType: string, objectId: string) => Promise<any>;
  queryObjects: () => Promise<OntologyQueryResponseDto>;
};

const MVP_MAX_DEPTH = 1;

function normalizeDepth(depth?: number): number {
  if (depth === undefined) {
    return 1;
  }

  if (!Number.isInteger(depth) || depth <= 0 || depth > MVP_MAX_DEPTH) {
    throw new BadRequestError('depth must be 1 in the MVP');
  }

  return depth;
}

export class SubgraphProjectionService {
  constructor(private readonly ontologyService: OntologyObjectReader) {}

  async getNeighbors(
    payload: OntologyProjectionNeighborsRequestDto
  ): Promise<OntologyProjectionNeighborsResponseDto> {
    return this.getSubgraph(payload);
  }

  async getSubgraph(
    payload: OntologyProjectionSubgraphRequestDto
  ): Promise<OntologyProjectionSubgraphDto> {
    const depth = normalizeDepth(payload.depth);
    const focus = await this.ontologyService.getObject(payload.objectType, payload.objectId);
    if (!focus) {
      throw new BadRequestError('Ontology object not found');
    }

    const { objects } = await this.ontologyService.queryObjects();
    const projection = buildProjectionNeighbors({
      focus,
      candidates: objects
    });

    const nodes = [projection.focusNode, ...projection.neighborNodes].sort((left, right) =>
      left.id.localeCompare(right.id)
    );
    const edges = [...projection.outboundEdges, ...projection.inboundEdges].sort((left, right) =>
      left.id.localeCompare(right.id)
    );

    return {
      focusNodeId: projection.focusNode.id,
      nodes,
      edges,
      depth,
      truncated: false,
      stats: {
        nodeCount: nodes.length,
        edgeCount: edges.length,
        loopCount: 0
      }
    };
  }
}
