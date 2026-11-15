import { computeWatchStatus, formatClock, scheduledModes, type Itinerary, type Place, type SavedItinerary, type TripRequest, type WatchStatus } from '@transit/shared';
import { assessRisk } from '../planning/risk.js';
import { checkConstraints } from '../planning/constraints.js';
import { planTrip } from '../planning/plan-trip.js';
import type { RouteProvider } from '../providers/types.js';
import type { WatchStore } from '../store/types.js';
import { minutesUntil, type WatchAdvisor } from './advisor.js';
import { boardingFrom, type TripLocations } from './boarding.js';
import { anchorLeg, DONE_GRACE_MINUTES, hasIssue, isDue, MAX_HORIZON_MINUTES } from './horizons.js';

const MINUTE_MS = 60_000;
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
const issueKey = (it: Itinerary, status: WatchStatus | undefined) => [status?.state === 'atRisk', anchorLeg(it).delayMinutes ?? 0, status?.leaveBy, it.arriveAt].join('|');

const nameOf = (it: Itinerary, index: number) => it.legs[index]?.routeName ?? it.legs[index]?.mode ?? 'vehicle';
const legKey = (it: Itinerary, index: number) => it.legs[index]?.trip?.tripId ?? it.legs[index]?.id;

function remapIndex(saved: SavedItinerary, current: Itinerary, index: number | undefined): number | undefined {
  if (index === undefined) return undefined;
  const key = legKey(saved, index);
  const found = current.legs.findIndex((_, i) => legKey(current, i) === key);
  return found < 0 ? undefined : found;
}

