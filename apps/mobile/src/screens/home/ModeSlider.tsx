import { modeGroups, type TravelMode } from '@transit/shared';

export type ModeGroupName = 'transit' | 'drive' | 'fly';

export const MODE_OPTIONS: readonly { group: ModeGroupName; label: string; glyph: string }[] = [
  { group: 'transit', label: 'Transit', glyph: '\u{1F68C}' },
  { group: 'drive', label: 'Drive', glyph: '\u{1F697}' },
  { group: 'fly', label: 'Fly', glyph: '✈' }
];

export function modesForGroup(group: ModeGroupName): TravelMode[] {
  return [...modeGroups[group]];
}

export function groupForModes(modes: readonly TravelMode[]): ModeGroupName {
  if (modes.includes('flight')) return 'fly';
  if (modes.includes('car') && !modes.some((m) => m === 'bus' || m === 'rail' || m === 'ferry')) return 'drive';
  return 'transit';
}
