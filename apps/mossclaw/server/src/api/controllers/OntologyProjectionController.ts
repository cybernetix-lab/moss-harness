import type { Request, Response } from 'express';
import type {
  OntologyLoopAnalysisRequestDto,
  OntologyLoopAnalysisResponseDto,
  OntologyProjectionNeighborsRequestDto,
  OntologyProjectionNeighborsResponseDto,
  OntologyProjectionSubgraphDto,
  OntologyProjectionSubgraphRequestDto,
  OntologyProjectionTypesResponseDto
} from '@mossclaw/shared';
import { BadRequestError, isBadRequestError, requireObject, requireTrimmedString } from '../../lib/validation';

export type OntologyProjectionHandlers = {
  getTypes: () => Promise<OntologyProjectionTypesResponseDto> | OntologyProjectionTypesResponseDto;
  getNeighbors: (
    payload: OntologyProjectionNeighborsRequestDto
  ) => Promise<OntologyProjectionNeighborsResponseDto> | OntologyProjectionNeighborsResponseDto;
  getSubgraph: (
    payload: OntologyProjectionSubgraphRequestDto
  ) => Promise<OntologyProjectionSubgraphDto> | OntologyProjectionSubgraphDto;
  analyzeLoops: (
    payload: OntologyLoopAnalysisRequestDto
  ) => Promise<OntologyLoopAnalysisResponseDto> | OntologyLoopAnalysisResponseDto;
};

const DEFAULT_DEPTH = 1;

function buildFocusNodeId(objectType: string, objectId: string): string {
  return `${objectType}:${objectId}`;
}

function createDefaultHandlers(): OntologyProjectionHandlers {
  return {
    getTypes: () => ({
      nodes: [],
      edges: []
    }),
    getNeighbors: ({ objectType, objectId, depth }) => ({
      focusNodeId: buildFocusNodeId(objectType, objectId),
      nodes: [],
      edges: [],
      depth: depth ?? DEFAULT_DEPTH,
      truncated: false
    }),
    getSubgraph: ({ objectType, objectId, depth }) => ({
      focusNodeId: buildFocusNodeId(objectType, objectId),
      nodes: [],
      edges: [],
      depth: depth ?? DEFAULT_DEPTH,
      truncated: false
    }),
    analyzeLoops: () => ({
      loops: []
    })
  };
}

function normalizeOptionalDepth(value: unknown): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = typeof rawValue === 'number' ? rawValue : Number(rawValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new BadRequestError('depth must be a positive integer');
  }

  return parsed;
}

function normalizeNeighborsRequest(req: Request): OntologyProjectionNeighborsRequestDto {
  return {
    objectType: requireTrimmedString(req.params.objectType, 'objectType'),
    objectId: requireTrimmedString(req.params.objectId, 'objectId'),
    depth: normalizeOptionalDepth(req.query.depth)
  };
}

function normalizeSubgraphRequest(req: Request): OntologyProjectionSubgraphRequestDto {
  const payload = requireObject(req.body, 'Ontology projection subgraph request');
  return {
    objectType: requireTrimmedString(payload.objectType, 'objectType'),
    objectId: requireTrimmedString(payload.objectId, 'objectId'),
    depth: normalizeOptionalDepth(payload.depth)
  };
}

function normalizeLoopAnalysisRequest(req: Request): OntologyLoopAnalysisRequestDto {
  const payload = requireObject(req.body, 'Ontology loop analysis request');
  return {
    subgraph: requireObject(payload.subgraph, 'subgraph') as unknown as OntologyProjectionSubgraphDto
  };
}

export class OntologyProjectionController {
  private readonly handlers: OntologyProjectionHandlers;

  constructor(handlers: Partial<OntologyProjectionHandlers> = {}) {
    this.handlers = {
      ...createDefaultHandlers(),
      ...handlers
    };
  }

  async getTypes(_req: Request, res: Response) {
    try {
      const result = await this.handlers.getTypes();
      res.status(200).json(result);
    } catch (error: any) {
      if (isBadRequestError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: 'Failed to load ontology projection types' });
    }
  }

  async getNeighbors(req: Request, res: Response) {
    try {
      const payload = normalizeNeighborsRequest(req);
      const result = await this.handlers.getNeighbors(payload);
      res.status(200).json(result);
    } catch (error: any) {
      if (isBadRequestError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: 'Failed to load ontology projection neighbors' });
    }
  }

  async getSubgraph(req: Request, res: Response) {
    try {
      const payload = normalizeSubgraphRequest(req);
      const result = await this.handlers.getSubgraph(payload);
      res.status(200).json(result);
    } catch (error: any) {
      if (isBadRequestError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: 'Failed to load ontology projection subgraph' });
    }
  }

  async analyzeLoops(req: Request, res: Response) {
    try {
      const payload = normalizeLoopAnalysisRequest(req);
      const result = await this.handlers.analyzeLoops(payload);
      res.status(200).json(result);
    } catch (error: any) {
      if (isBadRequestError(error)) {
        res.status(400).json({ error: error.message });
        return;
      }

      res.status(500).json({ error: 'Failed to analyze ontology projection loops' });
    }
  }
}
