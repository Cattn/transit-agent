import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Host } from '@expo/ui';
import { Card, Column, Icon, IconButton, Row, Text, useMaterialColors } from '@expo/ui/jetpack-compose';
import { background, clip, fillMaxWidth, padding, paddingAll, Shapes, size, weight } from '@expo/ui/jetpack-compose/modifiers';
import ArrowBack from '../../../assets/icons/arrow_back_fill.xml';
import Construction from '../../../assets/icons/construction_fill.xml';
import Mobile from '../../../assets/icons/mobile_fill.xml';
import { useAppColors } from '../../theme/appearance';
import { materialSeedColor } from '../../theme/colors';
import { m3Text } from '../../theme/typography';

export function SettingsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const scheme = useAppColors().scheme;
  const m = useMaterialColors({ colorScheme: scheme, seedColor: materialSeedColor });

  return (
    <View style={[styles.container, { backgroundColor: m.surface, paddingTop: insets.top }]}>
      <Host matchContents={{ vertical: true }} colorScheme={scheme} seedColor={materialSeedColor} style={styles.fullWidth}>
        <Column verticalArrangement={{ spacedBy: 16 }} modifiers={[fillMaxWidth(), padding(4, 4, 16, 16)]}>
          <Row verticalAlignment="center" horizontalArrangement={{ spacedBy: 4 }}>
            <IconButton onClick={() => navigation.goBack()}>
              <Icon source={ArrowBack} size={24} contentDescription="Back" />
            </IconButton>
            <Text color={m.onSurface} style={m3Text('headlineMedium')}>Settings</Text>
          </Row>
          <Column verticalArrangement={{ spacedBy: 12 }} modifiers={[padding(12, 0, 0, 0)]}>
            <Card colors={{ containerColor: m.primaryContainer, contentColor: m.onPrimaryContainer }} modifiers={[fillMaxWidth()]}>
              <Row horizontalArrangement={{ spacedBy: 14 }} verticalAlignment="center" modifiers={[paddingAll(16)]}>
                <Column
                  horizontalAlignment="center"
                  verticalArrangement="center"
                  modifiers={[size(48, 48), clip(Shapes.RoundedCorner(14)), background(m.primary)]}
                >
                  <Icon source={Mobile} size={24} tint={m.onPrimary} />
                </Column>
                <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[weight(1)]}>
                  <Text color={m.onPrimaryContainer} style={m3Text('titleMedium')}>This device&apos;s profile</Text>
                  <Text color={m.onPrimaryContainer} style={m3Text('bodyMedium')}>
                    One profile per device — no account needed. Your defaults fill every new trip.
                  </Text>
                </Column>
              </Row>
            </Card>
            <Card colors={{ containerColor: m.surfaceContainer, contentColor: m.onSurface }} modifiers={[fillMaxWidth()]}>
              <Row horizontalArrangement={{ spacedBy: 14 }} verticalAlignment="center" modifiers={[paddingAll(16)]}>
                <Icon source={Construction} size={24} tint={m.onSurfaceVariant} />
                <Column verticalArrangement={{ spacedBy: 2 }} modifiers={[weight(1)]}>
                  <Text color={m.onSurface} style={m3Text('titleMedium')}>Places, trip defaults and theme</Text>
                  <Text color={m.onSurfaceVariant} style={m3Text('bodyMedium')}>Coming in plan 025.</Text>
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
