import { describe, expect, it } from 'vitest';
import { sampleDrive, sampleItineraries, sampleItinerary } from './samples.js';
import { MIN_FIT_SPAN, boundsOf, flatFitBounds, uniqueItineraryIds } from './bounds.js';

describe('boundsOf', () => {
  it('is the tight box around every coordinate', () => {
    const coords = sampleItineraries.flatMap((it) => it.legs.flatMap((l) => l.geometry.coordinates));
    const lngs = coords.map((c) => c[0]);
    const lats = coords.map((c) => c[1]);
    expect(boundsOf(sampleItineraries)).toEqual([
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)]
    ]);
  });

  it('only counts visible modes', () => {
    const drive = sampleDrive.legs[0]!.geometry.coordinates;
    expect(boundsOf(sampleItineraries, ['car'])).toEqual([
      [Math.min(...drive.map((c) => c[0])), Math.min(...drive.map((c) => c[1]))],
      [Math.max(...drive.map((c) => c[0])), Math.max(...drive.map((c) => c[1]))]
    ]);
  });

  it('returns undefined when nothing is visible', () => {
    expect(boundsOf([])).toBeUndefined();
    expect(boundsOf([sampleItinerary], ['flight'])).toBeUndefined();
  });
});

describe('uniqueItineraryIds', () => {
  it('dedupes and orders topmost (highest sortKey) first', () => {
    const features = [
      { properties: { itineraryId: 'a', sortKey: 1 } },
      { properties: { itineraryId: 'b', sortKey: 5 } },
      { properties: { itineraryId: 'a', sortKey: 1 } },
      { properties: { itineraryId: 'c' } },
      { properties: null }
    ];
    expect(uniqueItineraryIds(features)).toEqual(['b', 'a', 'c']);
  });

  it('returns [] for no features', () => {
    expect(uniqueItineraryIds([])).toEqual([]);
  });
});

describe('flatFitBounds (native camera)', () => {
  it('flattens to [west, south, east, north] and leaves a normal trip unchanged', () => {
    expect(flatFitBounds([[-71.1, 42.3], [-71.0, 42.4]])).toEqual([-71.1, 42.3, -71.0, 42.4]);
  });

  it('widens a tiny trip around its centre to the minimum span, so the camera does not zoom in all the way', () => {
    const [w, s, e, n] = flatFitBounds([[-71.0601, 42.3601], [-71.0599, 42.3603]]);
    expect(e - w).toBeCloseTo(MIN_FIT_SPAN);
    expect(n - s).toBeCloseTo(MIN_FIT_SPAN);
    expect((w + e) / 2).toBeCloseTo(-71.06);
    expect((s + n) / 2).toBeCloseTo(42.3602);
  });

  it('widens only the direction that is too small', () => {
    const [w, s, e, n] = flatFitBounds([[-71.1, 42.36], [-71.0, 42.36]]);
    expect([w, e]).toEqual([-71.1, -71.0]);
    expect(n - s).toBeCloseTo(MIN_FIT_SPAN);
  });

  it('works for the sample trips', () => {
    const bounds = boundsOf(sampleItineraries)!;
    const [w, s, e, n] = flatFitBounds(bounds);
    expect(w).toBeLessThanOrEqual(bounds[0][0]);
    expect(s).toBeLessThanOrEqual(bounds[0][1]);
    expect(e).toBeGreaterThanOrEqual(bounds[1][0]);
    expect(n).toBeGreaterThanOrEqual(bounds[1][1]);
  });
});
