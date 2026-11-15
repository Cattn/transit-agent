import { useEffect, useState } from 'react';
import { Linking } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { parseConnectLink } from './api-url';

export const SERVER_URL_KEY = 'transit.serverUrl';

type Listener = (url: string | null) => void;
const listeners = new Set<Listener>();
let current: string | null | undefined;
let loading: Promise<void> | undefined;

function publish(url: string | null) {
  current = url;
  for (const listener of listeners) listener(url);
}

export function setServerUrl(url: string | null): Promise<void> {
  publish(url);
  return (url ? SecureStore.setItemAsync(SERVER_URL_KEY, url) : SecureStore.deleteItemAsync(SERVER_URL_KEY)).catch(() => undefined);
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
    SecureStore.getItemAsync(SERVER_URL_KEY).catch(() => null)
  ]).then(([initial, stored]) => {
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
