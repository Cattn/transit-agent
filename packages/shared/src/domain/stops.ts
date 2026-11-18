import type { CostLine, Itinerary, ItineraryStop, Leg } from './itinerary.js';
import { scheduledModes } from './modes.js';
import type { Place } from './places.js';
import type { TripRequest } from './trip-draft.js';

/** Most places a trip may pass through between origin and destination (issue #120). */
export const MAX_TRIP_STOPS = 3;
/** Most partial chains carried from one hop to the next. */
export const MAX_STOP_CHAINS = 6;

const MINUTE_MS = 60_000;

const shiftIso = (iso: string, ms: number) => new Date(Date.parse(iso) + ms).toISOString();

/** The places a request visits in order: origin, every stop, destination. */
export function tripPlaces(request: Pick<TripRequest, 'origin' | 'destination' | 'stops'>): Place[] {
  return [request.origin, ...(request.stops ?? []), request.destination];
}

/** One request per hop. Hops carry no stops, return trip, or deadline; the stitched trip is checked against those. */
export function hopRequests(request: TripRequest, time: TripRequest['time']): TripRequest[] {
  const places = tripPlaces(request);
  return places.slice(1).map((destination, index) => {
    const hop: TripRequest = { ...request, origin: places[index]!, destination, time, constraints: { ...request.constraints } };
    delete hop.stops;
    delete hop.returnTime;
    delete hop.constraints.arriveBy;
    return hop;
  });
}

/** Street-only options (walk, bike, car) run whenever you start them, so they can slide to fit a chain. */
function shiftable(it: Itinerary): boolean {
  return it.legs.every((leg) => !scheduledModes.includes(leg.mode));
}

function shift(it: Itinerary, ms: number): Itinerary {
  if (ms === 0) return it;
  return {
    ...it,
    departAt: shiftIso(it.departAt, ms),
    arriveAt: shiftIso(it.arriveAt, ms),
    legs: it.legs.map((leg) => ({ ...leg, departAt: shiftIso(leg.departAt, ms), arriveAt: shiftIso(leg.arriveAt, ms) }))
  };
}

/** Your own car or bike stays with you, so every hop of a chain must use the same ones (or none). */
export function vehiclesOf(it: Itinerary): string {
  return [...new Set(it.legs.map((leg) => leg.mode).filter((mode) => mode === 'car' || mode === 'bike'))].sort().join(',');
}

/** The best next hop that leaves after `after` (departAt chains), or the best previous hop that arrives before `before` (arriveBy chains). */
export function pickHop(candidates: readonly Itinerary[], bound: { after: string } | { before: string }, vehicles: string): Itinerary | undefined {
  let best: Itinerary | undefined;
  for (const raw of candidates) {
    if (vehiclesOf(raw) !== vehicles) continue;
    let it = raw;
    if ('after' in bound) {
      const gap = Date.parse(bound.after) - Date.parse(it.departAt);
      if (gap > 0 && shiftable(it)) it = shift(it, gap);
      if (Date.parse(it.departAt) < Date.parse(bound.after)) continue;
      if (!best || Date.parse(it.arriveAt) < Date.parse(best.arriveAt) || (it.arriveAt === best.arriveAt && it.transfers < best.transfers)) best = it;
    } else {
      const gap = Date.parse(bound.before) - Date.parse(it.arriveAt);
      if (gap < 0 && shiftable(it)) it = shift(it, gap);
      if (Date.parse(it.arriveAt) > Date.parse(bound.before)) continue;
      if (!best || Date.parse(it.departAt) > Date.parse(best.departAt) || (it.departAt === best.departAt && it.transfers < best.transfers)) best = it;
    }
  }
  return best;
}

function mergeCost(parts: readonly Itinerary[]): Itinerary['cost'] {
  const lines: CostLine[] = [];
  for (const line of parts.flatMap((part) => part.cost.lines)) {
    const same = lines.find((other) => other.label === line.label && other.estimated === line.estimated);
    if (same) same.usd = Math.round((same.usd + line.usd) * 100) / 100;
    else lines.push({ ...line });
  }
  return { totalUsd: Math.round(parts.reduce((sum, part) => sum + part.cost.totalUsd, 0) * 100) / 100, lines };
}

