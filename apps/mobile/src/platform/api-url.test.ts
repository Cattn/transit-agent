import { describe, expect, it } from 'vitest';
import { parseConnectLink, resolveApiUrl } from './api-url';

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
