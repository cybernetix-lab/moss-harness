import { useEffect, useMemo, useReducer, useState } from 'react';
import type { OntologyProjectionNodeDto } from '@mossclaw/shared';
import { useSearchParams } from 'react-router-dom';
import type { OntologyLoopSummaryDto } from '@mossclaw/shared';
import { getOntologyProjectionTypes } from '../../services/api';
import type {
  ExplorerBreadcrumb,
  ExplorerMode,
  ExplorerMockScenario,
  ExplorerSidebarTab,
  OntologyExplorerInstanceSummary,
  OntologyExplorerObjectDetail,
  OntologyExplorerPlaneGroup,
  OntologyExplorerTypeSummary,
  OntologyExplorerUrlState
} from '../../types/ontologyExplorer';
import { createExplorerMockScenarios } from './explorerRouteMocks';
import { createInitialExplorerSessionState, explorerReducer } from './explorerReducer';
import { useInstanceCollection } from './useInstanceCollection';
import { useLocalSubgraph } from './useLocalSubgraph';
import { useLoopAnalysis } from './useLoopAnalysis';
import { useObjectFocus } from './useObjectFocus';

function normalizeNullableString(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const trimmedValue = value.trim();
  return trimmedValue ? trimmedValue : null;
}

function normalizeMode(value: string | null): ExplorerMode {
  if (value === 'instances' || value === 'loops') {
    return value;
  }

  return 'schema';
}

function normalizeDepth(value: string | null): 1 {
  return value === '1' ? 1 : 1;
}

export function parseExplorerUrlState(searchParams: URLSearchParams): OntologyExplorerUrlState {
  return {
    mode: normalizeMode(searchParams.get('mode')),
    type: normalizeNullableString(searchParams.get('type')),
    objectId: normalizeNullableString(searchParams.get('objectId')),
    depth: normalizeDepth(searchParams.get('depth')),
    state: normalizeNullableString(searchParams.get('state')),
    q: normalizeNullableString(searchParams.get('q')),
    loopId: normalizeNullableString(searchParams.get('loopId'))
  };
}

export function buildExplorerSearchParams(
  baseState: OntologyExplorerUrlState,
  patch: Partial<OntologyExplorerUrlState>
): URLSearchParams {
  const nextState: OntologyExplorerUrlState = {
    ...baseState,
    ...patch
  };
  const params = new URLSearchParams();

  if (nextState.mode !== 'schema') {
    params.set('mode', nextState.mode);
  }
  if (nextState.type) {
    params.set('type', nextState.type);
  }
  if (nextState.objectId) {
    params.set('objectId', nextState.objectId);
  }
  if (nextState.depth !== 1) {
    params.set('depth', String(nextState.depth));
  }
  if (nextState.state) {
    params.set('state', nextState.state);
  }
  if (nextState.q) {
    params.set('q', nextState.q);
  }
  if (nextState.loopId) {
    params.set('loopId', nextState.loopId);
  }

  return params;
}

function readStringMetadata(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.trim() ? value : null;
}

