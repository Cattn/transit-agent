import { createHash } from 'node:crypto';
import { ItinerarySchema, legLabel, type Itinerary, type Leg, type Place, type TravelMode, type TripRef, type TripRequest } from '@transit/shared';
import { DEFAULT_GAS_USD_PER_GALLON, driveCost, type CostLine } from '../flights/ground-cost.js';
import { decodePolyline } from '../planning/geo.js';
import type { RouteProvider } from './types.js';

export const TRANSITOUS_TIMEOUT_MS = 10_000;
const NUM_ITINERARIES = 5;
const METERS_PER_MILE = 1609.344;
const DEFAULT_MPG = 28;
const FARES: Partial<Record<TravelMode, number>> = { bus: 1.7, rail: 2.4 };
const TRANSIT_MODES: Partial<Record<TravelMode, string[]>> = { bus: ['BUS'], rail: ['SUBWAY', 'TRAM'] };
const LEG_MODES: Record<string, TravelMode> = { WALK: 'walk', BIKE: 'bike', CAR: 'car', BUS: 'bus', SUBWAY: 'rail', TRAM: 'rail' };
const STREET_MODES: readonly TravelMode[] = ['walk', 'bike', 'bikeshare', 'car'];

export interface TransitousPlace {
  name?: string;
  stopId?: string;
  lat: number;
  lon: number;
  departure?: string;
  scheduledDeparture?: string;
}

export interface TransitousLeg {
  mode: string;
  from: TransitousPlace;
  to: TransitousPlace;
  duration: number;
  startTime: string;
  endTime: string;
  scheduledStartTime?: string;
  realTime?: boolean;
  distance?: number;
  legGeometry?: { points?: string; precision?: number };
  rental?: unknown;
  routeId?: string;
  directionId?: string;
  tripId?: string;
  agencyName?: string;
  displayName?: string;
  routeShortName?: string;
  routeLongName?: string;
  cancelled?: boolean;
}

export interface TransitousItinerary {
  id?: string;
  duration: number;
  startTime: string;
  endTime: string;
  transfers: number;
  legs: TransitousLeg[];
}

export interface TransitousPlanResponse {
  itineraries?: TransitousItinerary[];
  direct?: TransitousItinerary[];
}

export interface MapOptions {
  fetchedAt: string;
  gasUsdPerGallon?: number;
  onSkip?: (reason: string) => void;
}

const minutes = (seconds: number) => Math.round(seconds / 60);
const roundUsd = (usd: number) => Math.round(usd * 100) / 100;

function legMode(leg: TransitousLeg): TravelMode | undefined {
  if (leg.mode === 'BIKE' && leg.rental) return 'bikeshare';
  return LEG_MODES[leg.mode];
}

function tripRef(leg: TransitousLeg): TripRef | undefined {
  if (!leg.tripId) return undefined;
  const ref: TripRef = { provider: 'transitous', tripId: leg.tripId };
  const parsed = /^(\d{4})(\d{2})(\d{2})_\d{2}:\d{2}_([^_]+)_(.+)$/.exec(leg.tripId);
  if (parsed) {
    ref.serviceDate = `${parsed[1]}-${parsed[2]}-${parsed[3]}`;
    ref.feed = parsed[4];
    ref.agencyTripId = parsed[5];
  }
  if (leg.routeId) ref.routeId = leg.routeId;
  if (leg.directionId !== undefined) ref.directionId = leg.directionId;
  if (leg.from.stopId) ref.boardStopId = leg.from.stopId;
  if (leg.to.stopId) ref.alightStopId = leg.to.stopId;
  return ref;
}

function place(raw: TransitousPlace, mode: TravelMode, feed: string | undefined, fallback?: Place): Place {
  if (!raw.stopId && fallback) return { ...fallback, coordinates: [raw.lon, raw.lat] };
  const result: Place = { coordinates: [raw.lon, raw.lat] };
  if (raw.name && raw.name !== 'START' && raw.name !== 'END') result.name = raw.name;
  if (raw.stopId) {
    result.kind = mode === 'rail' ? 'station' : 'stop';
    result.code = feed && raw.stopId.startsWith(`${feed}_`) ? raw.stopId.slice(feed.length + 1) : raw.stopId;
  }
  return result;
}

