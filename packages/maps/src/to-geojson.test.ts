import { describe, expect, it } from 'vitest';
import { travelModes } from '@transit/shared';
import { sampleDrive, sampleItineraries, sampleItinerary } from './samples.js';
import { routeColor } from './colors.js';
import { dashForMode, itinerariesToFeatures, itineraryPoints, laneOrder } from './to-geojson.js';

describe('dashForMode', () => {
  it('maps each mode to the plan 009 dash style', () => {
    expect(dashForMode('walk')).toBe('dotted');
    expect(dashForMode('bike')).toBe('dashed');
    expect(dashForMode('bikeshare')).toBe('dashed');
    expect(dashForMode('flight')).toBe('dashed');
    for (const m of ['bus', 'rail', 'ferry', 'car'] as const) expect(dashForMode(m)).toBe('solid');
  });

  it('handles every travel mode', () => {
    for (const m of travelModes) expect(['solid', 'dashed', 'dotted']).toContain(dashForMode(m));
  });
});

describe('itinerariesToFeatures', () => {
  it('returns a FeatureCollection with one LineString per leg', () => {
    const fc = itinerariesToFeatures([sampleItinerary]);
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features).toHaveLength(sampleItinerary.legs.length);
    fc.features.forEach((f, i) => {
      expect(f.type).toBe('Feature');
      expect(f.geometry).toEqual(sampleItinerary.legs[i]!.geometry);
      expect(f.properties.legId).toBe(sampleItinerary.legs[i]!.id);
      expect(f.properties.itineraryId).toBe(sampleItinerary.id);
      expect(f.properties.mode).toBe(sampleItinerary.legs[i]!.mode);
    });
  });

  it('styles the dash per mode (walk → rail → walk)', () => {
    const dashes = itinerariesToFeatures([sampleItinerary]).features.map((f) => f.properties.dash);
    expect(dashes).toEqual(['dotted', 'solid', 'dotted']);
  });

  it('colours a whole itinerary with one colour', () => {
    const colors = new Set(itinerariesToFeatures([sampleItinerary]).features.map((f) => f.properties.color));
    expect([...colors]).toEqual([routeColor(sampleItinerary.id)]);
  });

  it('includes every leg of every itinerary when there is no filter', () => {
    const total = sampleItineraries.reduce((s, it) => s + it.legs.length, 0);
    expect(itinerariesToFeatures(sampleItineraries).features).toHaveLength(total);
  });

  it('nothing is selected or dimmed without a selection', () => {
    for (const f of itinerariesToFeatures(sampleItineraries).features) {
      expect(f.properties.selected).toBe(false);
      expect(f.properties.dimmed).toBe(false);
    }
  });

  it('marks the selected itinerary and dims the others', () => {
    const fc = itinerariesToFeatures(sampleItineraries, { selectedItineraryId: sampleDrive.id });
    for (const f of fc.features) {
      const isSel = f.properties.itineraryId === sampleDrive.id;
      expect(f.properties.selected).toBe(isSel);
      expect(f.properties.dimmed).toBe(!isSel);
    }
  });

  it('gives the selected itinerary the highest sortKey', () => {
    const fc = itinerariesToFeatures(sampleItineraries, { selectedItineraryId: sampleItinerary.id });
    const sel = fc.features.filter((f) => f.properties.selected).map((f) => f.properties.sortKey);
    const rest = fc.features.filter((f) => !f.properties.selected).map((f) => f.properties.sortKey);
    expect(Math.min(...sel)).toBeGreaterThan(Math.max(...rest));
  });

  it('visibleModes ["car"] hides walk (and everything but car)', () => {
    expect(itinerariesToFeatures([sampleItinerary], { visibleModes: ['car'] }).features).toHaveLength(0);
    const fc = itinerariesToFeatures(sampleItineraries, { visibleModes: ['car'] });
    expect(fc.features.map((f) => f.properties.itineraryId)).toEqual([sampleDrive.id]);
  });
});