/** Joins one itinerary per hop into a single trip. `stops` are the places between hops, in order. */
export function stitchHops(parts: readonly Itinerary[], stops: readonly Place[]): Itinerary {
  const first = parts[0]!;
  const last = parts.at(-1)!;
  const seen = new Set<string>();
  const legs: Leg[] = [];
  const marks: ItineraryStop[] = [];
  parts.forEach((part, index) => {
    if (index > 0) marks.push({ place: stops[index - 1]!, legIndex: legs.length });
    for (const leg of part.legs) {
      const id = seen.has(leg.id) ? `${index}-${leg.id}` : leg.id;
      seen.add(id);
      legs.push(id === leg.id ? leg : { ...leg, id });
    }
  });
  const fetchedAt = parts.map((part) => part.source.fetchedAt).sort((a, b) => Date.parse(a) - Date.parse(b))[0]!;
  return {
    id: parts.map((part) => part.id).join('~'),
    legs,
    departAt: first.departAt,
    arriveAt: last.arriveAt,
    durationMinutes: Math.max(0, Math.round((Date.parse(last.arriveAt) - Date.parse(first.departAt)) / MINUTE_MS)),
    transfers: parts.reduce((sum, part) => sum + part.transfers, 0),
    walkMinutes: parts.reduce((sum, part) => sum + part.walkMinutes, 0),
    cost: mergeCost(parts),
    risk: { level: 'low', reasons: [] },
    violations: [],
    summary: parts.map((part) => part.summary).join(' → '),
    source: { provider: first.source.provider, fetchedAt },
    stops: marks
  };
}

/** Splits a stitched trip back into its hops (the inverse of `stitchHops`). One part when there are no stops. */
export function splitHops(it: Itinerary): Itinerary[] {
  const marks = it.stops ?? [];
  if (marks.length === 0) return [it];
  const bounds = [0, ...marks.map((mark) => mark.legIndex), it.legs.length];
  return bounds.slice(1).map((end, index) => {
    const legs = it.legs.slice(bounds[index], end);
    const departAt = legs[0]!.departAt;
    const arriveAt = legs.at(-1)!.arriveAt;
    const part: Itinerary = {
      ...it,
      id: `${it.id}#${index}`,
      legs,
      departAt,
      arriveAt,
      durationMinutes: Math.max(0, Math.round((Date.parse(arriveAt) - Date.parse(departAt)) / MINUTE_MS)),
      transfers: Math.max(0, legs.filter((leg) => scheduledModes.includes(leg.mode)).length - 1),
      walkMinutes: legs.filter((leg) => leg.mode === 'walk').reduce((sum, leg) => sum + leg.durationMinutes, 0)
    };
    delete part.stops;
    return part;
  });
}

/** Stops still ahead once leg `legIndex` is next: a stop is passed when its first outgoing leg is at or before `legIndex`. */
export function stopsAfter(it: Itinerary, legIndex: number): Place[] {
  return (it.stops ?? []).filter((mark) => mark.legIndex > legIndex).map((mark) => mark.place);
}

type Search = (request: TripRequest) => Promise<Itinerary[]>;

/**
 * Plans a trip with stops by chaining one search per hop. Departing trips run forward: each hop
 * leaves after the previous one arrives. Arrive-by trips run backward from the destination. Each
 * hop is searched once at the earliest (or latest) chain's time, and again only for chains that
 * search left without a connection. A chain keeps the same own car or bike on every hop.
 * Requests without stops go straight to `search`.
 */
export async function searchWithStops(request: TripRequest, search: Search): Promise<Itinerary[]> {
  const stops = request.stops ?? [];
  if (stops.length === 0) return search(request);
  const forward = request.time.type === 'departAt';
  const hops = hopRequests(request, request.time);
  const order = forward ? hops : [...hops].reverse();

  let chains: Itinerary[][] = (await search(order[0]!)).slice(0, MAX_STOP_CHAINS).map((it) => [it]);
  for (const hop of order.slice(1)) {
    if (chains.length === 0) break;
    const edge = (chain: Itinerary[]) => (forward ? chain.at(-1)!.arriveAt : chain[0]!.departAt);
    const times = chains.map((chain) => Date.parse(edge(chain)));
    const cache = new Map<number, Promise<Itinerary[]>>();
    const searchAt = (ms: number) => {
      let found = cache.get(ms);
      if (!found) {
        found = search({ ...hop, time: { type: forward ? 'departAt' : 'arriveBy', at: new Date(ms).toISOString() } });
        cache.set(ms, found);
      }
      return found;
    };
    const shared = await searchAt(forward ? Math.min(...times) : Math.max(...times));
    const next = await Promise.all(chains.map(async (chain) => {
      const bound = forward ? { after: edge(chain) } : { before: edge(chain) };
      const vehicles = vehiclesOf(chain[0]!);
      const pick = pickHop(shared, bound, vehicles) ?? pickHop(await searchAt(Date.parse(edge(chain))), bound, vehicles);
      if (!pick) return undefined;
      return forward ? [...chain, pick] : [pick, ...chain];
    }));
    chains = next.filter((chain): chain is Itinerary[] => chain !== undefined);
  }

  const stitched: Itinerary[] = [];
  for (const chain of chains) {
    if (chain.length !== hops.length) continue;
    const it = stitchHops(chain, stops);
    if (!stitched.some((other) => other.id === it.id)) stitched.push(it);
  }
  return stitched;
}
