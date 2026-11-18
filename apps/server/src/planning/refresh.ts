import { hopRequests, splitHops, stitchHops, type Itinerary, type TripRequest, type WatchStatus } from '@transit/shared';
import type { RouteProvider } from '../providers/types.js';

type Watched = Itinerary & { watchStatus?: WatchStatus };

const estimated = (it: Itinerary): Itinerary => ({
  ...it,
  legs: it.legs.map((leg) => (leg.timeSource === 'realtime' ? { ...leg, timeSource: 'estimated', delayMinutes: undefined } : leg))
});

/**
 * Refreshes a watched trip. A trip with stops is refreshed one hop at a time, because providers
 * only know direct trips. Hops already behind the rider stay as they are; a hop the provider can't
 * match keeps its times as estimates. Undefined when no hop could be refreshed.
 */
export async function refreshItinerary(provider: RouteProvider, it: Watched, request: TripRequest, signal?: AbortSignal): Promise<Itinerary | undefined> {
  if (!provider.refresh) return undefined;
  const parts = splitHops(it);
  if (parts.length === 1) return provider.refresh(it, request, signal);
  const hops = hopRequests(request, request.time);
  if (hops.length !== parts.length) return undefined;

  const boarded = it.watchStatus?.boardedLegIndex;
  const refreshed: Itinerary[] = [];
  let start = 0;
  let found = false;
  for (const [index, part] of parts.entries()) {
    const end = start + part.legs.length;
    if (boarded !== undefined && boarded >= end) {
      refreshed.push(part);
    } else {
      const watched: Watched = boarded !== undefined && boarded >= start && it.watchStatus
        ? { ...part, watchStatus: { ...it.watchStatus, boardedLegIndex: boarded - start } }
        : part;
      const fresh = await provider.refresh(watched, hops[index]!, signal);
      if (fresh) found = true;
      refreshed.push(fresh ?? estimated(part));
    }
    start = end;
  }
  if (!found) return undefined;
  const stitched = stitchHops(refreshed, (it.stops ?? []).map((mark) => mark.place));
  const fetchedAt = refreshed.map((part) => part.source.fetchedAt).sort((a, b) => Date.parse(b) - Date.parse(a))[0]!;
  return { ...stitched, source: { provider: it.source.provider, fetchedAt } };
}