function costLines(legs: Leg[], req: TripRequest, gasUsdPerGallon: number): CostLine[] {
  const lines: CostLine[] = [];
  for (const leg of legs) {
    const fare = FARES[leg.mode];
    if (fare !== undefined) lines.push({ label: `${leg.routeName ?? leg.mode} fare`, usd: fare, estimated: true });
    if (leg.mode === 'car') {
      lines.push(...driveCost((leg.distanceMeters ?? 0) / METERS_PER_MILE, 0, { mpg: req.vehicles.carMpg ?? DEFAULT_MPG, gasUsdPerGallon }));
    }
  }
  return lines;
}

function withTransferBuffers(legs: Leg[]): void {
  let lastTransitArrival: number | undefined;
  let movement = 0;
  for (const leg of legs) {
    if (STREET_MODES.includes(leg.mode)) {
      movement += leg.durationMinutes;
      continue;
    }
    if (lastTransitArrival !== undefined) {
      leg.transferBufferMinutes = Math.max(0, Math.floor((Date.parse(leg.departAt) - lastTransitArrival) / 60_000 - movement));
    }
    lastTransitArrival = Date.parse(leg.arriveAt);
    movement = 0;
  }
}

export function mapTransitousItinerary(raw: TransitousItinerary, req: TripRequest, options: MapOptions): Itinerary | string {
  const id = `tr-${createHash('sha1').update(raw.id || JSON.stringify(raw.legs.map((leg) => [leg.mode, leg.startTime, leg.endTime, leg.tripId, leg.from.lat, leg.from.lon, leg.to.lat, leg.to.lon, leg.distance]))).digest('hex').slice(0, 12)}`;
  const legs: Leg[] = [];
  for (const [index, rawLeg] of raw.legs.entries()) {
    const mode = legMode(rawLeg);
    if (!mode) return `unsupported mode ${rawLeg.mode}`;
    if (rawLeg.cancelled) return 'cancelled trip';
    const encoded = rawLeg.legGeometry?.points;
    const coordinates = encoded ? decodePolyline(encoded, rawLeg.legGeometry?.precision ?? 6) : [];
    if (coordinates.length < 2) return `missing geometry on ${rawLeg.mode} leg`;
    const trip = tripRef(rawLeg);
    const leg: Leg = {
      id: `${id}-${index}`,
      mode,
      from: place(rawLeg.from, mode, trip?.feed, index === 0 ? req.origin : undefined),
      to: place(rawLeg.to, mode, trip?.feed, index === raw.legs.length - 1 ? req.destination : undefined),
      departAt: rawLeg.startTime,
      arriveAt: rawLeg.endTime,
      durationMinutes: minutes(rawLeg.duration),
      geometry: { type: 'LineString', coordinates },
      timeSource: STREET_MODES.includes(mode) || rawLeg.realTime ? 'estimated' : 'scheduled'
    };
    if (rawLeg.distance !== undefined) leg.distanceMeters = Math.round(rawLeg.distance);
    const routeName = rawLeg.displayName || rawLeg.routeShortName || rawLeg.routeLongName;
    if (routeName && !STREET_MODES.includes(mode)) leg.routeName = routeName;
    if (rawLeg.agencyName) leg.agency = rawLeg.agencyName;
    if (trip) leg.trip = trip;
    legs.push(leg);
  }
  if (legs.length === 0) return 'no legs';
  withTransferBuffers(legs);

  const lines = costLines(legs, req, options.gasUsdPerGallon ?? DEFAULT_GAS_USD_PER_GALLON);
  const itinerary: Itinerary = {
    id,
    legs,
    departAt: raw.startTime,
    arriveAt: raw.endTime,
    durationMinutes: minutes(raw.duration),
    transfers: raw.transfers,
    walkMinutes: legs.filter((leg) => leg.mode === 'walk').reduce((sum, leg) => sum + leg.durationMinutes, 0),
    cost: { totalUsd: roundUsd(lines.reduce((sum, line) => sum + line.usd, 0)), lines },
    risk: { level: 'low', reasons: [] },
    violations: [],
    summary: legs.map(legLabel).join(' → '),
    source: { provider: 'transitous', fetchedAt: options.fetchedAt }
  };
  const parsed = ItinerarySchema.safeParse(itinerary);
  return parsed.success ? parsed.data : `invalid itinerary: ${parsed.error.issues[0]?.message ?? 'schema'}`;
}

