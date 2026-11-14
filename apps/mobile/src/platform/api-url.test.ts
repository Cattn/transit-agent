import { describe, expect, it } from 'vitest';
import { resolveApiUrl } from './api-url';

describe('resolveApiUrl', () => {
  it.each([
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
