import type { Itinerary, PlanResponse, TripRequest } from '@transit/shared';
import type { RouteProvider } from '../providers/types.js';
import { checkConstraints } from './constraints.js';
import { rankItineraries } from './rank.js';
import { assessRisk } from './risk.js';

/** Max "almost works" options returned when they break a hard constraint. */
export const MAX_NEAR_MISSES = 3;

export interface PlanLogger {
  warn(details: unknown, message?: string): void;
}

const consoleLogger: PlanLogger = { warn: (details, message) => console.warn(message, details) };

/** Queries providers, annotates risk + violations, splits into results and near-misses, ranks both. */
export async function planTrip(
  req: TripRequest,
  providers: RouteProvider[],
  signal?: AbortSignal,
  logger: PlanLogger = consoleLogger
): Promise<PlanResponse> {
  const warnings: string[] = [];
  const active = providers.filter((provider) => provider.supports(req));
  const settled = await Promise.allSettled(active.map((provider) => provider.search(req, signal)));

  const candidates: Itinerary[] = [];
  settled.forEach((result, index) => {
    const provider = active[index];
    if (!provider) return;
    if (result.status === 'fulfilled') {
      candidates.push(...result.value);
    } else {
      logger.warn({ err: result.reason, provider: provider.name }, 'Route provider failed');
      warnings.push(`${provider.name} unavailable`);
    }
  });

  const annotated = candidates.map((it) => ({ ...it, risk: assessRisk(it, req), violations: checkConstraints(it, req) }));
  const itineraries = rankItineraries(annotated.filter((it) => it.violations.length === 0), req.preferences);
  const nearMisses = rankItineraries(annotated.filter((it) => it.violations.length > 0), req.preferences).slice(0, MAX_NEAR_MISSES);

  if (itineraries.length === 0 && nearMisses.length === 0) warnings.push('No routes found for this trip');

  return { itineraries, nearMisses, warnings };
}
