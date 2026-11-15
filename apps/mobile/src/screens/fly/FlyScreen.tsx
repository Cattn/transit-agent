import Flight from '../../../assets/icons/flight_fill.xml';
import { PlaceholderSheet } from '../placeholder/PlaceholderSheet';

export function FlyScreen({ onClose }: { onClose: () => void }) {
  return <PlaceholderSheet title="Fly" body="Coming soon." icon={Flight} onClose={onClose} />;
}
