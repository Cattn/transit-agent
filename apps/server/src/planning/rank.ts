import type { Itinerary, TripPreferences } from '@transit/shared';

/** All ranking weights in one place so they can be tuned against real data (plan 007). */
export const rankingWeights = {
  /** Per USD, scaled by (1 - comfortVsCost). */
  cost: 1.5,
  /** Per transfer, scaled by (transferBase + comfortVsCost). */
  transfer: 6,
  transferBase: 0.5,
  /** Per walking minute, scaled by (1 - activeTravel). */
  walk: 0.5,
  /** Risk penalty, scaled by (1 - transferRisk). */
  risk: { low: 0, medium: 8, high: 20 }
} as const;

/** Lower is better. Preferences only reorder options; they never exclude one. */
export function scoreItinerary(it: Itinerary, prefs: TripPreferences): number {
  const w = rankingWeights;
  return (
    it.durationMinutes +
    (1 - prefs.comfortVsCost) * w.cost * it.cost.totalUsd +
    (w.transferBase + prefs.comfortVsCost) * w.transfer * it.transfers +
    (1 - prefs.activeTravel) * w.walk * it.walkMinutes +
    w.risk[it.risk.level] * (1 - prefs.transferRisk)
  );
}

/** Stable sort by score (ties keep provider order). Returns a new array. */
export function rankItineraries(its: readonly Itinerary[], prefs: TripPreferences): Itinerary[] {
  return its
    .map((it, index) => ({ it, index, score: scoreItinerary(it, prefs) }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .map(({ it }) => it);
}
