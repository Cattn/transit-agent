/**
 * The props contract between the map and the apps (plan 009 step 2). The UI team mounts
 * <RouteMap> with exactly these props; announce changes on issue #13 first.
 *
 * Rule: the map never fetches, saves, or owns selection state. The app owns all three.
 */
import type { Itinerary, LngLat, TravelMode } from '@transit/shared';

export interface BuildPreview {
  phase: 'idle' | 'locating' | 'searching' | 'drawing';
  origin?: LngLat;
  destination?: LngLat;
  candidates?: LngLat[];
}

export interface RouteMapProps {
  /** Saved library and/or current search results. */
  itineraries: Itinerary[];
  selectedItineraryId?: string;
  /**
   * The user chose a route. `candidates` lists every itinerary that was under the pointer.
   */
  onRouteSelect: (itineraryId: string, candidates: string[]) => void;
  onDeselect?: () => void;
  /**
   * Tab filter (drive / transit+bike / fly). A trip is shown only if ALL its legs use these modes;
   * otherwise the whole trip is hidden (not just the excluded legs). Undefined = show all.
   */
  visibleModes?: readonly TravelMode[];
  /** Basemap (decision D8). The app passes it; the map never reads env. */
  styleUrl: string;
  userLocation?: LngLat;
  userHeading?: number;
  locateKey?: string | number;
  /** Change this value to re-fit the camera to the visible itineraries. */
  fitKey?: string | number;
  /** Extra padding when panels cover part of the map (web side panel, mobile bottom sheet). */
  padding?: { top: number; right: number; bottom: number; left: number };
  /**
   * Colour per itinerary id. Pass the SAME map your result cards use, so card and line always match:
   * `const routeColors = assignRouteColors(itineraries.map((it) => it.id))`.
   * Optional: without it the map computes exactly that itself.
   */
  routeColors?: ReadonlyMap<string, string>;
  unfocusedColors?: 'grey' | 'trip' | 'mode';
  variant?: 'saved' | 'choosing';
  accentColor?: string;
  buildPreview?: BuildPreview;
  onLoad?: () => void;
  onLoadError?: () => void;
}
