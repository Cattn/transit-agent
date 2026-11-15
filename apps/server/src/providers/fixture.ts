import { createHash } from 'node:crypto';
import type { Itinerary, Leg, Place, TravelMode, TripRequest } from '@transit/shared';
import { haversineMeters, interpolate, wobbleLine } from '../planning/geo.js';
import type { RouteProvider } from './types.js';

/** Real streets are not straight lines. */
const DETOUR_FACTOR = 1.3;
const METERS_PER_MILE = 1609.344;
const GAS_USD_PER_GALLON = 3.2;
const DEFAULT_MPG = 28;
const PARKING_USD = 15;
const FARES: Partial<Record<TravelMode, number>> = { bus: 1.7, rail: 2.4 };
const BIKESHARE_UNLOCK_USD = 2.95;
const ROUTE_NAMES: Partial<Record<TravelMode, string>> = { bus: 'Bus 1', rail: 'Red Line' };
const TRANSIT_MODES: readonly TravelMode[] = ['bus', 'rail', 'ferry', 'flight'];

type OptionKey = 'transit' | 'transit-safe' | 'bike-rail' | 'drive' | 'walk';

interface Segment {
  mode: TravelMode;
  start: number;
  end: number;
  /** Meters per minute. */
  speed: number;
  /** Wait before this leg departs; set as the leg's `transferBufferMinutes`. */
  bufferMinutes?: number;
}

interface Option {
  key: OptionKey;
  segments: Segment[];
}

/** Fixed index per option, used as the geometry seed so options bend differently on the map. */
const OPTION_SEEDS: Record<OptionKey, number> = { transit: 0, 'transit-safe': 1, 'bike-rail': 2, drive: 3, walk: 4 };

const WALK = 80;
const BUS = 300;
const RAIL = 600;
const BIKE = 250;
const CAR = 500;

function bikeMode(req: TripRequest): TravelMode {
  if (req.vehicles.ownsBike && req.modes.includes('bike')) return 'bike';
  if (req.modes.includes('bikeshare')) return 'bikeshare';
  return 'bike';
}

function optionsFor(req: TripRequest, distanceMeters: number): Option[] {
  const allowed = (mode: TravelMode) => req.modes.includes(mode);
  const options: Option[] = [];

  if (allowed('bus') || allowed('rail')) {
    options.push({
      key: 'transit',
      segments: [
        { mode: 'walk', start: 0, end: 0.08, speed: WALK },
        { mode: 'bus', start: 0.08, end: 0.55, speed: BUS },
        { mode: 'rail', start: 0.55, end: 0.94, speed: RAIL, bufferMinutes: 4 },
        { mode: 'walk', start: 0.94, end: 1, speed: WALK }
      ]
    });
    options.push({
      key: 'transit-safe',
      segments: [
        { mode: 'walk', start: 0, end: 0.08, speed: WALK },
        // A single bus (no transit transfer) with a comfortable 12 min wait at the stop.
        { mode: 'bus', start: 0.08, end: 0.94, speed: BUS, bufferMinutes: 12 },
        { mode: 'walk', start: 0.94, end: 1, speed: WALK }
      ]
    });
  }

  if ((allowed('bike') || allowed('bikeshare')) && allowed('rail')) {
    options.push({
      key: 'bike-rail',
      segments: [
        { mode: bikeMode(req), start: 0, end: 0.3, speed: BIKE },
        { mode: 'rail', start: 0.3, end: 0.95, speed: RAIL, bufferMinutes: 5 },
        { mode: 'walk', start: 0.95, end: 1, speed: WALK }
      ]
    });
  }

  if (allowed('car') && req.vehicles.ownsCar) {
    options.push({ key: 'drive', segments: [{ mode: 'car', start: 0, end: 1, speed: CAR }] });
  }

  if (distanceMeters < 3000) {
    options.push({ key: 'walk', segments: [{ mode: 'walk', start: 0, end: 1, speed: WALK }] });
  }

  return options;
}

