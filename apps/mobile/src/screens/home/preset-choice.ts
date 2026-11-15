import { MAX_PLACE_NAME } from '@transit/shared';
import type { PresetChoice } from './PresetSheet';

export function presetChoiceReady(choice: PresetChoice, nameEditable: boolean): boolean {
  if (!nameEditable) return true;
  const name = choice.name?.trim() ?? '';
  return name.length > 0 && name.length <= MAX_PLACE_NAME && choice.place !== undefined;
}
