import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { HomeChromeProps } from './HomeScreen';
import { MODE_OPTIONS } from './ModeSlider';
import { TrackedTripCard } from './TrackedTripCard';

const SHEET_INSET = 8;

function Glass({ dark, style, children }: { dark: boolean; style: StyleProp<ViewStyle>; children: ReactNode }) {
  return (
    <BlurView intensity={80} tint={dark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'} style={[styles.glass, style]}>
      {children}
    </BlurView>
  );
}

export function HomeChrome(props: HomeChromeProps) {
  const { colors, group, trips, now, chips, locating, notice, status } = props;
  const insets = useSafeAreaInsets();
  const dark = colors.scheme === 'dark';

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill}>
      <View pointerEvents="box-none" style={[styles.top, { top: insets.top + 4 }]}>
        <Glass dark={dark} style={styles.search}>
          <Text style={[styles.icon, { color: colors.onSurfaceVariant }]}>⌕</Text>
          <Text style={[styles.searchText, { color: colors.onSurfaceVariant }]}>Where to?</Text>
          <Text accessibilityLabel="Voice search (not available yet)" style={[styles.icon, { color: colors.onSurfaceVariant }]}>🎙</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Settings" hitSlop={8} onPress={props.onOpenSettings} style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={[styles.avatarText, { color: colors.onPrimary }]}>👤</Text>
          </Pressable>
        </Glass>
        <Glass dark={dark} style={styles.segments}>
          {MODE_OPTIONS.map((option) => {
            const selected = option.group === group;
            return (
              <Pressable
                key={option.group}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => props.onGroupChange(option.group)}
                style={[styles.segment, selected && { backgroundColor: colors.surface }]}
              >
                <Text style={[styles.segmentText, { color: selected ? colors.primary : colors.onSurface }]}>
                  {option.glyph} {option.label}
                </Text>
              </Pressable>
            );
          })}
        </Glass>
      </View>

      <View pointerEvents="box-none" style={[styles.actions, { bottom: props.sheetHeight + 14 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Ask agent" onPress={props.onAskAgent} style={[styles.askAgent, { backgroundColor: colors.primary }]}>
          <Text style={[styles.askAgentText, { color: colors.onPrimary }]}>✦ Ask agent</Text>
        </Pressable>
        <View style={styles.mapButtons}>
          <Pressable accessibilityRole="button" accessibilityLabel="Use my location" disabled={locating} onPress={props.onLocate}>
            <Glass dark={dark} style={styles.circle}>
              <Text style={[styles.icon, { color: colors.onSurface }]}>{locating ? '…' : '➤'}</Text>
            </Glass>
          </Pressable>
          <View accessibilityLabel="Map layers (not available yet)">
            <Glass dark={dark} style={styles.circle}>
              <Text style={[styles.icon, { color: colors.onSurfaceVariant }]}>◫</Text>
            </Glass>
          </View>
        </View>
      </View>

      <View
        style={[styles.sheetWrap, { bottom: SHEET_INSET }]}
        onLayout={(event) => props.onSheetLayout(event.nativeEvent.layout.height + SHEET_INSET)}
      >
        <Glass dark={dark} style={styles.sheet}>
          <View style={[styles.grabber, { backgroundColor: colors.outline }]} />
          <View style={styles.header}>
            <Text accessibilityRole="header" style={[styles.sheetTitle, { color: colors.onSurface }]}>Tracked Trips</Text>
            <Text style={[styles.watching, { color: colors.onSurfaceVariant }]}>🔔 {props.watchingCount} watching</Text>
          </View>
          {notice ? <Text accessibilityLiveRegion="polite" style={[styles.notice, { color: colors.onSurface }]}>{notice}</Text> : null}
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {trips.length ? trips.map((trip) => <TrackedTripCard key={trip.id} trip={trip} now={now} colors={colors} />) : (
              <Text style={[styles.empty, { color: colors.onSurfaceVariant }]}>No tracked trips yet.</Text>
            )}
          </ScrollView>
          <View style={styles.chips}>
            {chips.map((chip) => (
              <Pressable key={chip.key} accessibilityRole="button" onPress={chip.onPress} style={[styles.chip, { backgroundColor: colors.surfaceVariant }]}>
                <Text style={[styles.chipText, { color: colors.onSurface }]}>📍 {chip.label}</Text>
              </Pressable>
            ))}
            <View style={styles.spacer} />
            <Pressable accessibilityRole="button" accessibilityLabel="Filters" onPress={props.onOpenFilters} style={[styles.chip, { backgroundColor: colors.surfaceVariant }]}>
              <Text style={[styles.chipText, { color: colors.onSurface }]}>☷</Text>
            </Pressable>
          </View>
          <Text accessibilityLiveRegion="polite" style={[styles.status, { color: colors.onSurfaceVariant }]}>{status}</Text>
        </Glass>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  glass: { overflow: 'hidden' },
  top: { position: 'absolute', left: 16, right: 16, gap: 10 },
  search: { height: 51, borderRadius: 26, flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8, gap: 10 },
  searchText: { flex: 1, fontSize: 17 },
  icon: { fontSize: 18 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16 },
  segments: { height: 45, borderRadius: 23, flexDirection: 'row', padding: 4 },
  segment: { flex: 1, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  segmentText: { fontSize: 15, fontWeight: '600' },
  actions: { position: 'absolute', right: 16, flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  askAgent: { height: 48, borderRadius: 24, paddingHorizontal: 18, justifyContent: 'center' },
  askAgentText: { fontSize: 17, fontWeight: '600' },
  mapButtons: { gap: 10 },
  circle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  sheetWrap: { position: 'absolute', left: SHEET_INSET, right: SHEET_INSET },
  sheet: { borderRadius: 34, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 26, gap: 10 },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3, opacity: 0.5 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  sheetTitle: { fontSize: 20, fontWeight: '700' },
  watching: { fontSize: 13 },
  notice: { fontSize: 14, paddingHorizontal: 4 },
  list: { maxHeight: 212 },
  listContent: { gap: 10 },
  empty: { fontSize: 15, paddingVertical: 12, paddingHorizontal: 4 },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: { height: 34, borderRadius: 17, paddingHorizontal: 12, justifyContent: 'center' },
  chipText: { fontSize: 15, fontWeight: '600' },
  spacer: { flex: 1 },
  status: { fontSize: 12, paddingHorizontal: 4 }
});
