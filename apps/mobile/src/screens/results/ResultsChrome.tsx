import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ItineraryCard } from './ItineraryCard';
import type { ResultsChromeProps } from './ResultsScreen';

export function ResultsChrome(props: ResultsChromeProps) {
  const { colors } = props;
  const insets = useSafeAreaInsets();

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={props.onBack}>
          <Text style={[styles.link, { color: colors.primary }]}>Back</Text>
        </Pressable>
        <View style={styles.places}>
          <Text numberOfLines={1} style={{ color: colors.onSurface }}>{props.origin}</Text>
          <Text numberOfLines={1} style={{ color: colors.onSurface }}>{props.destination}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={props.onSwap}>
          <Text style={[styles.link, { color: colors.primary }]}>Swap</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 16 }]}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.onSurface }]}>{props.title}</Text>
        {props.subtitle ? <Text style={{ color: colors.onSurfaceVariant }}>{props.subtitle}</Text> : null}
        {props.warning ? <Text style={{ color: colors.onSurfaceVariant }}>{props.warning}</Text> : null}
        {props.saveError ? (
          <Pressable accessibilityRole="button" onPress={props.onRetrySave}>
            <Text style={{ color: colors.onSurface }}>{`${props.saveError} Tap to retry.`}</Text>
          </Pressable>
        ) : null}
        {props.message ? <Text style={{ color: colors.onSurfaceVariant }}>{props.message}</Text> : null}
        {props.cards.map((card) => (
          <ItineraryCard
            key={card.id}
            text={card.text}
            selected={card.selected}
            saved={card.saved}
            canSave={props.canSave}
            colors={colors}
            onPress={() => props.onSelect(card.id)}
            onSave={() => props.onSave(card.id)}
          />
        ))}
        {props.nearMisses.length ? <Text style={[styles.section, { color: colors.onSurfaceVariant }]}>Almost works</Text> : null}
        {props.nearMisses.map((miss) => (
          <View key={miss.id} style={styles.nearMiss}>
            <Text style={{ color: colors.onSurface }}>{miss.title}</Text>
            {miss.reason ? <Text style={{ color: colors.onErrorContainer }}>{miss.reason}</Text> : null}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16 },
  places: { flex: 1, gap: 4 },
  link: { fontSize: 16, fontWeight: '600' },
  list: { gap: 10, paddingHorizontal: 16 },
  title: { fontSize: 22 },
  section: { fontSize: 14, fontWeight: '600', paddingTop: 6 },
  nearMiss: { gap: 2, paddingVertical: 8 }
});
