import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { parseConnectLink, parseServerState, serverStateFromLegacy, withServer, type ServerState } from './api-url';

export const SERVER_URL_KEY = 'transit.serverUrl';
export const SERVER_STATE_KEY = 'transit.servers';

type Listener = (url: string | null) => void;
type ListListener = (servers: string[]) => void;
const listeners = new Set<Listener>();
const listListeners = new Set<ListListener>();
let current: string | null | undefined;
let saved: string[] | undefined;
let state: ServerState = { active: null, saved: [] };
let known = false;
let loading: Promise<void> | undefined;
let queue: Promise<void> = Promise.resolve();

function publish(url: string | null) {
  current = url;
  for (const listener of listeners) listener(url);
}

function publishList(servers: string[]) {
  saved = servers;
  for (const listener of listListeners) listener(servers);
}

async function readState(): Promise<ServerState | undefined> {
  try {
    const raw = await SecureStore.getItemAsync(SERVER_STATE_KEY);
    if (raw !== null) return parseServerState(raw);
    return serverStateFromLegacy(await SecureStore.getItemAsync(SERVER_URL_KEY));
  } catch {
    return undefined;
  }
}

function change(update: (state: ServerState) => ServerState): Promise<void> {
  const run = queue.then(async () => {
    await load();
    if (!known) {
      const stored = await readState();
      if (stored) {
        state = { active: stored.active, saved: state.saved.reduce(withServer, stored.saved) };
        known = true;
      }
    }
    state = update(state);
    publishList(state.saved);
    publish(state.active);
    if (known) await SecureStore.setItemAsync(SERVER_STATE_KEY, JSON.stringify(state)).catch(() => undefined);
  });
  queue = run.catch(() => undefined);
  return run;
}

export function setServerUrl(url: string | null): Promise<void> {
  return change((state) => ({ active: url, saved: withServer(state.saved, url) }));
}

export function removeServer(url: string): Promise<void> {
  return change((state) => ({ active: state.active === url ? null : state.active, saved: state.saved.filter((item) => item !== url) }));
}

function applyLink(link: string | null): boolean {
  const url = link ? parseConnectLink(link) : undefined;
  if (url === undefined) return false;
  void setServerUrl(url || null);
  return true;
}

function load(): Promise<void> {
  loading ??= Promise.all([Linking.getInitialURL().catch(() => null), readState()]).then(([initial, stored]) => {
    if (stored) {
      state = stored;
      known = true;
    }
    publishList(state.saved);
    Linking.addEventListener('url', ({ url }) => applyLink(url));
    if (!applyLink(initial ?? null)) publish(state.active);
  });
  return loading;
}

export function onServerUrl(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useServerUrl(): string | null | undefined {
  const [url, setUrl] = useState(current);
  useEffect(() => {
    const off = onServerUrl(setUrl);
    void load();
    return off;
  }, []);
  return url;
}

export function useSavedServers(): string[] | undefined {
  const [servers, setServers] = useState(saved);
  useEffect(() => {
    listListeners.add(setServers);
    void load();
    return () => {
      listListeners.delete(setServers);
    };
  }, []);
  return servers;
}
