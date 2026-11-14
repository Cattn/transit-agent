import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiClientError, type SavedItinerary, type SaveItineraryRequest } from '@transit/shared';
import { useApi } from './api-context.js';

export function useSavedItineraries(opts?: { pollMs?: number; enabled?: boolean }) {
  const api = useApi();
  const enabled = opts?.enabled ?? true;
  const pollMs = opts?.pollMs ?? 30_000;
  const version = useRef(0);
  const itemsRef = useRef<SavedItinerary[]>([]);
  const mutations = useRef(0);
  const [items, setItems] = useState<SavedItinerary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiClientError>();
  const replace = useCallback((next: SavedItinerary[]) => { itemsRef.current = next; setItems(next); }, []);
  const refresh = useCallback(async () => {
    if (mutations.current) return;
    const current = ++version.current;
    setLoading(true);
    try {
      const next = await api.listItineraries();
      if (current === version.current) { replace(next); setError(undefined); }
    } catch (error) {
      if (current === version.current) setError(error instanceof ApiClientError ? error : new ApiClientError(0, 'unknown', String(error)));
    } finally {
      if (current === version.current) setLoading(false);
    }
  }, [api, replace]);
  const invalidate = useCallback(() => { version.current++; }, []);
  useEffect(() => {
    const initial = setTimeout(() => { if (enabled) void refresh(); }, 0);
    const timer = enabled && pollMs > 0 ? setInterval(() => { void refresh(); }, pollMs) : undefined;
    return () => { clearTimeout(initial); clearInterval(timer); invalidate(); };
  }, [refresh, enabled, pollMs, invalidate]);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const perform = useCallback(async <T,>(optimistic: (items: SavedItinerary[]) => SavedItinerary[], action: () => Promise<T>): Promise<T> => {
    const previous = itemsRef.current;
    const current = ++version.current;
    mutations.current++;
    replace(optimistic(previous));
    setError(undefined);
    let succeeded = false;
    try {
      const result = await action();
      succeeded = true;
      return result;
    } catch (error) {
      if (current === version.current) replace(previous);
      setError(error instanceof ApiClientError ? error : new ApiClientError(0, 'unknown', String(error)));
      throw error;
    } finally {
      mutations.current--;
      if (!mutations.current && succeeded) await refresh();
    }
  }, [refresh, replace]);
  const mutate = useCallback(<T,>(optimistic: (items: SavedItinerary[]) => SavedItinerary[], action: () => Promise<T>): Promise<T> => {
    const task = queue.current.then(() => perform(optimistic, action));
    queue.current = task.catch(() => undefined);
    return task;
  }, [perform]);
  const save = useCallback((input: SaveItineraryRequest) => mutate((items) => [{ ...input.itinerary, request: input.request, label: input.label, watch: input.watch, savedAt: new Date().toISOString() }, ...items.filter((item) => item.id !== input.itinerary.id)], () => api.saveItinerary(input)), [api, mutate]);
  const update = useCallback(async (id: string, patch: { label?: string; watch?: boolean }) => { await mutate((items) => items.map((item) => item.id === id ? { ...item, ...patch } : item), () => api.updateItinerary(id, patch)); }, [api, mutate]);
  const remove = useCallback(async (id: string) => { await mutate((items) => items.filter((item) => item.id !== id), () => api.deleteItinerary(id)); }, [api, mutate]);
  return { items, loading, error, refresh, save, update, remove };
}
