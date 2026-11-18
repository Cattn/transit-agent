import { formatClock, formatDay, formatDuration, LONG_RETURN_WAIT_MINUTES, searchWithStops, type Itinerary, type PlanResponse, type ReturnPlan, type TripRequest } from '@transit/shared';
import type { RouteProvider } from '../providers/types.js';
import { checkConstraints } from './constraints.js';
import { rankItineraries } from './rank.js';
import { assessRisk } from './risk.js';

/** Max "almost works" options returned when they break a hard constraint. */
export const MAX_NEAR_MISSES = 3;
export const RETURN_WINDOW_HOURS = 12;
export const MORNING_HOUR = 5;
const DEFAULT_TIME_ZONE = 'America/New_York';
const MINUTE_MS = 60_000;

export interface PlanLogger {
  warn(details: unknown, message?: string): void;
}

const consoleLogger: PlanLogger = { warn: (details, message) => console.warn(message, details) };

interface SearchResult {
  candidates: Itinerary[];
  warnings: string[];
  failed: number;
}

async function searchProviders(req: TripRequest, active: RouteProvider[], signal: AbortSignal | undefined, logger: PlanLogger, suffix = ''): Promise<SearchResult> {
  const warnings: string[] = [];
  const candidates: Itinerary[] = [];
  let failed = 0;
  const settled = await Promise.allSettled(active.map((provider) => searchWithStops(req, (hop) => provider.search(hop, signal))));
  settled.forEach((result, index) => {
    const provider = active[index];
    if (!provider) return;
    if (result.status === 'fulfilled') {
      candidates.push(...result.value);
    } else {
      failed += 1;
      logger.warn({ err: result.reason, provider: provider.name }, 'Route provider failed');
      warnings.push(`${provider.name} unavailable${suffix}`);
    }
  });
  return { candidates, warnings, failed };
}

const annotate = (candidates: Itinerary[], req: TripRequest) =>
  candidates.map((it) => ({ ...it, risk: assessRisk(it, req), violations: checkConstraints(it, req) }));

function localParts(ms: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric'
  }).formatToParts(ms);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: part('year'), month: part('month'), day: part('day'), hour: part('hour'), minute: part('minute') };
}

function zonedInstant(year: number, month: number, day: number, hour: number, timeZone: string): number {
  const wall = Date.UTC(year, month - 1, day, hour);
  let ms = wall;
  for (let i = 0; i < 2; i += 1) {
    const p = localParts(ms, timeZone);
    ms -= Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - wall;
  }
  return ms;
}

export function nextMorning(afterMs: number, timeZone: string): number {
  const p = localParts(afterMs, timeZone);
  const sameDay = zonedInstant(p.year, p.month, p.day, MORNING_HOUR, timeZone);
  return sameDay > afterMs ? sameDay : zonedInstant(p.year, p.month, p.day + 1, MORNING_HOUR, timeZone);
}

/** The trip back goes straight home: stops are visited on the way out only. */
export function returnRequestFor(req: TripRequest, returnTime: string): TripRequest {
  const reversed: TripRequest = { ...req, origin: req.destination, destination: req.origin, time: { type: 'departAt', at: returnTime }, constraints: { ...req.constraints } };
  delete reversed.stops;
  delete reversed.returnTime;
  delete reversed.constraints.arriveBy;
  return reversed;
}

