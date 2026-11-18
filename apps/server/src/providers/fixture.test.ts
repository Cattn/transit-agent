import { describe, expect, it } from 'vitest';
import { ItinerarySchema, TripRequestSchema, type TripRequest } from '@transit/shared';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FixtureProvider } from './fixture.js';
import { createRouteProviders } from './registry.js';
import { mapTransitousItinerary, mapTransitousPlan, TransitousProvider, transitousPlanUrl, type TransitousPlanResponse } from './transitous.js';
import fixtureRequest from './fixture-request.json';

const baseRequest = (overrides: Record<string, unknown> = {}): TripRequest =>
  TripRequestSchema.parse({ ...fixtureRequest, ...overrides });

const optionKeys = (ids: string[]) => ids.map((id) => id.replace(/^fx-/, '').replace(/-[0-9a-f]{8}$/, ''));

describe('FixtureProvider', () => {
  const provider = new FixtureProvider();

  it('returns transit, transit-safe, bike-rail and drive for the Boston sample request', async () => {
    const results = await provider.search(baseRequest());
    expect(optionKeys(results.map((it) => it.id))).toEqual(['transit', 'transit-safe', 'bike-rail', 'drive']);
  });

  it('changes the option set with the allowed modes', async () => {
    const walkOnly = await provider.search(baseRequest({ modes: ['walk', 'car'], vehicles: { ownsCar: false } }));
    expect(walkOnly).toEqual([]);

    const busOnly = await provider.search(baseRequest({ modes: ['walk', 'bus'] }));
    expect(optionKeys(busOnly.map((it) => it.id))).toEqual(['transit', 'transit-safe']);

    const short = await provider.search(
      baseRequest({ destination: { coordinates: [-71.0589, 42.3601] }, modes: ['walk'] })
    );
    expect(optionKeys(short.map((it) => it.id))).toEqual(['walk']);
  });

  it('uses bikeshare (with an unlock fee) when the rider has no bike', async () => {
    const results = await provider.search(
      baseRequest({ modes: ['walk', 'bikeshare', 'rail'], vehicles: { ownsBike: false } })
    );
    const bikeRail = results.find((it) => it.id.startsWith('fx-bike-rail-'));
    expect(bikeRail?.legs[0]?.mode).toBe('bikeshare');
    expect(bikeRail?.cost.lines.map((line) => line.label)).toContain('Bikeshare unlock');
  });

  it('produces stable ids across calls', async () => {
    const first = await provider.search(baseRequest());
    const second = await provider.search(baseRequest());
    expect(second.map((it) => it.id)).toEqual(first.map((it) => it.id));
    expect(second.flatMap((it) => it.legs.map((leg) => leg.id))).toEqual(first.flatMap((it) => it.legs.map((leg) => leg.id)));
    expect(second.map((it) => it.legs.map((leg) => leg.geometry))).toEqual(first.map((it) => it.legs.map((leg) => leg.geometry)));
  });

  it('departAt makes the first leg start at time.at', async () => {
    const results = await provider.search(baseRequest());
    for (const it of results) {
      expect(Date.parse(it.legs[0]!.departAt)).toBe(Date.parse('2026-11-16T08:00:00-05:00'));
      expect(it.departAt).toBe('2026-11-16T08:00:00-05:00');
    }
  });

  it('arriveBy makes the last leg end exactly at time.at', async () => {
    const at = '2026-11-16T09:00:00-05:00';
    const results = await provider.search(baseRequest({ time: { type: 'arriveBy', at } }));
    expect(results.length).toBeGreaterThan(0);
    for (const it of results) {
      expect(it.legs[it.legs.length - 1]!.arriveAt).toBe(at);
      expect(it.arriveAt).toBe(at);
    }
  });

  it('sets transfers, walk minutes, buffers and time sources', async () => {
    const [transit] = await provider.search(baseRequest());
    expect(transit!.transfers).toBe(1);
    expect(transit!.legs[2]!.transferBufferMinutes).toBe(4);
    expect(transit!.legs.map((leg) => leg.timeSource)).toEqual(['estimated', 'scheduled', 'scheduled', 'estimated']);
    expect(transit!.walkMinutes).toBe(transit!.legs[0]!.durationMinutes + transit!.legs[3]!.durationMinutes);
    expect(transit!.summary).toMatch(/^Walk \d+ min → Bus 1 → Red Line → Walk \d+ min$/);
    expect(transit!.cost.totalUsd).toBe(4.1);
  });

  it('every result passes ItinerarySchema', async () => {
    const requests = [
      baseRequest(),
      baseRequest({ time: { type: 'arriveBy', at: '2026-11-16T09:00:00Z' } }),
      baseRequest({ destination: { coordinates: [-71.0589, 42.3601] }, modes: ['walk', 'bikeshare', 'rail', 'bus'] })
    ];
    for (const request of requests) {
      for (const it of await provider.search(request)) {
        expect(() => ItinerarySchema.parse(it)).not.toThrow();
      }
    }
  });
});

