import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { HomeChromeProps } from './HomeScreen';
import { MODE_OPTIONS } from './ModeSlider';
import { TrackedTripCard } from './TrackedTripCard';

export function HomeChrome(props: HomeChromeProps) {
  const { colors, group, trips, now, chips, locating, notice, status } = props;
  const insets = useSafeAreaInsets();

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View pointerEvents="box-none" style={[styles.top, { top: insets.top + 4 }]}>
        <View style={[styles.search, { backgroundColor: colors.surfaceVariant }]}>
          <Text accessibilityLabel="Menu (not available yet)" style={[styles.icon, { color: colors.onSurfaceVariant }]}>≡</Text>
          <Text style={[styles.searchText, { color: colors.onSurfaceVariant }]}>Where to?</Text>
          <Text style={[styles.icon, { color: colors.onSurfaceVariant }]}>⌕</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Settings" hitSlop={8} onPress={props.onOpenSettings} style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={[styles.avatarText, { color: colors.onPrimary }]}>👤</Text>
          </Pressable>
        </View>
        <View style={[styles.segments, { borderColor: colors.outline, backgroundColor: colors.surface }]}>
          {MODE_OPTIONS.map((option, index) => {
            const selected = option.group === group;
            return (
              <Pressable
                key={option.group}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => props.onGroupChange(option.group)}
                style={[
                  styles.segment,
                  index > 0 && { borderLeftWidth: 1, borderLeftColor: colors.outline },
                  selected && { backgroundColor: colors.secondaryContainer }
                ]}
              >
                <Text style={[styles.segmentText, { color: selected ? colors.onSecondaryContainer : colors.onSurface }]}>
                  {selected ? '✓' : option.glyph} {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View pointerEvents="box-none" style={[styles.actions, { bottom: props.sheetHeight + 16 }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Use my location"
          disabled={locating}
          onPress={props.onLocate}
          style={[styles.fab, { backgroundColor: colors.primaryContainer }]}
        >
          <Text style={[styles.fabIcon, { color: colors.onPrimaryContainer }]}>{locating ? '…' : '⌖'}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Ask agent"
          onPress={props.onAskAgent}
          style={[styles.extendedFab, { backgroundColor: colors.primaryContainer }]}
        >
          <Text style={[styles.extendedFabText, { color: colors.onPrimaryContainer }]}>✦ Ask agent</Text>
        </Pressable>
      </View>

      <View
        style={[styles.sheet, { backgroundColor: colors.surface, paddingBottom: insets.bottom + 12 }]}
        onLayout={(event) => props.onSheetLayout(event.nativeEvent.layout.height)}
      >
        <View style={[styles.handle, { backgroundColor: colors.outline }]} />
        <View style={styles.header}>
          <Text accessibilityRole="header" style={[styles.sheetTitle, { color: colors.onSurface }]}>Tracked trips</Text>
          <Text style={[styles.watching, { color: colors.onSurfaceVariant }]}>🔔 {props.watchingCount} watching</Text>
        </View>
        {notice ? <Text accessibilityLiveRegion="polite" style={[styles.notice, { color: colors.onSurface }]}>{notice}</Text> : null}
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
          {trips.length ? trips.map((trip) => <TrackedTripCard key={trip.id} trip={trip} now={now} colors={colors} />) : (
            <Text style={[styles.empty, { color: colors.onSurfaceVariant }]}>No tracked trips yet.</Text>
          )}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {chips.map((chip) => (
            <Pressable key={chip.key} accessibilityRole="button" onPress={chip.onPress} style={[styles.chip, { borderColor: colors.outline }]}>
              <Text style={[styles.chipText, { color: colors.onSurface }]}>📍 {chip.label}</Text>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" onPress={props.onOpenSettings} style={[styles.chip, { borderColor: colors.outline }]}>
            <Text style={[styles.chipText, { color: colors.onSurface }]}>⚙ Settings</Text>
          </Pressable>
        </ScrollView>
        <Text accessibilityLiveRegion="polite" style={[styles.status, { color: colors.onSurfaceVariant }]}>{status}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { position: 'absolute', left: 16, right: 16, gap: 10 },
  search: { height: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8, gap: 12, elevation: 3 },
  searchText: { flex: 1, fontSize: 16 },
  icon: { fontSize: 22 },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 15 },
  segments: { height: 48, borderRadius: 24, borderWidth: 1, flexDirection: 'row', overflow: 'hidden' },
  segment: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 14, fontWeight: '500' },
  actions: { position: 'absolute', right: 16, alignItems: 'flex-end', gap: 12 },
  fab: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', elevation: 3 },
  fabIcon: { fontSize: 24 },
  extendedFab: { height: 56, borderRadius: 16, paddingHorizontal: 20, justifyContent: 'center', elevation: 3 },
  extendedFabText: { fontSize: 16, fontWeight: '500' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 16, gap: 12, elevation: 8 },
  handle: { alignSelf: 'center', width: 32, height: 4, borderRadius: 2, marginTop: 16, opacity: 0.6 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 22 },
  watching: { fontSize: 12, fontWeight: '500' },
  notice: { fontSize: 14 },
  list: { maxHeight: 224 },
  listContent: { gap: 12 },
  empty: { fontSize: 15, paddingVertical: 12 },
  chips: { gap: 8 },
  chip: { height: 32, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, justifyContent: 'center' },
  chipText: { fontSize: 14, fontWeight: '500' },
  status: { fontSize: 12 }
});
