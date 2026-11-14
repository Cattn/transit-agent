/**
 * The props contract between the map and the apps (plan 009 step 2). The UI team mounts
 * <RouteMap> with exactly these props; announce changes on issue #13 first.
 *
 * Rule: the map never fetches, saves, or owns selection state. The app owns all three.
 */
import type { Itinerary, LngLat, TravelMode } from '@transit/shared';

export interface RouteMapProps {
  /** Saved library and/or current search results. */
  itineraries: Itinerary[];
  selectedItineraryId?: string;
  /**
   * The user chose a route. `candidates` lists every itinerary that was under the pointer.
   * When several routes overlap, the MAP shows its own small picker at the tap position and
   * calls this once with the route the user picked, so the app doesn't need a chooser.
   * (Changed from plan 009's "app shows a chooser"; announced on issue #13.)
   */
  onRouteSelect: (itineraryId: string, candidates: string[]) => void;
  /**
   * Tab filter (drive / transit+bike / fly). A trip is shown only if ALL its legs use these modes;
   * otherwise the whole trip is hidden (not just the excluded legs). Undefined = show all.
   */
  visibleModes?: readonly TravelMode[];
  /** Basemap (decision D8). The app passes it; the map never reads env. */
  styleUrl: string;
  userLocation?: LngLat;
  /** Change this value to re-fit the camera to the visible itineraries. */
  fitKey?: string | number;
  /** Extra padding when panels cover part of the map (web side panel, mobile bottom sheet). */
  padding?: { top: number; right: number; bottom: number; left: number };
}
