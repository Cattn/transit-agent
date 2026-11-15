import { computeWatchStatus, formatClock, WatchStatusSchema, type Itinerary, type SavedItinerary, type TripRequest, type WatchStatus } from '@transit/shared';
import { planTrip } from '../planning/plan-trip.js';
import type { RouteProvider } from '../providers/types.js';
import type { WatchStore } from '../store/types.js';
import { minutesUntil, type WatchAdvisor } from './advisor.js';
import { boardingFrom, type TripLocations } from './boarding.js';
import { anchorLeg, DONE_GRACE_MINUTES, hasIssue, isDue, MAX_HORIZON_MINUTES } from './horizons.js';

const MINUTE_MS = 60_000;
const DECIDE_AFTER_MINUTES = 10;
const MAX_REPLACEMENTS = 3;
export const NO_REPLACEMENT = 'No valid replacement is available right now.';

export interface WatchLogger {
  info(details: unknown, message?: string): void;
  warn(details: unknown, message?: string): void;
}

export interface WatchDeps {
  store: WatchStore;
  providers: RouteProvider[];
  now: () => Date;
  log: WatchLogger;
  locations?: TripLocations;
  advisor?: WatchAdvisor;
}

const iso = (ms: number) => new Date(ms).toISOString();
const legName = (it: Itinerary) => anchorLeg(it).routeName ?? anchorLeg(it).mode;
const issueKey = (it: Itinerary, status: WatchStatus | undefined) => [status?.state === 'atRisk', anchorLeg(it).delayMinutes ?? 0, status?.leaveBy, it.arriveAt].join('|');

function riding(it: Itinerary, req: TripRequest, now: Date, prefix: string, state: WatchStatus['state']): WatchStatus {
  return WatchStatusSchema.parse({
    state,
    message: `${prefix} you'll arrive around ${formatClock(it.arriveAt, req.timeZone)}.`,
    checkedAt: now.toISOString(),
    usedRealtime: it.legs.some((leg) => leg.timeSource === 'realtime')
  });
}

async function advise(deps: WatchDeps, saved: SavedItinerary, current: Itinerary, status: WatchStatus, replacements: Itinerary[], now: Date) {
  if (!deps.advisor) return undefined;
  try {
    return await deps.advisor.advise({ saved, current, status, replacements, departInMinutes: minutesUntil(anchorLeg(current).departAt, now) });
  } catch (err) {
    deps.log.warn({ err, id: saved.id }, 'Watch advisor failed');
    return undefined;
  }
}

async function replace(deps: WatchDeps, saved: SavedItinerary, current: Itinerary, missed: WatchStatus, now: Date) {
  const request: TripRequest = { ...saved.request, time: { type: 'departAt', at: now.toISOString() } };
  delete request.returnTime;
  const plan = await planTrip(request, deps.providers, undefined, deps.log);
  const replacements = plan.itineraries.slice(0, MAX_REPLACEMENTS);
  if (replacements.length === 0) {
    return { itinerary: current, request: saved.request, status: { ...missed, message: `${legName(current)} has left. ${NO_REPLACEMENT}` } };
  }
  const advice = await advise(deps, saved, current, missed, replacements, now);
  const chosen = replacements.find((it) => it.id === advice?.replacementId) ?? replacements[0]!;
  const status = computeWatchStatus(chosen, request, now);
  status.message = advice?.message ?? `Missed ${legName(current)}, switched to ${chosen.summary}. ${status.message}`;
  deps.log.info({ id: saved.id, replacement: chosen.id }, 'Watched trip switched after a missed departure');
  return { itinerary: chosen, request, status };
}

async function check(deps: WatchDeps, deviceId: string, saved: SavedItinerary, now: Date) {
  const provider = deps.providers.find((candidate) => candidate.name === saved.source.provider);
  let current: Itinerary = saved;
  try {
    current = (await provider?.refresh?.(saved, saved.request)) ?? saved;
  } catch (err) {
    deps.log.warn({ err, id: saved.id, provider: saved.source.provider }, 'Watch refresh failed');
  }
  let status = computeWatchStatus(current, saved.request, now);
  const previous = saved.watchStatus;
  const departMs = Date.parse(anchorLeg(current).departAt);

  if (status.state === 'missed') {
    const firstAfterDeparture = !previous || Date.parse(previous.checkedAt) < departMs;
    if (!firstAfterDeparture && previous?.state === 'onTrack') {
      return { itinerary: current, request: saved.request, status: riding(current, saved.request, now, `On ${legName(current)},`, 'onTrack') };
    }
    const boarding = boardingFrom(anchorLeg(current), deps.locations?.recent(deviceId, saved.id) ?? [], now);
    if (boarding === 'boarded') {
      return { itinerary: current, request: saved.request, status: riding(current, saved.request, now, `On ${legName(current)},`, 'onTrack') };
    }
    const sawLeaveTime = previous?.leaveBy !== undefined && Date.parse(previous.checkedAt) >= Date.parse(previous.leaveBy);
    const unseen = firstAfterDeparture && !sawLeaveTime;
    if (boarding === 'missed' || (boarding === 'unknown' && unseen)) return replace(deps, saved, current, status, now);
    return { itinerary: current, request: saved.request, status: riding(current, saved.request, now, `${legName(current)} has left. If you're on it,`, 'missed') };
  }

  if (deps.advisor && hasIssue(current, status)) {
    if (issueKey(current, status) === issueKey(saved, previous) && previous) status = { ...status, message: previous.message };
    else {
      const advice = await advise(deps, saved, current, status, [], now);
      if (advice) status = { ...status, message: advice.message };
    }
  }
  return { itinerary: current, request: saved.request, status };
}

function finished(saved: SavedItinerary): boolean {
  const status = saved.watchStatus;
  if (!status || status.state !== 'missed') return false;
  return status.message.endsWith(NO_REPLACEMENT) || Date.parse(status.checkedAt) >= Date.parse(anchorLeg(saved).departAt) + DECIDE_AFTER_MINUTES * MINUTE_MS;
}

export async function runWatchCycle(deps: WatchDeps): Promise<{ checked: number; updated: number }> {
  const now = deps.now();
  const nowMs = now.getTime();
  const watched = await deps.store.listWatched(iso(nowMs - DONE_GRACE_MINUTES * MINUTE_MS), iso(nowMs + MAX_HORIZON_MINUTES * MINUTE_MS));
  let checked = 0;
  let updated = 0;
  for (const { deviceId, item } of watched) {
    if (!isDue(item, now) || finished(item)) continue;
    checked += 1;
    try {
      const next = await check(deps, deviceId, item, now);
      if (await deps.store.applyWatch(deviceId, item.id, { itinerary: next.itinerary, request: next.request, watchStatus: next.status })) updated += 1;
    } catch (err) {
      deps.log.warn({ err, id: item.id }, 'Watch check failed');
    }
  }
  return { checked, updated };
}

export function startWatchJob(deps: WatchDeps, intervalSeconds: number): { stop(): void } {
  let running = false;
  const tick = () => {
    if (running) {
      deps.log.info({}, 'Watch cycle still running, skipping tick');
      return;
    }
    running = true;
    runWatchCycle(deps)
      .then((result) => { if (result.checked > 0) deps.log.info(result, 'Watch cycle finished'); })
      .catch((err: unknown) => deps.log.warn({ err }, 'Watch cycle failed'))
      .finally(() => { running = false; });
  };
  const timer = setInterval(tick, intervalSeconds * 1000);
  timer.unref();
  return { stop: () => clearInterval(timer) };
}
