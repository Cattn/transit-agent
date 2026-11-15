import type { Itinerary, TripRequest } from '@transit/shared';

export interface RouteProvider {
  readonly name: string;
  /** True if this provider can answer for these modes/places (e.g. flight provider only when 'flight' allowed). */
  supports(request: TripRequest): boolean;
  /** Return candidate itineraries. risk/violations may be left empty — planTrip fills them. */
  search(request: TripRequest, signal?: AbortSignal): Promise<Itinerary[]>;
  refresh?(it: Itinerary, request: TripRequest, signal?: AbortSignal): Promise<Itinerary | undefined>;
}
