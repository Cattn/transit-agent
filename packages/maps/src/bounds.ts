/**
 * Plan 009 step 3: camera bounds and overlap handling.
 * Tests: bounds.test.ts
 */
import type { Itinerary, TravelMode } from '@transit/shared';
import { isItineraryVisible } from './to-geojson.js';

/** [[minLng, minLat], [maxLng, maxLat]] (south-west corner, north-east corner). This is the format map.fitBounds() accepts. */
export type Bounds = [[number, number], [number, number]];

/**
 * The smallest box containing every point of every visible leg. The map zooms to this box when
 * `fitKey` changes, so all the trips on screen fit in view.
 */
export function boundsOf(itineraries: readonly Itinerary[], visibleModes?: readonly TravelMode[]): Bounds | undefined {
  // Start "inside out": any real coordinate is smaller than +Infinity and bigger than -Infinity,
  // so the first point we see sets all four edges.
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const itinerary of itineraries) {
    if (!isItineraryVisible(itinerary, visibleModes)) continue; // hidden by the tab: don't zoom to it

    for (const leg of itinerary.legs) {
      for (const [lng, lat] of leg.geometry.coordinates) {
        // GeoJSON order: [lng, lat]
        minLng = Math.min(minLng, lng);
        minLat = Math.min(minLat, lat);
        maxLng = Math.max(maxLng, lng);
        maxLat = Math.max(maxLat, lat);
      }
    }
  }

  // Still Infinity → we never saw a point. Returning undefined (instead of [[∞,∞],[-∞,-∞]])
  // lets the renderer skip the zoom rather than flying the camera to nowhere.
  if (minLng === Infinity) return undefined;

  return [
    [minLng, minLat],
    [maxLng, maxLat]
  ];
}

/**
 * Turn "every feature under the pointer" into "which trips did the user tap", topmost first.
 *
 * When routes overlap (e.g. three trips share the Red Line), MapLibre returns ALL the legs under the
 * pointer, often several from the same trip and in no useful order. This:
 *   1. drops features without properties
 *   2. sorts by sortKey, highest first (the trip drawn on top, i.e. the selected one, comes first)
 *   3. keeps only the first appearance of each itinerary id
 */
export function uniqueItineraryIds(
  features: ReadonlyArray<{ properties: { itineraryId?: unknown; sortKey?: unknown } | null }>
): string[] {
  // Read the two properties we need. They are `unknown` because MapLibre can't know their types,
  // so check them: the id must be a string, and a missing or invalid sortKey counts as 0.
  const hits = features.flatMap((feature) => {
    const id = feature.properties?.itineraryId;
    if (typeof id !== 'string') return []; // flatMap + [] = "skip this one"
    const sortKey = Number(feature.properties?.sortKey ?? 0);
    return [{ id, sortKey: Number.isFinite(sortKey) ? sortKey : 0 }];
  });

  hits.sort((a, b) => b.sortKey - a.sortKey); // b − a = descending (top-most first)

  // A Set keeps insertion order and ignores duplicates, which is exactly "first occurrence wins".
  return [...new Set(hits.map((hit) => hit.id))];
}

export function nextRouteToSelect(
  underTap: readonly string[],
  selectedId: string | undefined,
  listOrder: readonly string[]
): string | undefined {
  if (underTap.length === 0) return undefined;
  if (selectedId === undefined || !underTap.includes(selectedId)) return underTap[0];
  const position = (id: string) => {
    const index = listOrder.indexOf(id);
    return index === -1 ? Number.MAX_SAFE_INTEGER : index;
  };
  const cycle = [...underTap].sort((a, b) => position(a) - position(b));
  return cycle[(cycle.indexOf(selectedId) + 1) % cycle.length];
}
