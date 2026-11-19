import { beforeEach, describe, expect, it, vi } from 'vitest';
import { normalizeServerUrl, parseConnectLink, parseServerState, resolveApiUrl, serverStateFromLegacy, withServer } from './api-url';

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
    ['lower-cases the host and drops the default port, keeping the path', 'transit-agent://connect?url=HTTPS%3A%2F%2FExample.com%3A443%2FTransit%2F', 'https://example.com/Transit'],
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
    ['lower-cases the scheme and host', 'HTTPS://Laptop.Tail1234.TS.net', 'https://laptop.tail1234.ts.net'],
    ['lower-cases an IPv6 host', 'http://[FE80::1]:3001', 'http://[fe80::1]:3001'],
    ['drops the default http port', 'http://192.168.1.20:80', 'http://192.168.1.20'],
    ['keeps port 443 on http', 'laptop.example.com:443', 'http://laptop.example.com:443'],
    ['drops the default https port', 'https://laptop.example.com:443/', 'https://laptop.example.com'],
    ['drops leading zeros in the port', '192.168.1.20:03001', 'http://192.168.1.20:3001'],
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

describe('parseServerState', () => {
  it.each([
    ['active and saved', '{"active":"https://b.example.com","saved":["https://a.example.com","https://b.example.com"]}', { active: 'https://b.example.com', saved: ['https://a.example.com', 'https://b.example.com'] }],
    ['adds a missing active server to the list', '{"active":"http://192.168.1.20:3001","saved":[]}', { active: 'http://192.168.1.20:3001', saved: ['http://192.168.1.20:3001'] }],
    ['drops invalid and duplicate entries', '{"active":null,"saved":["https://a.example.com/",1,"not a url","https://a.example.com"]}', { active: null, saved: ['https://a.example.com'] }],
    ['merges spellings of the same server', '{"active":"HTTP://Laptop.local:3001","saved":["http://laptop.local:3001","https://a.example.com:443","HTTPS://A.example.com"]}', { active: 'http://laptop.local:3001', saved: ['http://laptop.local:3001', 'https://a.example.com'] }],
    ['keeps a /connect address with a path', '{"active":null,"saved":["https://example.com/transit/"]}', { active: null, saved: ['https://example.com/transit'] }],
    ['broken JSON', '{oops', { active: null, saved: [] }],
    ['not an object', '"https://a.example.com"', { active: null, saved: [] }]
  ])('%s', (_name, raw, expected) => {
    expect(parseServerState(raw)).toEqual(expected);
  });

  it('migrates the legacy server', () => {
    expect(serverStateFromLegacy('https://example.com/transit')).toEqual({ active: 'https://example.com/transit', saved: ['https://example.com/transit'] });
    expect(serverStateFromLegacy(null)).toEqual({ active: null, saved: [] });
    expect(serverStateFromLegacy('https://b.example.com', '["https://a.example.com","https://b.example.com"]')).toEqual({ active: 'https://b.example.com', saved: ['https://a.example.com', 'https://b.example.com'] });
    expect(serverStateFromLegacy(null, '[oops')).toEqual({ active: null, saved: [] });
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

const LEGACY = 'transit.serverUrl';
const STATE = 'transit.servers';

async function launch() {
  vi.resetModules();
  return import('./server-url');
}

function onDisk(): { active: string | null; saved: string[] } | undefined {
  const raw = disk.get(STATE);
  return raw === undefined ? undefined : (JSON.parse(raw) as { active: string | null; saved: string[] });
}

async function restart(): Promise<{ active: string | null | undefined; saved: string[] | undefined }> {
  const app = await launch();
  await app.removeServer('https://never-saved.example.com');
  return { active: onDisk()?.active, saved: onDisk()?.saved };
}

describe('saved servers on the phone', () => {
  beforeEach(() => {
    disk.clear();
    failing.get.clear();
    failing.set.clear();
    slowKey = undefined;
  });

  it('keeps an upgraded server after switching to Default and restarting', async () => {
    disk.set(LEGACY, 'http://100.64.0.1:3001');
    await (await launch()).setServerUrl(null);
    expect(await restart()).toEqual({ active: null, saved: ['http://100.64.0.1:3001'] });
  });

  it('keeps servers saved by earlier builds', async () => {
    disk.set('transit.savedServers', '["https://a.example.com","https://b.example.com"]');
    await (await launch()).setServerUrl(null);
    expect(await restart()).toEqual({ active: null, saved: ['https://a.example.com', 'https://b.example.com'] });
  });

  it('keeps the legacy server active when only the early list is unreadable', async () => {
    disk.set(LEGACY, 'https://a.example.com');
    disk.set('transit.savedServers', '["https://b.example.com"]');
    failing.get.add('transit.savedServers');
    const app = await launch();
    let active: string | null | undefined;
    const off = app.onServerUrl((url) => { active = url; });
    await app.removeServer('https://never-saved.example.com');
    off();
    expect(active).toBe('https://a.example.com');
    expect(disk.has(STATE)).toBe(false);
    failing.get.clear();
    await app.setServerUrl(null);
    expect(await restart()).toEqual({ active: null, saved: ['https://b.example.com', 'https://a.example.com'] });
  });

  it('replays a removal made while storage was unreadable', async () => {
    disk.set(STATE, '{"active":"https://a.example.com","saved":["https://a.example.com","https://b.example.com"]}');
    failing.get.add(STATE);
    const app = await launch();
    await app.setServerUrl('https://b.example.com');
    failing.get.clear();
    await app.removeServer('https://b.example.com');
    expect(await restart()).toEqual({ active: null, saved: ['https://a.example.com'] });
  });

  it('replays every change made while storage was unreadable, in order', async () => {
    disk.set(STATE, '{"active":"https://a.example.com","saved":["https://a.example.com","https://b.example.com"]}');
    failing.get.add(STATE);
    const app = await launch();
    await app.setServerUrl('https://b.example.com');
    await app.removeServer('https://b.example.com');
    failing.get.clear();
    await app.setServerUrl('https://c.example.com');
    expect(await restart()).toEqual({ active: 'https://c.example.com', saved: ['https://a.example.com', 'https://c.example.com'] });
  });

  it('keeps a /connect address with a path across restarts', async () => {
    disk.set(LEGACY, 'https://example.com/transit');
    await (await launch()).setServerUrl(null);
    expect(await restart()).toEqual({ active: null, saved: ['https://example.com/transit'] });
  });

  it('does not overwrite saved servers it could not read', async () => {
    const before = '{"active":"https://b.example.com","saved":["https://a.example.com","https://b.example.com"]}';
    disk.set(STATE, before);
    failing.get.add(STATE);
    await (await launch()).setServerUrl(null);
    expect(disk.get(STATE)).toBe(before);
  });

  it('does not migrate over a legacy server it could not read', async () => {
    disk.set(LEGACY, 'https://a.example.com');
    failing.get.add(LEGACY);
    const app = await launch();
    await app.setServerUrl('https://b.example.com');
    failing.get.clear();
    await app.setServerUrl(null);
    expect(onDisk()).toEqual({ active: null, saved: ['https://a.example.com', 'https://b.example.com'] });
  });

  it('a failed write is repaired by the next one', async () => {
    disk.set(STATE, '{"active":"https://a.example.com","saved":["https://a.example.com"]}');
    const app = await launch();
    failing.set.add(STATE);
    await app.setServerUrl('https://b.example.com');
    expect(onDisk()?.active).toBe('https://a.example.com');
    failing.set.clear();
    await app.setServerUrl('https://a.example.com');
    expect(await restart()).toEqual({ active: 'https://a.example.com', saved: ['https://a.example.com', 'https://b.example.com'] });
  });

  it('removing the active server falls back to Default, even after a failed write', async () => {
    const app = await launch();
    await app.setServerUrl('https://a.example.com');
    await app.setServerUrl('https://b.example.com');
    failing.set.add(STATE);
    await app.removeServer('https://b.example.com');
    failing.set.clear();
    await app.setServerUrl('https://a.example.com');
    expect(await restart()).toEqual({ active: 'https://a.example.com', saved: ['https://a.example.com'] });
  });

  it('keeps the last selection when an earlier write is slow', async () => {
    let release = () => undefined as void;
    slowKey = { key: STATE, release: new Promise<void>((resolve) => { release = resolve; }) };
    const app = await launch();
    const first = app.setServerUrl('https://a.example.com');
    const second = app.setServerUrl('https://c.example.com');
    const third = app.setServerUrl('https://a.example.com');
    release();
    await Promise.all([first, second, third]);
    expect(await restart()).toEqual({ active: 'https://a.example.com', saved: ['https://a.example.com', 'https://c.example.com'] });
  });
});
