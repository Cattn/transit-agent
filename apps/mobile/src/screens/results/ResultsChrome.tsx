import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
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
        {props.onSwap ? (
          <Pressable accessibilityRole="button" onPress={props.onSwap}>
            <Text style={[styles.link, { color: colors.primary }]}>Swap</Text>
          </Pressable>
        ) : null}
      </View>
      <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 16 }]}>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.onSurface }]}>{props.title}</Text>
        {props.subtitle ? <Text style={{ color: colors.onSurfaceVariant }}>{props.subtitle}</Text> : null}
        {props.warning ? <Text style={{ color: colors.onSurfaceVariant }}>{props.warning}</Text> : null}
        {props.savedTrip ? (
          <View style={styles.savedRow}>
            <Text style={[styles.savedLabel, { color: colors.onSurface }]}>Watch this trip</Text>
            <Switch accessibilityLabel="Watch this trip" value={props.savedTrip.watch} onValueChange={props.savedTrip.onToggleWatch} />
            <Pressable
              accessibilityRole="button"
              onPress={() => Alert.alert('Delete this trip?', 'It will be removed from your saved trips and will no longer be watched.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => props.savedTrip?.onDelete() }
              ])}
            >
              <Text style={[styles.link, { color: colors.primary }]}>Delete</Text>
            </Pressable>
          </View>
        ) : null}
        {props.savedTrip?.status ? <Text style={{ color: colors.onSurface }}>{props.savedTrip.status}</Text> : null}
        {props.savedTrip?.change ? (
          <View>
            <Text style={{ color: colors.onSurface }}>{props.savedTrip.change}</Text>
            <Pressable accessibilityRole="button" onPress={props.savedTrip.onDismissChange}><Text style={[styles.link, { color: colors.primary }]}>Dismiss change</Text></Pressable>
          </View>
        ) : null}
        {props.savedTrip?.boardingLabel ? (
          <View>
            <Text style={{ color: colors.onSurface }}>{props.savedTrip.boardingLabel}</Text>
            <Pressable accessibilityRole="button" onPress={props.savedTrip.onBoard}><Text style={[styles.link, { color: colors.primary }]}>I'm on board</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={props.savedTrip.onMissed}><Text style={[styles.link, { color: colors.primary }]}>Find next route</Text></Pressable>
          </View>
        ) : null}
        {props.savedTrip?.watch && props.savedTrip.onToggleLocation ? (
          <View>
            <Text style={{ color: colors.onSurface }}>Share location for this trip while Home is open</Text>
            <Switch accessibilityLabel="Share location for this trip" value={props.savedTrip.sharingLocation ?? false} onValueChange={props.savedTrip.onToggleLocation} />
          </View>
        ) : null}
        {props.savedTrip?.error ? (
          <Pressable accessibilityRole="button" onPress={props.savedTrip.onRetry}>
            <Text style={{ color: colors.onSurface }}>{`${props.savedTrip.error} Tap to retry.`}</Text>
          </Pressable>
        ) : null}
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
        {props.returns ? <Text style={[styles.section, { color: colors.onSurfaceVariant }]}>Return</Text> : null}
        {props.returns?.message ? <Text style={{ color: colors.onSurfaceVariant }}>{props.returns.message}</Text> : null}
        {props.returns?.warning ? <Text style={{ color: colors.onSurface }}>{props.returns.warning}</Text> : null}
        {props.returns?.cards.map((card) => (
          <View key={card.id}>
            {card.wait ? <Text style={{ color: colors.onSurfaceVariant }}>{card.wait.label}</Text> : null}
            <ItineraryCard
              text={card.text}
              selected={card.selected}
              saved={card.saved}
              canSave={props.canSave}
              colors={colors}
              onPress={() => props.onSelect(card.id)}
              onSave={() => props.onSave(card.id)}
            />
          </View>
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
  nearMiss: { gap: 2, paddingVertical: 8 },
  savedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  savedLabel: { flex: 1, fontSize: 16 }
});
