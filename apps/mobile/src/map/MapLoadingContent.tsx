import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { MAP_LOADING_TEXT, type MapLoadingContentProps } from './map-loading-text';

export function MapLoadingContent({ status, colors, onRetry }: MapLoadingContentProps) {
  const { title, hint } = MAP_LOADING_TEXT[status];
  return (
    <View accessibilityRole={status === 'loading' ? 'progressbar' : undefined} style={styles.column}>
      {status === 'loading' ? <ActivityIndicator size="large" color={colors.primary} /> : null}
      <Text style={[styles.title, { color: colors.onSurface }]}>{title}</Text>
      {hint ? <Text style={[styles.hint, { color: colors.onSurfaceVariant }]}>{hint}</Text> : null}
      {status === 'failed' ? (
        <Pressable accessibilityRole="button" onPress={onRetry}>
          <Text style={[styles.retry, { color: colors.primary }]}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { alignItems: 'center', gap: 8, padding: 24 },
  title: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  hint: { fontSize: 14, textAlign: 'center' },
  retry: { fontSize: 15, fontWeight: '600', paddingVertical: 8 }
});