const sample = (name: string) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`../../../../plans/research/samples/${name}`, import.meta.url)), 'utf8')).response as TransitousPlanResponse;
const fetchedAt = '2026-11-14T07:52:08Z';
const kendall = { name: 'Kendall/MIT', coordinates: [-71.0862, 42.3625] };
const southStation = { name: 'South Station', coordinates: [-71.0552, 42.3523] };
const liveRequest = (overrides: Record<string, unknown> = {}) =>
  baseRequest({ origin: kendall, destination: southStation, time: { type: 'departAt', at: '2026-11-14T09:00:00-05:00' }, ...overrides });
const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('Transitous mapping (recorded /api/v6/plan responses)', () => {
  it('maps the Kendall → South Station sample into valid scheduled itineraries', () => {
    const results = mapTransitousPlan(sample('007-transitous.json'), liveRequest(), { fetchedAt });
    expect(results).toHaveLength(3);
    for (const it of results) expect(() => ItinerarySchema.parse(it)).not.toThrow();
    const [first] = results;
    expect(first?.legs.map((leg) => [leg.mode, leg.timeSource, leg.geometry.coordinates.length])).toEqual([
      ['walk', 'estimated', 3], ['rail', 'scheduled', 46], ['walk', 'estimated', 2]
    ]);
    const rail = first!.legs[1]!;
    expect(rail.geometry.coordinates[0]).toEqual([-71.0856, 42.362354]);
    expect(rail).toMatchObject({
      routeName: 'Red Line', agency: 'MBTA', departAt: '2026-11-14T14:04:00Z', arriveAt: '2026-11-14T14:10:00Z', durationMinutes: 6,
      from: { name: 'Kendall/MIT', kind: 'station', code: '70071', coordinates: [-71.0856, 42.362354] }
    });
    expect(rail.delayMinutes).toBeUndefined();
    expect(rail.trip).toEqual({
      provider: 'transitous', tripId: '20261114_08:52_us-ma-MBTA_77909928', feed: 'us-ma-MBTA', agencyTripId: '77909928', serviceDate: '2026-11-14',
      routeId: 'us-ma-MBTA_Red', directionId: '0', boardStopId: 'us-ma-MBTA_70071', alightStopId: 'us-ma-MBTA_70079'
    });
    expect(first?.legs[0]?.from.name).toBe('Kendall/MIT');
    expect(first).toMatchObject({ durationMinutes: 8, transfers: 0, walkMinutes: 2, source: { provider: 'transitous', fetchedAt } });
    expect(first?.cost.lines).toEqual([{ label: 'Red Line fare', usd: 2.4, estimated: true }]);
  });

  it('lists the stops an MBTA subway leg rides through', () => {
    const [first] = mapTransitousPlan(sample('007-transitous.json'), liveRequest(), { fetchedAt });
    const rail = first!.legs[1]!;
    expect(rail.intermediateStops?.map((stop) => [stop.name, stop.kind, stop.code])).toEqual([
      ['Charles/MGH', 'station', '70073'], ['Park Street', 'station', '70075'], ['Downtown Crossing', 'station', '70077']
    ]);
    expect(rail.to.name).toBe('South Station');
    expect(first!.legs[0]!.intermediateStops).toBeUndefined();
  });

  it('names Green Line branches in full and keeps the headsign', () => {
    const raw = sample('007-transitous.json').itineraries![0]!;
    const green = { ...raw, legs: raw.legs.map((leg) => (leg.tripId ? { ...leg, mode: 'TRAM', displayName: 'E', routeShortName: 'E', routeLongName: 'Green Line E', headsign: 'Heath Street' } : leg)) };
    const mapped = mapTransitousItinerary(green, liveRequest(), { fetchedAt });
    if (typeof mapped === 'string') throw new Error(mapped);
    expect(mapped.legs[1]).toMatchObject({ mode: 'rail', routeName: 'Green Line E', headsign: 'Heath Street' });
    expect(mapped.summary).toContain('Green Line E');
  });

  it('leaves stops off non-MBTA and bus legs', () => {
    const response = sample('007-transitous.json');
    const raw = response.itineraries![0]!;
    const rerouted = { ...raw, legs: raw.legs.map((leg) => (leg.tripId ? { ...leg, tripId: leg.tripId.replace('us-ma-MBTA', 'xx-OTHER') } : leg)) };
    const mapped = mapTransitousItinerary(rerouted, liveRequest(), { fetchedAt });
    expect(typeof mapped).not.toBe('string');
    expect((mapped as { legs: { intermediateStops?: unknown; headsign?: unknown }[] }).legs[1]!.intermediateStops).toBeUndefined();
    expect((mapped as { legs: { headsign?: unknown }[] }).legs[1]!.headsign).toBeUndefined();
  });

  it('never labels the router realTime flag as live and omits delay', () => {
    const results = mapTransitousPlan(sample('007-transitous-early.json'), liveRequest(), { fetchedAt });
    const bus = results[0]?.legs.find((leg) => leg.mode === 'bus');
    expect(bus).toMatchObject({ routeName: '171', timeSource: 'estimated' });
    expect(bus?.delayMinutes).toBeUndefined();
    expect(results.flatMap((it) => it.legs).some((leg) => leg.timeSource === 'realtime')).toBe(false);
  });

  it('maps direct car and bike options as estimated street legs with estimated gas', () => {
    const results = mapTransitousPlan(sample('007-transitous-street.json'), liveRequest(), { fetchedAt, gasUsdPerGallon: 3.2 });
    expect(results.map((it) => it.legs.map((leg) => [leg.mode, leg.timeSource]))).toEqual([[['car', 'estimated']], [['bike', 'estimated']]]);
    expect(results[0]?.legs[0]?.distanceMeters).toBe(4180);
    expect(results[0]?.cost.lines).toEqual([{ label: 'Gas', usd: 0.3, estimated: true }]);
    expect(results[1]?.cost).toEqual({ totalUsd: 0, lines: [] });
  });

  it('gives id-less direct routes with different endpoints different ids', () => {
    const [car] = sample('007-transitous-street.json').direct!;
    const moved = { ...car!, legs: car!.legs.map((leg) => ({ ...leg, to: { ...leg.to, lat: leg.to.lat + 0.01 } })) };
    const ids = mapTransitousPlan({ direct: [car!, moved] }, liveRequest(), { fetchedAt }).map((it) => it.id);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it('subtracts the transfer walk from the boarding slack', () => {
    const results = mapTransitousPlan(sample('007-transitous-return.json'), liveRequest(), { fetchedAt });
    const bus = results[2]?.legs.find((leg) => leg.mode === 'bus');
    expect(bus).toMatchObject({ routeName: '1', departAt: '2026-11-15T07:14:00Z', transferBufferMinutes: 2 });
    expect(results[2]?.legs.find((leg) => leg.mode === 'rail')?.transferBufferMinutes).toBeUndefined();
  });

  it('skips itineraries with missing geometry or unsupported modes instead of inventing them', () => {
    const raw = sample('007-transitous.json').itineraries![0]!;
    const noGeometry = { ...raw, legs: raw.legs.map((leg, index) => (index === 1 ? { ...leg, legGeometry: undefined } : leg)) };
    const ferry = { ...raw, legs: raw.legs.map((leg, index) => (index === 1 ? { ...leg, mode: 'FERRY' } : leg)) };
    expect(mapTransitousItinerary(noGeometry, liveRequest(), { fetchedAt })).toBe('missing geometry on SUBWAY leg');
    const skipped: string[] = [];
    expect(mapTransitousPlan({ itineraries: [ferry] }, liveRequest(), { fetchedAt, onSkip: (reason) => skipped.push(reason) })).toEqual([]);
    expect(skipped).toEqual(['unsupported mode FERRY']);
  });

  it('builds the request with lat,lon order, allowed modes and arriveBy', () => {
    const url = transitousPlanUrl('https://api.transitous.org/', liveRequest({ time: { type: 'arriveBy', at: '2026-11-15T03:00:00-05:00' } }));
    expect(url.pathname).toBe('/api/v6/plan');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      fromPlace: '42.3625,-71.0862', toPlace: '42.3523,-71.0552', time: '2026-11-15T08:00:00.000Z', arriveBy: 'true',
      numItineraries: '5', transitModes: 'BUS,SUBWAY,TRAM', directModes: 'WALK,BIKE,CAR'
    });
    const streetOnly = transitousPlanUrl('https://api.transitous.org', liveRequest({ modes: ['walk', 'car'], vehicles: { ownsCar: true } }));
    expect(streetOnly.searchParams.get('transitModes')).toBe('');
    expect(streetOnly.searchParams.get('directModes')).toBe('WALK,CAR');
  });
});

