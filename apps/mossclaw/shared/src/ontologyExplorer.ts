export type OntologyPlaneDto = 'control' | 'execution' | 'evidence';

export type OntologyProjectionNodeKindDto = 'type' | 'instance' | 'loop';

export type OntologyProjectionEdgeKindDto = 'schema' | 'projection' | 'loop';

export type OntologyLoopCategoryDto = 'structural' | 'unknown';

export interface OntologyProjectionNodeDto {
  id: string;
  kind: OntologyProjectionNodeKindDto;
  label: string;
  objectType?: string;
  objectId?: string;
  plane?: OntologyPlaneDto;
  state?: string;
  metadata?: Record<string, unknown>;
}

export interface OntologyProjectionEdgeDto {
  id: string;
  source: string;
  target: string;
  kind: OntologyProjectionEdgeKindDto;
  label?: string;
  edgeSource?: string;
}

export interface OntologyProjectionStatsDto {
  nodeCount: number;
  edgeCount: number;
  loopCount: number;
}

export interface OntologyProjectionSubgraphDto {
  focusNodeId: string;
  nodes: OntologyProjectionNodeDto[];
  edges: OntologyProjectionEdgeDto[];
  depth: number;
  truncated: boolean;
  stats?: OntologyProjectionStatsDto;
}

export interface OntologyProjectionTypesRequestDto {}

export interface OntologyProjectionTypesResponseDto {
  nodes: OntologyProjectionNodeDto[];
  edges: OntologyProjectionEdgeDto[];
}

export interface OntologyProjectionNeighborsRequestDto {
  objectType: string;
  objectId: string;
  depth?: number;
}

export interface OntologyProjectionNeighborsResponseDto extends OntologyProjectionSubgraphDto {}

export interface OntologyProjectionSubgraphRequestDto {
  objectType: string;
  objectId: string;
  depth?: number;
}

export interface OntologyLoopSummaryDto {
  loopId: string;
  nodeIds: string[];
  edgeIds: string[];
  length: number;
  category: OntologyLoopCategoryDto;
  confidence?: number;
}

export interface OntologyLoopAnalysisRequestDto {
  subgraph: OntologyProjectionSubgraphDto;
}

export interface OntologyLoopAnalysisResponseDto {
  loops: OntologyLoopSummaryDto[];
}
