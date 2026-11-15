import { WatchStatusSchema, type Itinerary, type SavedItinerary, type WatchStatus } from './itinerary.js';
import type { UpdateItineraryRequest } from './api.js';
import { scheduledModes } from './modes.js';
import type { TripRequest } from './trip-draft.js';

/** Provisional values (accepted 2026-11-14, expected to be tuned). Keep every threshold in these two constants. */
export const leaveBufferMinutes = { strict: 5, some: 2, flexible: 0 } as const;
export const leaveSoonMinutes = 10;

/** Beyond this, the trip is just "scheduled" (display only; plan 008 may pass a per-mode horizon in later). */
const SCHEDULED_HORIZON_MINUTES = 3 * 60;
const MINUTE_MS = 60_000;

type Leg = Itinerary['legs'][number];

/**
 * Formats `ms` as an ISO time in the same UTC offset as `reference` (e.g. '-05:00'), so leaveBy
 * reads like the leg times it was computed from. Falls back to UTC ('Z').
 */
function isoInOffsetOf(ms: number, reference: string): string {
  const m = /([+-])(\d\d):(\d\d)$/.exec(reference);
  if (!m) return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const offsetMinutes = (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
  return new Date(ms + offsetMinutes * MINUTE_MS).toISOString().slice(0, 19) + m[0];
}

/** "8:12 AM" in the trip's display zone (or the runtime's zone when none is set). */
function formatTime(ms: number, timeZone: string | undefined): string {
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  if (timeZone !== undefined) opts.timeZone = timeZone;
  // Newer ICU puts a narrow no-break space (U+202F) before AM/PM. \s matches it (and U+00A0), so
  // this normalises to a plain space and messages match on every runtime.
  return new Intl.DateTimeFormat('en-US', opts).format(ms).replace(/\s/g, ' ');
}

const legName = (leg: Leg) => leg.routeName ?? leg.mode;

/**
 * When to leave, and whether the trip is still on track. Pure: same inputs → same output.
 * States are deterministic rules, never probabilities.
 */
export function computeWatchStatus(it: Itinerary, req: TripRequest, now: Date): WatchStatus {
  const legs = it.legs;
  // 1. Anchor: the first timetabled leg (it can't wait for you); otherwise the first leg.
  const anchorIndex = Math.max(0, legs.findIndex((l) => scheduledModes.includes(l.mode)));
  const anchor = legs[anchorIndex]!;
  const last = legs[legs.length - 1]!;

  // 2. Providers already include the delay in departAt for realtime legs, so delayMinutes is
  //    NOT added again here.
  const anchorDepart = Date.parse(anchor.departAt);

  // 3. leaveBy = anchor departure − time to reach it − the user's lateness buffer.
  const minutesBefore = legs.slice(0, anchorIndex).reduce((sum, l) => sum + l.durationMinutes, 0);
  const leaveByMs = anchorDepart - (minutesBefore + leaveBufferMinutes[req.preferences.lateTolerance]) * MINUTE_MS;
  const leaveBy = isoInOffsetOf(leaveByMs, anchor.departAt);

  const nowMs = now.getTime();
  const minutesLeft = (leaveByMs - nowMs) / MINUTE_MS;
  const arriveBy = req.constraints.arriveBy;

  // 4. State: first match wins.
  let state: WatchStatus['state'];
  if (nowMs > Date.parse(last.arriveAt)) state = 'done';
  else if (nowMs > anchorDepart) state = 'missed';
  else if (arriveBy !== undefined && Date.parse(last.arriveAt) > Date.parse(arriveBy)) state = 'atRisk';
  else if (minutesLeft > SCHEDULED_HORIZON_MINUTES) state = 'scheduled';
  else if (minutesLeft <= 0) state = 'leaveNow';
  else if (minutesLeft <= leaveSoonMinutes) state = 'leaveSoon';
  else state = 'onTrack';

  // 6. Message.
  let message: string;
  if (state === 'done') message = 'Trip finished.';
  else if (state === 'missed') message = `${legName(anchor)} has left. Check the next option.`;
  else if (state === 'atRisk') message = `You may arrive after ${formatTime(Date.parse(arriveBy!), req.timeZone)}.`;
  else {
    message = `Leave by ${formatTime(leaveByMs, req.timeZone)}.`;
    if ((anchor.delayMinutes ?? 0) > 0) message += ` ${legName(anchor)} is ${anchor.delayMinutes} min late (live).`;
  }

  // 5 + 7.
  return WatchStatusSchema.parse({
    state,
    leaveBy: state === 'done' || state === 'missed' ? undefined : leaveBy,
    message,
    checkedAt: now.toISOString(),
    usedRealtime: legs.some((l) => l.timeSource === 'realtime')
  });
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** "Leave in 6 min", "Leave now", "Leave in 1 h 20 min", "Left 3 min ago". Recompute every few seconds on the client. */
export function leaveByLabel(leaveBy: string, now: Date): string {
  // Whole minutes, rounded down: 6 min 50 s shows "Leave in 6 min" (safer to undersell).
  const minutes = Math.floor((Date.parse(leaveBy) - now.getTime()) / MINUTE_MS);
  if (minutes === 0) return 'Leave now';
  return minutes > 0 ? `Leave in ${formatDuration(minutes)}` : `Left ${formatDuration(-minutes)} ago`;
}

export function applyWatchAction(saved: SavedItinerary, patch: UpdateItineraryRequest, now = new Date()): WatchStatus | undefined {
  if (!patch.boarding && !patch.dismissChangeId) return saved.watchStatus;
  const status = { ...(saved.watchStatus ?? computeWatchStatus(saved, saved.request, now)) };
  if (patch.dismissChangeId === status.change?.id) delete status.change;
  if (patch.boarding) {
    const index = patch.boarding.legIndex;
    const leg = saved.legs[index];
    if (leg && scheduledModes.includes(leg.mode) && (leg.trip?.tripId ?? leg.id) === patch.boarding.tripId) {
      status.activeLegIndex = index;
      if (patch.boarding.state === 'boarded') {
        status.boardedLegIndex = index;
        delete status.missedLegIndex;
        delete status.pendingReplan;
        status.phase = 'riding';
        status.state = 'onTrack';
        delete status.leaveBy;
        status.message = `On ${legName(leg)}, you'll arrive around ${formatTime(Date.parse(saved.arriveAt), saved.request.timeZone)}.`;
      } else {
        status.missedLegIndex = index;
        status.pendingReplan = true;
        status.phase = 'uncertain';
        status.state = 'missed';
        status.message = `Looking for the next route after ${legName(leg)}.`;
      }
    }
  }
  return status;
}
