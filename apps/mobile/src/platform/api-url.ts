// Pure: no react-native / expo imports, so Vitest can load it. The Expo wrapper is api-url-native.ts.

export const DEFAULT_API_PORT = 3001;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export interface ResolveApiUrlInput {
  storedUrl?: string | null;
  /** EXPO_PUBLIC_API_URL. Always wins when set. */
  envUrl?: string;
  /** Expo's dev-server address, e.g. "192.168.1.20:8081" (Constants.expoConfig.hostUri). */
  hostUri?: string | null;
  os: 'android' | 'ios' | 'web' | string;
  port?: number;
}

/** Host part of Expo's hostUri ("192.168.1.20:8081", "host:8081/path", "[::1]:8081"), lower-cased. */
function hostOf(hostUri: string): string | undefined {
  const authority = hostUri.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').split('/')[0] ?? '';
  const host = authority.startsWith('[') ? authority.slice(1, authority.indexOf(']')) : authority.split(':')[0];
  return host ? host.toLowerCase() : undefined;
}

/**
 * Where the app should reach the API:
 * 1. the server saved on this phone, if any;
 * 2. EXPO_PUBLIC_API_URL, if set;
 * 3. the laptop's LAN address Expo is serving from (works on a real phone on the same Wi-Fi);
 * 4. Android emulator → 10.0.2.2 (the host machine);
 * 5. otherwise localhost (iOS simulator, web).
 */
export function resolveApiUrl({ storedUrl, envUrl, hostUri, os, port = DEFAULT_API_PORT }: ResolveApiUrlInput): string {
  if (storedUrl?.trim()) return storedUrl.trim();
  const fromEnv = envUrl?.trim();
  if (fromEnv) return fromEnv;

  const host = hostUri ? hostOf(hostUri) : undefined;
  if (host && !LOOPBACK_HOSTS.has(host)) return `http://${host.includes(':') ? `[${host}]` : host}:${port}`;

  return os === 'android' ? `http://10.0.2.2:${port}` : `http://localhost:${port}`;
}

export function parseConnectLink(link: string): string | undefined {
  const query = /(?:^[a-z][a-z0-9+.-]*:\/\/|\/)connect\/?\?([^#]*)/i.exec(link.trim())?.[1];
  if (query === undefined) return undefined;
  for (const pair of query.split('&')) {
    const [key, value = ''] = pair.split('=');
    if (key !== 'url') continue;
    let url: string;
    try {
      url = decodeURIComponent(value.replace(/\+/g, ' ')).trim();
    } catch {
      return undefined;
    }
    if (!url) return '';
    return /^https?:\/\/[^\s/?#]+/i.test(url) ? url.replace(/\/+$/, '') : undefined;
  }
  return undefined;
}

export function normalizeServerUrl(input: string): string | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const url = (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`).replace(/\/+$/, '');
  const match = /^https?:\/\/(?:\[[0-9a-f:.]+\]|[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::(\d{1,5}))?$/i.exec(url);
  if (!match) return undefined;
  const port = match[1] === undefined ? undefined : Number(match[1]);
  return port === undefined || (port > 0 && port <= 65535) ? url : undefined;
}
