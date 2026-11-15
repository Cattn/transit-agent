import { describe, expect, it } from 'vitest';
import { applyDraftPatch, initialDraftState, TripDraftSchema } from '@transit/shared';
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
