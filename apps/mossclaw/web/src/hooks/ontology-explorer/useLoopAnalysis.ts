import { useEffect, useMemo, useState } from 'react';
import type { OntologyLoopAnalysisResponseDto, OntologyProjectionSubgraphDto } from '@mossclaw/shared';
import { analyzeOntologyProjectionLoops } from '../../services/api';

interface LoopAnalysisResourceState {
  requestKey: string | null;
  loops: OntologyLoopAnalysisResponseDto['loops'];
  error: string | null;
}

function createSubgraphRequestKey(subgraph: OntologyProjectionSubgraphDto | null): string | null {
  if (!subgraph) {
    return null;
  }

  return JSON.stringify({
    focusNodeId: subgraph.focusNodeId,
    depth: subgraph.depth,
    nodeIds: subgraph.nodes.map((node) => node.id).sort(),
    edgeIds: subgraph.edges.map((edge) => edge.id).sort()
  });
}

export function useLoopAnalysis(subgraph: OntologyProjectionSubgraphDto | null) {
  const requestKey = useMemo(() => createSubgraphRequestKey(subgraph), [subgraph]);
  const [resourceState, setResourceState] = useState<LoopAnalysisResourceState>({
    requestKey: null,
    loops: [],
    error: null
  });

  useEffect(() => {
    if (!subgraph || !requestKey) {
      return;
    }

    let isMounted = true;

    analyzeOntologyProjectionLoops({ subgraph })
      .then((response) => {
        if (!isMounted) {
          return;
        }

        setResourceState({
          requestKey,
          loops: response.loops,
          error: null
        });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setResourceState({
          requestKey,
          loops: [],
          error: error instanceof Error ? error.message : 'Failed to analyze structural loops'
        });
      });

    return () => {
      isMounted = false;
    };
  }, [requestKey, subgraph]);

  return {
    loading: requestKey !== null && resourceState.requestKey !== requestKey,
    error: requestKey && resourceState.requestKey === requestKey ? resourceState.error : null,
    loops: requestKey && resourceState.requestKey === requestKey ? resourceState.loops : []
  };
}
