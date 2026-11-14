import { describe, expect, it } from 'vitest';
import { sampleDrive, sampleItineraries, sampleItinerary } from './samples.js';
import { boundsOf, uniqueItineraryIds } from './bounds.js';

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
