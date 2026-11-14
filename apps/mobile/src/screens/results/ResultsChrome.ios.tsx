import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetScrollView, BottomSheetView } from '@gorhom/bottom-sheet';
import { ItineraryCard } from './ItineraryCard';
import type { ResultsChromeProps } from './ResultsScreen';

const SHEET_INSET = 8;
const COLLAPSED_SHARE = 0.58;
const MIN_TRAVEL = 120;
const TOP_GAP = 12;

function Glass({ dark, style, children }: { dark: boolean; style: StyleProp<ViewStyle>; children: ReactNode }) {
  return (
    <BlurView intensity={80} tint={dark ? 'systemChromeMaterialDark' : 'systemChromeMaterialLight'} style={[styles.glass, style]}>
      {children}
    </BlurView>
  );
}

export function ResultsChrome(props: ResultsChromeProps) {
  const { colors } = props;
  const dark = colors.scheme === 'dark';
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [containerHeight, setContainerHeight] = useState(windowHeight);
  const [topHeight, setTopHeight] = useState(150);

  const expanded = Math.round(containerHeight - (insets.top + 4 + topHeight + TOP_GAP + SHEET_INSET));
  const collapsed = Math.min(Math.round(containerHeight * COLLAPSED_SHARE), expanded - MIN_TRAVEL);
  const snapPoints = [collapsed, expanded];

  const settle = (index: number) => {
    if (index < 0) return;
    props.onSheetLayout((snapPoints[index] ?? collapsed) + SHEET_INSET);
  };

  return (
    <View pointerEvents="box-none" style={StyleSheet.absoluteFill} onLayout={(event) => setContainerHeight(event.nativeEvent.layout.height)}>
      <View pointerEvents="box-none" style={[styles.top, { top: insets.top + 4 }]} onLayout={(event) => setTopHeight(event.nativeEvent.layout.height)}>
        <View style={styles.headerRow}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={props.onBack}>
            <Glass dark={dark} style={styles.circle}>
              <Text style={[styles.icon, { color: colors.onSurface }]}>‹</Text>
            </Glass>
          </Pressable>
          <Glass dark={dark} style={styles.trip}>
            <View style={styles.places}>
              <Text numberOfLines={1} style={[styles.place, { color: colors.onSurface }]}>◦ {props.origin}</Text>
              <View style={[styles.divider, { backgroundColor: colors.outline }]} />
              <Text numberOfLines={1} style={[styles.place, { color: colors.onSurface }]}>📍 {props.destination}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Swap start and destination" hitSlop={8} onPress={props.onSwap}>
              <Text style={[styles.icon, { color: colors.primary }]}>⇅</Text>
            </Pressable>
          </Glass>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {props.chips.map((chip) => (
            <Pressable key={chip.key} accessibilityRole="button" onPress={props.onOpenFilters}>
              <Glass dark={dark} style={[styles.chip, chip.kind === 'agent' && { backgroundColor: colors.primaryContainer }]}>
                <Text style={[styles.chipText, { color: chip.kind === 'agent' ? colors.onPrimaryContainer : colors.onSurface }]}>
                  {chip.kind === 'agent' ? '✦ ' : ''}{chip.label}
                </Text>
              </Glass>
            </Pressable>
          ))}
          <Pressable accessibilityRole="button" onPress={props.onOpenFilters}>
            <Glass dark={dark} style={styles.chip}>
              <Text style={[styles.chipText, { color: colors.onSurface }]}>☷ Filters</Text>
            </Glass>
          </Pressable>
        </ScrollView>
      </View>

      <BottomSheet
        index={0}
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
          <View style={styles.header}>
            <View style={styles.headerText}>
              <Text accessibilityRole="header" style={[styles.title, { color: colors.onSurface }]}>{props.title}</Text>
              {props.subtitle ? <Text style={[styles.subtitle, { color: colors.onSurfaceVariant }]}>{props.subtitle}</Text> : null}
            </View>
            {props.updated ? <Text style={[styles.updated, { color: props.live ? colors.primary : colors.onSurfaceVariant }]}>{props.updated}</Text> : null}
          </View>
          {props.warning ? (
            <View style={[styles.warning, { backgroundColor: colors.surfaceVariant }]}>
              <Text style={[styles.warningText, { color: colors.onSurfaceVariant }]}>⚠ {props.warning}</Text>
            </View>
          ) : null}
          <BottomSheetScrollView style={styles.list} contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 16 }]}>
            {props.message ? <Text accessibilityLiveRegion="polite" style={[styles.message, { color: colors.onSurfaceVariant }]}>{props.message}</Text> : null}
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
            {props.nearMisses.length ? (
              <View style={styles.nearMisses}>
                <Text accessibilityRole="header" style={[styles.nearTitle, { color: colors.onSurface }]}>Almost works</Text>
                {props.nearMisses.map((miss) => (
                  <View key={miss.id} style={[styles.nearRow, { backgroundColor: colors.surfaceVariant }]}>
                    <Text style={[styles.nearText, { color: colors.onSurface }]}>{miss.title}</Text>
                    {miss.reason ? <Text style={[styles.nearReason, { color: colors.onErrorContainer }]}>{miss.reason}</Text> : null}
                  </View>
                ))}
              </View>
            ) : null}
          </BottomSheetScrollView>
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  glass: { overflow: 'hidden' },
  top: { position: 'absolute', left: 16, right: 16, gap: 10 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  circle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 22, fontWeight: '600' },
  trip: { flex: 1, borderRadius: 22, flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, gap: 10 },
  places: { flex: 1, gap: 6 },
  place: { fontSize: 16 },
  divider: { height: StyleSheet.hairlineWidth, opacity: 0.5 },
  chips: { gap: 8 },
  chip: { height: 34, borderRadius: 17, paddingHorizontal: 12, justifyContent: 'center' },
  chipText: { fontSize: 14, fontWeight: '600' },
  sheetFrame: { marginHorizontal: SHEET_INSET },
  sheetGlass: { borderRadius: 34 },
  sheet: { flex: 1, paddingHorizontal: 16, gap: 10 },
  grabber: { width: 36, height: 5, borderRadius: 3, opacity: 0.5 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  headerText: { flex: 1, gap: 2 },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 14 },
  updated: { fontSize: 12, fontWeight: '600', paddingTop: 6 },
  warning: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  warningText: { fontSize: 13 },
  list: { flex: 1 },
  listContent: { gap: 10 },
  message: { fontSize: 15, paddingVertical: 12, paddingHorizontal: 4 },
  nearMisses: { gap: 8, paddingTop: 6 },
  nearTitle: { fontSize: 15, fontWeight: '700' },
  nearRow: { borderRadius: 14, padding: 12, gap: 2, opacity: 0.7 },
  nearText: { fontSize: 14, fontWeight: '600' },
  nearReason: { fontSize: 12 }
});