/** Offset suffix of an ISO datetime ('Z' or '±HH:MM'), so output times keep the request's offset. */
function offsetOf(iso: string): string {
  const match = /(Z|[+-]\d{2}:?\d{2})$/i.exec(iso);
  return match?.[1]?.toUpperCase() ?? 'Z';
}

function offsetMinutes(offset: string): number {
  if (offset === 'Z') return 0;
  const sign = offset.startsWith('-') ? -1 : 1;
  const digits = offset.slice(1).replace(':', '');
  return sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2, 4)));
}

/** Formats epoch ms as an ISO datetime in the given offset, e.g. 2026-11-16T08:00:00-05:00. */
function formatIso(ms: number, offset: string): string {
  if (offset === 'Z') return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const local = new Date(ms + offsetMinutes(offset) * 60_000).toISOString().slice(0, 19);
  const normalized = offset.includes(':') ? offset : `${offset.slice(0, 3)}:${offset.slice(3)}`;
  return `${local}${normalized}`;
}

const roundUsd = (usd: number) => Math.round(usd * 100) / 100;

function placeAt(req: TripRequest, option: Option, boundary: number): Place {
  if (boundary === 0) return req.origin;
  const segments = option.segments;
  if (boundary === segments.length) return req.destination;
  const before = segments[boundary - 1];
  const after = segments[boundary];
  const fraction = after?.start ?? before?.end ?? 0;
  const touchesRail = before?.mode === 'rail' || after?.mode === 'rail';
  const kind = touchesRail ? 'station' : 'stop';
  return {
    name: `Fixture ${kind} ${boundary}`,
    coordinates: interpolate(req.origin.coordinates, req.destination.coordinates, fraction),
    kind,
    code: `fx-${option.key}-${kind}-${boundary}`
  };
}

function legLabel(leg: Leg): string {
  if (leg.routeName) return leg.routeName;
  switch (leg.mode) {
    case 'walk': return `Walk ${leg.durationMinutes} min`;
    case 'bike': return `Bike ${leg.durationMinutes} min`;
    case 'bikeshare': return `Bikeshare ${leg.durationMinutes} min`;
    case 'car': return `Drive ${leg.durationMinutes} min`;
    default: return `${leg.mode[0]?.toUpperCase() ?? ''}${leg.mode.slice(1)} ${leg.durationMinutes} min`;
  }
}

