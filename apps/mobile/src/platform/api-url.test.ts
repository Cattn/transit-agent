import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeServerUrl, parseConnectLink, parseSavedServers, resolveApiUrl, withServer } from './api-url';

describe('resolveApiUrl', () => {
  it.each([
    ['saved server wins over env', { storedUrl: 'https://laptop.example.ts.net', envUrl: 'https://api.example.test', os: 'android' }, 'https://laptop.example.ts.net'],
    ['blank saved server is ignored', { storedUrl: ' ', envUrl: 'https://api.example.test', os: 'android' }, 'https://api.example.test'],
    ['env URL wins over everything', { envUrl: 'https://api.example.test', hostUri: '192.168.1.20:8081', os: 'android' }, 'https://api.example.test'],
    ['blank env URL is ignored', { envUrl: '  ', hostUri: '192.168.1.20:8081', os: 'android' }, 'http://192.168.1.20:3001'],
    ['LAN host from Expo (real phone)', { hostUri: '192.168.1.20:8081', os: 'ios' }, 'http://192.168.1.20:3001'],
    ['LAN host with a custom port', { hostUri: '10.0.0.5:8081', os: 'android', port: 4000 }, 'http://10.0.0.5:4000'],
    ['hostUri with a path', { hostUri: '192.168.1.20:8081/--/', os: 'android' }, 'http://192.168.1.20:3001'],
    ['localhost hostUri falls through to the Android emulator', { hostUri: 'localhost:8081', os: 'android' }, 'http://10.0.2.2:3001'],
    ['127.0.0.1 hostUri falls through to iOS localhost', { hostUri: '127.0.0.1:8081', os: 'ios' }, 'http://localhost:3001'],
    ['no hostUri on Android → emulator host', { hostUri: null, os: 'android' }, 'http://10.0.2.2:3001'],
    ['no hostUri on iOS → localhost', { os: 'ios' }, 'http://localhost:3001'],
    ['web → localhost', { hostUri: undefined, os: 'web' }, 'http://localhost:3001']
  ])('%s', (_name, input, expected) => {
    expect(resolveApiUrl(input)).toBe(expected);
  });
});

describe('parseConnectLink', () => {
  it.each([
    ['app scheme', 'transit-agent://connect?url=https%3A%2F%2Flaptop.example.ts.net', 'https://laptop.example.ts.net'],
    ['Expo Go link', 'exp://192.168.1.20:8081/--/connect?url=http%3A%2F%2F192.168.1.20%3A3001%2F', 'http://192.168.1.20:3001'],
    ['unencoded URL and other params', 'transit-agent://connect?from=qr&url=http://10.0.0.5:3001', 'http://10.0.0.5:3001'],
    ['empty url forgets the server', 'transit-agent://connect?url=', ''],
    ['not http(s)', 'transit-agent://connect?url=javascript%3Aalert(1)', undefined],
    ['no url param', 'transit-agent://connect?x=1', undefined],
    ['other app link', 'transit-agent://trip/123', undefined],
    ['Expo Go launch URL', 'exp://127.0.0.1:8082', undefined],
    ['bad encoding', 'transit-agent://connect?url=%E0%A4%A', undefined]
  ])('%s', (_name, link, expected) => {
    expect(parseConnectLink(link)).toBe(expected);
  });
});

describe('normalizeServerUrl', () => {
  it.each([
    ['LAN address without a scheme', '192.168.1.20:3001', 'http://192.168.1.20:3001'],
    ['trims and drops trailing slashes', '  http://192.168.1.20:3001//  ', 'http://192.168.1.20:3001'],
    ['https tunnel', 'https://laptop.tail1234.ts.net/', 'https://laptop.tail1234.ts.net'],
    ['hostname without a scheme', 'localhost:3001', 'http://localhost:3001'],
    ['IPv6 with port', 'http://[fe80::1]:3001', 'http://[fe80::1]:3001'],
    ['empty', '   ', undefined],
    ['other scheme', 'ftp://192.168.1.20', undefined],
    ['path', 'http://192.168.1.20:3001/api', undefined],
    ['query', 'http://192.168.1.20?x=1', undefined],
    ['spaces in host', 'my laptop', undefined],
    ['port out of range', '192.168.1.20:70000', undefined],
    ['port zero', '192.168.1.20:0', undefined],
    ['scheme only', 'http://', undefined]
  ])('%s', (_name, input, expected) => {
    expect(normalizeServerUrl(input)).toBe(expected);
  });
});

