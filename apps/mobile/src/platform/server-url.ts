import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { parseConnectLink, parseSavedServers, withServer } from './api-url';

export const SERVER_URL_KEY = 'transit.serverUrl';
export const SAVED_SERVERS_KEY = 'transit.savedServers';

type Listener = (url: string | null) => void;
type ListListener = (servers: string[]) => void;
const listeners = new Set<Listener>();
const listListeners = new Set<ListListener>();
let current: string | null | undefined;
let saved: string[] | undefined;
let storedActive: string | null | undefined;
let storedList: string[] | undefined;
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

function serialized(task: () => Promise<void>): Promise<void> {
  const run = queue.then(task);
  queue = run.catch(() => undefined);
  return run;
}

async function writeList(servers: string[]): Promise<boolean> {
  if (storedList && JSON.stringify(storedList) === JSON.stringify(servers)) return true;
  try {
    await SecureStore.setItemAsync(SAVED_SERVERS_KEY, JSON.stringify(servers));
    storedList = servers;
    return true;
  } catch {
    return false;
  }
}

async function syncList(): Promise<void> {
  if (storedList) return;
  let raw: string | null;
  try {
    raw = await SecureStore.getItemAsync(SAVED_SERVERS_KEY);
  } catch {
    return;
  }
  const servers = (saved ?? []).reduce(withServer, parseSavedServers(raw, storedActive));
  if (raw !== null && JSON.stringify(servers) === raw) storedList = servers;
  else await writeList(servers);
  publishList(servers);
}

async function readActive(): Promise<string | null | undefined> {
  try {
    return await SecureStore.getItemAsync(SERVER_URL_KEY);
  } catch {
    return undefined;
  }
}

async function writeActive(url: string | null): Promise<void> {
  storedActive ??= await readActive();
  if (storedActive === undefined || url === storedActive) return;
  if (storedActive && !storedList?.includes(storedActive)) return;
  try {
    await (url ? SecureStore.setItemAsync(SERVER_URL_KEY, url) : SecureStore.deleteItemAsync(SERVER_URL_KEY));
    storedActive = url;
  } catch {
    return;
  }
}

async function select(url: string | null): Promise<void> {
  publish(url);
  await syncList();
  if (url && saved && !saved.includes(url)) {
    const servers = withServer(saved, url);
    publishList(servers);
    if (storedList) await writeList(servers);
  }
  await writeActive(url);
}

export function setServerUrl(url: string | null): Promise<void> {
  return serialized(async () => {
    await load();
    await select(url);
  });
}

export function removeServer(url: string): Promise<void> {
  return serialized(async () => {
    await load();
    if (current === url) await select(null);
    await syncList();
    const servers = (saved ?? []).filter((item) => item !== url);
    publishList(servers);
    if (storedList) await writeList(servers);
  });
}

function applyLink(link: string | null): boolean {
  const url = link ? parseConnectLink(link) : undefined;
  if (url === undefined) return false;
  void setServerUrl(url || null);
  return true;
}

function load(): Promise<void> {
  loading ??= Promise.all([
    Linking.getInitialURL().catch(() => null),
    readActive()
  ]).then(async ([initial, stored]) => {
    storedActive = stored;
    publishList(withServer([], stored));
    await syncList();
    Linking.addEventListener('url', ({ url }) => applyLink(url));
    if (!applyLink(initial ?? null)) publish(stored ?? null);
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
