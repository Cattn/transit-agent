import { z } from 'zod';
import { TravelModeSchema } from '../domain/modes.js';
import { PlaceSchema, type Place } from '../domain/places.js';
import {
  TripConstraintsSchema,
  TripDraftSchema,
  TripPreferencesSchema,
  TripRequestSchema,
  TripTimeSchema,
  VehiclesSchema,
  type TripConstraints,
  type TripDraft,
  type TripRequest
} from '../domain/trip-draft.js';

/** Who made a change. The UI uses this to show "agent set this" chips that the user can edit. */
export const DraftChangeSourceSchema = z.enum(['user', 'agent', 'profile']);
export type DraftChangeSource = z.infer<typeof DraftChangeSourceSchema>;

const draftShape = TripDraftSchema.shape;
const constraintShape = TripConstraintsSchema.shape;
const preferenceShape = TripPreferencesSchema.shape;
const vehicleShape = VehiclesSchema.shape;

/**
 * A change to a `TripDraft`. Filters (source 'user') and the agent (source 'agent') both produce
 * these, and `applyDraftPatch` is the only way either reaches state.
 *
 * - Omitted / `undefined` = leave the field alone.
 * - `null` = clear an optional field (top-level fields and individual constraints).
 * - `constraints`, `preferences`, `vehicles` merge per key; `modes` replaces the whole list.
 *
 * Validators are reused from the draft schema (unwrapped, without defaults) so they can't drift.
 * Plan 006 uses this as the agent's tool parameter schema.
 */
export const TripDraftPatchSchema = z.object({
  origin: PlaceSchema.nullable().optional(),
  destination: PlaceSchema.nullable().optional(),
  stops: draftShape.stops.unwrap().nullable().optional(),
  time: TripTimeSchema.nullable().optional(),
  returnTime: draftShape.returnTime.unwrap().nullable().optional(),
  timeZone: draftShape.timeZone.unwrap().nullable().optional(),
  modes: z.array(TravelModeSchema).min(1).optional(),
  vehicles: z.object({
    ownsBike: vehicleShape.ownsBike.unwrap().optional(),
    ownsCar: vehicleShape.ownsCar.unwrap().optional(),
    carMpg: vehicleShape.carMpg
  }).optional(),
  constraints: z.object({
    arriveBy: constraintShape.arriveBy.unwrap().nullable().optional(),
    maxBudgetUsd: constraintShape.maxBudgetUsd.unwrap().nullable().optional(),
    maxWalkMinutes: constraintShape.maxWalkMinutes.unwrap().nullable().optional(),
    maxBikeMinutes: constraintShape.maxBikeMinutes.unwrap().nullable().optional(),
    maxTransfers: constraintShape.maxTransfers.unwrap().nullable().optional(),
    minTransferBufferMinutes: constraintShape.minTransferBufferMinutes.unwrap().nullable().optional(),
    maxDriveMinutes: constraintShape.maxDriveMinutes.unwrap().nullable().optional(),
    wheelchairAccessible: constraintShape.wheelchairAccessible.unwrap().nullable().optional()
  }).optional(),
  preferences: z.object({
    comfortVsCost: preferenceShape.comfortVsCost.unwrap().optional(),
    transferRisk: preferenceShape.transferRisk.unwrap().optional(),
    lateTolerance: preferenceShape.lateTolerance.unwrap().optional(),
    activeTravel: preferenceShape.activeTravel.unwrap().optional()
  }).optional()
});
export type TripDraftPatch = z.infer<typeof TripDraftPatchSchema>;

export interface DraftState {
  draft: TripDraft;
  /** Which source last set each field path, e.g. { 'constraints.maxWalkMinutes': 'agent' } — UI shows an "agent set this" chip. */
  provenance: Record<string, DraftChangeSource>;
}

const topLevelKeys = ['origin', 'destination', 'time', 'returnTime', 'timeZone'] as const;
const nestedKeys = ['vehicles', 'constraints', 'preferences'] as const;

/** A fresh draft with schema defaults. `defaults` (e.g. from a saved profile) is applied with source 'profile'. */
export function initialDraftState(defaults?: TripDraftPatch): DraftState {
  const state: DraftState = { draft: TripDraftSchema.parse({}), provenance: {} };
  return defaults ? applyDraftPatch(state, defaults, 'profile') : state;
}

/**
 * Apply a patch immutably and record provenance. Throws a ZodError if the patch or the resulting
 * draft is invalid (e.g. `preferences.comfortVsCost: 2`).
 */
export function applyDraftPatch(state: DraftState, patch: TripDraftPatch, source: DraftChangeSource): DraftState {
  const parsed = TripDraftPatchSchema.parse(patch);
  const next: Record<string, unknown> = { ...state.draft };
  const provenance: Record<string, DraftChangeSource> = { ...state.provenance };

  for (const key of topLevelKeys) {
    const value = parsed[key];
    if (value === undefined) continue;
    if (value === null) delete next[key];
    else next[key] = value;
    provenance[key] = source;
  }

  if (parsed.stops !== undefined) {
    if (parsed.stops === null || parsed.stops.length === 0) delete next.stops;
    else next.stops = [...parsed.stops];
    provenance.stops = source;
  }

  if (parsed.modes !== undefined) {
    next.modes = [...parsed.modes];
    provenance.modes = source;
  }

  for (const group of nestedKeys) {
    const groupPatch = parsed[group] as Record<string, unknown> | undefined;
    if (!groupPatch) continue;
    const merged: Record<string, unknown> = { ...(state.draft[group] as Record<string, unknown>) };
    for (const [key, value] of Object.entries(groupPatch)) {
      if (value === undefined) continue;
      if (value === null) delete merged[key];
      else merged[key] = value;
      provenance[`${group}.${key}`] = source;
    }
    next[group] = merged;
  }

  return { draft: TripDraftSchema.parse(next), provenance };
}

