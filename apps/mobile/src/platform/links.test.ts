import { describe, expect, it } from 'vitest';
import { parseTripLink, tripLink } from './links';

describe('tripLink', () => {
  it.each([
    ['mock-fast-1a2b', 'transit-agent://trip/mock-fast-1a2b'],
    ['a/b', 'transit-agent://trip/a%2Fb'],
    ['morning commute', 'transit-agent://trip/morning%20commute']
  ])('%s → %s', (id, expected) => {
    expect(tripLink(id)).toBe(expected);
  });
});

describe('parseTripLink', () => {
  it.each(['mock-fast-1a2b', 'a/b/c', 'morning commute', 'ünïcode #1?'])('round-trips %j', (id) => {
    expect(parseTripLink(tripLink(id))).toEqual({ tripId: id });
  });

  it.each([
    ['dev-client scheme', 'exp+transit-agent://trip/abc', 'abc'],
    ['triple slash', 'transit-agent:///trip/abc', 'abc'],
    ['trailing slash', 'transit-agent://trip/abc/', 'abc'],
    ['query and fragment ignored', 'transit-agent://trip/abc?from=share#top', 'abc'],
    ['scheme case-insensitive', 'Transit-Agent://trip/abc', 'abc']
  ])('accepts %s', (_name, url, tripId) => {
    expect(parseTripLink(url)).toEqual({ tripId });
  });

  it.each([
    ['web URL', 'https://example.com/trip/abc'],
    ['another app', 'other-app://trip/abc'],
    ['Expo Go', 'exp://192.168.1.20:8081/--/trip/abc'],
    ['other route', 'transit-agent://saved/abc'],
    ['missing id', 'transit-agent://trip/'],
    ['unencoded extra segment', 'transit-agent://trip/a/b'],
    ['malformed encoding', 'transit-agent://trip/%E0%A4%A'],
    ['empty string', '']
  ])('rejects %s', (_name, url) => {
    expect(parseTripLink(url)).toBeNull();
  });
});
