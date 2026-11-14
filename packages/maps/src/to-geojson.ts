/**
 * Plan 009 step 3: turn itineraries into GeoJSON the map can style.
 *
 * This is the core of the maps package, and it is pure. No React, no MapLibre, no network:
 * data in, GeoJSON out. Because of that, the web map, the native map, and even the server
 * can all use it, and you can unit test it without a browser.
 *
 * Learn: GeoJSON Feature/FeatureCollection (https://geojson.io; draw something and look at the JSON).
 * Done when: `npx vitest run src/maps/to-geojson.test.ts` passes.
 */
import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import type { Itinerary, LngLat, Place, TravelMode } from '@transit/shared';
import { assignRouteColors } from './colors.js';

export type Dash = 'solid' | 'dashed' | 'dotted';

/** Plan 009 step 3: the properties on every route line feature. Layers in layers.ts read these. */
export interface RouteFeatureProps {
  itineraryId: string;
  legId: string;
  mode: TravelMode;
  /** From assignRouteColors(): the whole journey shares one colour, different from the other trips shown. */
  color: string;
  dash: Dash;
  /** This itinerary is the selected one. */
  selected: boolean;
  /** A selection exists and this is not it. */
  dimmed: boolean;
  /** Higher draws on top. The selected itinerary must have the highest. */
  sortKey: number;
  /**
   * This trip's lane, counted from the centre: 3 trips → -1, 0, +1; 2 trips → -0.5, +0.5.
   * layers.ts turns it into a sideways shift (lane × LANE_SPACING px, MapLibre `line-offset`;
   * positive = right of the direction of travel). Same for every leg of a trip, and it does NOT
   * change when the selection changes, so routes never jump when you click them.
   */
  lane: number;
}

/**
 * Properties on point features (start, end and transfer dots). Plan 009 asks for point features; they
 * come from a separate function, itineraryPoints(), so each GeoJSON source holds one geometry type.
 */
export interface RoutePointProps {
  itineraryId: string;
  kind: 'origin' | 'destination' | 'transfer';
  name: string;
  color: string;
  selected: boolean;
  dimmed: boolean;
}

export interface FeatureOptions {
  selectedItineraryId?: string;
  /** Undefined means every trip is visible. See isItineraryVisible(). */
  visibleModes?: readonly TravelMode[];
}

/**
 * Tab filter, per WHOLE trip: a trip is shown only if EVERY one of its legs uses a mode the tab
 * allows. So the Drive tab (walk + car) shows drive trips and hides train trips completely,
 * instead of leaving their walking legs behind. Undefined visibleModes = show everything.
 */
export function isItineraryVisible(itinerary: Itinerary, visibleModes?: readonly TravelMode[]): boolean {
  return !visibleModes || itinerary.legs.every((leg) => visibleModes.includes(leg.mode));
}

/**
 * Dash style by mode (plan 009, confirmed in issue #6):
 *   walk → dotted · bike/bikeshare → dashed · flight → dashed · everything else → solid
 *
 * A lookup table typed as Record<TravelMode, Dash> means TypeScript errors if a mode is
 * missing. If the team adds a new mode to the contract (or brings back 'rideshare'),
 * this line won't compile until you choose its dash style.
 */
const DASH_BY_MODE: Record<TravelMode, Dash> = {
  walk: 'dotted', // on foot: light dots, so walking never looks like a vehicle
  bike: 'dashed', // human-powered vehicles: dashes
  bikeshare: 'dashed',
  flight: 'dashed', // the server sends a curved great-circle line; dashes say "not on the ground"
  bus: 'solid', // vehicles that follow roads or tracks: solid lines
  rail: 'solid',
  ferry: 'solid',
  car: 'solid'
};

export function dashForMode(mode: TravelMode): Dash {
  return DASH_BY_MODE[mode];
}

/**
 * The order of lanes, left to right, as seen travelling from the trips' start towards their end.
 *
 * Why it matters: MapLibre's `line-offset` shifts a line to the RIGHT of its own direction for a
 * positive offset, LEFT for a negative one. If lanes were handed out in list order, a trip that
 * already runs just left of another could be shifted right, INTO it, and two near-identical routes
 * (e.g. two flights into the same airport) would still look like one. Ordering lanes by where each
 * trip actually is makes every shift move trips apart.
 *
 * How: draw an axis from the average start point to the average end point. For each trip take the
 * average of all its points (its centre) and measure how far left (negative) or right (positive)
 * of the axis that centre lies. Sort by that. Trips with no clear direction (same start and end)
 * keep their list order.
 */
export function laneOrder(itineraries: readonly Itinerary[]): string[] {
  if (itineraries.length < 2) return itineraries.map((it) => it.id);

  const average = (points: readonly LngLat[]): LngLat => [
    points.reduce((sum, p) => sum + p[0], 0) / points.length,
    points.reduce((sum, p) => sum + p[1], 0) / points.length
  ];
  const start = average(itineraries.map((it) => it.legs[0]!.geometry.coordinates[0]!));
  const end = average(itineraries.map((it) => it.legs[it.legs.length - 1]!.geometry.coordinates.at(-1)!));

  // A degree of longitude is shorter than a degree of latitude away from the equator; scale x by
  // cos(latitude) so "left/right" isn't skewed. Good enough at city to country scale.
  const k = Math.cos((((start[1] + end[1]) / 2) * Math.PI) / 180);
  const dx = (end[0] - start[0]) * k;
  const dy = end[1] - start[1];

  // Signed distance of a trip's centre from the axis: > 0 = right of the direction of travel.
  // (Right of a direction (dx, dy) in east/north coordinates is the direction (dy, -dx).)
  const side = (it: Itinerary) => {
    const [cx, cy] = average(it.legs.flatMap((leg) => leg.geometry.coordinates));
    return (cx - start[0]) * k * dy - (cy - start[1]) * dx;
  };

  return itineraries
    .map((it, index) => ({ id: it.id, side: side(it), index }))
    .sort((a, b) => a.side - b.side || a.index - b.index) // ties: keep list order
    .map((entry) => entry.id);
}