function buildItinerary(req: TripRequest, option: Option, distanceMeters: number, hash: string, fetchedAt: string): Itinerary {
  const id = `fx-${option.key}-${hash}`;
  const offset = offsetOf(req.time.at);
  const seed = OPTION_SEEDS[option.key];

  const sized = option.segments.map((segment) => {
    const legMeters = (segment.end - segment.start) * distanceMeters * DETOUR_FACTOR;
    return { segment, legMeters, minutes: Math.ceil(legMeters / segment.speed) };
  });
  const totalMinutes = sized.reduce((sum, { segment, minutes }) => sum + minutes + (segment.bufferMinutes ?? 0), 0);
  const anchor = Date.parse(req.time.at);
  let cursor = req.time.type === 'departAt' ? anchor : anchor - totalMinutes * 60_000;

  const legs: Leg[] = sized.map(({ segment, legMeters, minutes }, index) => {
    cursor += (segment.bufferMinutes ?? 0) * 60_000;
    const departMs = cursor;
    cursor += minutes * 60_000;
    const from = placeAt(req, option, index);
    const to = placeAt(req, option, index + 1);
    const leg: Leg = {
      id: `${id}-${index}`,
      mode: segment.mode,
      from,
      to,
      departAt: formatIso(departMs, offset),
      arriveAt: formatIso(cursor, offset),
      durationMinutes: minutes,
      distanceMeters: Math.round(legMeters),
      geometry: { type: 'LineString', coordinates: wobbleLine(from.coordinates, to.coordinates, 12, 0.002, seed) },
      timeSource: segment.mode === 'bus' || segment.mode === 'rail' ? 'scheduled' : 'estimated'
    };
    const routeName = ROUTE_NAMES[segment.mode];
    if (routeName) leg.routeName = routeName;
    if (segment.bufferMinutes !== undefined) leg.transferBufferMinutes = segment.bufferMinutes;
    return leg;
  });

  const lines: Itinerary['cost']['lines'] = [];
  for (const leg of legs) {
    const fare = FARES[leg.mode];
    if (fare !== undefined) lines.push({ label: `${leg.routeName ?? leg.mode} fare`, usd: fare, estimated: true });
    if (leg.mode === 'bikeshare') lines.push({ label: 'Bikeshare unlock', usd: BIKESHARE_UNLOCK_USD, estimated: true });
    if (leg.mode === 'car') {
      const miles = (leg.distanceMeters ?? 0) / METERS_PER_MILE;
      const gas = (miles / (req.vehicles.carMpg ?? DEFAULT_MPG)) * GAS_USD_PER_GALLON;
      lines.push({ label: 'Gas', usd: roundUsd(gas), estimated: true });
      lines.push({ label: 'Parking', usd: PARKING_USD, estimated: true });
    }
  }

  const first = legs[0];
  const last = legs[legs.length - 1];
  if (!first || !last) throw new Error(`Fixture option ${option.key} has no legs`);
  const transitLegs = legs.filter((leg) => TRANSIT_MODES.includes(leg.mode)).length;

  return {
    id,
    legs,
    departAt: first.departAt,
    arriveAt: last.arriveAt,
    durationMinutes: Math.round((Date.parse(last.arriveAt) - Date.parse(first.departAt)) / 60_000),
    transfers: Math.max(0, transitLegs - 1),
    walkMinutes: legs.filter((leg) => leg.mode === 'walk').reduce((sum, leg) => sum + leg.durationMinutes, 0),
    cost: { totalUsd: roundUsd(lines.reduce((sum, line) => sum + line.usd, 0)), lines },
    risk: { level: 'low', reasons: [] },
    violations: [],
    summary: legs.map(legLabel).join(' → '),
    source: { provider: 'fixture', fetchedAt }
  };
}

/** Deterministic offline provider: same request → same itineraries (ids, times, geometry). */
export class FixtureProvider implements RouteProvider {
  readonly name = 'fixture';

  supports(): boolean {
    return true;
  }

  async search(request: TripRequest, signal?: AbortSignal): Promise<Itinerary[]> {
    signal?.throwIfAborted();
    const distanceMeters = haversineMeters(request.origin.coordinates, request.destination.coordinates);
    const hash = createHash('sha1')
      .update(JSON.stringify([request.origin.coordinates, request.destination.coordinates, request.time]))
      .digest('hex')
      .slice(0, 8);
    const fetchedAt = new Date().toISOString();
    return optionsFor(request, distanceMeters).map((option) => buildItinerary(request, option, distanceMeters, hash, fetchedAt));
  }

  async refresh(it: Itinerary, request: TripRequest, signal?: AbortSignal): Promise<Itinerary | undefined> {
    const legIds = it.legs.map((leg) => leg.id).join();
    const match = (await this.search(request, signal)).find((candidate) => candidate.legs.map((leg) => leg.id).join() === legIds);
    const raw = process.env.FIXTURE_DELAY_MINUTES?.trim();
    if (!match || !raw) return match;
    const delay = Number(raw);
    const start = match.legs.findIndex((leg) => leg.mode === 'bus' || leg.mode === 'rail');
    if (!Number.isFinite(delay) || start < 0) return match;
    const shift = (iso: string) => formatIso(Date.parse(iso) + delay * 60_000, offsetOf(iso));
    const legs = match.legs.map((leg, index): Leg => {
      if (index < start) return leg;
      const next: Leg = { ...leg, departAt: shift(leg.departAt), arriveAt: shift(leg.arriveAt) };
      if (leg.mode === 'bus' || leg.mode === 'rail') {
        next.timeSource = 'realtime';
        next.delayMinutes = delay;
      }
      return next;
    });
    return { ...match, legs, arriveAt: legs[legs.length - 1]!.arriveAt, departAt: legs[0]!.departAt };
  }
}
