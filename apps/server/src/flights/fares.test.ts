import { describe, it, expect } from 'vitest';
import { AIRPORTS, airportByIata } from './airports.js';
import { FixtureFareProvider, type FareQuote } from './fares.js';
import { haversineKm, KM_PER_MILE } from './geo.js';
import { driveCost, transitCost, type CostLine } from './ground-cost.js';

const ORIGINS = ['BOS', 'PVD', 'MHT', 'JFK', 'EWR', 'BDL'];
const DATE = '2026-12-01';
const provider = new FixtureFareProvider();
const priced = (q: FareQuote) => q.priceUsd ?? Infinity;

describe('FixtureFareProvider', () => {
  it('returns two flights from each of the 6 origins to ORD', async () => {
    const quotes = await provider.search({ from: ORIGINS, to: ['ORD'], date: DATE });
    expect(new Set(quotes.map((q) => q.from))).toEqual(new Set(ORIGINS));
    expect(quotes).toHaveLength(12);
    for (const from of ORIGINS) {
      expect(quotes.filter((q) => q.from === from).map((q) => q.departAt).sort()).toEqual([
        `${DATE}T06:00:00-05:00`,
        `${DATE}T09:00:00-05:00`
      ]);
    }
    expect(new Set(quotes.map((q) => q.id)).size).toBe(12);
    expect(quotes.find((q) => q.from === 'BOS' && q.departAt.includes('T09:00'))!.id).toBe(`fx-BOS-ORD-${DATE}-0900`);
  });

  it('gives JFK the lowest fare, and the 06:00 flight is $40 cheaper', async () => {
    const quotes = await provider.search({ from: ORIGINS, to: ['ORD'], date: DATE });
    const cheapest = [...quotes].sort((a, b) => priced(a) - priced(b))[0]!;
    expect(cheapest.from).toBe('JFK');
    const jfk = quotes.filter((q) => q.from === 'JFK');
    expect(jfk.map(priced).sort((a, b) => a - b)).toEqual([90, 130]);
  });

  it('routes EWR→ORD via DTW: one 45 min layover, duration = leg 1 + 45 + leg 2', async () => {
    const [ewr] = await provider.search({ from: ['EWR'], to: ['ORD'], date: DATE });
    expect(ewr!.stops).toBe(1);
    expect(ewr!.layovers).toEqual([{ airport: 'DTW', minutes: 45 }]);
    expect(ewr!.flightNumbers).toHaveLength(2);
    const leg = (a: string, b: string) => (haversineKm(airportByIata(a)!.coordinates, airportByIata(b)!.coordinates) / 800) * 60 + 30;
    expect(ewr!.durationMinutes).toBe(Math.round(leg('EWR', 'DTW') + 45 + leg('DTW', 'ORD')));
    expect(Date.parse(ewr!.arriveAt) - Date.parse(ewr!.departAt)).toBe(ewr!.durationMinutes * 60_000);
    expect(ewr!.arriveAt).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:00-05:00$/);
  });

  it.each([
    ['EWR', 'ORD', 'DTW'],
    ['EWR', 'LAX', 'ORD'],
    ['BDL', 'PHL', 'CLT'],
    ['BDL', 'ORD', 'PHL']
  ])('connects %s→%s at %s', async (from, to, hub) => {
    const quotes = await provider.search({ from: [from], to: [to], date: DATE });
    expect(quotes).toHaveLength(2);
    for (const q of quotes) expect(q.layovers.map((l) => l.airport)).toEqual([hub]);
  });

  it('never lays over at an endpoint, for every sample origin and every known destination', async () => {
    const quotes = await provider.search({ from: ORIGINS, to: AIRPORTS.map((a) => a.iata), date: DATE });
    expect(quotes.length).toBe(ORIGINS.length * (AIRPORTS.length - 1) * 2);
    for (const q of quotes) {
      for (const l of q.layovers) {
        expect(l.airport, q.id).not.toBe(q.from);
        expect(l.airport, q.id).not.toBe(q.to);
      }
      expect(q.stops, q.id).toBe(q.layovers.length);
      expect(q.flightNumbers, q.id).toHaveLength(q.stops === 1 ? 2 : 1);
      expect(q.stops, q.id).toBeLessThanOrEqual(1);
    }
  });

  it('returns fresh objects: mutating a result does not change sibling or later quotes', async () => {
    const search = { from: ['EWR', 'BDL'], to: ['ORD'], date: DATE };
    const first = await provider.search(search);
    const pristine = structuredClone(first);
    first[0]!.layovers[0]!.minutes = 999;
    first[0]!.flightNumbers.push('SA999');

    // The sibling quote (same origin, other departure) is untouched.
    expect(first[1]!.layovers[0]!.minutes).toBe(pristine[1]!.layovers[0]!.minutes);
    expect(first[1]!.flightNumbers).toEqual(pristine[1]!.flightNumbers);

    const strip = (qs: FareQuote[]) => qs.map((q) => ({ ...q, fetchedAt: undefined }));
    expect(strip(await provider.search(search))).toEqual(strip(pristine));
    expect(strip(await new FixtureFareProvider().search(search))).toEqual(strip(pristine));
  });

  it('is deterministic apart from fetchedAt', async () => {
    const strip = (qs: FareQuote[]) => qs.map((q) => ({ ...q, fetchedAt: undefined }));
    const a = await provider.search({ from: ORIGINS, to: ['ORD', 'LAX'], date: DATE });
    const b = await provider.search({ from: ORIGINS, to: ['ORD', 'LAX'], date: DATE });
    expect(strip(a)).toEqual(strip(b));
    expect(a.every((q) => q.source === 'fixture-fares' && q.carrier === 'Sample Air' && q.bookingUrl === undefined)).toBe(true);
  });

  it('skips unknown airports and origin == destination', async () => {
    expect(await provider.search({ from: ['BOS', 'XXX'], to: ['ZZZ', 'BOS'], date: DATE })).toEqual([]);
  });
});