/**
 * One LineString feature per *visible* leg, styled through its properties.
 *
 * The map never looks at Itinerary objects directly. It only sees these features, and the
 * layers in layers.ts read their properties (color, dash, selected, dimmed, sortKey, lane).
 */
export function itinerariesToFeatures(
  itineraries: readonly Itinerary[],
  options: FeatureOptions = {}
): FeatureCollection<LineString, RouteFeatureProps> {
  const { selectedItineraryId, visibleModes } = options;
  const hasSelection = selectedItineraryId !== undefined;

  // Two buckets so the selected route ends up LAST in the list. Renderers draw in list order
  // when they ignore sortKey, so this keeps the selected route on top everywhere.
  const others: RouteFeature[] = [];
  const selectedFeatures: RouteFeature[] = [];

  // Lanes: put the VISIBLE trips in left-to-right order across their direction of travel (laneOrder),
  // then centre the lanes around the real route: the middle trip stays on the street, the others
  // sit beside it, and every shift pushes a trip AWAY from its neighbours, never into them.
  const visibleIds = laneOrder(itineraries.filter((it) => isItineraryVisible(it, visibleModes)));
  const centre = (visibleIds.length - 1) / 2;
  const laneOf = (id: string) => visibleIds.indexOf(id) - centre;
  // Colours over the WHOLE list (not just visible trips), so switching tabs never recolours a trip.
  const colors = assignRouteColors(itineraries.map((it) => it.id));

  itineraries.forEach((itinerary, index) => {
    if (!isItineraryVisible(itinerary, visibleModes)) return; // hidden by the tab: no lines at all

    const lane = laneOf(itinerary.id); // one lane for the whole trip
    const selected = itinerary.id === selectedItineraryId;
    const dimmed = hasSelection && !selected; // only dim when something else is selected
    const color = colors.get(itinerary.id)!; // one colour for the whole trip

    for (const leg of itinerary.legs) {
      const feature: RouteFeature = {
        type: 'Feature',
        geometry: leg.geometry, // already a GeoJSON LineString in [lng, lat] order (plan 002)
        properties: {
          itineraryId: itinerary.id, // lets a tap on ANY leg select the whole trip
          legId: leg.id,
          mode: leg.mode,
          color,
          dash: dashForMode(leg.mode),
          selected,
          dimmed,
          // Unselected trips keep their list order (0, 1, 2…). The selected trip gets
          // itineraries.length, which is bigger than any index, so it always draws on top.
          sortKey: selected ? itineraries.length : index,
          lane
        }
      };

      (selected ? selectedFeatures : others).push(feature);
    }
  });

  return { type: 'FeatureCollection', features: [...others, ...selectedFeatures] };
}

/**
 * The dots on the map: where each trip starts, ends, and changes vehicle.
 *
 * For a trip with legs  A ──walk──▶ B ──rail──▶ C ──walk──▶ D  this emits:
 *   origin at A, transfer at B, transfer at C, destination at D
 * i.e. one transfer per boundary BETWEEN two legs (a 3-leg trip has 2).
 */
export function itineraryPoints(
  itineraries: readonly Itinerary[],
  options: FeatureOptions = {}
): FeatureCollection<Point, RoutePointProps> {
  const { selectedItineraryId, visibleModes } = options;
  const hasSelection = selectedItineraryId !== undefined;
  const features: Feature<Point, RoutePointProps>[] = [];
  const colors = assignRouteColors(itineraries.map((it) => it.id)); // same colours as the lines

  for (const itinerary of itineraries) {
    // Same tab rule as the lines: a hidden trip gets no dots either.
    if (!isItineraryVisible(itinerary, visibleModes)) continue;

    const legs = itinerary.legs;
    const first = legs[0]!; // the contract guarantees at least one leg (LegSchema .min(1))
    const last = legs[legs.length - 1]!;

    // Every dot of this trip shares these properties; only position, kind and name differ.
    const shared = {
      itineraryId: itinerary.id,
      color: colors.get(itinerary.id)!,
      selected: itinerary.id === selectedItineraryId,
      dimmed: hasSelection && itinerary.id !== selectedItineraryId
    };

    const point = (place: Place, kind: RoutePointProps['kind']): Feature<Point, RoutePointProps> => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: place.coordinates },
      properties: { ...shared, kind, name: place.name ?? '' } // name is optional in Place, '' keeps the type simple
    });

    features.push(point(first.from, 'origin'));
    // Transfers: the end of every leg except the last one (that end is the destination).
    for (const leg of legs.slice(0, -1)) features.push(point(leg.to, 'transfer'));
    features.push(point(last.to, 'destination'));
  }

  return { type: 'FeatureCollection', features };
}

export type RouteFeature = Feature<LineString, RouteFeatureProps>;