function readNumberMetadata(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function normalizePlane(value: unknown): OntologyExplorerTypeSummary['plane'] {
  if (value === 'control' || value === 'execution' || value === 'evidence') {
    return value;
  }

  return 'unknown';
}

function mapPlaneLabel(plane: OntologyExplorerTypeSummary['plane']): string {
  switch (plane) {
    case 'control':
      return 'Control Plane';
    case 'execution':
      return 'Execution Plane';
    case 'evidence':
      return 'Evidence Plane';
    default:
      return 'Unknown Plane';
  }
}

function mapProjectionTypesToSummaries(
  response: Awaited<ReturnType<typeof getOntologyProjectionTypes>>
): OntologyExplorerTypeSummary[] {
  return response.nodes
    .filter((node) => node.kind === 'type' && node.objectType)
    .map((node) => {
      const metadata = node.metadata ?? {};
      return {
        id: node.id,
        objectType: node.objectType!,
        label: node.label,
        plane: normalizePlane(node.plane),
        description: readStringMetadata(metadata, 'description'),
        propertyCount: readNumberMetadata(metadata, 'propertyCount')
      };
    })
    .sort((left, right) => left.objectType.localeCompare(right.objectType));
}

function groupTypesByPlane(items: OntologyExplorerTypeSummary[]): OntologyExplorerPlaneGroup[] {
  const planeOrder: OntologyExplorerTypeSummary['plane'][] = ['control', 'execution', 'evidence', 'unknown'];
  return planeOrder
    .map((plane) => ({
      plane,
      label: mapPlaneLabel(plane),
      items: items.filter((item) => item.plane === plane)
    }))
    .filter((group) => group.items.length > 0);
}

export function useOntologyExplorerController() {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlState = useMemo(() => parseExplorerUrlState(searchParams), [searchParams]);
  const [typeProjectionLoading, setTypeProjectionLoading] = useState(true);
  const [typeProjectionError, setTypeProjectionError] = useState<string | null>(null);
  const [typeProjectionItems, setTypeProjectionItems] = useState<OntologyExplorerTypeSummary[]>([]);
  const [sessionState, dispatch] = useReducer(
    explorerReducer,
    urlState,
    createInitialExplorerSessionState
  );

  useEffect(() => {
    dispatch({
      type: 'RESET_FROM_URL',
      payload: createInitialExplorerSessionState(urlState)
    });
  }, [urlState]);

  useEffect(() => {
    let isMounted = true;

    getOntologyProjectionTypes()
      .then((response) => {
        if (!isMounted) {
          return;
        }

        setTypeProjectionItems(mapProjectionTypesToSummaries(response));
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setTypeProjectionError(error instanceof Error ? error.message : 'Failed to load ontology projection types');
        setTypeProjectionItems([]);
      })
      .finally(() => {
        if (isMounted) {
          setTypeProjectionLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const mockScenarios = useMemo(() => createExplorerMockScenarios(), []);
  const planeGroups = useMemo(() => groupTypesByPlane(typeProjectionItems), [typeProjectionItems]);
  const currentType = useMemo(
    () => typeProjectionItems.find((item) => item.objectType === sessionState.selectedType) ?? null,
    [sessionState.selectedType, typeProjectionItems]
  );
  const instanceCollection = useInstanceCollection({
    objectType: sessionState.selectedType,
    state: urlState.state,
    q: urlState.q
  });
  const objectFocus = useObjectFocus({
    objectType: urlState.type,
    objectId: urlState.objectId
  });
  const localSubgraph = useLocalSubgraph({
    objectType: urlState.type,
    objectId: urlState.objectId,
    depth: urlState.depth
  });
  const loopAnalysis = useLoopAnalysis(localSubgraph.subgraph);
  const selectedLoop = useMemo<OntologyLoopSummaryDto | null>(
    () => loopAnalysis.loops.find((loop) => loop.loopId === sessionState.selectedLoopId) ?? null,
    [loopAnalysis.loops, sessionState.selectedLoopId]
  );

  function updateUrlState(patch: Partial<OntologyExplorerUrlState>) {
    setSearchParams(buildExplorerSearchParams(urlState, patch), {
      replace: false
    });
  }

  function applyMockScenario(scenario: ExplorerMockScenario) {
    setSearchParams(new URLSearchParams(scenario.search), {
      replace: false
    });
  }

  function setMode(mode: ExplorerMode) {
    updateUrlState({
      mode,
      loopId: mode === 'loops' ? urlState.loopId : null
    });
  }

  function setSearchQuery(value: string) {
    updateUrlState({
      q: normalizeNullableString(value)
    });
  }

  function setStateFilter(value: string | null) {
    updateUrlState({
      state: normalizeNullableString(value)
    });
  }

  function selectType(type: string | null) {
    updateUrlState({
      type: normalizeNullableString(type),
      objectId: null,
      loopId: null
    });
  }

  function focusObject(type: string, objectId: string) {
    updateUrlState({
      mode: 'instances',
      type,
      objectId,
      loopId: null
    });
  }

  function focusGraphNode(node: OntologyProjectionNodeDto) {
    if (node.objectType && node.objectId) {
      focusObject(node.objectType, node.objectId);
      return;
    }

    if (node.objectType) {
      selectType(node.objectType);
    }
  }

  function navigateBreadcrumb(item: ExplorerBreadcrumb) {
    if (item.kind === 'loop') {
      selectLoop(item.loopId ?? null);
      return;
    }

    if (item.kind === 'instance' && item.objectType && item.objectId) {
      focusObject(item.objectType, item.objectId);
      return;
    }

    if (item.objectType) {
      updateUrlState({
        mode: 'instances',
        type: item.objectType,
        objectId: null,
        loopId: null
      });
      return;
    }

    resetExplorer();
  }

  function goBack() {
    if (urlState.loopId) {
      updateUrlState({
        mode: 'instances',
        loopId: null
      });
      return;
    }

    if (urlState.objectId) {
      updateUrlState({
        objectId: null,
        loopId: null
      });
      return;
    }

    if (urlState.type) {
      resetExplorer();
    }
  }

  function selectLoop(loopId: string | null) {
    updateUrlState({
      mode: loopId ? 'loops' : urlState.mode,
      loopId: normalizeNullableString(loopId)
    });
    dispatch({
      type: 'SELECT_LOOP',
      payload: {
        loopId: normalizeNullableString(loopId)
      }
    });
  }

  function setActiveSidebarTab(tab: ExplorerSidebarTab) {
    dispatch({
      type: 'SET_ACTIVE_TAB',
      payload: { tab }
    });
  }

  function resetExplorer() {
    setSearchParams(new URLSearchParams(), {
      replace: false
    });
  }

  const derived = {
    selectedTypeLabel: sessionState.selectedType ?? 'None',
    focusedNodeLabel: sessionState.focusedNodeId ?? 'None',
    currentLoopLabel: sessionState.selectedLoopId ?? 'None',
    currentType,
    planeGroups,
    typeProjectionLoading,
    typeProjectionError,
    instanceCollectionLoading: instanceCollection.loading,
    instanceCollectionError: instanceCollection.error,
    instanceItems: instanceCollection.items as OntologyExplorerInstanceSummary[],
    instanceTotalCount: instanceCollection.totalCount,
    instanceFilteredCount: instanceCollection.filteredCount,
    objectDetailLoading: objectFocus.loading,
    objectDetailError: objectFocus.error,
    objectDetail: objectFocus.objectDetail as OntologyExplorerObjectDetail | null,
    localSubgraphLoading: localSubgraph.loading,
    localSubgraphError: localSubgraph.error,
    localSubgraph: localSubgraph.subgraph,
    localSubgraphStats: localSubgraph.subgraph?.stats ?? null,
    loopAnalysisLoading: loopAnalysis.loading,
    loopAnalysisError: loopAnalysis.error,
    loops: loopAnalysis.loops,
    selectedLoop,
    querySummary: [
      `mode=${urlState.mode}`,
      `type=${urlState.type ?? '-'}`,
      `objectId=${urlState.objectId ?? '-'}`,
      `state=${urlState.state ?? '-'}`,
      `q=${urlState.q ?? '-'}`,
      `loopId=${urlState.loopId ?? '-'}`
    ].join(' | ')
  };

  return {
    urlState,
    sessionState,
    derived,
    mockScenarios,
    actions: {
      applyMockScenario,
      setMode,
      setSearchQuery,
      setStateFilter,
      selectType,
      focusObject,
      focusGraphNode,
      navigateBreadcrumb,
      goBack,
      selectLoop,
      setActiveSidebarTab,
      resetExplorer
    }
  };
}
