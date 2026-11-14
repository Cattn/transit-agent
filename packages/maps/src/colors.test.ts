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

  it('the first trip keeps its own routeColor, and a lone trip always does', () => {
    expect(assignRouteColors(['a', 'b']).get('a')).toBe(routeColor('a'));
    expect(assignRouteColors(['b']).get('b')).toBe(routeColor('b'));
  });

  it('resolves a real collision by moving the later trip on', () => {
    // find two ids that hash to the same colour
    const first = 'trip-0';
    const clash = Array.from({ length: 200 }, (_, i) => `trip-${i + 1}`).find((id) => routeColor(id) === routeColor(first))!;
    const colors = assignRouteColors([first, clash]);
    expect(colors.get(first)).toBe(routeColor(first));
    expect(colors.get(clash)).not.toBe(colors.get(first));
  });

  it('is the same every time for the same list', () => {
    const ids = ['x', 'y', 'z'];
    expect([...assignRouteColors(ids)]).toEqual([...assignRouteColors(ids)]);
  });
});
