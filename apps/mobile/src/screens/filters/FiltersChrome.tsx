import { useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppColors } from '../../theme/appearance';
import type { AppColors } from '../../theme/colors';
import type { FilterFocus, FiltersChromeProps, LimitKey } from './FiltersScreen';
import { PlaceField } from './PlaceField';

function nudge(value: number, delta: number): number {
  return Math.min(1, Math.max(0, Math.round((value + delta) * 10) / 10));
}

function LimitRow({ item, colors, onLimit }: {
  item: FiltersChromeProps['limits'][number];
  colors: AppColors;
  onLimit: (key: LimitKey, value: number | null) => void;
}) {
  return (
    <View style={styles.limit}>
      <Text style={[styles.body, { color: colors.onSurface }]}>{item.title}</Text>
      <Text style={{ color: colors.primary }}>{item.label}</Text>
      {item.agent ? <Text style={{ color: colors.primary }}>Agent</Text> : null}
      <View style={styles.row}>
        {item.options.map((option) => (
          <Pressable key={option.label} accessibilityRole="button" accessibilityState={{ selected: option.selected }} onPress={() => onLimit(item.key, option.value)} style={[styles.choice, { backgroundColor: option.selected ? colors.primaryContainer : colors.surfaceVariant }]}>
            <Text style={{ color: option.selected ? colors.onPrimaryContainer : colors.onSurface }}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function FiltersChrome(props: FiltersChromeProps) {
  const colors = useAppColors();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ScrollViewInstance>(null);
  const scrolled = useRef(false);
  const placeColors = {
    surface: colors.surface,
    onSurface: colors.onSurface,
    onSurfaceVariant: colors.onSurfaceVariant,
    primary: colors.primary,
    outline: colors.outline
  };

  const remember = (key: FilterFocus, y: number) => {
    if (scrolled.current || props.focus !== key) return;
    scrolled.current = true;
    requestAnimationFrame(() => scroll.current?.scrollTo({ y, animated: false }));
  };

  return (
    <View style={[styles.fill, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={props.onClose}>
          <Text style={[styles.action, { color: colors.primary }]}>Close</Text>
        </Pressable>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.onSurface }]}>Trip filters</Text>
        <Pressable accessibilityRole="button" onPress={props.onReset}>
          <Text style={[styles.action, { color: colors.primary }]}>Reset</Text>
        </Pressable>
      </View>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" style={styles.list} contentContainerStyle={styles.content}>
        <View onLayout={(event) => remember('where', event.nativeEvent.layout.y)} style={styles.section}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.onSurface }]}>Where & when</Text>
          <Pressable accessibilityRole="button" onPress={() => props.onSearch('origin')} style={styles.field}>
            <Text style={{ color: colors.onSurfaceVariant }}>From</Text>
            <Text style={{ color: colors.onSurface }}>{props.origin.label}</Text>
            {props.origin.agent ? <Text style={{ color: colors.primary }}>Agent</Text> : null}
          </Pressable>
          {props.search?.which === 'origin' ? (
            <PlaceField near={props.search.near} showLocation locating={props.search.locating} notice={props.search.notice} colors={placeColors} onPick={props.search.onPick} onUseLocation={props.search.onUseLocation} />
          ) : null}
          <Pressable accessibilityRole="button" onPress={() => props.onSearch('destination')} style={styles.field}>
            <Text style={{ color: colors.onSurfaceVariant }}>To</Text>
            <Text style={{ color: colors.onSurface }}>{props.destination.label}</Text>
            {props.destination.agent ? <Text style={{ color: colors.primary }}>Agent</Text> : null}
          </Pressable>
          {props.search?.which === 'destination' ? (
            <PlaceField near={props.search.near} showLocation={false} locating={props.search.locating} notice={props.search.notice} colors={placeColors} onPick={props.search.onPick} onUseLocation={props.search.onUseLocation} />
          ) : null}
          <View style={styles.row}>
            {props.timeOptions.map((option) => (
              <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: option.selected }} onPress={() => props.onTimeType(option.value)} style={[styles.choice, { backgroundColor: option.selected ? colors.primaryContainer : colors.surfaceVariant }]}>
                <Text style={{ color: option.selected ? colors.onPrimaryContainer : colors.onSurface }}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable accessibilityRole="button" disabled={props.time.set} onPress={() => props.onSetTime(new Date())} style={styles.field}>
            <Text style={{ color: colors.onSurface }}>{props.time.label}</Text>
            {props.time.agent ? <Text style={{ color: colors.primary }}>Agent</Text> : null}
          </Pressable>
        </View>

        <View onLayout={(event) => remember('modes', event.nativeEvent.layout.y)} style={styles.section}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.onSurface }]}>Modes</Text>
          {props.modesAgent ? <Text style={{ color: colors.primary }}>Agent</Text> : null}
          <View style={styles.row}>
            {props.modes.map((mode) => (
              <Pressable key={mode.mode} accessibilityRole="button" accessibilityState={{ selected: mode.selected }} onPress={() => props.onToggleMode(mode.mode)} style={[styles.choice, { backgroundColor: mode.selected ? colors.primaryContainer : colors.surfaceVariant }]}>
                <Text style={{ color: mode.selected ? colors.onPrimaryContainer : colors.onSurface }}>{mode.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View onLayout={(event) => remember('strict', event.nativeEvent.layout.y)} style={styles.section}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.onSurface }]}>How strict is the arrival time?</Text>
          {props.lateAgent ? <Text style={{ color: colors.primary }}>Agent</Text> : null}
          <View style={styles.row}>
            {props.lateOptions.map((option) => (
              <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: option.selected }} onPress={() => props.onLateTolerance(option.value)} style={[styles.choice, { backgroundColor: option.selected ? colors.primaryContainer : colors.surfaceVariant }]}>
                <Text style={{ color: option.selected ? colors.onPrimaryContainer : colors.onSurface }}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View onLayout={(event) => remember('prefs', event.nativeEvent.layout.y)} style={styles.section}>
          <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.onSurface }]}>Preferences (rank, never exclude)</Text>
          {props.preferences.map((row) => (
            <View key={row.key} style={styles.field}>
              <Text style={{ color: colors.onSurface }}>{row.start} ↔ {row.end}</Text>
              {row.agent ? <Text style={{ color: colors.primary }}>Agent</Text> : null}
              <View style={styles.row}>
                <Pressable accessibilityRole="button" onPress={() => props.onPreference(row.key, nudge(row.value, -0.1))}><Text style={[styles.action, { color: colors.primary }]}>−</Text></Pressable>
                <Text style={{ color: colors.onSurface }}>{Math.round(row.value * 100)}</Text>
                <Pressable accessibilityRole="button" onPress={() => props.onPreference(row.key, nudge(row.value, 0.1))}><Text style={[styles.action, { color: colors.primary }]}>+</Text></Pressable>
              </View>
            </View>
          ))}
        </View>

        <View onLayout={(event) => remember('limits', event.nativeEvent.layout.y)} style={styles.section}>
          <Pressable accessibilityRole="button" onPress={props.onToggleLimits}>
            <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.onSurface }]}>Advanced limits {props.limitsOpen ? '▾' : '▸'}</Text>
          </Pressable>
          {props.limitsOpen ? (
            <View>
              {props.limits.map((item) => <LimitRow key={item.key} item={item} colors={colors} onLimit={props.onLimit} />)}
              <View style={styles.limit}>
                <Text style={[styles.body, { color: colors.onSurface }]}>Step-free access</Text>
                <Text style={{ color: colors.onSurfaceVariant }}>{props.stepFree.on ? 'On' : 'Off'}</Text>
                {props.stepFree.agent ? <Text style={{ color: colors.primary }}>Agent</Text> : null}
                <Pressable accessibilityRole="button" onPress={() => props.onStepFree(!props.stepFree.on)}>
                  <Text style={[styles.action, { color: colors.primary }]}>{props.stepFree.on ? 'Turn off' : 'Turn on'}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12, borderTopColor: colors.outline }]}>
        {props.counts ? (
          <View>
            <Text style={{ color: colors.onSurfaceVariant }}>{props.counts.routes}</Text>
            <Text style={{ color: colors.onSurfaceVariant }}>{props.counts.almost}</Text>
          </View>
        ) : null}
        <Pressable accessibilityRole="button" onPress={props.onShowRoutes} style={[styles.show, { backgroundColor: colors.primary }]}>
          <Text style={[styles.action, { color: colors.onPrimary }]}>Show routes</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 24, elevation: 24 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  title: { fontSize: 20, fontWeight: '700' },
  action: { fontSize: 16, fontWeight: '600' },
  list: { flex: 1 },
  content: { paddingBottom: 16 },
  section: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  sectionTitle: { fontSize: 18, fontWeight: '700' },
  field: { gap: 2, paddingVertical: 4 },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  choice: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  body: { fontSize: 16 },
  limit: { gap: 4, paddingVertical: 8 },
  footer: { gap: 8, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  show: { borderRadius: 24, alignItems: 'center', paddingVertical: 12 }
});
