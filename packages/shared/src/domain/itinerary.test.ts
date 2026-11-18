import { describe, expect, it, vi } from 'vitest';
import { sampleItinerary } from './fixtures.js';
import { ItinerarySchema, type Itinerary, type Leg } from './itinerary.js';
import type { TravelMode } from './modes.js';
import type { Place } from './places.js';
import { searchWithStops, splitHops, stitchHops, stopsAfter, tripPlaces } from './stops.js';
import { TripRequestSchema, type TripRequest } from './trip-draft.js';

describe('ItinerarySchema', () => {
  it('parses the 3-leg sample itinerary', () => {
    expect(sampleItinerary.legs).toHaveLength(3);
    expect(ItinerarySchema.safeParse(sampleItinerary).success).toBe(true);
  });

  it('rejects a leg whose LineString has one point', () => {
    const [first, ...rest] = sampleItinerary.legs;
    const bad = {
      ...sampleItinerary,
      legs: [{ ...first, geometry: { type: 'LineString', coordinates: [[-71.06, 42.36]] } }, ...rest]
    };
    expect(ItinerarySchema.safeParse(bad).success).toBe(false);
  });
});

const place = (name: string, lng: number): Place => ({ name, coordinates: [lng, 42.36] });
const home = place('Home', -71.06);
const shop = place('Shop', -71.07);
const gym = place('Gym', -71.08);
const work = place('Work', -71.09);

const at = (minute: number) => new Date(Date.UTC(2026, 10, 17, 13, minute)).toISOString();
const minuteOf = (iso: string) => (Date.parse(iso) - Date.parse(at(0))) / 60_000;

function trip(id: string, from: Place, to: Place, depart: number, arrive: number, mode: TravelMode = 'bus'): Itinerary {
  const leg: Leg = {
    id: `${id}-leg`, mode, from, to, departAt: at(depart), arriveAt: at(arrive), durationMinutes: arrive - depart,
    geometry: { type: 'LineString', coordinates: [from.coordinates, to.coordinates] }, timeSource: 'scheduled'
  };
  return ItinerarySchema.parse({
    id, legs: [leg], departAt: leg.departAt, arriveAt: leg.arriveAt, durationMinutes: arrive - depart, transfers: 0,
    walkMinutes: mode === 'walk' ? arrive - depart : 0,
    cost: { totalUsd: mode === 'bus' ? 1.7 : 0, lines: mode === 'bus' ? [{ label: 'Fare', usd: 1.7, estimated: false }] : [] },
    risk: { level: 'low', reasons: [] }, violations: [], summary: id, source: { provider: 'test', fetchedAt: at(0) }
  });
}

const request = (overrides: Partial<TripRequest> = {}): TripRequest => TripRequestSchema.parse({
  origin: home, destination: work, stops: [shop], time: { type: 'departAt', at: at(0) }, ...overrides
});

function timetable() {
  const calls: { from?: string; to?: string; minute: number; type: string }[] = [];
  const search = vi.fn(async (req: TripRequest) => {
    const minute = minuteOf(req.time.at);
    calls.push({ from: req.origin.name, to: req.destination.name, minute, type: req.time.type });
    const first = req.time.type === 'departAt' ? Math.ceil(minute / 10) * 10 : Math.floor((minute - 15) / 10) * 10;
    return [0, 10, 20].map((offset) => {
      const depart = req.time.type === 'departAt' ? first + offset : first - offset;
      return trip(`${req.origin.name}-${req.destination.name}-${depart}`, req.origin, req.destination, depart, depart + 15);
    });
  });
  return { calls, search };
}

