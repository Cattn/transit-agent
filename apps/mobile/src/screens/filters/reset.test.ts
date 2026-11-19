import { describe, expect, it } from 'vitest';
import { applyDraftPatch, initialDraftState, TripDraftSchema, type Place } from '@transit/shared';
import { canAddStop, movePatch, pickPatch, placeSlots, removeStopPatch } from './places';
import { filtersResetPatch } from './reset';
import { earliestDay, pickerClock, pickerDay, withClock, withDay } from './when';

const place = { name: 'Office', coordinates: [-71.07, 42.35] as [number, number] };
const now = new Date('2026-11-15T13:40:00.000Z');

function edited() {
  return applyDraftPatch(initialDraftState({ origin: place, destination: place, time: { type: 'arriveBy', at: '2026-11-15T09:00:00-05:00' } }), {
    modes: ['walk', 'bike', 'car'],
    preferences: { comfortVsCost: 0.9, transferRisk: 1, lateTolerance: 'strict', activeTravel: 0 },
    constraints: { maxWalkMinutes: 15, maxTransfers: 1, maxBudgetUsd: 10, wheelchairAccessible: true, arriveBy: '2026-11-15T09:00:00-05:00' }
  }, 'agent');
}

describe('filtersResetPatch', () => {
  it('clears places, sets the time to now and returns every filter to the defaults', () => {
    const state = edited();
    const next = applyDraftPatch(state, filtersResetPatch(state.draft, undefined, now), 'user');
    const base = TripDraftSchema.parse({});
    expect(next.draft.origin).toBeUndefined();
    expect(next.draft.destination).toBeUndefined();
    expect(next.draft.time).toEqual({ type: 'departAt', at: now.toISOString() });
    expect(next.draft.modes).toEqual(base.modes);
    expect(next.draft.preferences).toEqual(base.preferences);
    expect(next.draft.constraints).toEqual({});
    expect(next.provenance['constraints.maxWalkMinutes']).toBe('user');
    expect(next.provenance.destination).toBe('user');
  });

  it('uses the saved profile defaults for modes, sliders and limits', () => {
    const state = edited();
    const defaults = { modes: ['walk' as const, 'rail' as const], preferences: { activeTravel: 0.8 }, constraints: { maxWalkMinutes: 20, maxTransfers: null } };
    const next = applyDraftPatch(state, filtersResetPatch(state.draft, defaults, now), 'user');
    expect(next.draft.modes).toEqual(['walk', 'rail']);
    expect(next.draft.preferences).toMatchObject({ activeTravel: 0.8, comfortVsCost: 0.5, lateTolerance: 'some' });
    expect(next.draft.constraints).toEqual({ maxWalkMinutes: 20 });
  });

  it('keeps the Fly choice', () => {
    const state = applyDraftPatch(edited(), { modes: ['walk', 'flight'] }, 'user');
    expect(filtersResetPatch(state.draft, undefined, now).modes).toEqual(['walk', 'bus', 'rail', 'flight']);
    expect(filtersResetPatch(edited().draft, { modes: ['flight'] }, now).modes).toEqual(['walk', 'bus', 'rail']);
  });
});

const named = (name: string): Place => ({ name, coordinates: [-71, 42] });
const home = named('Home');
const shop = named('Shop');
const gym = named('Gym');
const work = named('Work');

describe('place rows', () => {
  it('lists From, stops, then To', () => {
    expect(placeSlots({ origin: home, stops: [shop], destination: undefined })).toEqual([home, shop, undefined]);
    expect(placeSlots({ origin: home, destination: work })).toEqual([home, work]);
  });

  it('adds, replaces and removes stops', () => {
    expect(pickPatch({}, 'add', shop)).toEqual({ stops: [shop] });
    expect(pickPatch({ stops: [shop, gym] }, 1, work)).toEqual({ stops: [shop, work] });
    expect(pickPatch({ stops: [shop] }, 'origin', home)).toEqual({ origin: home });
    expect(removeStopPatch({ stops: [shop, gym] }, 0)).toEqual({ stops: [gym] });
    expect(canAddStop({ stops: [shop, gym] })).toBe(true);
    expect(canAddStop({ stops: [shop, gym, work] })).toBe(false);
  });

  it('moves a stop between other stops', () => {
    expect(movePatch({ origin: home, stops: [shop, gym], destination: work }, 1, 2)).toEqual({ origin: home, destination: work, stops: [gym, shop] });
  });

  it('makes whatever lands first From and last To', () => {
    expect(movePatch({ origin: home, stops: [shop], destination: work }, 0, 2)).toEqual({ origin: shop, destination: home, stops: [work] });
    expect(movePatch({ origin: home, destination: work }, 1, 0)).toEqual({ origin: work, destination: home, stops: [] });
  });

  it('drops an empty end that lands in the middle', () => {
    expect(movePatch({ origin: undefined, stops: [shop], destination: work }, 0, 1)).toEqual({ origin: shop, destination: work, stops: [] });
  });

  it('ignores a drop in place and clamps past the ends', () => {
    expect(movePatch({ origin: home, destination: work }, 1, 1)).toBeUndefined();
    expect(movePatch({ origin: home, stops: [shop], destination: work }, 0, 9)).toEqual({ origin: shop, destination: home, stops: [work] });
  });
});

