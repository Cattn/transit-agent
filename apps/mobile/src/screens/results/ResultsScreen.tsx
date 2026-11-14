import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppColors } from '../../theme/appearance';
import { androidFont } from '../../theme/typography';

export function ResultsScreen({ onClose }: { onClose: () => void }) {
  const colors = useAppColors();
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.onSurface }, androidFont(700)]}>Results</Text>
        <Pressable accessibilityRole="button" hitSlop={12} onPress={onClose}>
          <Text style={[styles.close, { color: colors.primary }, androidFont(500)]}>Close</Text>
        </Pressable>
      </View>
      <Text style={[styles.body, { color: colors.onSurfaceVariant }, androidFont(400)]}>Coming in plan 021.</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 28, fontWeight: '700' },
  close: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 16 }
});
