import { Platform, StyleSheet, Text, View } from 'react-native';
import { formatClock, itineraryFreshness, leaveByLabel, legLabel, scheduledModes, type SavedItinerary } from '@transit/shared';
import type { AppColors } from '../../theme/colors';

type Tile = { top: string; value: string; bottom: string } | { label: string };

function tileText(leaveBy: string | undefined, departAt: string, timeZone: string | undefined, now: Date): Tile {
  if (!leaveBy) return { top: 'Departs', value: formatClock(departAt, timeZone), bottom: '' };
  const label = leaveByLabel(leaveBy, now);
  const minutes = /^Leave in (\d+) min$/.exec(label);
  return minutes ? { top: 'Leave in', value: minutes[1]!, bottom: 'min' } : { label };
}

function tileColors(state: string | undefined, colors: AppColors): { background: string; text: string } {
  if (state === 'onTrack') return { background: colors.secondaryContainer, text: colors.onSecondaryContainer };
  if (state === 'leaveSoon') return { background: colors.tertiaryContainer, text: colors.onTertiaryContainer };
  if (state === 'leaveNow' || state === 'atRisk') return { background: colors.errorContainer, text: colors.onErrorContainer };
  return { background: colors.surfaceVariant, text: colors.onSurfaceVariant };
}

export function TrackedTripCard({ trip, now, colors }: { trip: SavedItinerary; now: Date; colors: AppColors }) {
  const timeZone = trip.request.timeZone;
  const status = trip.watchStatus;
  const anchor = trip.legs.find((leg) => scheduledModes.includes(leg.mode)) ?? trip.legs[0]!;
  const freshness = itineraryFreshness(trip);
  const live = freshness.label === 'Live';
  const tile = tileText(status?.leaveBy ?? trip.leaveBy, anchor.departAt, timeZone, now);
  const tint = tileColors(status?.state, colors);
  const message = status?.message ?? `${legLabel(anchor)} departs ${formatClock(anchor.departAt, timeZone)}`;

  return (
    <View
      accessible
      accessibilityLabel={`${trip.label ?? trip.summary}. ${message}. ${freshness.label}.`}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.surfaceVariant }]}
    >
      <View style={[styles.tile, { backgroundColor: tint.background }]}>
        {'label' in tile ? (
          <Text style={[styles.tileLabel, { color: tint.text }]}>{tile.label}</Text>
        ) : (
          <>
            <Text style={[styles.tileTop, { color: tint.text }]}>{tile.top}</Text>
            <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.tileValue, { color: tint.text }]}>{tile.value}</Text>
            {tile.bottom ? <Text style={[styles.tileTop, { color: tint.text }]}>{tile.bottom}</Text> : null}
          </>
        )}
      </View>
      <View style={styles.body}>
        <Text numberOfLines={1} style={[styles.title, { color: colors.onSurface }]}>{trip.label ?? trip.summary}</Text>
        <Text numberOfLines={2} style={[styles.message, { color: colors.onSurfaceVariant }]}>{message}</Text>
        <View style={styles.meta}>
          <View style={[styles.pill, { backgroundColor: live ? 'transparent' : colors.surfaceVariant }]}>
            <Text style={[styles.pillText, { color: live ? colors.live : colors.onSurfaceVariant }]}>{freshness.label}</Text>
          </View>
          <Text numberOfLines={1} style={[styles.metaText, { color: colors.onSurfaceVariant }]}>
            {legLabel(anchor)} · arrive {formatClock(trip.arriveAt, timeZone)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: 14, padding: 12, borderRadius: Platform.OS === 'ios' ? 20 : 16, borderWidth: StyleSheet.hairlineWidth },
  tile: { width: 72, minHeight: 72, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 4 },
  tileTop: { fontSize: 12, fontWeight: '600' },
  tileValue: { fontSize: 28, fontWeight: '700' },
  tileLabel: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  body: { flex: 1, gap: 4, justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '600' },
  message: { fontSize: 14 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  pillText: { fontSize: 12, fontWeight: '600' },
  metaText: { flexShrink: 1, fontSize: 12 }
});
