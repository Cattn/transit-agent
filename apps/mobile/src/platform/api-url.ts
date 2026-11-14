// Pure: no react-native / expo imports, so Vitest can load it. The Expo wrapper is api-url-native.ts.

export const DEFAULT_API_PORT = 3001;
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export interface ResolveApiUrlInput {
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
 * 1. EXPO_PUBLIC_API_URL, if set;
 * 2. the laptop's LAN address Expo is serving from (works on a real phone on the same Wi-Fi);
 * 3. Android emulator → 10.0.2.2 (the host machine);
 * 4. otherwise localhost (iOS simulator, web).
 */
export function resolveApiUrl({ envUrl, hostUri, os, port = DEFAULT_API_PORT }: ResolveApiUrlInput): string {
  const fromEnv = envUrl?.trim();
  if (fromEnv) return fromEnv;

  const host = hostUri ? hostOf(hostUri) : undefined;
  if (host && !LOOPBACK_HOSTS.has(host)) return `http://${host.includes(':') ? `[${host}]` : host}:${port}`;

  return os === 'android' ? `http://10.0.2.2:${port}` : `http://localhost:${port}`;
}
