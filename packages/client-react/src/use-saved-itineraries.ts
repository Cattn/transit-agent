import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiClientError, type SavedItinerary, type SaveItineraryRequest } from '@transit/shared';
import { useApi } from './api-context.js';

export function useSavedItineraries(opts?: { pollMs?: number; enabled?: boolean }) {
  const api = useApi();
  const enabled = opts?.enabled ?? true;
  const pollMs = opts?.pollMs ?? 30_000;
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const generation = useRef(0);
  const version = useRef(0);
  const itemsRef = useRef<SavedItinerary[]>([]);
  const mutations = useRef(0);
  const [items, setItems] = useState<SavedItinerary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiClientError>();
  const [previousApi, setPreviousApi] = useState(api);
  if (previousApi !== api) {
    setPreviousApi(api);
    setItems([]);
    setLoading(false);
    setError(undefined);
  }
  const invalidateGeneration = useCallback(() => { generation.current++; }, []);
  useEffect(() => {
    mutations.current = 0;
    itemsRef.current = [];
    queue.current = Promise.resolve();
    return invalidateGeneration;
  }, [api, invalidateGeneration]);
  const replace = useCallback((next: SavedItinerary[]) => { itemsRef.current = next; setItems(next); }, []);
  const refresh = useCallback(async () => {
    if (mutations.current) return;
    const currentGeneration = generation.current;
    const current = ++version.current;
    setLoading(true);
    try {
      const next = await api.listItineraries();
      if (currentGeneration === generation.current && current === version.current) { replace(next); setError(undefined); }
    } catch (error) {
      if (currentGeneration === generation.current && current === version.current) setError(error instanceof ApiClientError ? error : new ApiClientError(0, 'unknown', String(error)));
    } finally {
      if (currentGeneration === generation.current && current === version.current) setLoading(false);
    }
  }, [api, replace]);
  const invalidate = useCallback(() => { version.current++; }, []);
  useEffect(() => {
    const initial = setTimeout(() => { setLoading(false); if (enabled) void refresh(); }, 0);
    const timer = enabled && pollMs > 0 ? setInterval(() => { void refresh(); }, pollMs) : undefined;
    return () => { clearTimeout(initial); clearInterval(timer); invalidate(); };
  }, [refresh, enabled, pollMs, invalidate]);
  const perform = useCallback(async <T,>(optimistic: (items: SavedItinerary[]) => SavedItinerary[], action: () => Promise<T>): Promise<T> => {
    const previous = itemsRef.current;
    const currentGeneration = generation.current;
    const current = ++version.current;
    mutations.current++;
    setLoading(false);
    replace(optimistic(previous));
    setError(undefined);
    let succeeded = false;
    try {
      const result = await action();
      succeeded = true;
      return result;
    } catch (error) {
      if (currentGeneration === generation.current && current === version.current) replace(previous);
      if (currentGeneration === generation.current) setError(error instanceof ApiClientError ? error : new ApiClientError(0, 'unknown', String(error)));
      throw error;
    } finally {
      if (currentGeneration === generation.current) {
        mutations.current--;
        if (!mutations.current && succeeded) await refresh();
      }
    }
  }, [refresh, replace]);
  const mutate = useCallback(<T,>(optimistic: (items: SavedItinerary[]) => SavedItinerary[], action: () => Promise<T>): Promise<T> => {
    const currentGeneration = generation.current;
    const task = queue.current.then(() => {
      if (currentGeneration !== generation.current) throw new ApiClientError(0, 'cancelled', 'API client changed');
      return perform(optimistic, action);
    });
    queue.current = task.catch(() => undefined);
    return task;
  }, [perform]);
  const save = useCallback((input: SaveItineraryRequest) => mutate((items) => [{ ...input.itinerary, request: input.request, label: input.label, watch: input.watch, savedAt: new Date().toISOString() }, ...items.filter((item) => item.id !== input.itinerary.id)], () => api.saveItinerary(input)), [api, mutate]);
  const update = useCallback(async (id: string, patch: { label?: string; watch?: boolean }) => { await mutate((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item), () => api.updateItinerary(id, patch)); }, [api, mutate]);
  const remove = useCallback(async (id: string) => { await mutate((items) => items.filter((item) => item.id !== id), () => api.deleteItinerary(id)); }, [api, mutate]);
  return { items, loading, error, refresh, save, update, remove };
}
