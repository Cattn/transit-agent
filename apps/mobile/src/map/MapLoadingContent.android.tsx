import { Host } from '@expo/ui';
import { Button, Column, Icon, LoadingIndicator, Row, Text } from '@expo/ui/jetpack-compose';
import { paddingAll, size } from '@expo/ui/jetpack-compose/modifiers';
import Refresh from '../../assets/icons/refresh_fill.xml';
import Warning from '../../assets/icons/warning_fill.xml';
import WifiOff from '../../assets/icons/wifi_off_fill.xml';
import { materialSeedColor } from '../theme/colors';
import { m3Text } from '../theme/typography';
import { MAP_LOADING_TEXT, type MapLoadingContentProps } from './map-loading-text';

export function MapLoadingContent({ status, colors, onRetry }: MapLoadingContentProps) {
  const { title, hint } = MAP_LOADING_TEXT[status];
  return (
    <Host matchContents colorScheme={colors.scheme} seedColor={materialSeedColor}>
      <Column horizontalAlignment="center" verticalArrangement={{ spacedBy: 8 }} modifiers={[paddingAll(24)]}>
        {status === 'loading' ? (
          <LoadingIndicator color={colors.primary} modifiers={[size(48, 48)]} />
        ) : (
          <Icon source={status === 'offline' ? WifiOff : Warning} size={32} tint={colors.onSurfaceVariant} />
        )}
        <Text color={colors.onSurface} style={{ ...m3Text('titleMedium'), textAlign: 'center' }}>{title}</Text>
        {hint ? <Text color={colors.onSurfaceVariant} style={{ ...m3Text('bodyMedium'), textAlign: 'center' }}>{hint}</Text> : null}
        {status === 'failed' ? (
          <Button onClick={onRetry}>
            <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 8 }}>
              <Icon source={Refresh} size={18} />
              <Text style={m3Text('labelLarge')}>Retry</Text>
            </Row>
          </Button>
        ) : null}
      </Column>
    </Host>
  );
}
