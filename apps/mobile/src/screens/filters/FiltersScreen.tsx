import Tune from '../../../assets/icons/tune_fill.xml';
import { PlaceholderSheet } from '../placeholder/PlaceholderSheet';

export function FiltersScreen({ onClose }: { onClose: () => void }) {
  return <PlaceholderSheet title="Filters" body="Coming in plan 022." icon={Tune} onClose={onClose} />;
}