describe('itineraryPoints', () => {
  const count = (kinds: string[], k: string) => kinds.filter((x) => x === k).length;

  it('emits origin, destination, and one transfer per inner leg boundary', () => {
    const fc = itineraryPoints([sampleItinerary]);
    const kinds = fc.features.map((f) => f.properties.kind);
    expect(count(kinds, 'origin')).toBe(1);
    expect(count(kinds, 'destination')).toBe(1);
    expect(count(kinds, 'transfer')).toBe(sampleItinerary.legs.length - 1);
  });

  it('puts origin and destination at the right places', () => {
    const fc = itineraryPoints([sampleItinerary]);
    const origin = fc.features.find((f) => f.properties.kind === 'origin')!;
    const dest = fc.features.find((f) => f.properties.kind === 'destination')!;
    expect(origin.geometry.coordinates).toEqual(sampleItinerary.legs[0]!.from.coordinates);
    expect(dest.geometry.coordinates).toEqual(sampleItinerary.legs.at(-1)!.to.coordinates);
    expect(origin.properties.name).toBe('MIT Stata Center');
  });

  it('a single-leg drive has no transfers', () => {
    expect(itineraryPoints([sampleDrive]).features).toHaveLength(2);
  });

  it('skips itineraries with no visible legs', () => {
    expect(itineraryPoints([sampleItinerary], { visibleModes: ['car'] }).features).toHaveLength(0);
  });
});

describe('lanes: itinerariesToFeatures lane numbers', () => {
  const laneOf = (fc: ReturnType<typeof itinerariesToFeatures>) => {
    const byTrip = new Map<string, Set<number>>();
    for (const f of fc.features) byTrip.set(f.properties.itineraryId, (byTrip.get(f.properties.itineraryId) ?? new Set()).add(f.properties.lane));
    return byTrip;
  };

  it('a single trip stays on the street (lane 0)', () => {
    for (const f of itinerariesToFeatures([sampleItinerary]).features) expect(f.properties.lane).toBe(0);
  });

  it('every leg of a trip shares one lane, and each trip gets its own', () => {
    const lanes = laneOf(itinerariesToFeatures(sampleItineraries));
    for (const offsets of lanes.values()) expect(offsets.size).toBe(1);
    const all = [...lanes.values()].map((s) => [...s][0]!);
    expect(new Set(all).size).toBe(sampleItineraries.length);
  });

  it('lanes are 1 apart and centred on the real route', () => {
    const lanes = [...laneOf(itinerariesToFeatures(sampleItineraries)).values()].map((s) => [...s][0]!).sort((a, b) => a - b);
    lanes.slice(1).forEach((o, i) => expect(o - lanes[i]!).toBeCloseTo(1));
    expect(lanes[0]! + lanes.at(-1)!).toBeCloseTo(0);
  });

  it('selecting a trip does not move any lane', () => {
    const before = laneOf(itinerariesToFeatures(sampleItineraries));
    const after = laneOf(itinerariesToFeatures(sampleItineraries, { selectedItineraryId: sampleDrive.id }));
    expect(after).toEqual(before);
  });

  it('hidden trips do not take a lane', () => {
    for (const f of itinerariesToFeatures(sampleItineraries, { visibleModes: ['car'] }).features) expect(f.properties.lane).toBe(0);
  });
});

describe('lanes follow where trips actually are (no crossing)', () => {
  // Two parallel trips heading north; `east` runs 0.01° east of `west`. Heading north, east is the
  // RIGHT side, and a positive line-offset shifts right, so `east` must get the larger offset.
  const trip = (id: string, lng: number) => ({
    ...sampleDrive,
    id,
    legs: [{ ...sampleDrive.legs[0]!, id: `${id}-0`, geometry: { type: 'LineString' as const, coordinates: [[lng, 42], [lng, 42.5]] as [number, number][] } }]
  });
  const west = trip('west', -71.1);
  const east = trip('east', -71.09);

  it('orders lanes left to right across the direction of travel, whatever the list order', () => {
    expect(laneOrder([west, east])).toEqual(['west', 'east']);
    expect(laneOrder([east, west])).toEqual(['west', 'east']);
  });

  it('shifts the right-hand trip right and the left-hand trip left (apart, not into each other)', () => {
    for (const list of [[west, east], [east, west]]) {
      const laneOfTrip = (id: string) => itinerariesToFeatures(list).features.find((f) => f.properties.itineraryId === id)!.properties.lane;
      expect(laneOfTrip('east')).toBeGreaterThan(0);
      expect(laneOfTrip('west')).toBeLessThan(0);
    }
  });
});
