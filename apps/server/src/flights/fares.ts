import { airportByIata } from './airports.js';
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
  layover?: { airport: string; minutes: number };
}

/** Sample prices per origin, chosen so the cheapest fare (JFK) is not the cheapest trip from Boston. */
const SAMPLE_ROUTES: Record<string, SampleRoute> = {
  BOS: { priceUsd: 240 },
  PVD: { priceUsd: 150 },
  MHT: { priceUsd: 200 },
  JFK: { priceUsd: 130 },
  EWR: { priceUsd: 135, layover: { airport: 'ORD', minutes: 45 } },
  BDL: { priceUsd: 190, layover: { airport: 'PHL', minutes: 120 } }
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

        const layovers = route.layover ? [route.layover] : [];
        const durationMinutes = Math.round(
          (haversineKm(origin.coordinates, dest.coordinates) / CRUISE_KMH) * 60 + TAXI_MINUTES + (route.layover?.minutes ?? 0)
        );
        const base = 100 + ORIGIN_ORDER.indexOf(from) * 10;

        DEPARTURES.forEach(({ hhmm, discountUsd }, i) => {
          const departAt = `${q.date}T${hhmm.slice(0, 2)}:${hhmm.slice(2)}:00${OFFSET}`;
          const flight = base + i;
          quotes.push({
            id: `fx-${from}-${to}-${q.date}-${hhmm}`,
            from,
            to,
            departAt,
            arriveAt: isoAtOffset(Date.parse(departAt) + durationMinutes * 60_000),
            durationMinutes,
            stops: layovers.length,
            layovers,
            carrier: 'Sample Air',
            flightNumbers: layovers.length ? [`SA${flight}`, `SA${flight + 500}`] : [`SA${flight}`],
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
