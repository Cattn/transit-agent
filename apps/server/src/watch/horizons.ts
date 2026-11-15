import { scheduledModes, type Itinerary, type SavedItinerary } from '@transit/shared';

export type WatchClass = 'bus' | 'subway' | 'commuterRail';

const MINUTE_MS = 60_000;

export const watchPolicies: Record<WatchClass, { checkpointsMinutes: number[]; rampMinutes: number }> = {
  bus: { checkpointsMinutes: [240, 120, 60, 30, 20, 10], rampMinutes: 10 },
  subway: { checkpointsMinutes: [60, 30, 20, 10], rampMinutes: 10 },
  commuterRail: { checkpointsMinutes: [240, 180, 120, 60, 30, 20, 10], rampMinutes: 10 }
};
export const RAMP_INTERVAL_MINUTES = 2;
export const ISSUE_RAMP_MINUTES = 30;
export const DONE_GRACE_MINUTES = 15;
export const MAX_HORIZON_MINUTES = Math.max(...Object.values(watchPolicies).flatMap((policy) => policy.checkpointsMinutes));

export function anchorLeg(it: Itinerary): Itinerary['legs'][number] {
  return it.legs.find((leg) => scheduledModes.includes(leg.mode)) ?? it.legs[0]!;
}

export function watchClassFor(it: Itinerary): WatchClass | undefined {
  const anchor = it.legs.find((leg) => scheduledModes.includes(leg.mode));
  if (!anchor || anchor.mode === 'flight') return undefined;
  if (anchor.mode !== 'rail') return 'bus';
  return /(^|_)CR-/.test(anchor.trip?.routeId ?? '') ? 'commuterRail' : 'subway';
}

export function hasIssue(it: Itinerary, status: SavedItinerary['watchStatus']): boolean {
  return status?.state === 'atRisk' || (anchorLeg(it).delayMinutes ?? 0) > 0;
}

export function isDue(it: SavedItinerary, now: Date): boolean {
  const watchClass = watchClassFor(it);
  if (!watchClass) return false;
  const nowMs = now.getTime();
  const departMs = Date.parse(anchorLeg(it).departAt);
  const last = it.watchStatus ? Date.parse(it.watchStatus.checkedAt) : undefined;
  if (it.watchStatus?.state === 'done') return false;
  const policy = watchPolicies[watchClass];
  if (last === undefined) return departMs - nowMs <= Math.max(...policy.checkpointsMinutes) * MINUTE_MS;
  if (nowMs - last >= RAMP_INTERVAL_MINUTES * MINUTE_MS && nowMs >= departMs) return true;
  const rampMinutes = hasIssue(it, it.watchStatus) ? Math.max(policy.rampMinutes, ISSUE_RAMP_MINUTES) : policy.rampMinutes;
  if (departMs - nowMs <= rampMinutes * MINUTE_MS) return nowMs - last >= RAMP_INTERVAL_MINUTES * MINUTE_MS;
  return policy.checkpointsMinutes.some((minutes) => {
    const at = departMs - minutes * MINUTE_MS;
    return last < at && at <= nowMs;
  });
}
