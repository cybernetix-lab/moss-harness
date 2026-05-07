import type {
  ExplorerMode,
  OntologyExplorerSessionState,
  OntologyExplorerUrlState
} from '../../types/ontologyExplorer';
import { createExplorerMockScenarios } from './explorerRouteMocks';
import {
  buildExplorerSearchParams,
  parseExplorerUrlState
} from './useOntologyExplorerController';
import { createInitialExplorerSessionState, explorerReducer } from './explorerReducer';

const scenarios = createExplorerMockScenarios();

const searchScenario = scenarios.find((scenario) => scenario.id === 'search-orders');
if (!searchScenario) {
  throw new Error('search-orders scenario is required');
}

const parsedState = parseExplorerUrlState(new URLSearchParams(searchScenario.search));
const nextParams = buildExplorerSearchParams(parsedState, {
  mode: 'loops',
  loopId: 'loop:Artifact:artifact-001>Order:order-001>Review:review-001'
});
const sessionState = createInitialExplorerSessionState(parsedState);
const reducedState = explorerReducer(sessionState, {
  type: 'SELECT_LOOP',
  payload: {
    loopId: 'loop:Artifact:artifact-001>Order:order-001>Review:review-001'
  }
});

const mode: ExplorerMode = parsedState.mode;
const urlState: OntologyExplorerUrlState = parseExplorerUrlState(nextParams);
const nextSessionState: OntologyExplorerSessionState = reducedState;

void mode;
void urlState;
void nextSessionState;