describe('searchWithStops', () => {
  it('passes a direct trip straight to search', async () => {
    const { search } = timetable();
    const direct = request({ stops: undefined });
    await searchWithStops(direct, search);
    expect(search).toHaveBeenCalledWith(direct);
  });

  it('chains each hop after the previous arrival', async () => {
    const { calls, search } = timetable();
    const trips = await searchWithStops(request(), search);
    expect(calls).toEqual([
      { from: 'Home', to: 'Shop', minute: 0, type: 'departAt' },
      { from: 'Shop', to: 'Work', minute: 15, type: 'departAt' }
    ]);
    expect(trips.map((it) => [minuteOf(it.departAt), minuteOf(it.arriveAt)])).toEqual([[0, 35], [10, 45], [20, 55]]);
    const first = trips[0]!;
    expect(first.id).toBe('Home-Shop-0~Shop-Work-20');
    expect(first.stops).toEqual([{ place: shop, legIndex: 1 }]);
    expect(first.legs.map((leg) => leg.to.name)).toEqual(['Shop', 'Work']);
    expect(first.cost).toEqual({ totalUsd: 3.4, lines: [{ label: 'Fare', usd: 3.4, estimated: false }] });
    expect(() => ItinerarySchema.parse(first)).not.toThrow();
  });

  it('shares one search per hop when it covers every chain', async () => {
    const { calls, search } = timetable();
    const trips = await searchWithStops(request({ stops: [shop, gym] }), search);
    expect(trips).toHaveLength(3);
    expect(calls.map((call) => `${call.from}>${call.to}@${call.minute}`)).toEqual(['Home>Shop@0', 'Shop>Gym@15', 'Gym>Work@35']);
    expect(trips.at(-1)!.stops?.map((mark) => mark.legIndex)).toEqual([1, 2]);
  });

  it('searches again only for chains the shared search left behind', async () => {
    const { calls, search } = timetable();
    const single = async (req: TripRequest) => (await search(req)).slice(0, req.origin.name === 'Home' ? 3 : 1);
    const trips = await searchWithStops(request(), single);
    expect(calls.map((call) => `${call.from}>${call.to}@${call.minute}`)).toEqual(['Home>Shop@0', 'Shop>Work@15', 'Shop>Work@25', 'Shop>Work@35']);
    expect(trips.map((it) => minuteOf(it.arriveAt))).toEqual([35, 45, 55]);
  });

  it('runs arrive-by trips backward from the destination', async () => {
    const { calls, search } = timetable();
    const trips = await searchWithStops(request({ time: { type: 'arriveBy', at: at(60) } }), search);
    expect(calls[0]).toEqual({ from: 'Shop', to: 'Work', minute: 60, type: 'arriveBy' });
    expect(calls[1]).toMatchObject({ from: 'Home', to: 'Shop', type: 'arriveBy' });
    for (const it of trips) expect(minuteOf(it.arriveAt)).toBeLessThanOrEqual(60);
    expect(trips[0]!.legs[0]!.to.name).toBe('Shop');
  });

  it('slides walking hops to leave when the rider reaches the stop', async () => {
    const search = async (req: TripRequest) => req.origin.name === 'Home'
      ? [trip('bus', home, shop, 0, 12)]
      : [trip('walk', shop, work, 0, 8, 'walk')];
    const [only] = await searchWithStops(request(), search);
    expect(only!.legs.map((leg) => [minuteOf(leg.departAt), minuteOf(leg.arriveAt)])).toEqual([[0, 12], [12, 20]]);
  });

  it('keeps your own car or bike on every hop', async () => {
    const search = async (req: TripRequest) => req.origin.name === 'Home'
      ? [trip('bus-1', home, shop, 0, 20), trip('car-1', home, shop, 0, 5, 'car')]
      : [trip('car-2', shop, work, 0, 5, 'car'), trip('bus-2', shop, work, 30, 50)];
    const trips = await searchWithStops(request(), search);
    expect(trips.map((it) => it.id)).toEqual(['bus-1~bus-2', 'car-1~car-2']);
  });

  it('drops chains that cannot reach the next stop', async () => {
    const search = async (req: TripRequest) => (req.origin.name === 'Home' ? [trip('late', home, shop, 0, 50)] : [trip('early', shop, work, 10, 20)]);
    expect(await searchWithStops(request(), search)).toEqual([]);
  });
});

describe('stops helpers', () => {
  const stitched = stitchHops([trip('a', home, shop, 0, 10), trip('b', shop, gym, 12, 20), trip('c', gym, work, 25, 30)], [shop, gym]);

  it('splits a stitched trip back into its hops', () => {
    const parts = splitHops(stitched);
    expect(parts.map((part) => [part.legs.length, minuteOf(part.departAt), minuteOf(part.arriveAt)])).toEqual([[1, 0, 10], [1, 12, 20], [1, 25, 30]]);
    expect(parts.every((part) => part.stops === undefined)).toBe(true);
    expect(splitHops(trip('x', home, work, 0, 5))).toHaveLength(1);
  });

  it('counts transfers and transfer buffers across stops', () => {
    expect(stitched.transfers).toBe(2);
    expect(stitched.legs.map((leg) => leg.transferBufferMinutes)).toEqual([undefined, 2, 5]);
    const walked = stitchHops([trip('a', home, shop, 0, 10), trip('w', shop, gym, 10, 14, 'walk'), trip('c', gym, work, 20, 30)], [shop, gym]);
    expect(walked.transfers).toBe(1);
    expect(walked.legs[2]!.transferBufferMinutes).toBe(6);
    const resplit = stitchHops(splitHops(stitched), [shop, gym]);
    expect([resplit.transfers, resplit.legs[1]!.transferBufferMinutes]).toEqual([2, 2]);
  });

  it('lists the stops still ahead of a leg', () => {
    expect(stopsAfter(stitched, -1)).toEqual([shop, gym]);
    expect(stopsAfter(stitched, 1)).toEqual([gym]);
    expect(stopsAfter(stitched, 2)).toEqual([]);
  });

  it('lists every place in visiting order', () => {
    expect(tripPlaces(request({ stops: [shop, gym] }))).toEqual([home, shop, gym, work]);
  });
});