function recentPosition(deps: WatchDeps, deviceId: string, id: string, now: Date): Place | undefined {
  const point = deps.locations?.recent(deviceId, id).filter((point) => now.getTime() - point.atMs <= 2 * MINUTE_MS && (point.accuracyMeters ?? Infinity) <= 100).at(-1);
  return point ? { name: 'Current location', coordinates: point.coordinates } : undefined;
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

async function replace(deps: WatchDeps, saved: SavedItinerary, current: Itinerary, missed: WatchStatus, now: Date, origin: Place, reason: string) {
  const deadline = saved.request.constraints.arriveBy ?? (saved.request.time.type === 'arriveBy' ? saved.request.time.at : undefined);
  const request: TripRequest = { ...saved.request, origin, constraints: { ...saved.request.constraints, ...(deadline ? { arriveBy: deadline } : {}) }, time: { type: 'departAt', at: now.toISOString() } };
  delete request.returnTime;
  const plan = await planTrip(request, deps.providers, undefined, deps.log);
  const replacements = plan.itineraries.filter((it) => Date.parse(it.departAt) >= Math.floor(now.getTime() / 1000) * 1000).slice(0, MAX_REPLACEMENTS);
  if (replacements.length === 0) {
    const unavailable = plan.warnings.some((warning) => warning.includes('unavailable'));
    return { itinerary: current, request: saved.request, status: { ...missed, message: unavailable ? 'Could not retrieve alternatives. Will try again.' : `${reason} ${NO_REPLACEMENT}` } };
  }
  const advice = await advise(deps, saved, current, missed, replacements, now);
  const chosen = replacements.find((it) => it.id === advice?.replacementId) ?? replacements[0]!;
  const anchorIndex = chosen.legs.findIndex((leg) => scheduledModes.includes(leg.mode));
  const message = `${reason} Switched to ${chosen.summary}.`;
  const status: WatchStatus = {
    ...computeWatchStatus(chosen, request, now),
    phase: anchorIndex < 0 ? 'enRoute' : 'boarding',
    activeLegIndex: anchorIndex < 0 ? undefined : anchorIndex,
    refreshState: 'fresh',
    lastSuccessfulAt: now.toISOString(),
    change: { id: `${now.toISOString()}-${chosen.id}`, message: saved.watchStatus?.change ? `${saved.watchStatus.change.message} ${message}` : message, changedAt: now.toISOString() }
  };
  if (anchorIndex < 0) {
    status.state = 'onTrack';
    delete status.leaveBy;
    status.message = `Continue to your destination; arrive around ${formatClock(chosen.arriveAt, request.timeZone)}.`;
  }
  deps.log.info({ id: saved.id, replacement: chosen.id }, 'Watched trip switched after a missed departure');
  return { itinerary: chosen, request, status };
}

async function check(deps: WatchDeps, deviceId: string, saved: SavedItinerary, now: Date) {
  const provider = deps.providers.find((candidate) => candidate.name === saved.source.provider);
  const previous = saved.watchStatus;
  let current: Itinerary = saved;
  let refreshState: WatchStatus['refreshState'] = provider?.refresh ? 'notFound' : 'unsupported';
  try {
    const refreshed = await provider?.refresh?.(saved, saved.request);
    if (refreshed) {
      current = refreshed;
      refreshState = 'fresh';
    }
  } catch (err) {
    refreshState = 'unavailable';
    deps.log.warn({ err, id: saved.id, provider: saved.source.provider }, 'Watch refresh failed');
  }
  if (refreshState !== 'fresh') {
    current = { ...current, legs: current.legs.map((leg) => leg.timeSource === 'realtime' ? { ...leg, timeSource: 'estimated', delayMinutes: undefined } : leg) };
  }
  current = { ...current, risk: assessRisk(current, saved.request), violations: checkConstraints(current, saved.request) };
  const request = { ...saved.request, constraints: { ...saved.request.constraints, ...(saved.request.time.type === 'arriveBy' ? { arriveBy: saved.request.constraints.arriveBy ?? saved.request.time.at } : {}) } };
  let boarded = remapIndex(saved, current, previous?.boardedLegIndex);
  let active = current.legs.findIndex((leg, index) => scheduledModes.includes(leg.mode) && (boarded === undefined || index > boarded));
  let status = computeWatchStatus(current, request, now);
  status = { ...status, refreshState, lastSuccessfulAt: refreshState === 'fresh' ? now.toISOString() : previous?.lastSuccessfulAt ?? saved.source.fetchedAt, change: previous?.change, boardedLegIndex: boarded, activeLegIndex: active < 0 ? undefined : active };
  const result = () => ({ itinerary: current, request: saved.request, status });
  if (status.state === 'done' && previous?.missedLegIndex === undefined && (boarded === undefined || (active < 0 && now.getTime() >= Date.parse(current.legs[boarded]!.arriveAt)))) {
    status.phase = 'done';
    return result();
  }
  const riding = () => {
    status.phase = 'riding';
    status.activeLegIndex = boarded;
    status.boardedLegIndex = boarded;
    status.state = 'onTrack';
    delete status.leaveBy;
    status.message = `On ${nameOf(current, boarded!)}, you'll arrive around ${formatClock(current.arriveAt, request.timeZone)}.`;
    const next = current.legs[active];
    if (next && boarded !== undefined) {
      const walking = current.legs.slice(boarded + 1, active).reduce((sum, leg) => sum + leg.durationMinutes, 0);
      const available = (Date.parse(next.departAt) - Date.parse(current.legs[boarded]!.arriveAt)) / MINUTE_MS - walking;
      if (available < (request.constraints.minTransferBufferMinutes ?? 3)) {
        status.state = 'atRisk';
        status.message = available < 0
          ? `On ${nameOf(current, boarded)}. Connection no longer works to ${nameOf(current, active)} at ${formatClock(next.departAt, request.timeZone)}. We'll find the next route at the transfer stop.`
          : `${status.message} Tight connection to ${nameOf(current, active)} at ${formatClock(next.departAt, request.timeZone)}.`;
      }
    }
    if (request.constraints.arriveBy && Date.parse(current.arriveAt) > Date.parse(request.constraints.arriveBy)) {
      status.state = 'atRisk';
      status.message += ` Arrival is after your ${formatClock(request.constraints.arriveBy, request.timeZone)} deadline.`;
    }
  };
  if (boarded !== undefined && now.getTime() < Date.parse(current.legs[boarded]!.arriveAt)) {
    riding();
    return result();
  }
  if (active < 0) {
    status.phase = 'enRoute';
    status.state = 'onTrack';
    delete status.leaveBy;
    status.message = `Continue to your destination; arrive around ${formatClock(current.arriveAt, request.timeZone)}.`;
    return result();
  }
  const leg = current.legs[active]!;
  const points = deps.locations?.recent(deviceId, saved.id) ?? [];
  const boarding = boardingFrom(leg, points, now);
  if (boarding === 'boarded' && refreshState === 'fresh') {
    boarded = active;
    active = current.legs.findIndex((candidate, index) => index > boarded! && scheduledModes.includes(candidate.mode));
    riding();
    return result();
  }
  const manualMiss = remapIndex(saved, current, previous?.missedLegIndex) === active;
  const walking = boarded === undefined ? 0 : current.legs.slice(boarded + 1, active).reduce((sum, item) => sum + item.durationMinutes, 0);
  const impossibleTransfer = boarded !== undefined && Date.parse(current.legs[boarded]!.arriveAt) + walking * MINUTE_MS > Date.parse(leg.departAt);
  if (manualMiss || (refreshState === 'fresh' && (boarding === 'missed' || impossibleTransfer))) {
    status.state = 'missed';
    status.phase = 'uncertain';
    status.missedLegIndex = active;
    const origin = recentPosition(deps, deviceId, saved.id, now) ?? (boarded === undefined ? saved.request.origin : current.legs[boarded]!.to);
    const reason = impossibleTransfer ? `Missed connection to ${nameOf(current, active)}.` : `Missed ${nameOf(current, active)}.`;
    return replace(deps, saved, current, status, now, origin, reason);
  }
  if (now.getTime() > Date.parse(leg.departAt)) {
    status.state = 'missed';
    status.phase = 'uncertain';
    delete status.leaveBy;
    status.message = `${nameOf(current, active)} departure time has passed. Are you on board?`;
    return result();
  }
  const remaining = { ...current, legs: current.legs.slice(boarded === undefined ? 0 : boarded + 1) };
  const upcoming = computeWatchStatus(remaining, request, now);
  status = { ...status, state: upcoming.state, leaveBy: upcoming.leaveBy, message: upcoming.message, phase: boarded === undefined ? 'boarding' : 'transfer' };
  if (boarded !== undefined) status.message = `Transfer to ${nameOf(current, active)} by ${formatClock(leg.departAt, request.timeZone)}. ${status.message}`;
  if (deps.advisor && hasIssue(current, status) && boarded === undefined) {
    if (issueKey(current, status) === issueKey(saved, previous) && previous) status.message = previous.message;
    else {
      const advice = await advise(deps, saved, current, status, [], now);
      if (advice) status.message = advice.message;
    }
  }
  return result();
}

export async function runWatchCycle(deps: WatchDeps): Promise<{ checked: number; updated: number }> {
  const now = deps.now();
  const nowMs = now.getTime();
  const watched = await deps.store.listWatched(iso(nowMs - DONE_GRACE_MINUTES * MINUTE_MS), iso(nowMs + MAX_HORIZON_MINUTES * MINUTE_MS));
  let checked = 0;
  let updated = 0;
  for (const { deviceId, item } of watched) {
    if (!isDue(item, now)) continue;
    checked += 1;
    try {
      const next = await check(deps, deviceId, item, now);
      if (await deps.store.applyWatch(deviceId, item.id, { itinerary: next.itinerary, request: next.request, watchStatus: next.status, previousStatus: item.watchStatus })) updated += 1;
    } catch (err) {
      deps.log.warn({ err, id: item.id }, 'Watch check failed');
    }
  }
  return { checked, updated };
}

export function startWatchJob(deps: WatchDeps, intervalSeconds: number): { stop(): void; checkSoon(): void } {
  let running = false;
  let queued = false;
  let stopped = false;
  const tick = () => {
    if (running) {
      deps.log.info({}, 'Watch cycle still running, skipping tick');
      return;
    }
    running = true;
    runWatchCycle(deps)
      .then((result) => { if (result.checked > 0) deps.log.info(result, 'Watch cycle finished'); })
      .catch((err: unknown) => deps.log.warn({ err }, 'Watch cycle failed'))
      .finally(() => {
        running = false;
        if (queued && !stopped) { queued = false; tick(); }
      });
  };
  const timer = setInterval(tick, intervalSeconds * 1000);
  timer.unref();
  return {
    stop: () => { stopped = true; clearInterval(timer); },
    checkSoon: () => { if (stopped) return; if (running) queued = true; else tick(); }
  };
}
