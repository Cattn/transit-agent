import { airportByIata, type Airport } from './airports.js';
import { haversineKm } from './geo.js';

export interface FareQuote {
  id: string;
  from: string;
  to: string;
  /** ISO with offset */
  departAt: string;
  /** ISO with offset */
  arriveAt: string;
  durationMinutes: number;
  stops: number;
  layovers: { airport: string; minutes: number }[];
  carrier: string;
  flightNumbers: string[];
  /** null when the source listed the flight without a price. Keep these: the agent can still use the schedule. */
  priceUsd: number | null;
  bagsIncluded: number;
  bookingUrl?: string;
  source: string;
  fetchedAt: string;
}

/** Several origins AND destinations (plan 019 uses both). */
export interface FareSearch {
  from: string[];
  to: string[];
  /** YYYY-MM-DD, local to the origin. */
  date: string;
}

/** Returns ALL quotes found, unsorted by contract (callers sort). */
export interface FlightFareProvider {
  readonly name: string;
  search(q: FareSearch, signal?: AbortSignal): Promise<FareQuote[]>;
}

interface SampleRoute {
  priceUsd: number;
  /** 1-stop routes: connect at the first hub that is neither the origin nor the destination. */
  connection?: { hubs: readonly string[]; minutes: number };
}

/** Sample prices per origin, chosen so the cheapest fare (JFK) is not the cheapest trip from Boston. */
const SAMPLE_ROUTES: Readonly<Record<string, Readonly<SampleRoute>>> = {
  BOS: { priceUsd: 240 },
  PVD: { priceUsd: 150 },
  MHT: { priceUsd: 200 },
  JFK: { priceUsd: 130 },
  EWR: { priceUsd: 135, connection: { hubs: ['ORD', 'DTW'], minutes: 45 } },
  BDL: { priceUsd: 190, connection: { hubs: ['PHL', 'CLT'], minutes: 120 } }
};
const ORIGIN_ORDER = Object.keys(SAMPLE_ROUTES);

/** Each origin gets a 09:00 flight at its sample price and a 06:00 early flight $40 cheaper. */
const DEPARTURES = [
  { hhmm: '0900', discountUsd: 0 },
  { hhmm: '0600', discountUsd: 40 }
] as const;

const OFFSET = '-05:00';
const OFFSET_MS = -5 * 60 * 60 * 1000;
const CRUISE_KMH = 800;
const TAXI_MINUTES = 30;

/** Formats an instant as an ISO string in the fixed -05:00 offset, e.g. 2026-12-01T11:24:00-05:00. */
function isoAtOffset(ms: number): string {
  return new Date(ms + OFFSET_MS).toISOString().slice(0, 19) + OFFSET;
}

/** One flight leg: great-circle distance at cruise speed plus taxi time, in (fractional) minutes. */
function legMinutes(a: Airport, b: Airport): number {
  return (haversineKm(a.coordinates, b.coordinates) / CRUISE_KMH) * 60 + TAXI_MINUTES;
}

/** The connection hub for origin → dest, or undefined for a nonstop (no route connection, or no hub qualifies). */
function pickHub(route: SampleRoute, origin: Airport, dest: Airport): { hub: Airport; minutes: number } | undefined {
  if (!route.connection) return undefined;
  for (const code of route.connection.hubs) {
    const hub = airportByIata(code);
    if (hub && code !== origin.iata && code !== dest.iata) return { hub, minutes: route.connection.minutes };
  }
  return undefined;
}

/** Deterministic sample fares. No network, no randomness; only `fetchedAt` varies between calls. */
export class FixtureFareProvider implements FlightFareProvider {
  readonly name = 'fixture-fares';

  async search(q: FareSearch, signal?: AbortSignal): Promise<FareQuote[]> {
    signal?.throwIfAborted();
    const fetchedAt = new Date().toISOString();
    const quotes: FareQuote[] = [];

    for (const from of q.from) {
      const route = SAMPLE_ROUTES[from];
      const origin = airportByIata(from);
      if (!route || !origin) continue;
      for (const to of q.to) {
        const dest = airportByIata(to);
        if (!dest || to === from) continue;

        const connection = pickHub(route, origin, dest);
        const durationMinutes = Math.round(
          connection
            ? legMinutes(origin, connection.hub) + connection.minutes + legMinutes(connection.hub, dest)
            : legMinutes(origin, dest)
        );
        const base = 100 + ORIGIN_ORDER.indexOf(from) * 10;

        DEPARTURES.forEach(({ hhmm, discountUsd }, i) => {
          const departAt = `${q.date}T${hhmm.slice(0, 2)}:${hhmm.slice(2)}:00${OFFSET}`;
          const flight = base + i;
          // Fresh objects per quote: callers may annotate results without touching other quotes.
          quotes.push({
            id: `fx-${from}-${to}-${q.date}-${hhmm}`,
            from,
            to,
            departAt,
            arriveAt: isoAtOffset(Date.parse(departAt) + durationMinutes * 60_000),
            durationMinutes,
            stops: connection ? 1 : 0,
            layovers: connection ? [{ airport: connection.hub.iata, minutes: connection.minutes }] : [],
            carrier: 'Sample Air',
            flightNumbers: connection ? [`SA${flight}`, `SA${flight + 500}`] : [`SA${flight}`],
            priceUsd: route.priceUsd - discountUsd,
            bagsIncluded: 0,
            source: this.name,
            fetchedAt
          });
        });
      }
    }
    return quotes;
  }
}
