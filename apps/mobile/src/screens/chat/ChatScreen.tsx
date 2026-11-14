import WandShine from '../../../assets/icons/wand_shine_fill.xml';
import { PlaceholderSheet } from '../placeholder/PlaceholderSheet';

export function ChatScreen({ onClose }: { onClose: () => void }) {
  return <PlaceholderSheet title="Ask agent" body="Coming in plan 023." icon={WandShine} onClose={onClose} />;
}
