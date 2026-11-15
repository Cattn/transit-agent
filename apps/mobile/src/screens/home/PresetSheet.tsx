import type { LngLat, Place, PresetIcon, PresetKey } from '@transit/shared';
import type { AppColors } from '../../theme/colors';

export interface PresetChoice {
  color: string;
  icon: PresetIcon;
  place?: Place;
}

export interface PresetSheetProps {
  colors: AppColors;
  presetKey: PresetKey;
  label: string;
  value: PresetChoice;
  palette: readonly string[];
  icons: readonly PresetIcon[];
  placeEditable: boolean;
  near?: LngLat;
  saving: boolean;
  error?: string;
  onSave: (choice: PresetChoice) => void;
  onOpenSettings: () => void;
  onClose: () => void;
}

export function PresetSheet(props: PresetSheetProps) {
  void props;
  return null;
}