describe('worked example: issue #1, is it cheaper to fly from another airport?', () => {
  // From Boston Common, 1-day trip, 25 mpg, gas $3.20. Round-trip drive = 2 × straight-line
  // miles (an underestimate; fine here). BOS is reached by subway: two fares at the plan's $2.05.
  const BOSTON_COMMON: [number, number] = [-71.0656, 42.355];
  const sum = (lines: CostLine[]) => lines.reduce((t, l) => t + l.usd, 0);

  function groundCost(iata: string): CostLine[] {
    if (iata === 'BOS') return transitCost(2.05, 2);
    const airport = airportByIata(iata)!;
    const roundTripMiles = (2 * haversineKm(BOSTON_COMMON, airport.coordinates)) / KM_PER_MILE;
    return driveCost(roundTripMiles, 1, { mpg: 25, gasUsdPerGallon: 3.2, parkingUsdPerDay: airport.parkingUsdPerDay });
  }

  it.each(['0900', '0600'])('PVD < JFK < BOS door to door, though JFK has the cheapest fare (%s flights)', async (hhmm) => {
    const quotes = (await provider.search({ from: ['PVD', 'JFK', 'BOS'], to: ['ORD'], date: DATE })).filter((q) => q.id.endsWith(hhmm));
    const total = (iata: string) => priced(quotes.find((q) => q.from === iata)!) + sum(groundCost(iata));

    expect([...quotes].sort((a, b) => priced(a) - priced(b))[0]!.from).toBe('JFK');
    expect(total('PVD')).toBeLessThan(total('JFK'));
    expect(total('JFK')).toBeLessThan(total('BOS'));

    if (hhmm === '0900') {
      // Sanity-check against the plan's rough figures (≈ $187, $202, $244).
      expect(total('PVD')).toBeCloseTo(187, -1);
      expect(total('JFK')).toBeCloseTo(202, -1);
      expect(total('BOS')).toBeCloseTo(244, -1);
    }
  });
});
