import { useEffect, useMemo, useState } from 'react';
import { queryOntology } from '../../services/api';
import type { OntologyExplorerInstanceSummary } from '../../types/ontologyExplorer';

interface InstanceCollectionResourceState {
  requestKey: string | null;
  items: OntologyExplorerInstanceSummary[];
  error: string | null;
}

const EMPTY_INSTANCE_ITEMS: OntologyExplorerInstanceSummary[] = [];

function mapInstanceSummary(item: Awaited<ReturnType<typeof queryOntology>>['objects'][number]): OntologyExplorerInstanceSummary {
  return {
    id: `${item.objectType}:${item.objectId}`,
    objectType: item.objectType,
    objectId: item.objectId,
    displayName: item.displayName,
    state: item.state
  };
}

export function useInstanceCollection(input: {
  objectType: string | null;
  state: string | null;
  q: string | null;
}) {
  const { objectType, state, q } = input;
  const requestKey = useMemo(
    () => (objectType ? `${objectType}::${state ?? ''}` : null),
    [objectType, state]
  );
  const [resourceState, setResourceState] = useState<InstanceCollectionResourceState>({
    requestKey: null,
    items: [],
    error: null
  });

  useEffect(() => {
    if (!objectType || !requestKey) {
      return;
    }

    let isMounted = true;

    queryOntology({
      objectType,
      state: state ?? undefined
    })
      .then((response) => {
        if (!isMounted) {
          return;
        }

        setResourceState({
          requestKey,
          items: response.objects.map(mapInstanceSummary),
          error: null
        });
      })
      .catch((err) => {
        if (!isMounted) {
          return;
        }

        setResourceState({
          requestKey,
          items: [],
          error: err instanceof Error ? err.message : 'Failed to load ontology instances'
        });
      });

    return () => {
      isMounted = false;
    };
  }, [objectType, requestKey, state]);

  const items =
    requestKey && resourceState.requestKey === requestKey
      ? resourceState.items
      : EMPTY_INSTANCE_ITEMS;
  const error = requestKey && resourceState.requestKey === requestKey ? resourceState.error : null;
  const loading = requestKey !== null && resourceState.requestKey !== requestKey;

  const filteredItems = useMemo(() => {
    const keyword = q?.trim().toLowerCase();
    if (!keyword) {
      return items;
    }

    return items.filter(
      (item) =>
        item.displayName.toLowerCase().includes(keyword) ||
        item.objectId.toLowerCase().includes(keyword) ||
        item.objectType.toLowerCase().includes(keyword)
    );
  }, [items, q]);

  return {
    loading,
    error,
    items: filteredItems,
    totalCount: items.length,
    filteredCount: filteredItems.length
  };
}
