import { describe, expect, it } from 'vitest';
import type { LngLat } from '@transit/shared';
import { haversineMeters, interpolate, wobbleLine } from './geo.js';

const boston: LngLat = [-71.0589, 42.3601];
const cambridge: LngLat = [-71.1097, 42.3736];

describe('haversineMeters', () => {
  it('measures Boston → Cambridge as 4.0–4.6 km', () => {
    const d = haversineMeters(boston, cambridge);
    expect(d).toBeGreaterThanOrEqual(4000);
    expect(d).toBeLessThanOrEqual(4600);
  });

  it('is zero for the same point', () => {
    expect(haversineMeters(boston, boston)).toBe(0);
  });
});

describe('interpolate', () => {
  it('returns the midpoint at t = 0.5', () => {
    const [lng, lat] = interpolate(boston, cambridge, 0.5);
    expect(lng).toBeCloseTo((boston[0] + cambridge[0]) / 2, 10);
    expect(lat).toBeCloseTo((boston[1] + cambridge[1]) / 2, 10);
  });
});

describe('wobbleLine', () => {
  it('starts at a, ends at b, and has `points` entries', () => {
    const line = wobbleLine(boston, cambridge, 12);
    expect(line).toHaveLength(12);
    expect(line[0]).toEqual(boston);
    expect(line[line.length - 1]).toEqual(cambridge);
  });

  it('is deterministic and differs by seed', () => {
    expect(wobbleLine(boston, cambridge, 12, 0.002, 1)).toEqual(wobbleLine(boston, cambridge, 12, 0.002, 1));
    expect(wobbleLine(boston, cambridge, 12, 0.002, 0)).not.toEqual(wobbleLine(boston, cambridge, 12, 0.002, 1));
  });
});
