import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();

vi.mock('react-native', () => ({
  Linking: { getInitialURL: async () => null, addEventListener: () => ({ remove: () => undefined }) }
}));
vi.mock('expo-secure-store', () => ({
  getItemAsync: async (key: string) => store.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => void store.set(key, value),
  deleteItemAsync: async (key: string) => void store.delete(key)
}));

async function launch() {
  vi.resetModules();
  return import('./server-url');
}

function savedList(): string[] {
  return JSON.parse(store.get('transit.savedServers') ?? '[]') as string[];
}

describe('server-url', () => {
  beforeEach(() => store.clear());

  it('keeps an upgraded server after switching to Default and restarting', async () => {
    store.set('transit.serverUrl', 'http://100.64.0.1:3001');

    const first = await launch();
    await first.setServerUrl(null);
    expect(store.has('transit.serverUrl')).toBe(false);

    await launch();
    expect(savedList()).toEqual(['http://100.64.0.1:3001']);
  });

  it('adds a new server to the list and removing the active one falls back to Default', async () => {
    const app = await launch();
    await app.setServerUrl('https://a.example.com');
    await app.setServerUrl('https://b.example.com');
    expect(savedList()).toEqual(['https://a.example.com', 'https://b.example.com']);

    await app.removeServer('https://b.example.com');
    expect(savedList()).toEqual(['https://a.example.com']);
    expect(store.has('transit.serverUrl')).toBe(false);
  });
});