describe('parseSavedServers', () => {
  it.each([
    ['nothing stored', null, null, []],
    ['keeps the stored order', '["https://a.example.com","http://192.168.1.20:3001"]', null, ['https://a.example.com', 'http://192.168.1.20:3001']],
    ['adds the active server (first run after the update)', null, 'http://192.168.1.20:3001', ['http://192.168.1.20:3001']],
    ['does not repeat the active server', '["http://192.168.1.20:3001"]', 'http://192.168.1.20:3001', ['http://192.168.1.20:3001']],
    ['drops invalid and duplicate entries', '["https://a.example.com/",1,"not a url","https://a.example.com"]', null, ['https://a.example.com']],
    ['broken JSON', '[oops', 'https://a.example.com', ['https://a.example.com']],
    ['not an array', '{"url":"https://a.example.com"}', null, []],
    ['keeps a /connect address with a path', '["https://example.com/transit/"]', null, ['https://example.com/transit']]
  ])('%s', (_name, raw, active, expected) => {
    expect(parseSavedServers(raw, active)).toEqual(expected);
  });
});

describe('withServer', () => {
  it('appends a new server', () => expect(withServer(['https://a.example.com'], 'https://b.example.com')).toEqual(['https://a.example.com', 'https://b.example.com']));
  it('keeps an existing server in place', () => expect(withServer(['https://a.example.com', 'https://b.example.com'], 'https://a.example.com')).toEqual(['https://a.example.com', 'https://b.example.com']));
  it('ignores null', () => expect(withServer(['https://a.example.com'], null)).toEqual(['https://a.example.com']));
});

const disk = new Map<string, string>();
const failing = { get: new Set<string>(), set: new Set<string>() };
let slowKey: { key: string; release: Promise<void> } | undefined;

vi.mock('react-native', () => ({
  Linking: { getInitialURL: async () => null, addEventListener: () => ({ remove: () => undefined }) }
}));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => {
    if (failing.get.has(key)) throw new Error('read failed');
    return disk.get(key) ?? null;
  },
  setItemAsync: async (key: string, value: string) => {
    if (failing.set.has(key)) throw new Error('write failed');
    if (slowKey?.key === key) {
      const { release } = slowKey;
      slowKey = undefined;
      await release;
    }
    disk.set(key, value);
  },
  deleteItemAsync: async (key: string) => void disk.delete(key)
}));

const ACTIVE = 'transit.serverUrl';
const LIST = 'transit.savedServers';

async function launch() {
  vi.resetModules();
  return import('./server-url');
}

function savedOnDisk(): string[] {
  return JSON.parse(disk.get(LIST) ?? '[]') as string[];
}

describe('saved servers on the phone', () => {
  beforeEach(() => {
    disk.clear();
    failing.get.clear();
    failing.set.clear();
    slowKey = undefined;
  });

  it('keeps an upgraded server after switching to Default and restarting', async () => {
    disk.set(ACTIVE, 'http://100.64.0.1:3001');
    await (await launch()).setServerUrl(null);
    expect(disk.has(ACTIVE)).toBe(false);
    await launch().then((app) => app.setServerUrl(null));
    expect(savedOnDisk()).toEqual(['http://100.64.0.1:3001']);
  });

  it('keeps a /connect address with a path across restarts', async () => {
    disk.set(ACTIVE, 'https://example.com/transit');
    await (await launch()).setServerUrl(null);
    await (await launch()).setServerUrl(null);
    expect(savedOnDisk()).toEqual(['https://example.com/transit']);
  });

  it('does not overwrite the list when it cannot be read', async () => {
    disk.set(ACTIVE, 'https://b.example.com');
    disk.set(LIST, '["https://a.example.com","https://b.example.com"]');
    failing.get.add(LIST);
    await (await launch()).setServerUrl(null);
    expect(disk.get(LIST)).toBe('["https://a.example.com","https://b.example.com"]');
    expect(disk.get(ACTIVE)).toBe('https://b.example.com');
  });

  it('keeps the legacy server when the migrated list cannot be written', async () => {
    disk.set(ACTIVE, 'https://a.example.com');
    failing.set.add(LIST);
    await (await launch()).setServerUrl('https://b.example.com');
    await (await launch()).setServerUrl(null);
    expect(disk.get(ACTIVE)).toBe('https://a.example.com');
  });

  it('keeps the last selection when an earlier write is slow', async () => {
    let release = () => undefined as void;
    slowKey = { key: LIST, release: new Promise<void>((resolve) => { release = resolve; }) };
    const app = await launch();
    const adding = app.setServerUrl('https://a.example.com');
    const toDefault = app.setServerUrl(null);
    release();
    await Promise.all([adding, toDefault]);
    expect(disk.has(ACTIVE)).toBe(false);
    expect(savedOnDisk()).toEqual(['https://a.example.com']);
  });

  it('removing the active server falls back to Default', async () => {
    const app = await launch();
    await app.setServerUrl('https://a.example.com');
    await app.setServerUrl('https://b.example.com');
    await app.removeServer('https://b.example.com');
    expect(savedOnDisk()).toEqual(['https://a.example.com']);
    expect(disk.has(ACTIVE)).toBe(false);
  });
});
