import { describe, expect, it } from 'vitest';
import { applyDraftPatch, initialDraftState, TripDraftSchema, type Place } from '@transit/shared';
import { canAddStop, movePatch, pickPatch, placeSlots, removeStopPatch } from './places';
import { filtersResetPatch } from './reset';

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