export type MissingTripField = 'origin' | 'destination' | 'time';

/** Turn a draft into a searchable request, or report which required fields are still missing. */
export function toTripRequest(draft: TripDraft): { ok: true; request: TripRequest } | { ok: false; missing: MissingTripField[] } {
  const missing: MissingTripField[] = [];
  if (!draft.origin) missing.push('origin');
  if (!draft.destination) missing.push('destination');
  if (!draft.time) missing.push('time');
  if (missing.length > 0) return { ok: false, missing };
  return { ok: true, request: TripRequestSchema.parse(draft) };
}

/** "2026-11-13T09:05:00-05:00" → "9:05 AM", read from the string's own offset (no device time zone). */
function formatClock(iso: string): string {
  const match = /T(\d{2}):(\d{2})/.exec(iso);
  if (!match) return iso;
  const hours = Number(match[1]);
  const minutes = match[2];
  const suffix = hours < 12 ? 'AM' : 'PM';
  const hour12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${hour12}:${minutes} ${suffix}`;
}

function formatPlace(place: Place): string {
  return place.name ?? `${place.coordinates[1].toFixed(4)}, ${place.coordinates[0].toFixed(4)}`;
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

const constraintLabels: { [K in keyof TripConstraints]-?: { label: string; format: (value: NonNullable<TripConstraints[K]>) => string } } = {
  arriveBy: { label: 'Must arrive by', format: formatClock },
  maxBudgetUsd: { label: 'Max budget', format: (v) => `$${v}` },
  maxWalkMinutes: { label: 'Max walk', format: (v) => `${v} min` },
  maxBikeMinutes: { label: 'Max bike', format: (v) => `${v} min` },
  maxTransfers: { label: 'Max transfers', format: (v) => String(v) },
  minTransferBufferMinutes: { label: 'Min transfer buffer', format: (v) => `${v} min` },
  maxDriveMinutes: { label: 'Max drive', format: (v) => `${v} min` },
  wheelchairAccessible: { label: 'Wheelchair accessible', format: (v) => (v ? 'yes' : 'no') }
};

/**
 * Human-readable lines for a patch, e.g. ["Max walk: 15 min", "Must arrive by 9:00 AM"].
 * Used for agent chips and toasts. Order follows the patch fields.
 */
export function describePatch(patch: TripDraftPatch): string[] {
  const lines: string[] = [];

  if (patch.origin !== undefined) lines.push(patch.origin === null ? 'From: cleared' : `From: ${formatPlace(patch.origin)}`);
  if (patch.destination !== undefined) lines.push(patch.destination === null ? 'To: cleared' : `To: ${formatPlace(patch.destination)}`);
  if (patch.stops !== undefined) lines.push(patch.stops === null || patch.stops.length === 0 ? 'Stops: none' : `Stops: ${patch.stops.map(formatPlace).join(', ')}`);
  if (patch.time !== undefined) {
    if (patch.time === null) lines.push('Time: cleared');
    else lines.push(`${patch.time.type === 'arriveBy' ? 'Arrive by' : 'Leave at'} ${formatClock(patch.time.at)}`);
  }
  if (patch.returnTime !== undefined) lines.push(patch.returnTime === null ? 'Return: cleared' : `Return after ${formatClock(patch.returnTime)}`);
  if (patch.timeZone !== undefined) lines.push(patch.timeZone === null ? 'Time zone: trip default' : `Time zone: ${patch.timeZone}`);
  if (patch.modes !== undefined) lines.push(`Modes: ${patch.modes.join(', ')}`);

  if (patch.vehicles) {
    const { ownsBike, ownsCar, carMpg } = patch.vehicles;
    if (ownsBike !== undefined) lines.push(ownsBike ? 'Has a bike' : 'No bike');
    if (ownsCar !== undefined) lines.push(ownsCar ? 'Has a car' : 'No car');
    if (carMpg !== undefined) lines.push(`Car: ${carMpg} mpg`);
  }

  if (patch.constraints) {
    for (const [key, value] of Object.entries(patch.constraints)) {
      if (value === undefined) continue;
      const entry = constraintLabels[key as keyof TripConstraints] as { label: string; format: (v: unknown) => string } | undefined;
      if (!entry) continue;
      if (value === null) lines.push(key === 'wheelchairAccessible' ? `${entry.label}: not required` : `${entry.label}: no limit`);
      else if (key === 'arriveBy') lines.push(`${entry.label} ${entry.format(value)}`);
      else lines.push(`${entry.label}: ${entry.format(value)}`);
    }
  }

  if (patch.preferences) {
    const { comfortVsCost, transferRisk, lateTolerance, activeTravel } = patch.preferences;
    if (comfortVsCost !== undefined) lines.push(`Comfort vs cost: ${percent(comfortVsCost)} comfort`);
    if (transferRisk !== undefined) lines.push(`Tight transfers OK: ${percent(transferRisk)}`);
    if (lateTolerance !== undefined) lines.push(`Late tolerance: ${lateTolerance}`);
    if (activeTravel !== undefined) lines.push(`Active travel: ${percent(activeTravel)}`);
  }

  return lines;
}
