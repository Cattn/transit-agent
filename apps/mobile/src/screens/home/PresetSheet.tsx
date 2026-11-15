import type { LngLat, Place, PresetIcon } from '@transit/shared';
import type { AppColors } from '../../theme/colors';

export interface PresetChoice {
  name?: string;
  color: string;
  icon: PresetIcon;
  place?: Place;
}

export interface PresetSheetProps {
  colors: AppColors;
  label: string;
  value: PresetChoice;
  palette: readonly string[];
  icons: readonly PresetIcon[];
  placeEditable: boolean;
  nameEditable: boolean;
  near?: LngLat;
  saving: boolean;
  error?: string;
  onSave: (choice: PresetChoice) => void;
  onDelete?: () => void;
  onOpenSettings: () => void;
  onClose: () => void;
}

export function PresetSheet(props: PresetSheetProps) {
  void props;
  return null;
}