describe('trip date and time pickers (#128)', () => {
  const NY = 'America/New_York';
  const iso = (value: string) => new Date(value).toISOString();
  const localParts = (value: string) => {
    const at = new Date(value);
    return [at.getFullYear(), at.getMonth(), at.getDate(), at.getHours(), at.getMinutes()];
  };

  it('opens the pickers on the trip zone day and clock', () => {
    const at = '2026-11-21T02:30:00Z';
    expect(pickerDay(at, NY)).toBe('2026-11-20T00:00:00.000Z');
    expect(localParts(pickerClock(at, NY))).toEqual([2026, 10, 20, 21, 30]);
    expect(localParts(earliestDay(new Date('2026-11-21T05:30:00Z'), NY))).toEqual([2026, 10, 21, 0, 0]);
  });

  it('moves the trip to the picked day and keeps its clock in the trip zone', () => {
    const now = new Date('2026-11-18T12:00:00Z');
    expect(withDay(new Date('2026-11-25T00:00:00Z'), '2026-11-21T04:30:00Z', now, NY)).toBe(iso('2026-11-25T23:30:00-05:00'));
  });

  it('keeps the picked day when the new clock time is earlier', () => {
    const now = new Date('2026-11-18T17:00:20-05:00');
    expect(withClock(new Date(2026, 10, 18, 20, 0), iso('2026-11-18T18:00:00-05:00'), now, NY)).toBe(iso('2026-11-18T20:00:00-05:00'));
    expect(withClock(new Date(2026, 10, 18, 9, 0), iso('2026-11-18T18:00:00-05:00'), now, NY)).toBe(iso('2026-11-18T17:01:00-05:00'));
  });

  it('moves a past day up to the next minute, not below now', () => {
    const now = new Date('2026-11-18T23:18:30-05:00');
    expect(withDay(new Date('2026-11-18T00:00:00Z'), iso('2026-11-18T08:00:00-05:00'), now, NY)).toBe(iso('2026-11-18T23:19:00-05:00'));
  });

  it('keeps the second 1:30 AM when its own day is confirmed at fall-back', () => {
    const second = iso('2026-11-01T01:30:00-05:00');
    expect(withDay(new Date('2026-11-01T00:00:00Z'), second, new Date('2026-10-30T12:00:00Z'), NY)).toBe(second);
    expect(withClock(new Date(2026, 10, 1, 1, 30), second, new Date('2026-10-30T12:00:00Z'), NY)).toBe(second);
    expect(withDay(new Date('2026-11-01T00:00:00Z'), second, new Date('2026-11-01T01:40:00-05:00'), NY)).toBe(iso('2026-11-01T01:40:00-05:00'));
  });

  it('uses the first 1:30 AM when moving onto the fall-back day', () => {
    expect(withDay(new Date('2026-11-01T00:00:00Z'), iso('2026-10-31T01:30:00-04:00'), new Date('2026-10-30T12:00:00Z'), NY)).toBe(iso('2026-11-01T01:30:00-04:00'));
  });

  it('moves a time in the spring-forward gap to the end of the gap', () => {
    expect(withDay(new Date('2027-03-14T00:00:00Z'), iso('2027-03-07T02:30:00-05:00'), new Date('2027-03-01T12:00:00Z'), NY)).toBe(iso('2027-03-14T03:00:00-04:00'));
  });

  it('finds Auckland transitions when moving the trip day', () => {
    const AKL = 'Pacific/Auckland';
    const now = new Date('2026-09-01T00:00:00Z');
    expect(withDay(new Date('2026-09-27T00:00:00Z'), iso('2026-09-20T02:30:00+12:00'), now, AKL)).toBe(iso('2026-09-27T03:00:00+13:00'));
    expect(withDay(new Date('2027-04-04T00:00:00Z'), iso('2027-03-28T02:30:00+13:00'), now, AKL)).toBe(iso('2027-04-04T02:30:00+13:00'));
  });

  it('carries the trip clock on a device day where it exists', () => {
    const clock = new Date(pickerClock('2027-03-14T02:30:00Z', 'UTC'));
    expect([clock.getHours(), clock.getMinutes()]).toEqual([2, 30]);
  });

  it('keeps a future trip and a past-time correction on the chosen day', () => {
    expect(withClock(new Date(2026, 10, 18, 9, 0), iso('2026-11-18T18:00:00-05:00'), new Date('2026-11-18T23:59:30-05:00'), NY)).toBe(iso('2026-11-18T23:59:30-05:00'));
    const soon = iso('2026-11-19T00:00:25-05:00');
    expect(withDay(new Date('2026-11-19T00:00:00Z'), soon, new Date('2026-11-19T00:00:10-05:00'), NY)).toBe(soon);
  });
});
