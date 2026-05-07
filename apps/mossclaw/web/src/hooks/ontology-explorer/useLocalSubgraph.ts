import { useEffect, useMemo, useState } from 'react';
import type { OntologyProjectionSubgraphDto } from '@mossclaw/shared';
import { getOntologyProjectionSubgraph } from '../../services/api';

interface LocalSubgraphResourceState {
  requestKey: string | null;
  subgraph: OntologyProjectionSubgraphDto | null;
  error: string | null;
}

export function useLocalSubgraph(input: {
  objectType: string | null;
  objectId: string | null;
  depth: number;
}) {
  const { objectType, objectId, depth } = input;
  const requestKey = useMemo(
    () => (objectType && objectId ? `${objectType}:${objectId}:depth=${depth}` : null),
    [depth, objectId, objectType]
  );
  const [resourceState, setResourceState] = useState<LocalSubgraphResourceState>({
    requestKey: null,
    subgraph: null,
    error: null
  });

  useEffect(() => {
    if (!objectType || !objectId || !requestKey) {
      return;
    }

    let isMounted = true;

    getOntologyProjectionSubgraph({
      objectType,
      objectId,
      depth
    })
      .then((subgraph) => {
        if (!isMounted) {
          return;
        }

        setResourceState({
          requestKey,
          subgraph,
          error: null
        });
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setResourceState({
          requestKey,
          subgraph: null,
          error: error instanceof Error ? error.message : 'Failed to load ontology subgraph'
        });
      });

    return () => {
      isMounted = false;
    };
  }, [depth, objectId, objectType, requestKey]);

  return {
    loading: requestKey !== null && resourceState.requestKey !== requestKey,
    error: requestKey && resourceState.requestKey === requestKey ? resourceState.error : null,
    subgraph: requestKey && resourceState.requestKey === requestKey ? resourceState.subgraph : null
  };
}
