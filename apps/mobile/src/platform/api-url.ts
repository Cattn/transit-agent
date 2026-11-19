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
    return linkedServerUrl(url);
  }
  return undefined;
}

function linkedServerUrl(url: string): string | undefined {
  return /^https?:\/\/[^\s/?#]+/i.test(url) ? canonicalServerUrl(url.replace(/\/+$/, '')) : undefined;
}

const DEFAULT_PORTS: Record<string, string> = { http: '80', https: '443' };

/** One spelling per server: lower-case scheme and host, no leading zeros or default port. The path keeps its case. */
function canonicalServerUrl(url: string): string {
  const match = /^([a-z][a-z0-9+.-]*):\/\/([^/?#]*)(.*)$/i.exec(url);
  if (!match) return url;
  const scheme = match[1]!.toLowerCase();
  const authority = match[2]!.toLowerCase().replace(/^\[([^\]]+)\]/, (all, host: string) => {
    const ipv6 = canonicalIpv6(host);
    return ipv6 ? `[${ipv6}]` : all;
  }).replace(/:(\d+)$/, (_all, port: string) => {
    const number = port.replace(/^0+(?=\d)/, '');
    return number === DEFAULT_PORTS[scheme] ? '' : `:${number}`;
  });
  return `${scheme}://${authority}${match[3]}`;
}

/** RFC 5952 text for an IPv6 address: no leading zeros, the longest run of zero groups as "::". Undefined if it isn't one. */
function canonicalIpv6(host: string): string | undefined {
  let text = host;
  const ipv4 = /^(.*:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(text);
  if (ipv4) {
    const bytes = ipv4.slice(2).map(Number);
    if (bytes.some((byte) => byte > 255)) return undefined;
    text = `${ipv4[1]}${((bytes[0]! << 8) | bytes[1]!).toString(16)}:${((bytes[2]! << 8) | bytes[3]!).toString(16)}`;
  }
  const halves = text.split('::');
  if (halves.length > 2) return undefined;
  const parts = halves.map((half) => (half ? half.split(':') : []));
  if (parts.some((list) => list.some((group) => !/^[0-9a-f]{1,4}$/.test(group)))) return undefined;
  const [head = [], tail = []] = parts;
  const missing = 8 - head.length - tail.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) return undefined;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...tail].map((group) => parseInt(group, 16).toString(16));
  let best = { start: -1, length: 1 };
  for (let start = 0; start < 8; start++) {
    let length = 0;
    while (groups[start + length] === '0') length++;
    if (length > best.length) best = { start, length };
  }
  if (best.start < 0) return groups.join(':');
  return `${groups.slice(0, best.start).join(':')}::${groups.slice(best.start + best.length).join(':')}`;
}

export function normalizeServerUrl(input: string): string | undefined {
  const trimmed = input.trim();
  if (!trimmed) return undefined;
  const url = (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`).replace(/\/+$/, '');
  const match = /^https?:\/\/(?:\[[0-9a-f:.]+\]|[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?)(?::(\d{1,5}))?$/i.exec(url);
  if (!match) return undefined;
  const port = match[1] === undefined ? undefined : Number(match[1]);
  return port === undefined || (port > 0 && port <= 65535) ? canonicalServerUrl(url) : undefined;
}

export interface ServerState {
  active: string | null;
  saved: string[];
}

/** A stored or configured server address in its canonical form, or undefined if it isn't an http(s) server address. */
export function savedServerUrl(value: unknown): string | undefined {
  return typeof value === 'string' ? normalizeServerUrl(value) ?? linkedServerUrl(value.trim()) : undefined;
}

function parseJson(raw: string | null): unknown {
  try {
    return raw === null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
}

function serverState(active: unknown, saved: unknown): ServerState {
  const url = savedServerUrl(active) ?? null;
  const urls = Array.isArray(saved) ? saved.map(savedServerUrl).filter((item): item is string => item !== undefined) : [];
  return { active: url, saved: withServer(urls, url) };
}

export function serverStateFromLegacy(active: string | null, savedList: string | null = null): ServerState {
  return serverState(active, parseJson(savedList));
}

export function parseServerState(raw: string): ServerState {
  const value = parseJson(raw);
  const record = value && typeof value === 'object' ? (value as { active?: unknown; saved?: unknown }) : {};
  return serverState(record.active, record.saved);
}

export function withServer(servers: readonly string[], url?: string | null): string[] {
  const unique = [...new Set(servers)];
  return url && !unique.includes(url) ? [...unique, url] : unique;
}
