import type {
  ExplorerSidebarTab,
  OntologyExplorerSessionState,
  OntologyExplorerUrlState
} from '../../types/ontologyExplorer';

type ExplorerReducerAction =
  | {
      type: 'RESET_FROM_URL';
      payload: OntologyExplorerSessionState;
    }
  | {
      type: 'SET_ACTIVE_TAB';
      payload: {
        tab: ExplorerSidebarTab;
      };
    }
  | {
      type: 'SELECT_LOOP';
      payload: {
        loopId: string | null;
      };
    };

function createBreadcrumbTrail(urlState: OntologyExplorerUrlState): OntologyExplorerSessionState['breadcrumbTrail'] {
  const breadcrumbTrail: OntologyExplorerSessionState['breadcrumbTrail'] = [];

  if (urlState.type) {
    breadcrumbTrail.push({
      id: `type:${urlState.type}`,
      label: urlState.type,
      kind: 'type',
      objectType: urlState.type
    });
  }

  if (urlState.objectId && urlState.type) {
    breadcrumbTrail.push({
      id: `${urlState.type}:${urlState.objectId}`,
      label: urlState.objectId,
      kind: 'instance',
      objectType: urlState.type,
      objectId: urlState.objectId
    });
  }

  if (urlState.loopId) {
    breadcrumbTrail.push({
      id: urlState.loopId,
      label: 'Loop',
      kind: 'loop',
      loopId: urlState.loopId
    });
  }

  return breadcrumbTrail;
}

export function createInitialExplorerSessionState(
  urlState: OntologyExplorerUrlState
): OntologyExplorerSessionState {
  const focusedNodeId =
    urlState.loopId ?? (urlState.type && urlState.objectId ? `${urlState.type}:${urlState.objectId}` : null);
  const focusedNodeKind = urlState.loopId
    ? 'loop'
    : urlState.objectId
      ? 'instance'
      : urlState.type
        ? 'type'
        : null;

  return {
    selectedType: urlState.type,
    focusedNodeId,
    focusedNodeKind,
    selectedLoopId: urlState.loopId,
    expandedNodeIds: [],
    pinnedNodeIds: [],
    activeSidebarTab: urlState.loopId ? 'loops' : 'overview',
    breadcrumbTrail: createBreadcrumbTrail(urlState)
  };
}

export function explorerReducer(
  state: OntologyExplorerSessionState,
  action: ExplorerReducerAction
): OntologyExplorerSessionState {
  switch (action.type) {
    case 'RESET_FROM_URL':
      return action.payload;
    case 'SET_ACTIVE_TAB':
      return {
        ...state,
        activeSidebarTab: action.payload.tab
      };
    case 'SELECT_LOOP':
      return {
        ...state,
        selectedLoopId: action.payload.loopId,
        focusedNodeId: action.payload.loopId,
        focusedNodeKind: action.payload.loopId ? 'loop' : state.focusedNodeKind,
        activeSidebarTab: action.payload.loopId ? 'loops' : state.activeSidebarTab
      };
    default:
      return state;
  }
}
