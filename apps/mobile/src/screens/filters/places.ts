import { MAX_TRIP_STOPS, type Place, type TripDraft, type TripDraftPatch } from '@transit/shared';

export type PlaceTarget = 'origin' | 'destination' | 'add' | number;

export function placeSlots(draft: Pick<TripDraft, 'origin' | 'stops' | 'destination'>): (Place | undefined)[] {
  return [draft.origin, ...(draft.stops ?? []), draft.destination];
}

export function canAddStop(draft: Pick<TripDraft, 'stops'>): boolean {
  return (draft.stops ?? []).length < MAX_TRIP_STOPS;
}

export function pickPatch(draft: Pick<TripDraft, 'stops'>, target: PlaceTarget, place: Place): TripDraftPatch {
  const stops = draft.stops ?? [];
  if (target === 'origin') return { origin: place };
  if (target === 'destination') return { destination: place };
  if (target === 'add') return { stops: [...stops, place].slice(0, MAX_TRIP_STOPS) };
  return { stops: stops.map((stop, index) => (index === target ? place : stop)) };
}

export function removeStopPatch(draft: Pick<TripDraft, 'stops'>, index: number): TripDraftPatch {
  return { stops: (draft.stops ?? []).filter((_, i) => i !== index) };
}

export function movePatch(draft: Pick<TripDraft, 'origin' | 'stops' | 'destination'>, from: number, to: number): TripDraftPatch | undefined {
  const slots = placeSlots(draft);
  const target = Math.max(0, Math.min(slots.length - 1, to));
  if (from === target || from < 0 || from >= slots.length) return undefined;
  const [moved] = slots.splice(from, 1);
  slots.splice(target, 0, moved);
  return {
    origin: slots[0] ?? null,
    destination: slots.at(-1) ?? null,
    stops: slots.slice(1, -1).filter((place): place is Place => place !== undefined)
  };
}
