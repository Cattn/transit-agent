import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  formatCost,
  formatDuration,
  formatTimeRange,
  itineraryFreshness,
  legFreshness,
  legDirection,
  legLabel,
  legStopCount,
  legStopNames,
  riskBadge,
  scheduledModes,
  type Badge,
  type Itinerary,
  type Tone
} from '@transit/shared';
import type { AppColors } from '../../theme/colors';

type Leg = Itinerary['legs'][number];

export interface LegChip {
  id: string;
  mode: Leg['mode'];
  transit: boolean;
  label: string;
}

export interface LegDetail {
  id: string;
  label: string;
  times: string;
  freshness: Badge;
  direction?: string;
  stopCount?: string;
  stops?: string;
}

export interface ItineraryCardText {
  times: string;
  duration: string;
  chips: LegChip[];
  freshness: Badge;
  live: boolean;
  detail: string;
  cost: string;
  risk: Badge;
  details: LegDetail[];
}

export interface NearMissText {
  title: string;
  reason: string;
  mode: Leg['mode'];
  cost: string;
}

function freshnessDetail(it: Itinerary, now: Date): string {
  const freshness = itineraryFreshness(it, now);
  if (freshness.label === 'Outdated' || freshness.label === 'Updates unavailable') return 'last known times';
  const live = it.legs.find((leg) => leg.timeSource === 'realtime' && scheduledModes.includes(leg.mode));
  if (live) {
    const minutes = Math.round((Date.parse(live.departAt) - now.getTime()) / 60_000);
    const stop = live.from.name ? `at ${live.from.name} ` : '';
    return minutes > 0 ? `${stop}in ${minutes} min` : `${stop}now`;
  }
  return itineraryFreshness(it).label === 'Live' ? '' : it.legs.some((leg) => leg.timeSource === 'scheduled') ? 'timetable only' : '';
}

function cardFreshness(it: Itinerary, now: Date): Badge {
  const overall = itineraryFreshness(it, now);
  if (overall.label !== 'Live') return overall;
  const live = it.legs.find((leg) => leg.timeSource === 'realtime');
  return live ? legFreshness(live) : overall;
}

export function itineraryCardText(it: Itinerary, now: Date, timeZone?: string): ItineraryCardText {
  const freshness = cardFreshness(it, now);
  const outdated = freshness.label === 'Outdated' || freshness.label === 'Updates unavailable';
  return {
    times: formatTimeRange(it.departAt, it.arriveAt, timeZone),
    duration: formatDuration(it.durationMinutes),
    chips: it.legs.map((leg) => {
      const transit = scheduledModes.includes(leg.mode);
      return { id: leg.id, mode: leg.mode, transit, label: transit ? legLabel(leg) : String(Math.round(leg.durationMinutes)) };
    }),
    freshness,
    live: itineraryFreshness(it, now).label === 'Live',
    detail: freshnessDetail(it, now),
    cost: formatCost(it.cost),
    risk: riskBadge(it.risk),
    details: it.legs.map((leg) => {
      const detail: LegDetail = { id: leg.id, label: legLabel(leg), times: formatTimeRange(leg.departAt, leg.arriveAt, timeZone), freshness: outdated && leg.timeSource === 'realtime' ? { label: 'Outdated', tone: 'warn' } : legFreshness(leg) };
      const direction = legDirection(leg);
      const stopCount = legStopCount(leg);
      const stops = legStopNames(leg);
      if (direction) detail.direction = direction;
      if (stopCount) detail.stopCount = stopCount;
      if (stops) detail.stops = stops;
      return detail;
    })
  };
}

export function nearMissText(it: Itinerary, timeZone?: string): NearMissText {
  const main = it.legs.find((leg) => scheduledModes.includes(leg.mode)) ?? it.legs[0]!;
  return {
    title: `${it.summary} · ${formatTimeRange(it.departAt, it.arriveAt, timeZone)}`,
    reason: it.violations[0] ?? '',
    mode: main.mode,
    cost: formatCost(it.cost)
  };
}

export type ToneRole = 'secondary' | 'tertiary' | 'error';

export function toneRole(tone: Tone): ToneRole {
  if (tone === 'danger') return 'error';
  return tone === 'warn' ? 'tertiary' : 'secondary';
}

function toneColors(tone: Tone, colors: AppColors): { background: string; text: string } {
  const role = toneRole(tone);
  if (role === 'error') return { background: colors.errorContainer, text: colors.onErrorContainer };
  if (role === 'tertiary') return { background: colors.tertiaryContainer, text: colors.onTertiaryContainer };
  return { background: colors.secondaryContainer, text: colors.onSecondaryContainer };
}

