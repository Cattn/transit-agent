import { modeGroups, type TravelMode } from '@transit/shared';

export type ModeGroupName = 'transit' | 'fly';

export const MODE_OPTIONS: readonly { group: ModeGroupName; label: string; glyph: string }[] = [
  { group: 'transit', label: 'Transit', glyph: '\u{1F68C}' },
  { group: 'fly', label: 'Fly', glyph: '✈' }
];

export function modesForGroup(group: ModeGroupName, currentModes: readonly TravelMode[]): TravelMode[] {
  const modes: TravelMode[] = modeGroups[group].filter((mode) => mode !== 'car');
  return currentModes.includes('car') ? [...modes, 'car'] : modes;
}

export function groupForModes(modes: readonly TravelMode[]): ModeGroupName {
  return modes.includes('flight') ? 'fly' : 'transit';
}
