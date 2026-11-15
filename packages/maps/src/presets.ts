import { PRESET_KEYS, type Place, type PresetIcon, type PresetKey, type TravelProfile } from '@transit/shared';
import { PALETTE } from './colors.js';
import { metersBetween } from './to-geojson.js';

export const PRESET_MATCH_METERS = 150;

export const DEFAULT_PRESET_COLORS: Readonly<Record<PresetKey, string>> = { home: PALETTE[3]!, office: PALETTE[0]!, gym: PALETTE[2]! };
export const DEFAULT_PRESET_ICONS: Readonly<Record<PresetKey, PresetIcon>> = { home: 'home', office: 'work', gym: 'fitness' };

type PresetProfile = Pick<TravelProfile, 'home' | 'work' | 'presets'> | undefined;

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

export function presetForPlace(place: Place, profile: PresetProfile): PresetKey | undefined {
  let best: { key: PresetKey; meters: number } | undefined;
  for (const key of PRESET_KEYS) {
    const target = presetPlace(key, profile);
    if (!target) continue;
    const meters = metersBetween(place.coordinates, target.coordinates);
    if (meters <= PRESET_MATCH_METERS && (!best || meters < best.meters)) best = { key, meters };
  }
  return best?.key;
}

export function presetTripColors(
  trips: readonly { id: string; request: { destination: Place } }[],
  profile: PresetProfile
): Map<string, string> {
  const colors = new Map<string, string>();
  for (const trip of trips) {
    const key = presetForPlace(trip.request.destination, profile);
    if (key) colors.set(trip.id, presetColor(key, profile));
  }
  return colors;
}
