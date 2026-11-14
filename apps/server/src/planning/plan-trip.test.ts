import { describe, expect, it } from 'vitest';
import { ItinerarySchema, TripRequestSchema, type Itinerary, type TripRequest } from '@transit/shared';
import { FixtureProvider } from '../providers/fixture.js';
import fixtureRequest from '../providers/fixture-request.json';
import type { RouteProvider } from '../providers/types.js';
import { planTrip, type PlanLogger } from './plan-trip.js';

const request = (overrides: Record<string, unknown> = {}): TripRequest =>
  TripRequestSchema.parse({ ...fixtureRequest, ...overrides });

const silent: PlanLogger = { warn: () => {} };

const failing: RouteProvider = {
  name: 'broken',
  supports: () => true,
  search: async () => {
    throw new Error('upstream down');
  }
};

const unsupported: RouteProvider = {
  name: 'flights',
  supports: () => false,
  search: async (): Promise<Itinerary[]> => {
    throw new Error('should not be called');
  }
};

describe('planTrip', () => {
  it('returns ranked fixture itineraries with risk filled in', async () => {
    const result = await planTrip(request(), [new FixtureProvider()], undefined, silent);
    expect(result.itineraries.length).toBeGreaterThanOrEqual(3);
    expect(result.nearMisses).toEqual([]);
    expect(result.warnings).toEqual([]);
    for (const it of result.itineraries) expect(() => ItinerarySchema.parse(it)).not.toThrow();
    const transit = result.itineraries.find((it) => it.id.startsWith('fx-transit-') && !it.id.startsWith('fx-transit-safe'));
    expect(transit?.risk.level).toBe('medium');
  });

  it('moves options that break a hard constraint into nearMisses', async () => {
    const result = await planTrip(request({ constraints: { maxTransfers: 0 } }), [new FixtureProvider()], undefined, silent);
    const transitId = /^fx-transit-[0-9a-f]{8}$/;
    expect(result.itineraries.some((it) => transitId.test(it.id))).toBe(false);
    const nearMiss = result.nearMisses.find((it) => transitId.test(it.id));
    expect(nearMiss?.violations).toEqual(['1 transfer, more than the 0 allowed']);
  });

  it('caps nearMisses at 3', async () => {
    const result = await planTrip(request({ constraints: { maxBudgetUsd: 0 } }), [new FixtureProvider()], undefined, silent);
    expect(result.itineraries).toEqual([]);
    expect(result.nearMisses).toHaveLength(3);
  });

  it('turns a failing provider into a warning, not an error', async () => {
    const result = await planTrip(request(), [failing, unsupported, new FixtureProvider()], undefined, silent);
    expect(result.warnings).toEqual(['broken unavailable']);
    expect(result.itineraries.length).toBeGreaterThan(0);
  });

  it('warns when no routes are found', async () => {
    const result = await planTrip(request(), [failing], undefined, silent);
    expect(result).toEqual({ itineraries: [], nearMisses: [], warnings: ['broken unavailable', 'No routes found for this trip'] });
  });
});
