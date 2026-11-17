import { PRESET_KEYS, type CustomPlace, type Place, type PresetIcon, type PresetKey, type TravelProfile } from '@transit/shared';
import { PALETTE } from './colors.js';
import { metersBetween } from './to-geojson.js';

export const PRESET_MATCH_METERS = 150;

export const DEFAULT_PRESET_COLORS: Readonly<Record<PresetKey, string>> = { home: PALETTE[3]!, office: PALETTE[0]!, gym: PALETTE[2]! };
export const DEFAULT_PRESET_ICONS: Readonly<Record<PresetKey, PresetIcon>> = { home: 'home', office: 'work', gym: 'fitness' };

export const PRESET_NAMES: Readonly<Record<PresetKey, string>> = { home: 'Home', office: 'Work', gym: 'Gym' };

type PresetProfile = Pick<TravelProfile, 'home' | 'work' | 'presets' | 'places'> | undefined;

export type PlaceKey = PresetKey | `place:${string}`;

export interface ProfilePlace {
  key: PlaceKey;
  name: string;
  icon: PresetIcon;
  color: string;
  place?: Place;
}

export function presetColor(key: PresetKey, profile: PresetProfile): string {
  return profile?.presets?.[key]?.color ?? DEFAULT_PRESET_COLORS[key];
}

export function presetIcon(key: PresetKey, profile: PresetProfile): PresetIcon {
  return profile?.presets?.[key]?.icon ?? DEFAULT_PRESET_ICONS[key];
}

export function presetPlace(key: PresetKey, profile: PresetProfile): Place | undefined {
  if (key === 'home') return profile?.home;
  if (key === 'office') return profile?.work;
  return profile?.presets?.gym?.place;
}

export function profilePlaces(profile: PresetProfile): ProfilePlace[] {
  const presets = PRESET_KEYS.map((key): ProfilePlace => ({
    key,
    name: PRESET_NAMES[key],
    icon: presetIcon(key, profile),
    color: presetColor(key, profile),
    place: presetPlace(key, profile)
  }));
  const custom = (profile?.places ?? []).map((place): ProfilePlace => ({ key: `place:${place.id}`, name: place.name, icon: place.icon, color: place.color, place: place.place }));
  return [...presets, ...custom];
}

export function placeFor(place: Place, profile: PresetProfile): ProfilePlace | undefined {
  let best: { match: ProfilePlace; meters: number } | undefined;
  for (const candidate of profilePlaces(profile)) {
    if (!candidate.place) continue;
    const meters = metersBetween(place.coordinates, candidate.place.coordinates);
    if (meters <= PRESET_MATCH_METERS && (!best || meters < best.meters)) best = { match: candidate, meters };
  }
  return best?.match;
}

export function nextPlaceColor(profile: PresetProfile): string {
  const uses = new Map<string, number>(PALETTE.map((color) => [color.toLowerCase(), 0]));
  for (const { color } of profilePlaces(profile)) {
    const key = color.toLowerCase();
    if (uses.has(key)) uses.set(key, uses.get(key)! + 1);
  }
  let best = PALETTE[0]!;
  for (const color of PALETTE) {
    if (uses.get(color.toLowerCase())! < uses.get(best.toLowerCase())!) best = color;
  }
  return best;
}

export function presetTripColors(
  trips: readonly { id: string; request: { destination: Place } }[],
  profile: PresetProfile
): Map<string, string> {
  const colors = new Map<string, string>();
  for (const trip of trips) {
    const match = placeFor(trip.request.destination, profile);
    if (match) colors.set(trip.id, match.color);
  }
  return colors;
}

export function withPresetColors(stored: ReadonlyMap<string, string>, presets: ReadonlyMap<string, string>): Map<string, string> {
  const taken = new Set([...presets.values()].map((color) => color.toLowerCase()));
  const fixed = new Map<string, string>();
  for (const [id, color] of stored) {
    if (!presets.has(id) && !taken.has(color.toLowerCase())) fixed.set(id, color);
  }
  for (const [id, color] of presets) fixed.set(id, color);
  return fixed;
}

export function isPresetKey(key: string): key is PresetKey {
  return (PRESET_KEYS as readonly string[]).includes(key);
}

export interface CustomPlaceChoice {
  name: string;
  icon: PresetIcon;
  color: string;
  place?: Place;
}

export function upsertCustomPlace(places: readonly CustomPlace[] | undefined, key: PlaceKey | 'new', choice: CustomPlaceChoice, newId: string): CustomPlace[] {
  const list = [...(places ?? [])];
  const fields = { name: choice.name.trim(), icon: choice.icon, color: choice.color };
  if (key === 'new') return choice.place ? [...list, { id: newId, ...fields, place: choice.place }] : list;
  return list.map((entry) => (`place:${entry.id}` === key ? { ...entry, ...fields, place: choice.place ?? entry.place } : entry));
}

export function removeCustomPlace(places: readonly CustomPlace[] | undefined, key: PlaceKey): CustomPlace[] {
  return (places ?? []).filter((entry) => `place:${entry.id}` !== key);
}