export function mapTransitousPlan(response: TransitousPlanResponse, req: TripRequest, options: MapOptions): Itinerary[] {
  const mapped: Itinerary[] = [];
  for (const raw of [...(response.itineraries ?? []), ...(response.direct ?? [])]) {
    const result = mapTransitousItinerary(raw, req, options);
    if (typeof result === 'string') options.onSkip?.(result);
    else if (!mapped.some((it) => it.id === result.id)) mapped.push(result);
  }
  return mapped;
}

export function transitousPlanUrl(baseUrl: string, req: TripRequest): URL {
  const url = new URL(`${baseUrl.replace(/\/+$/, '')}/api/v6/plan`);
  const [fromLng, fromLat] = req.origin.coordinates;
  const [toLng, toLat] = req.destination.coordinates;
  url.searchParams.set('fromPlace', `${fromLat},${fromLng}`);
  url.searchParams.set('toPlace', `${toLat},${toLng}`);
  url.searchParams.set('time', new Date(req.time.at).toISOString());
  if (req.time.type === 'arriveBy') url.searchParams.set('arriveBy', 'true');
  url.searchParams.set('numItineraries', String(NUM_ITINERARIES));
  url.searchParams.set('transitModes', req.modes.flatMap((mode) => TRANSIT_MODES[mode] ?? []).join(','));
  const direct = ['WALK'];
  if (req.modes.includes('bike') && req.vehicles.ownsBike) direct.push('BIKE');
  if (req.modes.includes('car') && req.vehicles.ownsCar) direct.push('CAR');
  url.searchParams.set('directModes', direct.join(','));
  if (req.constraints.wheelchairAccessible) url.searchParams.set('pedestrianProfile', 'WHEELCHAIR');
  return url;
}

export interface TransitousOptions {
  baseUrl: string;
  userAgent: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
  gasUsdPerGallon?: number;
  logger?: { warn(details: unknown, message?: string): void };
}

export class TransitousProvider implements RouteProvider {
  readonly name = 'transitous';

  constructor(private readonly options: TransitousOptions) {}

  supports(request: TripRequest): boolean {
    return request.modes.some((mode) => mode === 'walk' || TRANSIT_MODES[mode] !== undefined || mode === 'bike' || mode === 'car');
  }

  async search(request: TripRequest, signal?: AbortSignal): Promise<Itinerary[]> {
    const { baseUrl, userAgent, fetch: fetchImpl = globalThis.fetch, timeoutMs = TRANSITOUS_TIMEOUT_MS, logger = console } = this.options;
    const timeout = AbortSignal.timeout(timeoutMs);
    const res = await fetchImpl(transitousPlanUrl(baseUrl, request), {
      headers: { 'User-Agent': userAgent, Accept: 'application/json' },
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout
    });
    if (!res.ok) throw new Error(`Transitous returned ${res.status}`);
    const body = (await res.json()) as TransitousPlanResponse;
    if (!Array.isArray(body.itineraries) && !Array.isArray(body.direct)) throw new Error('Transitous response has no itineraries');
    return mapTransitousPlan(body, request, {
      fetchedAt: new Date().toISOString(),
      gasUsdPerGallon: this.options.gasUsdPerGallon,
      onSkip: (reason) => logger.warn({ provider: this.name, reason }, 'Skipped Transitous itinerary')
    });
  }
}
