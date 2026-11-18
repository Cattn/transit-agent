import { describe, expect, it, vi } from 'vitest';
import { ItinerarySchema, splitHops, TripRequestSchema, type Itinerary, type TripRequest } from '@transit/shared';
import { FixtureProvider } from '../providers/fixture.js';
import fixtureRequest from '../providers/fixture-request.json';
import type { RouteProvider } from '../providers/types.js';
import { MemoryItineraryStore } from '../store/memory.js';
import { anchorLeg } from '../watch/horizons.js';
import { runWatchCycle } from '../watch/watch-job.js';
import { planTrip, returnRequestFor, type PlanLogger } from './plan-trip.js';
import { refreshItinerary } from './refresh.js';

const silent: PlanLogger = { warn: () => {} };
const log = { info: () => {}, warn: () => {} };
const central = { name: 'Central Square', coordinates: [-71.1036, 42.3655] as [number, number], kind: 'station' as const };
const kendall = { name: 'Kendall', coordinates: [-71.0862, 42.3625] as [number, number], kind: 'station' as const };

const request = (overrides: Record<string, unknown> = {}): TripRequest =>
  TripRequestSchema.parse({ ...fixtureRequest, stops: [kendall, central], ...overrides });

describe('planTrip with stops', () => {
  it('returns trips that pass through every stop in order', async () => {
    const fixture = new FixtureProvider();
    const search = vi.spyOn(fixture, 'search');
    const result = await planTrip(request(), [fixture], undefined, silent);
    expect(result.itineraries.length).toBeGreaterThan(0);
    for (const it of result.itineraries) {
      expect(() => ItinerarySchema.parse(it)).not.toThrow();
      expect(it.stops?.map((mark) => mark.place.name)).toEqual(['Kendall', 'Central Square']);
      for (const mark of it.stops!) {
        expect(it.legs[mark.legIndex]!.from.coordinates).toEqual(mark.place.coordinates);
        expect(Date.parse(it.legs[mark.legIndex]!.departAt)).toBeGreaterThanOrEqual(Date.parse(it.legs[mark.legIndex - 1]!.arriveAt));
      }
      expect(it.legs.at(-1)!.to.name).toBe('Harvard Square');
    }
    expect(search.mock.calls.every(([hop]) => hop.stops === undefined)).toBe(true);
    expect(search.mock.calls.map(([hop]) => hop.destination.name)).toEqual(expect.arrayContaining(['Kendall', 'Central Square', 'Harvard Square']));
  });

  it('checks constraints against the whole trip, not each hop', async () => {
    const direct = await planTrip(request({ stops: undefined }), [new FixtureProvider()], undefined, silent);
    const via = await planTrip(request({ constraints: { maxWalkMinutes: Math.max(...direct.itineraries.map((it) => it.walkMinutes)) } }), [new FixtureProvider()], undefined, silent);
    for (const it of via.itineraries) expect(it.walkMinutes).toBeLessThanOrEqual(Math.max(...direct.itineraries.map((d) => d.walkMinutes)));
    expect(via.nearMisses.some((it) => it.violations.some((violation) => violation.startsWith('Walks ')))).toBe(true);
  });

  it('plans the trip back without the stops', () => {
    const back = returnRequestFor(request(), '2026-11-16T18:00:00-05:00');
    expect(back.stops).toBeUndefined();
    expect(back.origin.name).toBe('Harvard Square');
  });
});

describe('refreshItinerary', () => {
  async function stitched(): Promise<Itinerary> {
    return (await planTrip(request({ stops: [central] }), [new FixtureProvider()], undefined, silent)).itineraries.find((it) => it.stops)!;
  }

  it('refreshes each hop with its own request and keeps the stops', async () => {
    const it = await stitched();
    const refresh = vi.fn(async (part: Itinerary) => ({ ...part, source: { ...part.source, fetchedAt: '2026-11-16T12:00:00.000Z' } }));
    const provider: RouteProvider = { name: 'fixture', supports: () => true, search: async () => [], refresh };
    const fresh = await refreshItinerary(provider, it, request({ stops: [central] }));
    expect(refresh.mock.calls.map(([, hop]) => [hop.origin.name, hop.destination.name])).toEqual([['Boston Common', 'Central Square'], ['Central Square', 'Harvard Square']]);
    expect(fresh?.legs).toEqual(it.legs);
    expect(fresh?.stops).toEqual(it.stops);
    expect(fresh?.source.fetchedAt).toBe('2026-11-16T12:00:00.000Z');
  });

  it('skips hops already behind the rider and estimates hops it cannot match', async () => {
    const it = await stitched();
    const [first, second] = splitHops(it);
    const realtime = { ...it, legs: it.legs.map((leg) => ({ ...leg, timeSource: 'realtime' as const, delayMinutes: 1 })) };
    const refresh = vi.fn(async (): Promise<Itinerary | undefined> => undefined);
    const provider: RouteProvider = { name: 'fixture', supports: () => true, search: async () => [], refresh };
    expect(await refreshItinerary(provider, realtime, request({ stops: [central] }))).toBeUndefined();

    refresh.mockImplementationOnce(async () => undefined).mockImplementationOnce(async () => second!);
    const partial = await refreshItinerary(provider, realtime, request({ stops: [central] }));
    expect(partial?.legs.slice(0, first!.legs.length).every((leg) => leg.timeSource === 'estimated' && leg.delayMinutes === undefined)).toBe(true);

    refresh.mockClear();
    const boarded = { ...it, watchStatus: { state: 'onTrack' as const, message: '', checkedAt: it.departAt, usedRealtime: false, boardedLegIndex: it.stops![0]!.legIndex } };
    refresh.mockImplementationOnce(async () => second!);
    await refreshItinerary(provider, boarded, request({ stops: [central] }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh.mock.calls[0]![0]).toMatchObject({ watchStatus: { boardedLegIndex: 0 } });
  });
});

describe('watching a trip with stops', () => {
  it('replans a missed departure through the stops still ahead', async () => {
    const store = new MemoryItineraryStore();
    const saveRequest = request({ stops: [kendall, central] });
    const plan = await planTrip(saveRequest, [new FixtureProvider()], undefined, silent);
    const itinerary = plan.itineraries.find((it) => it.legs.slice(0, it.stops![0]!.legIndex).some((leg) => leg.mode === 'bus' || leg.mode === 'rail'))!;
    const saved = await store.save('device-a', { itinerary, request: saveRequest, watch: true });
    const legIndex = saved.legs.indexOf(anchorLeg(saved));
    await store.update('device-a', saved.id, { boarding: { legIndex, tripId: anchorLeg(saved).id, state: 'missed' } });

    const fixture = new FixtureProvider();
    const search = vi.spyOn(fixture, 'search');
    const now = new Date(Date.parse(anchorLeg(saved).departAt) + 60_000);
    await runWatchCycle({ store, providers: [fixture], now: () => now, log });
    const replans = search.mock.calls.filter(([hop]) => hop.time.at === now.toISOString()).map(([hop]) => hop.destination.name);
    expect(replans).toEqual(['Kendall']);
    const switched = await store.get('device-a', saved.id);
    expect(switched?.watchStatus?.change?.message).toMatch(/Switched to /);
    expect(switched?.request.stops?.map((stop) => stop.name)).toEqual(['Kendall', 'Central Square']);
    expect(switched?.stops?.map((mark) => mark.place.name)).toEqual(['Kendall', 'Central Square']);
  });
});
