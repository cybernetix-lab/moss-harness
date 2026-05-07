export type ExplorerMode = 'schema' | 'instances' | 'loops';

export type ExplorerSidebarTab = 'overview' | 'properties' | 'neighbors' | 'loops' | 'why';

export type ExplorerNodeKind = 'type' | 'instance' | 'loop';

export interface ExplorerBreadcrumb {
  id: string;
  label: string;
  kind: ExplorerNodeKind;
  objectType?: string;
  objectId?: string;
  loopId?: string;
}

export interface OntologyExplorerUrlState {
  mode: ExplorerMode;
  type: string | null;
  objectId: string | null;
  depth: 1;
  state: string | null;
  q: string | null;
  loopId: string | null;
}

export interface OntologyExplorerSessionState {
  selectedType: string | null;
  focusedNodeId: string | null;
  focusedNodeKind: ExplorerNodeKind | null;
  selectedLoopId: string | null;
  expandedNodeIds: string[];
  pinnedNodeIds: string[];
  activeSidebarTab: ExplorerSidebarTab;
  breadcrumbTrail: ExplorerBreadcrumb[];
}

export interface ExplorerMockScenario {
  id: string;
  label: string;
  description: string;
  search: string;
}

export interface OntologyExplorerTypeSummary {
  id: string;
  objectType: string;
  label: string;
  plane: 'control' | 'execution' | 'evidence' | 'unknown';
  description: string | null;
  propertyCount: number;
}

export interface OntologyExplorerPlaneGroup {
  plane: 'control' | 'execution' | 'evidence' | 'unknown';
  label: string;
  items: OntologyExplorerTypeSummary[];
}

export interface OntologyExplorerInstanceSummary {
  id: string;
  objectType: string;
  objectId: string;
  displayName: string;
  state: string;
}

export interface OntologyExplorerObjectDetail {
  objectType: string;
  objectId: string;
  displayName: string;
  state: string;
  properties: Record<string, unknown>;
}

export interface OntologyExplorerGraphStats {
  nodeCount: number;
  edgeCount: number;
  loopCount: number;
  focusLabel: string;
}
