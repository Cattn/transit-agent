import { ItinerarySchema, type Itinerary, type Leg } from '../../domain/itinerary.js';
import type { TravelMode } from '../../domain/modes.js';
import type { LngLat, Place } from '../../domain/places.js';
import { hopRequests, stitchHops } from '../../domain/stops.js';
import type { TripRequest } from '../../domain/trip-draft.js';

function distance(a: LngLat, b: LngLat): number {
  const rad = (n: number) => n * Math.PI / 180;
  const lat = Math.sin(rad(b[1] - a[1]) / 2) ** 2;
  const lng = Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(rad(b[0] - a[0]) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.min(1, Math.sqrt(lat + lng)));
}

function hash(value: string): string {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) result = Math.imul(result ^ value.charCodeAt(i), 16777619);
  return (result >>> 0).toString(16);
}

type Segment = [TravelMode, number, number, number?];

export function mockItineraries(request: TripRequest, now: () => Date = () => new Date()): Itinerary[] {
  const { origin, destination } = request;
  const d = distance(origin.coordinates, destination.coordinates) * 1.3;
  const key = hash(JSON.stringify([origin.coordinates, destination.coordinates, request.time.at]));
  const bikeMode = request.modes.includes('bike') ? 'bike' : 'bikeshare';
  const options: { suffix: string; segments: Segment[] }[] = [
    { suffix: 'fast', segments: [['walk', 0, 0.1], ['bus', 0.1, 0.5], ['rail', 0.5, 0.95, 3], ['walk', 0.95, 1]] },
    { suffix: 'safe', segments: [['walk', 0, 0.1], ['bus', 0.1, 0.95], ['walk', 0.95, 1]] },
    { suffix: 'bike', segments: [[bikeMode, 0, 0.35], ['rail', 0.35, 0.95, 6], ['walk', 0.95, 1]] },
    { suffix: 'drive', segments: [['car', 0, 1]] }
  ];
  const speeds: Partial<Record<TravelMode, number>> = { walk: 80, bike: 250, bikeshare: 250, bus: 300, rail: 600, car: 500 };
  const point = (fraction: number): LngLat => [
    origin.coordinates[0] + (destination.coordinates[0] - origin.coordinates[0]) * fraction,
    origin.coordinates[1] + (destination.coordinates[1] - origin.coordinates[1]) * fraction
  ];
  const place = (fraction: number): Place => fraction === 0 ? origin : fraction === 1 ? destination : {
    name: `Mock stop ${Math.round(fraction * 100)}`, coordinates: point(fraction), kind: 'stop'
  };
  return options.filter(({ segments }) => segments.every(([mode]) => mode === 'walk' || request.modes.includes(mode))).map(({ suffix, segments }) => {
    const durations = segments.map(([mode, start, end]) => Math.ceil(d * (end - start) / (speeds[mode] ?? 80)));
    const durationMinutes = durations.reduce((sum, n) => sum + n, 0) + segments.reduce((sum, segment) => sum + (segment[3] ?? 0), 0);
    let cursor = Date.parse(request.time.at) - (request.time.type === 'arriveBy' ? durationMinutes * 60000 : 0);
    const legs: Leg[] = segments.map(([mode, start, end, transferBufferMinutes], i) => {
      cursor += (transferBufferMinutes ?? 0) * 60000;
      const departAt = new Date(cursor).toISOString();
      cursor += durations[i]! * 60000;
      return {
        id: `mock-${suffix}-${key}-leg-${i}`, mode, from: place(start), to: place(end),
        departAt, arriveAt: new Date(cursor).toISOString(), durationMinutes: durations[i]!,
        distanceMeters: d * (end - start),
        geometry: { type: 'LineString', coordinates: Array.from({ length: 6 }, (_, j) => point(start + (end - start) * j / 5)) },
        timeSource: mode === 'bus' && suffix === 'fast' ? 'realtime' : mode === 'bus' || mode === 'rail' ? 'scheduled' : 'estimated',
        ...(mode === 'bus' ? { routeName: 'Bus 1', agency: 'MBTA' } : mode === 'rail' ? { routeName: 'Red Line', agency: 'MBTA' } : {}),
        ...(mode === 'bus' && suffix === 'fast' ? { delayMinutes: 4 } : {}),
        ...(transferBufferMinutes === undefined ? {} : { transferBufferMinutes })
      };
    });
    const lines = legs.flatMap((leg) => leg.mode === 'bus' ? [{ label: 'Bus fare', usd: 1.7, estimated: true }]
      : leg.mode === 'rail' ? [{ label: 'Rail fare', usd: 2.4, estimated: true }]
      : leg.mode === 'bikeshare' ? [{ label: 'Bikeshare unlock', usd: 2.95, estimated: true }]
      : leg.mode === 'car' ? [
        { label: 'Gas', usd: Math.round(d / 1609.344 / (request.vehicles.carMpg ?? 28) * 3.2 * 100) / 100, estimated: true },
        { label: 'Parking', usd: 15, estimated: true }
      ] : []);
    return ItinerarySchema.parse({
      id: `mock-${suffix}-${key}`, legs, departAt: legs[0]!.departAt, arriveAt: legs[legs.length - 1]!.arriveAt,
      durationMinutes, transfers: Math.max(0, legs.filter((leg) => leg.mode === 'bus' || leg.mode === 'rail').length - 1),
      walkMinutes: legs.filter((leg) => leg.mode === 'walk').reduce((sum, leg) => sum + leg.durationMinutes, 0),
      cost: { totalUsd: Math.round(lines.reduce((sum, line) => sum + line.usd, 0) * 100) / 100, lines },
      risk: suffix === 'fast' ? { level: 'high', reasons: ['Tight 3 min transfer to Red Line'] } : { level: 'low', reasons: [] },
      violations: [], summary: legs.map((leg) => leg.routeName ?? `${leg.mode === 'walk' ? 'Walk' : leg.mode === 'car' ? 'Drive' : 'Bike'} ${leg.durationMinutes} min`).join(' → '),
      source: { provider: 'mock', fetchedAt: now().toISOString() }
    });
  });
}

/** Mock trips through stops: each mock option is chained hop by hop, leaving each stop when the last hop arrives. */
export function mockTripsWithStops(request: TripRequest, now: () => Date = () => new Date()): Itinerary[] {
  const stops = request.stops ?? [];
  if (stops.length === 0) return mockItineraries(request, now);
  const hops = hopRequests(request, request.time);
  const chain = (option: number, at: string): Itinerary | undefined => {
    const parts: Itinerary[] = [];
    for (const hop of hops) {
      const next = mockItineraries({ ...hop, time: { type: 'departAt', at: parts.at(-1)?.arriveAt ?? at } }, now)[option];
      if (!next) return undefined;
      parts.push(next);
    }
    return stitchHops(parts, stops);
  };
  return mockItineraries({ ...hops[0]!, time: { type: 'departAt', at: request.time.at } }, now).flatMap((_, option) => {
    const trip = chain(option, request.time.at);
    if (!trip || request.time.type === 'departAt') return trip ? [trip] : [];
    const early = chain(option, new Date(Date.parse(request.time.at) * 2 - Date.parse(trip.arriveAt)).toISOString());
    return early ? [early] : [];
  });
}
