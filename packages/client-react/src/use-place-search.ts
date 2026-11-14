import { useEffect, useState } from 'react';
import type { LngLat, Place } from '@transit/shared';
import { useApi } from './api-context.js';

export function usePlaceSearch(query: string, opts?: { debounceMs?: number; near?: LngLat }) {
  const api = useApi();
  const debounceMs = opts?.debounceMs ?? 250;
  const lng = opts?.near?.[0];
  const lat = opts?.near?.[1];
  const [state, setState] = useState<{ results: Place[]; loading: boolean }>({ results: [], loading: false });
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      if (query.trim().length < 3) { setState({ results: [], loading: false }); return; }
      setState({ results: [], loading: true });
      void api.searchPlaces(query.trim(), lng !== undefined && lat !== undefined ? [lng, lat] : undefined)
        .then((results) => { if (active) setState({ results, loading: false }); })
        .catch(() => { if (active) setState({ results: [], loading: false }); });
    }, query.trim().length < 3 ? 0 : debounceMs);
    return () => { active = false; clearTimeout(timer); };
  }, [api, query, debounceMs, lng, lat]);
  return query.trim().length < 3 ? { results: [], loading: false } : state;
}
