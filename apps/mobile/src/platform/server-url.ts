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
let loading: Promise<void> | undefined;

function publish(url: string | null) {
  current = url;
  for (const listener of listeners) listener(url);
}

function publishList(servers: string[]) {
  saved = servers;
  for (const listener of listListeners) listener(servers);
}

function storeList(servers: string[]): Promise<void> {
  publishList(servers);
  return SecureStore.setItemAsync(SAVED_SERVERS_KEY, JSON.stringify(servers)).catch(() => undefined);
}

export async function setServerUrl(url: string | null): Promise<void> {
  publish(url);
  await (url ? SecureStore.setItemAsync(SERVER_URL_KEY, url) : SecureStore.deleteItemAsync(SERVER_URL_KEY)).catch(() => undefined);
  await load();
  if (url && saved && !saved.includes(url)) await storeList(withServer(saved, url));
}

export async function removeServer(url: string): Promise<void> {
  await load();
  await Promise.all([storeList((saved ?? []).filter((item) => item !== url)), current === url ? setServerUrl(null) : undefined]);
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
    SecureStore.getItemAsync(SERVER_URL_KEY).catch(() => null),
    SecureStore.getItemAsync(SAVED_SERVERS_KEY).catch(() => null)
  ]).then(([initial, stored, list]) => {
    publishList(parseSavedServers(list, stored));
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
