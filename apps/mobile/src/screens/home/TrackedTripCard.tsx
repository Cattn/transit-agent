import { StyleSheet, Text, View } from 'react-native';
import { formatClock, itineraryFreshness, leaveByLabel, legLabel, scheduledModes, type Badge, type SavedItinerary } from '@transit/shared';
import type { AppColors } from '../../theme/colors';

export type CardTile = { top: string; value: string; bottom: string } | { label: string };

export interface TripCardText {
  title: string;
  message: string;
  meta: string;
  freshness: Badge;
  live: boolean;
  tile: CardTile;
  state: string | undefined;
}

function leavesInTile(leaveAt: string, now: Date): CardTile {
  const minutes = Math.floor((Date.parse(leaveAt) - now.getTime()) / 60_000);
  if (minutes <= 0) return { label: leaveByLabel(leaveAt, now) };
  if (minutes < 100) return { top: 'Leaves in', value: String(minutes), bottom: minutes === 1 ? 'minute' : 'minutes' };
  const hours = Math.floor(minutes / 60);
  return { top: 'Leaves in', value: String(hours), bottom: hours === 1 ? 'hour' : 'hours' };
}

export function tripCardText(trip: SavedItinerary, now: Date): TripCardText {
  const timeZone = trip.request.timeZone;
  const status = trip.watchStatus;
  const anchor = trip.legs.find((leg) => scheduledModes.includes(leg.mode)) ?? trip.legs[0]!;
  const freshness = itineraryFreshness(trip);
  return {
    title: trip.label ?? trip.summary,
    message: status?.message ?? `${legLabel(anchor)} departs ${formatClock(anchor.departAt, timeZone)}`,
    meta: `${legLabel(anchor)} · arrive ${formatClock(trip.arriveAt, timeZone)}`,
    freshness,
    live: freshness.label === 'Live',
    tile: leavesInTile(status?.leaveBy ?? trip.leaveBy ?? trip.departAt, now),
    state: status?.state
  };
}

export function tileRole(state: string | undefined): 'secondary' | 'tertiary' | 'error' | 'primary' {
  if (state === 'onTrack') return 'secondary';
  if (state === 'leaveSoon') return 'tertiary';
  if (state === 'leaveNow' || state === 'atRisk') return 'error';
  return 'primary';
}

function tileColors(state: string | undefined, colors: AppColors): { background: string; text: string } {
  const role = tileRole(state);
  if (role === 'secondary') return { background: colors.secondaryContainer, text: colors.onSecondaryContainer };
  if (role === 'tertiary') return { background: colors.tertiaryContainer, text: colors.onTertiaryContainer };
  if (role === 'error') return { background: colors.errorContainer, text: colors.onErrorContainer };
  return { background: colors.primaryContainer, text: colors.onPrimaryContainer };
}

export function TrackedTripCard({ trip, now, colors }: { trip: SavedItinerary; now: Date; colors: AppColors }) {
  const text = tripCardText(trip, now);
  const tint = tileColors(text.state, colors);

  return (
    <View
      accessible
      accessibilityLabel={`${text.title}. ${text.message}. ${text.freshness.label}.`}
      style={[styles.card, { backgroundColor: colors.surface }]}
    >
      <View style={[styles.tile, { backgroundColor: tint.background }]}>
        {'label' in text.tile ? (
          <Text style={[styles.tileLabel, { color: tint.text }]}>{text.tile.label}</Text>
        ) : (
          <>
            <Text style={[styles.tileTop, { color: tint.text }]}>{text.tile.top}</Text>
            <Text adjustsFontSizeToFit numberOfLines={1} style={[styles.tileValue, { color: tint.text }]}>{text.tile.value}</Text>
            <Text style={[styles.tileTop, { color: tint.text }]}>{text.tile.bottom}</Text>
          </>
        )}
      </View>
      <View style={styles.body}>
        <Text numberOfLines={1} style={[styles.title, { color: colors.onSurface }]}>{text.title}</Text>
        <Text numberOfLines={2} style={[styles.message, { color: colors.onSurfaceVariant }]}>{text.message}</Text>
        <View style={styles.meta}>
          <View style={[styles.pill, { backgroundColor: text.live ? colors.primaryContainer : colors.surfaceVariant }]}>
            <Text style={[styles.pillText, { color: text.live ? colors.onPrimaryContainer : colors.onSurfaceVariant }]}>{text.freshness.label}</Text>
          </View>
          <Text numberOfLines={1} style={[styles.metaText, { color: colors.onSurfaceVariant }]}>{text.meta}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    gap: 14,
    padding: 12,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }
  },
  tile: { width: 76, minHeight: 76, borderRadius: 16, alignItems: 'center', justifyContent: 'center', paddingVertical: 6, paddingHorizontal: 4 },
  tileTop: { fontSize: 12, fontWeight: '600' },
  tileValue: { fontSize: 28, fontWeight: '700' },
  tileLabel: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  body: { flex: 1, gap: 4, justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '600' },
  message: { fontSize: 14 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  pillText: { fontSize: 12, fontWeight: '700' },
  metaText: { flexShrink: 1, fontSize: 12 }
});