const MODE_GLYPHS: Partial<Record<Leg['mode'], string>> = { walk: '🚶', bike: '🚲', bikeshare: '🚲', car: '🚗', bus: '🚌', rail: '🚆', ferry: '⛴', flight: '✈' };

export interface ItineraryCardProps {
  text: ItineraryCardText;
  selected: boolean;
  saved: boolean;
  canSave: boolean;
  colors: AppColors;
  onPress: () => void;
  onSave: () => void;
}

export function ItineraryCard({ text, selected, saved, canSave, colors, onPress, onSave }: ItineraryCardProps) {
  const risk = toneColors(text.risk.tone, colors);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${text.times}, ${text.duration}. ${text.freshness.label}. ${text.cost}. ${text.risk.label}.`}
      onPress={onPress}
      style={[styles.card, { backgroundColor: colors.surface, borderWidth: selected ? 2 : 1, borderColor: selected ? colors.primary : colors.outline }]}
    >
      <View style={styles.row}>
        <Text style={[styles.times, { color: colors.onSurface }]}>{text.times}</Text>
        <Text style={[styles.duration, { color: colors.onSurface }]}>{text.duration}</Text>
      </View>
      <View style={styles.legs}>
        {text.chips.map((chip, index) => (
          <View key={chip.id} style={styles.legWrap}>
            {index > 0 ? <Text style={[styles.chevron, { color: colors.onSurfaceVariant }]}>›</Text> : null}
            <View style={[styles.leg, chip.transit && { backgroundColor: colors.primaryContainer }]}>
              <Text style={[styles.legText, { color: chip.transit ? colors.onPrimaryContainer : colors.onSurfaceVariant }]}>
                {MODE_GLYPHS[chip.mode] ?? ''} {chip.label}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.row}>
        <View style={styles.freshness}>
          <Text numberOfLines={1} style={[styles.fresh, { color: text.live ? colors.primary : colors.onSurfaceVariant }]}>{text.freshness.label}</Text>
          {text.detail ? <Text numberOfLines={1} style={[styles.meta, { color: colors.onSurfaceVariant }]}>{text.detail}</Text> : null}
        </View>
        <View style={styles.end}>
          <Text style={[styles.cost, { color: colors.onSurface }]}>{text.cost}</Text>
          <View style={[styles.badge, { backgroundColor: risk.background }]}>
            <Text style={[styles.badgeText, { color: risk.text }]}>{text.risk.label}</Text>
          </View>
        </View>
      </View>
      {selected ? (
        <View style={[styles.details, { borderTopColor: colors.surfaceVariant }]}>
          {text.details.map((leg) => (
            <View key={leg.id} style={styles.detail}>
              <Text style={[styles.detailLabel, { color: colors.onSurface }]}>{leg.direction ? `${leg.label} ${leg.direction}` : leg.label}</Text>
              <Text style={[styles.detailMeta, { color: colors.onSurfaceVariant }]}>{leg.times} · {leg.freshness.label}</Text>
              {leg.stopCount ? <Text style={[styles.detailMeta, { color: colors.onSurface }]}>{leg.stopCount}</Text> : null}
              {leg.stops ? <Text style={[styles.detailMeta, { color: colors.onSurfaceVariant }]}>{leg.stops}</Text> : null}
            </View>
          ))}
          <Pressable accessibilityRole="button" disabled={!canSave || saved} onPress={onSave} style={styles.save}>
            <Text style={[styles.saveText, { color: canSave && !saved ? colors.primary : colors.outline }]}>{saved ? 'Saved' : 'Save'}</Text>
          </Pressable>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  times: { flex: 1, fontSize: 17, fontWeight: '700' },
  duration: { fontSize: 17, fontWeight: '700' },
  legs: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  legWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chevron: { fontSize: 14 },
  leg: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  legText: { fontSize: 13, fontWeight: '600' },
  freshness: { flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  fresh: { fontSize: 12, fontWeight: '500' },
  meta: { flexShrink: 1, fontSize: 11, fontWeight: '500' },
  end: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cost: { fontSize: 15, fontWeight: '700' },
  badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  details: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, gap: 6 },
  detail: { gap: 1 },
  detailLabel: { fontSize: 14, fontWeight: '600' },
  detailMeta: { fontSize: 12 },
  save: { alignSelf: 'flex-end', paddingVertical: 6, paddingHorizontal: 8 },
  saveText: { fontSize: 15, fontWeight: '600' }
});
