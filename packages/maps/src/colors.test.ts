import { describe, expect, it } from 'vitest';
import { PALETTE, assignRouteColors, hashString, routeColor } from './colors.js';

describe('PALETTE', () => {
  it('has 8 distinct hex colours', () => {
    expect(PALETTE).toHaveLength(8);
    expect(new Set(PALETTE.map((c) => c.toLowerCase())).size).toBe(8);
    for (const c of PALETTE) expect(c).toMatch(/^#[0-9a-f]{6}$/i);
  });
});

describe('hashString', () => {
  it('is stable for the same input', () => {
    expect(hashString('fx-transit-abc123')).toBe(hashString('fx-transit-abc123'));
  });

  it('returns a non-negative integer', () => {
    for (const s of ['', 'a', 'sample-red-line', 'a much longer itinerary id with spaces 12345']) {
      const h = hashString(s);
      expect(Number.isInteger(h)).toBe(true);
      expect(h).toBeGreaterThanOrEqual(0);
    }
  });

  it('gives different values for different strings', () => {
    expect(hashString('a')).not.toBe(hashString('b'));
    expect(hashString('ab')).not.toBe(hashString('ba'));
  });
});

describe('routeColor', () => {
  it('returns a palette colour', () => {
    expect(PALETTE).toContain(routeColor('sample-red-line'));
  });

  it('is stable across calls (same saved trip, same colour)', () => {
    expect(routeColor('fx-transit-1')).toBe(routeColor('fx-transit-1'));
  });

  it('spreads ids across the palette', () => {
    const ids = Array.from({ length: 40 }, (_, i) => `fx-transit-${i}`);
    expect(new Set(ids.map(routeColor)).size).toBeGreaterThanOrEqual(6);
  });
});

describe('assignRouteColors (no two trips on screen share a colour)', () => {
  it('gives up to 8 trips 8 different colours, even when their hashes collide', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `fx-transit-${i}`);
    const colors = assignRouteColors(ids);
    expect(new Set(colors.values()).size).toBe(8);
    for (const c of colors.values()) expect(PALETTE).toContain(c);
  });

  it('a trip with no clash keeps its own routeColor', () => {
    expect(assignRouteColors(['b']).get('b')).toBe(routeColor('b'));
    const noClash = Array.from({ length: 50 }, (_, i) => `trip-${i}`).find((id) => routeColor(id) !== routeColor('trip-0'))!;
    expect(assignRouteColors(['trip-0', noClash]).get(noClash)).toBe(routeColor(noClash));
  });

  it('resolves a real collision so the two trips get different colours', () => {
    const first = 'trip-0';
    const clash = Array.from({ length: 200 }, (_, i) => `trip-${i + 1}`).find((id) => routeColor(id) === routeColor(first))!;
    const colors = assignRouteColors([first, clash]);
    expect(colors.get(clash)).not.toBe(colors.get(first));
  });

  it('a trip keeps its own routeColor whenever no other trip on screen wants that colour (PR #35 review, issue 3)', () => {
    // Many pseudo-random sets of 2 to 8 trips, including chains (A and B clash, and C wants the
    // colour B gets bumped to): every trip whose preferred colour is unique in its set keeps it.
    for (let seed = 0; seed < 300; seed++) {
      const size = 2 + (seed % 7);
      const ids = Array.from({ length: size }, (_, i) => `t${(seed * 7919 + i * 104729) % 100000}`);
      const colors = assignRouteColors(ids);
      for (const id of ids) {
        const wanted = routeColor(id);
        const competitors = ids.filter((other) => other !== id && routeColor(other) === wanted);
        if (competitors.length === 0) expect(colors.get(id), `${id} in [${ids}]`).toBe(wanted);
      }
      expect(new Set(colors.values()).size, `unique colours for [${ids}]`).toBe(new Set(ids).size);
    }
  });

  it('gives the same colours whatever order the trips are listed in (PR #35 review, issue 3)', () => {
    const asObject = (ids: string[]) => Object.fromEntries(assignRouteColors(ids));
    // Cattn's reproduction: these two clash, and used to swap colours when reordered.
    expect(asObject(['trip-8', 'trip-0'])).toEqual(asObject(['trip-0', 'trip-8']));
    const ids = Array.from({ length: 8 }, (_, i) => `fx-transit-${i}`);
    const expected = asObject(ids);
    expect(asObject([...ids].reverse())).toEqual(expected);
    expect(asObject([...ids.slice(3), ...ids.slice(0, 3)])).toEqual(expected);
  });

  it('is the same every time for the same list', () => {
    const ids = ['x', 'y', 'z'];
    expect([...assignRouteColors(ids)]).toEqual([...assignRouteColors(ids)]);
  });
});
