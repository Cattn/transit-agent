import { TripDraftSchema, type TravelMode, type TripDraft, type TripDraftPatch } from '@transit/shared';

type ConstraintsPatch = NonNullable<TripDraftPatch['constraints']>;

const CLEARED: Required<{ [K in keyof ConstraintsPatch]: null }> = {
  arriveBy: null,
  maxBudgetUsd: null,
  maxWalkMinutes: null,
  maxBikeMinutes: null,
  maxTransfers: null,
  minTransferBufferMinutes: null,
  maxDriveMinutes: null,
  wheelchairAccessible: null
};

/**
 * The patch Reset applies. Everything on the filters sheet starts over: From and To are cleared,
 * the time becomes "Depart at" now, and modes, preferences and limits go back to the saved
 * profile defaults (or the schema defaults where the profile sets none). Only the Transit / Fly
 * choice on Home is kept.
 */
export function filtersResetPatch(draft: TripDraft, defaults: TripDraftPatch | undefined, now: Date): TripDraftPatch {
  const base = TripDraftSchema.parse({});
  let modes: TravelMode[] = [...(defaults?.modes ?? base.modes)];
  const flying = draft.modes.includes('flight');
  if (flying && !modes.includes('flight')) modes.push('flight');
  if (!flying && modes.includes('flight')) {
    modes = modes.filter((mode) => mode !== 'flight');
    if (!modes.length) modes = [...base.modes];
  }
  const constraints: ConstraintsPatch = { ...CLEARED };
  for (const [key, value] of Object.entries(defaults?.constraints ?? {}) as [keyof ConstraintsPatch, unknown][]) {
    if (key !== 'arriveBy' && value !== undefined && value !== null) (constraints as Record<string, unknown>)[key] = value;
  }
  return {
    origin: null,
    destination: null,
    stops: null,
    time: { type: 'departAt', at: now.toISOString() },
    returnTime: null,
    modes,
    preferences: { ...base.preferences, ...defaults?.preferences },
    constraints
  };
}
