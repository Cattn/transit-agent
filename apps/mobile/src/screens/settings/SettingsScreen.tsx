import { StyleSheet, Text, View } from 'react-native';
import { useAppColors } from '../../theme/appearance';

export function SettingsScreen() {
  const colors = useAppColors();
  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text accessibilityRole="header" style={[styles.title, { color: colors.onSurface }]}>Settings</Text>
      <Text style={[styles.body, { color: colors.onSurfaceVariant }]}>Coming in plan 025.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12 },
  title: { fontSize: 28, fontWeight: '700' },
  body: { fontSize: 16 }
});
