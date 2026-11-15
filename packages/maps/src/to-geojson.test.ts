import { describe, expect, it } from 'vitest';
import { travelModes, type Itinerary, type LngLat } from '@transit/shared';
import * as samples from './samples.js';
import { commuteBikeTransit, commuteWalk, sampleDrive, sampleItineraries, sampleItinerary } from './samples.js';
import { MODE_COLORS, routeColor } from './colors.js';
import { REVEAL_PER_ROUTE_MS, REVEAL_STAGGER_MS, SEARCH_PULSE_PERIOD_MS, previewFeatures, revealFeatures, sliceLine } from './build-preview.js';
import { dashForMode, drawnLegLines, itinerariesToFeatures, itineraryPoints, laneOrder, mainMode, transitLegLabels } from './to-geojson.js';

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
      expect(f.geometry.type).toBe('LineString');
      const original = sampleItinerary.legs[i]!.geometry.coordinates;
      const drawn = f.geometry.coordinates;
      const startsWith = JSON.stringify(drawn.slice(0, original.length)) === JSON.stringify(original);
      const endsWith = JSON.stringify(drawn.slice(-original.length)) === JSON.stringify(original);
      expect(startsWith || endsWith, `leg ${i} keeps its own line`).toBe(true);
      expect(drawn.length - original.length).toBeLessThanOrEqual(1);
      expect(f.properties.legId).toBe(sampleItinerary.legs[i]!.id);
      expect(f.properties.itineraryId).toBe(sampleItinerary.id);
      expect(f.properties.mode).toBe(sampleItinerary.legs[i]!.mode);
    });
  });

  it('styles the dash per mode (walk → rail → walk)', () => {
    const dashes = itinerariesToFeatures([sampleItinerary]).features.map((f) => f.properties.dash);
    expect(dashes).toEqual(['dotted', 'solid', 'dotted']);
  });

  it('gives every leg the colour of its mode, for when its trip is selected', () => {
    const fc = itinerariesToFeatures([sampleItinerary]);
    for (const f of fc.features) expect(f.properties.modeColor).toBe(MODE_COLORS[f.properties.mode]);
    expect(new Set(travelModes.map((m) => MODE_COLORS[m])).size).toBeGreaterThanOrEqual(6);
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

  it('puts origin and destination on the ends of the drawn line, so the dots sit on the route', () => {
    const fc = itineraryPoints([sampleItinerary]);
    const origin = fc.features.find((f) => f.properties.kind === 'origin')!;
    const dest = fc.features.find((f) => f.properties.kind === 'destination')!;
    expect(origin.geometry.coordinates).toEqual(sampleItinerary.legs[0]!.geometry.coordinates[0]);
    expect(dest.geometry.coordinates).toEqual(sampleItinerary.legs.at(-1)!.geometry.coordinates.at(-1));
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

describe('colours chosen by the app (PR #35 review, issue 3)', () => {
  it('lines and dots use the colour map passed in, so result cards in the app can share it', () => {
    const colors = new Map(sampleItineraries.map((t, i) => [t.id, `#00000${i}`]));
    for (const f of itinerariesToFeatures(sampleItineraries, { colors }).features) {
      expect(f.properties.color).toBe(colors.get(f.properties.itineraryId));
    }
    for (const f of itineraryPoints(sampleItineraries, { colors }).features) {
      expect(f.properties.color).toBe(colors.get(f.properties.itineraryId));
    }
  });
});

describe('mainMode: the mode a trip uses for the most distance', () => {
  it('counts distance, not time: a short train ride beats a slow walk', () => {
    const minutes = (mode: string) => sampleItinerary.legs.filter((l) => l.mode === mode).reduce((t, l) => t + l.durationMinutes, 0);
    expect(minutes('walk')).toBeGreaterThan(minutes('rail'));
    expect(mainMode(sampleItinerary)).toBe('rail');
  });

  it('picks the right mode for bike + bus, drive-only and walk-only trips', () => {
    expect(mainMode(commuteBikeTransit)).toBe('bike');
    expect(mainMode(sampleDrive)).toBe('car');
    expect(mainMode(commuteWalk)).toBe('walk');
  });

  it('puts the main mode colour on every leg and every dot of the trip', () => {
    const expected = MODE_COLORS[mainMode(sampleItinerary)];
    for (const f of itinerariesToFeatures([sampleItinerary]).features) expect(f.properties.mainModeColor).toBe(expected);
    for (const f of itineraryPoints([sampleItinerary]).features) expect(f.properties.mainModeColor).toBe(expected);
  });
});

describe('legs meet at transfers (real routing data can leave 10-50 m between legs)', () => {
  const trip = (gapDegrees: number): Itinerary => ({
    ...sampleItinerary,
    id: 'gap-test',
    legs: [
      { ...sampleItinerary.legs[0]!, id: 'g-0', mode: 'walk', geometry: { type: 'LineString', coordinates: [[-71.1, 42.36], [-71.09, 42.36]] } },
      { ...sampleItinerary.legs[1]!, id: 'g-1', mode: 'bus', geometry: { type: 'LineString', coordinates: [[-71.09 + gapDegrees, 42.36], [-71.08, 42.36]] } }
    ]
  });

  it('joins a small gap by extending the walk to the stop, leaving the bus line exactly as given', () => {
    const lines = drawnLegLines(trip(0.0003));
    expect(lines[0]!.at(-1)).toEqual([-71.09 + 0.0003, 42.36]);
    expect(lines[1]).toEqual([[-71.09 + 0.0003, 42.36], [-71.08, 42.36]]);
  });

  it('after getting off, starts the walk where the bus ended', () => {
    const offTheBus: Itinerary = {
      ...trip(0.0003),
      legs: [
        { ...sampleItinerary.legs[1]!, id: 'b-0', mode: 'bus', geometry: { type: 'LineString', coordinates: [[-71.1, 42.36], [-71.09, 42.36]] } },
        { ...sampleItinerary.legs[2]!, id: 'b-1', mode: 'walk', geometry: { type: 'LineString', coordinates: [[-71.0897, 42.36], [-71.08, 42.36]] } }
      ]
    };
    const lines = drawnLegLines(offTheBus);
    expect(lines[0]).toEqual([[-71.1, 42.36], [-71.09, 42.36]]);
    expect(lines[1]![0]).toEqual([-71.09, 42.36]);
  });

  it('leaves a big gap alone, since that would be bad data, not a transfer', () => {
    const lines = drawnLegLines(trip(0.01));
    expect(lines[1]![0]).toEqual([-71.09 + 0.01, 42.36]);
  });

  it('draws every sample trip as one connected line', () => {
    const trips = Object.values(samples).filter((value): value is Itinerary => !Array.isArray(value) && typeof value === 'object' && 'legs' in value);
    for (const it of trips) {
      const lines = itinerariesToFeatures([it]).features.map((f) => f.geometry.coordinates);
      for (let i = 1; i < lines.length; i++) {
        if (it.legs[i - 1]!.mode === 'flight' || it.legs[i]!.mode === 'flight') continue;
        expect(lines[i]![0], `${it.id} leg ${i}`).toEqual(lines[i - 1]!.at(-1));
      }
    }
  });

  it('puts each transfer where the legs meet, in the colour of the leg you switch onto', () => {
    const points = itineraryPoints([trip(0.0003)]).features;
    const transfer = points.find((p) => p.properties.kind === 'transfer')!;
    expect(transfer.geometry.coordinates).toEqual([-71.09 + 0.0003, 42.36]);
    expect(transfer.properties.modeColor).toBe(MODE_COLORS.bus);
  });
});

describe('transitLegLabels: line bubbles for search results (Figma frame 02)', () => {
  const trip = samples.testScenarios.airport![0]!;
  const labels = transitLegLabels(trip, 'America/New_York');

  it('labels only bus, train and ferry legs, in trip order', () => {
    const transit = trip.legs.filter((leg) => ['bus', 'rail', 'ferry'].includes(leg.mode));
    expect(labels.map((l) => l.legId)).toEqual(transit.map((leg) => leg.id));
    expect(transitLegLabels(sampleDrive)).toEqual([]);
  });

  it('shows the line and the departure time without AM/PM, and drops the word Bus because the icon says it', () => {
    expect(labels.map((l) => l.text)).toEqual(['Red Line · 8:49', 'SL1 · 8:58']);
  });

  it('puts each bubble halfway along its leg, on the drawn line', () => {
    const lines = drawnLegLines(trip);
    for (const label of labels) {
      const line = lines[trip.legs.findIndex((leg) => leg.id === label.legId)]!;
      const lngs = line.map((p) => p[0]);
      const lats = line.map((p) => p[1]);
      expect(label.coordinates[0]).toBeGreaterThanOrEqual(Math.min(...lngs));
      expect(label.coordinates[0]).toBeLessThanOrEqual(Math.max(...lngs));
      expect(label.coordinates[1]).toBeGreaterThanOrEqual(Math.min(...lats));
      expect(label.coordinates[1]).toBeLessThanOrEqual(Math.max(...lats));
      expect(label.coordinates).not.toEqual(line[0]);
    }
  });
});

describe('sliceLine (plan 030)', () => {
  const line: LngLat[] = [[-71.1, 42.36], [-71.0, 42.36]];
  const ell: LngLat[] = [[-71.1, 42.36], [-71.09, 42.36], [-71.09, 42.36 + 0.01 * Math.cos((42.36 * Math.PI) / 180)]];
  const near = (a: LngLat, b: LngLat) => {
    expect(a[0]).toBeCloseTo(b[0], 5);
    expect(a[1]).toBeCloseTo(b[1], 5);
  };

  it('returns a zero-length line at the start for 0 and the whole line for 1', () => {
    const none = sliceLine(line, 0);
    near(none[0]!, line[0]!);
    near(none.at(-1)!, line[0]!);
    expect(sliceLine(line, 1)).toEqual(line);
  });

  it('cuts a straight line halfway by length', () => {
    const half = sliceLine(line, 0.5);
    expect(half).toHaveLength(2);
    near(half[1]!, [-71.05, 42.36]);
  });

  it('keeps the corners it passes on a 3-point line and interpolates the last point', () => {
    const half = sliceLine(ell, 0.5);
    near(half.at(-1)!, ell[1]!);
    const most = sliceLine(ell, 0.75);
    expect(most).toHaveLength(3);
    near(most[1]!, ell[1]!);
    near(most[2]!, [-71.09, (ell[1]![1] + ell[2]![1]) / 2]);
  });
});

describe('revealFeatures (plan 030)', () => {
  const trips = samples.commuteOptions;
  const lines = itinerariesToFeatures(trips);
  const idsAt = (now: number, options = {}) =>
    new Set(revealFeatures(lines, 0, now, options).data.features.map((f) => f.properties.itineraryId));
  const end = REVEAL_STAGGER_MS * (trips.length - 1) + REVEAL_PER_ROUTE_MS;

  it('finishes after the last route has had its full time, and not before', () => {
    expect(revealFeatures(lines, 0, end - 1).finished).toBe(false);
    const done = revealFeatures(lines, 0, end);
    expect(done.finished).toBe(true);
    expect(done.data).toEqual(lines);
  });

  it('starts with nothing drawn and staggers the routes in their input order', () => {
    expect(idsAt(0).size).toBe(0);
    expect([...idsAt(REVEAL_STAGGER_MS / 2)]).toEqual([trips[0]!.id]);
    expect(idsAt(REVEAL_STAGGER_MS + 1)).toEqual(new Set([trips[0]!.id, trips[1]!.id]));
  });

  it('draws each route in leg order: the first leg grows before later legs appear', () => {
    const first = trips[0]!;
    const legsOf = (now: number) =>
      revealFeatures(lines, 0, now).data.features.filter((f) => f.properties.itineraryId === first.id).map((f) => f.properties.legId);
    const early = legsOf(REVEAL_PER_ROUTE_MS * 0.05);
    expect(early).toEqual([first.legs[0]!.id]);
    expect(legsOf(REVEAL_PER_ROUTE_MS)).toEqual(first.legs.map((leg) => leg.id));
  });

  it('draws routes outside `animate` in full from the start, and they do not delay the end', () => {
    const fresh = new Set([trips[2]!.id]);
    const ids = idsAt(0, { animate: fresh });
    expect(ids).toEqual(new Set([trips[0]!.id, trips[1]!.id]));
    expect(revealFeatures(lines, 0, REVEAL_PER_ROUTE_MS, { animate: fresh }).finished).toBe(true);
  });

  it('follows `order` when given', () => {
    const order = [trips[2]!.id, trips[0]!.id, trips[1]!.id];
    expect([...idsAt(REVEAL_STAGGER_MS / 2, { order })]).toEqual([trips[2]!.id]);
  });

  it('finishes at once when there is nothing to animate', () => {
    expect(revealFeatures(lines, 0, 0, { animate: new Set() }).finished).toBe(true);
    expect(revealFeatures(itinerariesToFeatures([]), 0, 0).finished).toBe(true);
  });
});

describe('previewFeatures (plan 030)', () => {
  const origin: LngLat = [-71.0942, 42.3601];
  const destination: LngLat = [-71.0552, 42.3523];
  const candidates: LngLat[] = [[-71.1, 42.37], [-71.08, 42.35]];
  const kinds = (fc: ReturnType<typeof previewFeatures>) => fc.features.map((f) => f.properties.kind);

  it('is empty when there is no preview, when idle and while drawing', () => {
    expect(previewFeatures(undefined, 0).features).toEqual([]);
    expect(previewFeatures({ phase: 'idle', origin, destination }, 0).features).toEqual([]);
    expect(previewFeatures({ phase: 'drawing', origin, destination }, 0).features).toEqual([]);
  });

  it('shows candidate pins plus any known ends while locating, with no searching line', () => {
    expect(kinds(previewFeatures({ phase: 'locating', candidates }, 0))).toEqual(['candidate', 'candidate']);
    expect(kinds(previewFeatures({ phase: 'locating', candidates, origin }, 0))).toEqual(['candidate', 'candidate', 'origin']);
  });

  it('shows the two ends and a searching line only while searching', () => {
    expect(kinds(previewFeatures({ phase: 'searching', origin, destination, candidates }, 0))).toEqual([
      'searching-track',
      'searching-pulse',
      'origin',
      'destination'
    ]);
    expect(kinds(previewFeatures({ phase: 'searching', origin }, 0))).toEqual(['origin']);
  });

  it('moves the pulse along the searching line over time, looping', () => {
    const pulseAt = (now: number) =>
      previewFeatures({ phase: 'searching', origin, destination }, now).features.find((f) => f.properties.kind === 'searching-pulse')!
        .geometry.coordinates.at(-1) as LngLat;
    expect(pulseAt(SEARCH_PULSE_PERIOD_MS / 2)[0]).toBeGreaterThan(pulseAt(SEARCH_PULSE_PERIOD_MS / 4)[0]);
    expect(pulseAt(SEARCH_PULSE_PERIOD_MS / 4)).toEqual(pulseAt(SEARCH_PULSE_PERIOD_MS * 1.25));
  });
});
