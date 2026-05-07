import { useEffect, useState } from 'react';
import { getOntologyObject } from '../../services/api';
import type { OntologyExplorerObjectDetail } from '../../types/ontologyExplorer';

interface ObjectFocusResourceState {
  requestKey: string | null;
  objectDetail: OntologyExplorerObjectDetail | null;
  error: string | null;
}

function mapObjectDetail(item: Awaited<ReturnType<typeof getOntologyObject>>): OntologyExplorerObjectDetail {
  return {
    objectType: item.objectType,
    objectId: item.objectId,
    displayName: item.displayName,
    state: item.state,
    properties: item.properties
  };
}

export function useObjectFocus(input: {
  objectType: string | null;
  objectId: string | null;
}) {
  const { objectType, objectId } = input;
  const requestKey = objectType && objectId ? `${objectType}:${objectId}` : null;
  const [resourceState, setResourceState] = useState<ObjectFocusResourceState>({
    requestKey: null,
    objectDetail: null,
    error: null
  });

  useEffect(() => {
    if (!objectType || !objectId || !requestKey) {
      return;
    }

    let isMounted = true;

    getOntologyObject(objectType, objectId)
      .then((response) => {
        if (!isMounted) {
          return;
        }

        setResourceState({
          requestKey,
          objectDetail: mapObjectDetail(response),
          error: null
        });
      })
      .catch((err) => {
        if (!isMounted) {
          return;
        }

        setResourceState({
          requestKey,
          objectDetail: null,
          error: err instanceof Error ? err.message : 'Failed to load ontology object detail'
        });
      });

    return () => {
      isMounted = false;
    };
  }, [objectId, objectType, requestKey]);

  const objectDetail =
    requestKey && resourceState.requestKey === requestKey ? resourceState.objectDetail : null;
  const error = requestKey && resourceState.requestKey === requestKey ? resourceState.error : null;
  const loading = requestKey !== null && resourceState.requestKey !== requestKey;

  return {
    loading,
    error,
    objectDetail
  };
}