describe('TransitousProvider', () => {
  const silentLogger = { warn: () => {} };

  it('sends the identifying User-Agent and maps the response', async () => {
    const calls: [string, RequestInit | undefined][] = [];
    const provider = new TransitousProvider({
      baseUrl: 'https://api.transitous.org', userAgent: 'transit-agent-test', logger: silentLogger,
      fetch: async (url, init) => { calls.push([String(url), init]); return jsonResponse(sample('007-transitous.json')); }
    });
    const results = await provider.search(liveRequest());
    expect(results).toHaveLength(3);
    expect(calls[0]?.[0]).toMatch(/^https:\/\/api\.transitous\.org\/api\/v6\/plan\?/);
    expect(new Headers(calls[0]?.[1]?.headers).get('User-Agent')).toBe('transit-agent-test');
  });

  it('refreshes the same trips and marks them live only when MBTA confirms the prediction', async () => {
    const body = sample('007-transitous-early.json');
    const [saved] = mapTransitousPlan(body, liveRequest(), { fetchedAt });
    const bus = saved!.legs.find((leg) => leg.mode === 'bus')!;
    const raw = body.itineraries!.find((it) => it.legs.some((leg) => leg.tripId === bus.trip?.tripId))!.legs.find((leg) => leg.tripId === bus.trip?.tripId)!;
    const mbtaCalls: string[] = [];
    const provider = (uncertainty: number) => new TransitousProvider({
      baseUrl: 'https://api.transitous.org', userAgent: 'ua', logger: silentLogger, mbtaApiKey: 'key',
      fetch: async (url, init) => {
        if (String(url).includes('api/v6/plan')) return jsonResponse(body);
        mbtaCalls.push(`${String(url)} ${new Headers(init?.headers).get('x-api-key')}`);
        return jsonResponse({ data: [{ attributes: { departure_uncertainty: uncertainty } }] });
      }
    });
    const live = await provider(120).refresh(saved!, liveRequest());
    const liveBus = live?.legs.find((leg) => leg.mode === 'bus');
    expect(liveBus).toMatchObject({ timeSource: 'realtime', delayMinutes: Math.round((Date.parse(raw.startTime) - Date.parse(raw.scheduledStartTime!)) / 60_000) });
    expect(mbtaCalls[0]).toContain(`filter%5Btrip%5D=${bus.trip?.agencyTripId}`);
    expect(mbtaCalls[0]).toMatch(/ key$/);
    const scheduleBased = await provider(300).refresh(saved!, liveRequest());
    expect(scheduleBased?.legs.find((leg) => leg.mode === 'bus')).toMatchObject({ timeSource: 'estimated' });
    expect(scheduleBased?.legs.find((leg) => leg.mode === 'bus')?.delayMinutes).toBeUndefined();
    const other = { ...saved!, legs: saved!.legs.map((leg) => (leg.trip ? { ...leg, trip: { ...leg.trip, tripId: 'gone' } } : leg)) };
    expect(await provider(120).refresh(other, liveRequest())).toBeUndefined();
    const ongoing = { ...saved!, watchStatus: { state: 'onTrack' as const, message: '', usedRealtime: false, checkedAt: fetchedAt, boardedLegIndex: saved!.legs.indexOf(bus), phase: 'riding' as const } };
    let searches = 0;
    const remainingProvider = new TransitousProvider({
      baseUrl: 'https://api.transitous.org', userAgent: 'ua', logger: silentLogger,
      fetch: async (url) => {
        if (String(url).includes('api/v6/plan')) return jsonResponse(++searches === 1 ? { itineraries: [] } : body);
        return jsonResponse({ data: [{ attributes: { departure_uncertainty: 120 } }] });
      }
    });
    const remaining = await remainingProvider.refresh(ongoing, liveRequest());
    expect(searches).toBeGreaterThan(1);
    expect(remaining?.legs.find((leg) => leg.trip?.tripId === bus.trip?.tripId)).toMatchObject({ id: bus.id, timeSource: 'realtime' });
  });

  it('fails honestly on upstream errors and malformed bodies', async () => {
    const failing = new TransitousProvider({ baseUrl: 'https://x.test', userAgent: 'ua', fetch: async () => jsonResponse({ error: 'busy' }, 503) });
    await expect(failing.search(liveRequest())).rejects.toThrow('Transitous returned 503');
    const empty = new TransitousProvider({ baseUrl: 'https://x.test', userAgent: 'ua', fetch: async () => jsonResponse({}) });
    await expect(empty.search(liveRequest())).rejects.toThrow('no itineraries');
  });

  it('honours caller cancellation and the bounded timeout', async () => {
    const hang: typeof fetch = (_url, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
    });
    const controller = new AbortController();
    const cancelled = new TransitousProvider({ baseUrl: 'https://x.test', userAgent: 'ua', fetch: hang }).search(liveRequest(), controller.signal);
    controller.abort(new Error('client went away'));
    await expect(cancelled).rejects.toThrow('client went away');
    const slow = new TransitousProvider({ baseUrl: 'https://x.test', userAgent: 'ua', fetch: hang, timeoutMs: 20 });
    await expect(slow.search(liveRequest())).rejects.toMatchObject({ name: 'TimeoutError' });
  });
});

describe('createRouteProviders', () => {
  it('defaults to the fixture provider', () => {
    expect(createRouteProviders({}).map((provider) => provider.name)).toEqual(['fixture']);
  });

  it('opts in to Transitous only with an identifying User-Agent', () => {
    expect(() => createRouteProviders({ ROUTE_PROVIDERS: 'transitous' })).toThrow('ROUTING_USER_AGENT is required');
    expect(createRouteProviders({ ROUTE_PROVIDERS: 'transitous', ROUTING_USER_AGENT: 'transit-agent' }).map((provider) => provider.name)).toEqual(['transitous']);
  });

  it('rejects unknown names and fixture mixed with live results', () => {
    expect(() => createRouteProviders({ ROUTE_PROVIDERS: 'otp' })).toThrow('Unknown route provider "otp"');
    expect(() => createRouteProviders({ ROUTE_PROVIDERS: 'transitous,fixture', ROUTING_USER_AGENT: 'ua' })).toThrow('cannot mix fixture');
  });
});
