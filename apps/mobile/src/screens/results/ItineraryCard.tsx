import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  formatAge,
  formatCost,
  formatDuration,
  formatTimeRange,
  itineraryFreshness,
  legFreshness,
  legLabel,
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
}

export interface ItineraryCardText {
  times: string;
  duration: string;
  chips: LegChip[];
  freshness: Badge;
  live: boolean;
  updated: string;
  cost: string;
  risk: Badge;
  details: LegDetail[];
}

export interface NearMissText {
  title: string;
  reason: string;
}

function cardFreshness(it: Itinerary): Badge {
  const overall = itineraryFreshness(it);
  if (overall.label !== 'Live') return overall;
  const live = it.legs.find((leg) => leg.timeSource === 'realtime');
  return live ? legFreshness(live) : overall;
}

export function itineraryCardText(it: Itinerary, now: Date, timeZone?: string): ItineraryCardText {
  const freshness = cardFreshness(it);
  return {
    times: formatTimeRange(it.departAt, it.arriveAt, timeZone),
    duration: formatDuration(it.durationMinutes),
    chips: it.legs.map((leg) => {
      const transit = scheduledModes.includes(leg.mode);
      return { id: leg.id, mode: leg.mode, transit, label: transit ? legLabel(leg) : String(Math.round(leg.durationMinutes)) };
    }),
    freshness,
    live: itineraryFreshness(it).label === 'Live',
    updated: `updated ${formatAge(it.source.fetchedAt, now)}`,
    cost: formatCost(it.cost),
    risk: riskBadge(it.risk),
    details: it.legs.map((leg) => ({ id: leg.id, label: legLabel(leg), times: formatTimeRange(leg.departAt, leg.arriveAt, timeZone), freshness: legFreshness(leg) }))
  };
}

export function nearMissText(it: Itinerary, timeZone?: string): NearMissText {
  return { title: `${it.summary} · ${formatTimeRange(it.departAt, it.arriveAt, timeZone)}`, reason: it.violations[0] ?? '' };
}

export type ToneRole = 'primary' | 'secondary' | 'tertiary' | 'error' | 'neutral';

export function toneRole(tone: Tone): ToneRole {
  if (tone === 'ok') return 'primary';
  if (tone === 'info') return 'secondary';
  if (tone === 'warn') return 'tertiary';
  if (tone === 'danger') return 'error';
  return 'neutral';
}

function toneColors(tone: Tone, colors: AppColors): { background: string; text: string } {
  const role = toneRole(tone);
  if (role === 'primary') return { background: colors.primaryContainer, text: colors.onPrimaryContainer };
  if (role === 'secondary') return { background: colors.secondaryContainer, text: colors.onSecondaryContainer };
  if (role === 'tertiary') return { background: colors.tertiaryContainer, text: colors.onTertiaryContainer };
  if (role === 'error') return { background: colors.errorContainer, text: colors.onErrorContainer };
  return { background: colors.surfaceVariant, text: colors.onSurfaceVariant };
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
      style={[styles.card, { backgroundColor: colors.surface, borderColor: selected ? colors.primary : colors.surfaceVariant }]}
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
        <Text numberOfLines={1} style={[styles.meta, { color: text.live ? colors.primary : colors.onSurfaceVariant }]}>
          {text.freshness.label} · {text.updated}
        </Text>
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
              <Text style={[styles.detailLabel, { color: colors.onSurface }]}>{leg.label}</Text>
              <Text style={[styles.detailMeta, { color: colors.onSurfaceVariant }]}>{leg.times} · {leg.freshness.label}</Text>
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
  card: { borderRadius: 20, borderWidth: 1.5, padding: 14, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  times: { fontSize: 17, fontWeight: '700' },
  duration: { fontSize: 17, fontWeight: '700' },
  legs: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4 },
  legWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  chevron: { fontSize: 14 },
  leg: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  legText: { fontSize: 13, fontWeight: '600' },
  meta: { flexShrink: 1, fontSize: 12, fontWeight: '600' },
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
