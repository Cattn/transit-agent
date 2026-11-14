import { describe, expect, it } from 'vitest';
import { sampleDrive, sampleItineraries, sampleItinerary } from './samples.js';
import { boundsOf, nextRouteToSelect, uniqueItineraryIds } from './bounds.js';

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

describe('nextRouteToSelect: tap again to cycle through overlapping routes', () => {
  const list = ['a', 'b', 'c', 'd'];

  it('does nothing when no route is under the tap', () => {
    expect(nextRouteToSelect([], 'a', list)).toBeUndefined();
  });

  it('selects the top route on the first tap', () => {
    expect(nextRouteToSelect(['c', 'a'], undefined, list)).toBe('c');
  });

  it('selects the top route when the selected one is somewhere else', () => {
    expect(nextRouteToSelect(['c', 'a'], 'd', list)).toBe('c');
  });

  it('moves on to the next route in list order when the selected one is under the tap, wrapping round', () => {
    expect(nextRouteToSelect(['c', 'a', 'b'], 'a', list)).toBe('b');
    expect(nextRouteToSelect(['c', 'a', 'b'], 'b', list)).toBe('c');
    expect(nextRouteToSelect(['c', 'a', 'b'], 'c', list)).toBe('a');
  });

  it('visits every route under the tap once per round, even though the selected one is drawn on top each time', () => {
    const underTap = ['b', 'd', 'a'];
    let selected = nextRouteToSelect(underTap, undefined, list)!;
    const seen = [selected];
    for (let i = 0; i < underTap.length; i++) {
      const topmostFirst = [selected, ...underTap.filter((id) => id !== selected)];
      selected = nextRouteToSelect(topmostFirst, selected, list)!;
      seen.push(selected);
    }
    expect(new Set(seen.slice(0, 3))).toEqual(new Set(underTap));
    expect(seen[3]).toBe(seen[0]);
  });

  it('keeps a route selected when it is the only one under the tap', () => {
    expect(nextRouteToSelect(['a'], 'a', list)).toBe('a');
  });
});
