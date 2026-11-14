import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Host } from '@expo/ui';
import { Card, Column, Icon, IconButton, Row, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, padding, paddingAll, weight } from '@expo/ui/jetpack-compose/modifiers';
import Close from '../../../assets/icons/close_fill.xml';
import Construction from '../../../assets/icons/construction_fill.xml';
import { useAppColors } from '../../theme/appearance';
import { materialSeedColor } from '../../theme/colors';
import { m3Text } from '../../theme/typography';
import type { PlaceholderSheetProps } from './PlaceholderSheet';

export function PlaceholderSheet({ title, body, icon, onClose }: PlaceholderSheetProps) {
  const insets = useSafeAreaInsets();
  const scheme = useAppColors().scheme;
  const m = useMaterialColors({ colorScheme: scheme, seedColor: materialSeedColor });

  return (
    <View style={[styles.container, { backgroundColor: m.surface, paddingTop: insets.top }]}>
      <Host matchContents={{ vertical: true }} colorScheme={scheme} seedColor={materialSeedColor} style={styles.fullWidth}>
        <Column verticalArrangement={{ spacedBy: 16 }} modifiers={[fillMaxWidth(), padding(4, 4, 16, 16)]}>
          <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 4 }}>
            <IconButton onClick={onClose}>
              <Icon source={Close} size={24} contentDescription="Close" />
            </IconButton>
            <Icon source={icon} size={24} tint={m.primary} />
            <Text color={m.onSurface} style={m3Text('headlineMedium')} modifiers={[padding(8, 0, 0, 0)]}>{title}</Text>
          </Row>
          <Column modifiers={[padding(12, 0, 0, 0)]}>
            <Card colors={{ containerColor: m.surfaceContainer, contentColor: m.onSurface }} modifiers={[fillMaxWidth()]}>
              <Row horizontalArrangement={{ spacedBy: 14 }} verticalAlignment="center" modifiers={[paddingAll(16)]}>
                <Icon source={Construction} size={24} tint={m.onSurfaceVariant} />
                <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[weight(1)]}>
                  <Text color={m.onSurface} style={m3Text('titleMedium')}>Not built yet</Text>
                  <Text color={m.onSurfaceVariant} style={m3Text('bodyMedium')}>{body}</Text>
                </Column>
              </Row>
            </Card>
          </Column>
        </Column>
      </Host>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  fullWidth: { width: '100%' }
});