function isoAt(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

async function planReturn(req: TripRequest, returnTime: string, providers: RouteProvider[], signal: AbortSignal | undefined, logger: PlanLogger): Promise<ReturnPlan> {
  const request = returnRequestFor(req, returnTime);
  const timeZone = req.timeZone ?? DEFAULT_TIME_ZONE;
  const base = { requestedDepartAt: returnTime, request, options: [], nearMisses: [] };
  const active = providers.filter((provider) => provider.supports(request));
  if (active.length === 0) return { ...base, status: 'unsupported', warnings: ['No route provider supports this return trip'] };

  const requestedMs = Date.parse(returnTime);
  const morningMs = nextMorning(requestedMs, timeZone);
  const overnight = morningMs - requestedMs <= RETURN_WINDOW_HOURS * 60 * MINUTE_MS;
  const suffix = ' for the return';

  const first = await searchProviders(request, active, signal, logger, suffix);
  const warnings = [...first.warnings];
  const unavailable = first.failed === active.length;
  let morningFailed = false;
  const candidates = [...first.candidates];
  const feasibleMorning = (it: Itinerary) => Date.parse(it.departAt) >= morningMs && checkConstraints(it, request).length === 0;
  if (!unavailable && overnight && !candidates.some(feasibleMorning)) {
    const morning = await searchProviders({ ...request, time: { type: 'departAt', at: isoAt(morningMs) } }, active, signal, logger, suffix);
    warnings.push(...morning.warnings.filter((warning) => !warnings.includes(warning)));
    for (const it of morning.candidates) if (!candidates.some((other) => other.id === it.id)) candidates.push(it);
    morningFailed = morning.failed === active.length;
  }

  const annotated = annotate(candidates.filter((it) => Date.parse(it.departAt) >= requestedMs), request);
  const byDeparture = (a: Itinerary, b: Itinerary) => Date.parse(a.departAt) - Date.parse(b.departAt);
  const feasible = annotated.filter((it) => it.violations.length === 0).sort(byDeparture);
  const firstMorning = overnight ? feasible.find((it) => Date.parse(it.departAt) >= morningMs) : undefined;
  const kept = overnight ? feasible.filter((it) => Date.parse(it.departAt) < morningMs || it === firstMorning) : feasible;

  const waitMinutes = (it: Itinerary) => Math.max(0, Math.round((Date.parse(it.departAt) - requestedMs) / MINUTE_MS));
  const ranked = rankItineraries(kept.map((it) => ({ ...it, durationMinutes: it.durationMinutes + waitMinutes(it) })), req.preferences);
  const options = ranked.map((scored) => {
    const itinerary = kept.find((it) => it.id === scored.id)!;
    return { itinerary, waitMinutes: waitMinutes(itinerary) };
  });
  const nearMisses = rankItineraries(annotated.filter((it) => it.violations.length > 0), req.preferences).slice(0, MAX_NEAR_MISSES);

  const longWait = (label: string, it: Itinerary | undefined) => {
    if (!it || waitMinutes(it) < LONG_RETURN_WAIT_MINUTES) return;
    warnings.push(`${label} leaves ${formatDay(it.departAt, timeZone)} at ${formatClock(it.departAt, timeZone)}, a ${formatDuration(waitMinutes(it))} wait`);
  };
  longWait('Next return', feasible[0]);
  if (firstMorning !== feasible[0]) longWait('First morning return', firstMorning);

  let status: ReturnPlan['status'] = 'ok';
  if (options.length === 0) {
    status = unavailable || morningFailed ? 'unavailable' : 'no_routes';
    if (status === 'no_routes') warnings.push('No return routes found');
  }
  const plan: ReturnPlan = { ...base, status, options, nearMisses, warnings };
  if (firstMorning) plan.firstMorningOptionId = firstMorning.id;
  return plan;
}

/** Queries providers, annotates risk + violations, splits into results and near-misses, ranks both. */
export async function planTrip(
  req: TripRequest,
  providers: RouteProvider[],
  signal?: AbortSignal,
  logger: PlanLogger = consoleLogger
): Promise<PlanResponse> {
  const active = providers.filter((provider) => provider.supports(req));
  const [outbound, returnPlan] = await Promise.all([
    searchProviders(req, active, signal, logger),
    req.returnTime ? planReturn(req, req.returnTime, providers, signal, logger) : undefined
  ]);
  const warnings = outbound.warnings;

  const annotated = annotate(outbound.candidates, req);
  const itineraries = rankItineraries(annotated.filter((it) => it.violations.length === 0), req.preferences);
  const nearMisses = rankItineraries(annotated.filter((it) => it.violations.length > 0), req.preferences).slice(0, MAX_NEAR_MISSES);

  if (itineraries.length === 0 && nearMisses.length === 0) warnings.push('No routes found for this trip');

  return returnPlan ? { itineraries, nearMisses, warnings, returnPlan } : { itineraries, nearMisses, warnings };
}
