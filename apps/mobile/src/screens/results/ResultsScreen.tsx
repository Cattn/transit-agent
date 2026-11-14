import DirectionsBus from '../../../assets/icons/directions_bus_fill.xml';
import { PlaceholderSheet } from '../placeholder/PlaceholderSheet';

export function ResultsScreen({ onClose }: { onClose: () => void }) {
  return <PlaceholderSheet title="Results" body="Coming in plan 021." icon={DirectionsBus} onClose={onClose} />;
}
