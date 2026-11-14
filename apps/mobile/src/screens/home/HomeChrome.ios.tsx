import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import type { HomeChromeProps } from './HomeScreen';
import { MODE_OPTIONS } from './ModeSlider';
import { TrackedTripCard } from './TrackedTripCard';

const SHEET_INSET = 8;
const HANDLE_HEIGHT = 24;
const LIST_CAP = 212;
const MIN_TRAVEL = 120;
const TOP_GAP = 12;

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
  const { height: windowHeight } = useWindowDimensions();
  const [containerHeight, setContainerHeight] = useState(windowHeight);
  const [headerHeight, setHeaderHeight] = useState(40);
  const [footerHeight, setFooterHeight] = useState(64);
  const [listHeight, setListHeight] = useState(LIST_CAP);
  const [sheetIndex, setSheetIndex] = useState(1);
  const [topHeight, setTopHeight] = useState(106);

  const expanded = Math.round(containerHeight - (insets.top + 4 + topHeight + TOP_GAP + SHEET_INSET));
  const natural = Math.round(HANDLE_HEIGHT + headerHeight + Math.min(listHeight, LIST_CAP) + footerHeight + 24);
  const collapsed = Math.min(natural, expanded - MIN_TRAVEL);
  const peek = Math.round(HANDLE_HEIGHT + headerHeight + 12);
  const snapPoints = [peek, collapsed, expanded];
  const visible = snapPoints[sheetIndex] ?? collapsed;

  const settle = (index: number) => {
    if (index < 0) return;
    setSheetIndex(index);
    props.onSheetLayout((snapPoints[index] ?? collapsed) + SHEET_INSET);
  };

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill} onLayout={(event) => setContainerHeight(event.nativeEvent.layout.height)}>
      <View
        pointerEvents="box-none"
        style={[styles.top, { top: insets.top + 4 }]}
        onLayout={(event) => setTopHeight(event.nativeEvent.layout.height)}
      >
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

      {sheetIndex !== 2 ? <View pointerEvents="box-none" style={[styles.actions, { bottom: visible + SHEET_INSET + 14 }]}>
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
      </View> : null}

      <BottomSheet
        index={1}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose={false}
        detached
        bottomInset={SHEET_INSET}
        style={styles.sheetFrame}
        onChange={settle}
        onAnimate={(_from, to) => settle(to)}
        backgroundComponent={({ style }) => <Glass dark={dark} style={[style, styles.sheetGlass]}>{null}</Glass>}
        handleIndicatorStyle={[styles.grabber, { backgroundColor: colors.outline }]}
      >
        <BottomSheetView style={styles.sheet}>
          <View onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)} style={styles.headerBlock}>
            <View style={styles.header}>
              <Text accessibilityRole="header" style={[styles.sheetTitle, { color: colors.onSurface }]}>Tracked Trips</Text>
              <Text style={[styles.watching, { color: colors.onSurfaceVariant }]}>🔔 {props.watchingCount} watching</Text>
            </View>
            {notice ? <Text accessibilityLiveRegion="polite" style={[styles.notice, { color: colors.onSurface }]}>{notice}</Text> : null}
          </View>
          <BottomSheetScrollView style={styles.list} contentContainerStyle={styles.listContent} onContentSizeChange={(_, height) => setListHeight(height)}>
            {trips.length ? trips.map((trip) => <TrackedTripCard key={trip.id} trip={trip} now={now} colors={colors} />) : (
              <Text style={[styles.empty, { color: colors.onSurfaceVariant }]}>No tracked trips yet.</Text>
            )}
          </BottomSheetScrollView>
          <View onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)} style={styles.footer}>
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
          {status ? <Text accessibilityLiveRegion="polite" style={[styles.status, { color: colors.onSurfaceVariant }]}>{status}</Text> : null}
          </View>
        </BottomSheetView>
      </BottomSheet>
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
  sheetFrame: { marginHorizontal: SHEET_INSET },
  sheetGlass: { borderRadius: 34 },
  sheet: { flex: 1, paddingHorizontal: 16, paddingBottom: 16 },
  grabber: { width: 36, height: 5, borderRadius: 3, opacity: 0.5 },
  headerBlock: { gap: 6, paddingBottom: 10 },
  footer: { gap: 8, paddingTop: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  sheetTitle: { fontSize: 20, fontWeight: '700' },
  watching: { fontSize: 13 },
  notice: { fontSize: 14, paddingHorizontal: 4 },
  list: { flex: 1 },
  listContent: { gap: 10 },
  empty: { fontSize: 15, paddingVertical: 12, paddingHorizontal: 4 },
  chips: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chip: { height: 34, borderRadius: 17, paddingHorizontal: 12, justifyContent: 'center' },
  chipText: { fontSize: 15, fontWeight: '600' },
  spacer: { flex: 1 },
  status: { fontSize: 12, paddingHorizontal: 4 }
});
