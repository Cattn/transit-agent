import { describe, expect, it } from 'vitest';
import { ItinerarySchema, TripRequestSchema, type TripRequest } from '@transit/shared';
import { FixtureProvider } from './fixture.js';
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
