import { describe, expect, it } from 'vitest';
import { ItinerarySchema, PlanResponseSchema, TripRequestSchema, type Itinerary, type TripRequest } from '@transit/shared';
import { FixtureProvider } from '../providers/fixture.js';
import fixtureRequest from '../providers/fixture-request.json';
import type { RouteProvider } from '../providers/types.js';
import { nextMorning, planTrip, type PlanLogger } from './plan-trip.js';

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

const at = (base: Itinerary, id: string, departAt: string, minutes = 20): Itinerary => {
  const arriveAt = new Date(Date.parse(departAt) + minutes * 60_000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  return { ...base, id, departAt, arriveAt, durationMinutes: minutes, legs: base.legs.map((leg, index) => ({ ...leg, id: `${id}-${index}`, departAt, arriveAt })) };
};

const scripted = (outbound: (r: TripRequest) => boolean, byTime: Record<string, string[]>, base: Itinerary): RouteProvider & { calls: TripRequest[] } => {
  const calls: TripRequest[] = [];
  return {
    name: 'scripted',
    calls,
    supports: () => true,
    search: async (r) => {
      calls.push(r);
      if (outbound(r)) return [at(base, 'out', r.time.at)];
      const times = byTime[new Date(r.time.at).toISOString()] ?? [];
      return times.map((time, index) => at(base, `ret-${time}`, time, index === 0 ? 30 : 20));
    }
  };
};

describe('planTrip returns', () => {
  const NY = 'America/New_York';

  it('omits returnPlan when no return was requested', async () => {
    const result = await planTrip(request(), [new FixtureProvider()], undefined, silent);
    expect('returnPlan' in result).toBe(false);
  });

  it('searches the reversed trip from returnTime without the outbound deadline', async () => {
    const outbound = request({ timeZone: NY, returnTime: '2026-11-16T14:00:00-05:00', constraints: { arriveBy: '2026-11-16T09:00:00-05:00', maxWalkMinutes: 30 } });
    const result = await planTrip(outbound, [new FixtureProvider()], undefined, silent);
    const plan = result.returnPlan!;
    expect(plan.status).toBe('ok');
    expect(plan.request.origin).toEqual(outbound.destination);
    expect(plan.request.destination).toEqual(outbound.origin);
    expect(plan.request.time).toEqual({ type: 'departAt', at: '2026-11-16T14:00:00-05:00' });
    expect(plan.request.constraints).toEqual({ maxWalkMinutes: 30 });
    expect('returnTime' in plan.request).toBe(false);
    expect(plan.options.length).toBeGreaterThan(0);
    for (const option of plan.options) {
      expect(Date.parse(option.itinerary.departAt)).toBeGreaterThanOrEqual(Date.parse('2026-11-16T14:00:00-05:00'));
      expect(option.waitMinutes).toBe(Math.round((Date.parse(option.itinerary.departAt) - Date.parse(plan.requestedDepartAt)) / 60_000));
      expect(option.itinerary.violations).toEqual([]);
    }
    expect(plan.firstMorningOptionId).toBeUndefined();
    expect(() => PlanResponseSchema.parse(result)).not.toThrow();
  });

  it('keeps overnight options and adds the first morning option, ranked with the wait', async () => {
    const base = (await new FixtureProvider().search(request()))[0]!;
    const provider = scripted((r) => r.time.at.startsWith('2026-11-16T08'), {
      '2026-11-16T05:30:00.000Z': ['2026-11-16T05:50:00Z', '2026-11-16T06:40:00Z'],
      '2026-11-16T10:00:00.000Z': ['2026-11-16T10:16:00Z', '2026-11-16T10:40:00Z']
    }, base);
    const result = await planTrip(request({ timeZone: NY, returnTime: '2026-11-16T00:30:00-05:00' }), [provider], undefined, silent);
    const plan = result.returnPlan!;
    expect(provider.calls.map((r) => r.time.at)).toEqual(['2026-11-16T08:00:00-05:00', '2026-11-16T00:30:00-05:00', '2026-11-16T10:00:00Z']);
    expect(plan.options.map((o) => [o.itinerary.id, o.waitMinutes])).toEqual([
      ['ret-2026-11-16T05:50:00Z', 20], ['ret-2026-11-16T06:40:00Z', 70], ['ret-2026-11-16T10:16:00Z', 286]
    ]);
    expect(plan.firstMorningOptionId).toBe('ret-2026-11-16T10:16:00Z');
    expect(plan.warnings).toEqual(['First morning return leaves Mon, Nov 16 at 5:16 AM, a 4 h 46 min wait']);
    expect(result.itineraries.map((it) => it.id)).toEqual(['out']);
  });

  it('warns about a long wait when service has already ended', async () => {
    const base = (await new FixtureProvider().search(request()))[0]!;
    const provider = scripted((r) => r.time.at.startsWith('2026-11-16T08'), { '2026-11-16T07:00:00.000Z': ['2026-11-16T10:20:00Z'] }, base);
    const plan = (await planTrip(request({ timeZone: NY, returnTime: '2026-11-16T02:00:00-05:00' }), [provider], undefined, silent)).returnPlan!;
    expect(provider.calls).toHaveLength(2);
    expect(plan.options.map((o) => o.waitMinutes)).toEqual([200]);
    expect(plan.firstMorningOptionId).toBe('ret-2026-11-16T10:20:00Z');
    expect(plan.warnings).toEqual(['Next return leaves Mon, Nov 16 at 5:20 AM, a 3 h 20 min wait']);
  });

  it('still searches the morning when the only morning candidate breaks a constraint', async () => {
    const base = (await new FixtureProvider().search(request()))[0]!;
    const provider: RouteProvider = {
      name: 'scripted',
      supports: () => true,
      search: async (r) => {
        if (r.time.at === '2026-11-16T00:30:00-05:00') return [{ ...at(base, 'long-walk', '2026-11-16T10:10:00Z'), walkMinutes: 40 }];
        if (r.time.at === '2026-11-16T10:00:00Z') return [{ ...at(base, 'ok', '2026-11-16T10:20:00Z'), walkMinutes: 5 }];
        return [at(base, 'out', r.time.at)];
      }
    };
    const plan = (await planTrip(request({ timeZone: NY, returnTime: '2026-11-16T00:30:00-05:00', constraints: { maxWalkMinutes: 10 } }), [provider], undefined, silent)).returnPlan!;
    expect(plan.status).toBe('ok');
    expect(plan.firstMorningOptionId).toBe('ok');
    expect(plan.nearMisses.map((it) => it.id)).toEqual(['long-walk']);
  });

  it('reports the return as unavailable when the morning search fails after an empty night', async () => {
    const provider: RouteProvider = {
      name: 'flaky',
      supports: () => true,
      search: async (r) => {
        if (r.time.at === '2026-11-16T10:00:00Z') throw new Error('timeout');
        return r.time.at === request().time.at ? new FixtureProvider().search(r) : [];
      }
    };
    const plan = (await planTrip(request({ timeZone: NY, returnTime: '2026-11-16T02:00:00-05:00' }), [provider], undefined, silent)).returnPlan!;
    expect(plan).toMatchObject({ status: 'unavailable', options: [], warnings: ['flaky unavailable for the return'] });
  });

  it('keeps outbound results when only the return search fails', async () => {
    const flaky: RouteProvider = {
      name: 'flaky',
      supports: () => true,
      search: async (r) => {
        if (r.time.at !== request().time.at) throw new Error('timeout');
        return new FixtureProvider().search(r);
      }
    };
    const result = await planTrip(request({ returnTime: '2026-11-16T17:30:00-05:00' }), [flaky], undefined, silent);
    expect(result.itineraries.length).toBeGreaterThan(0);
    expect(result.warnings).toEqual([]);
    expect(result.returnPlan).toMatchObject({ status: 'unavailable', options: [], warnings: ['flaky unavailable for the return'] });
  });

  it('separates no service from unsupported returns', async () => {
    const empty: RouteProvider = { name: 'empty', supports: () => true, search: async () => [] };
    const noRoutes = await planTrip(request({ returnTime: '2026-11-16T17:30:00-05:00' }), [empty], undefined, silent);
    expect(noRoutes.returnPlan).toMatchObject({ status: 'no_routes', warnings: ['No return routes found'] });
    const outboundOnly: RouteProvider = { ...new FixtureProvider(), name: 'outbound', supports: (r) => r.origin.name === 'Boston Common', search: (r) => new FixtureProvider().search(r) };
    const unsupported = await planTrip(request({ returnTime: '2026-11-16T17:30:00-05:00' }), [outboundOnly], undefined, silent);
    expect(unsupported.returnPlan).toMatchObject({ status: 'unsupported', options: [] });
    expect(unsupported.itineraries.length).toBeGreaterThan(0);
  });
});

describe('nextMorning', () => {
  it('finds 05:00 local across midnight and DST changes', () => {
    const NY = 'America/New_York';
    expect(new Date(nextMorning(Date.parse('2026-11-16T00:30:00-05:00'), NY)).toISOString()).toBe('2026-11-16T10:00:00.000Z');
    expect(new Date(nextMorning(Date.parse('2026-11-15T23:30:00-05:00'), NY)).toISOString()).toBe('2026-11-16T10:00:00.000Z');
    expect(new Date(nextMorning(Date.parse('2026-10-31T23:30:00-04:00'), NY)).toISOString()).toBe('2026-11-01T10:00:00.000Z');
    expect(new Date(nextMorning(Date.parse('2026-03-07T23:30:00-05:00'), NY)).toISOString()).toBe('2026-03-08T09:00:00.000Z');
    expect(new Date(nextMorning(Date.parse('2026-11-16T05:00:00-05:00'), NY)).toISOString()).toBe('2026-11-17T10:00:00.000Z');
  });
});
