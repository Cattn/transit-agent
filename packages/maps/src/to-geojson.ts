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
  /** The trip's colour (FeatureOptions.colors, else assignRouteColors()): one colour for the whole journey. */
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
   * Positive = right of the shared reference direction (see laneAxis). Same for every leg of a
   * trip, and it does NOT change when the selection changes, so routes never jump when clicked.
   */
  lane: number;
  /**
   * 1 if this TRIP (start → end) travels with the reference direction, -1 if against it. Same for
   * every leg of the trip. MapLibre shifts a line relative to the line's own direction, so layers.ts
   * shifts by lane × direction × LANE_SPACING px: a trip keeps its lane on the same side of its own
   * path all the way along, and a trip going the other way (e.g. the return of a commute) is
   * flipped so it ends up on the opposite side of the street, not on top.
   */
  direction: 1 | -1;
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
  /**
   * Colour per itinerary id, owned by the app (usually assignRouteColors() over everything it shows),
   * so its result cards can use the very same colours. Trips missing from it, or no map at all,
   * fall back to assignRouteColors() over the whole list.
   */
  colors?: ReadonlyMap<string, string>;
}

/** The colour for each trip: the app's map first, else the automatic assignment over the whole list. */
function colorsFor(itineraries: readonly Itinerary[], given?: ReadonlyMap<string, string>): (id: string) => string {
  const auto = assignRouteColors(itineraries.map((it) => it.id));
  return (id) => given?.get(id) ?? auto.get(id)!;
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

interface LaneAxis {
  start: LngLat;
  /** Direction of the axis in "even" units: dx is scaled by k so east and north distances compare fairly. */
  dx: number;
  dy: number;
  /** cos(latitude): a degree of longitude is shorter than a degree of latitude away from the equator. */
  k: number;
}

const average = (points: readonly LngLat[]): LngLat => [
  points.reduce((sum, p) => sum + p[0], 0) / points.length,
  points.reduce((sum, p) => sum + p[1], 0) / points.length
];
const firstPoint = (it: Itinerary) => it.legs[0]!.geometry.coordinates[0]!;
const lastPoint = (it: Itinerary) => it.legs[it.legs.length - 1]!.geometry.coordinates.at(-1)!;

/**
 * The shared reference direction lanes are measured across: from the trips' average start to their
 * average end. If that has no length (e.g. a trip and its return, which start and end in the same
 * two places), use the first trip's own start → end instead. Undefined if there is still no
 * direction (round trips only); lanes then fall back to list order and no flipping.
 */
function laneAxis(itineraries: readonly Itinerary[]): LaneAxis | undefined {
  if (itineraries.length === 0) return undefined;
  const make = (start: LngLat, end: LngLat): LaneAxis | undefined => {
    const k = Math.cos((((start[1] + end[1]) / 2) * Math.PI) / 180);
    const dx = (end[0] - start[0]) * k;
    const dy = end[1] - start[1];
    return Math.hypot(dx, dy) > 1e-12 ? { start, dx, dy, k } : undefined;
  };
  return (
    make(average(itineraries.map(firstPoint)), average(itineraries.map(lastPoint))) ??
    make(firstPoint(itineraries[0]!), lastPoint(itineraries[0]!))
  );
}

/**
 * 1 if a trip, from its start to its end, travels with the axis direction (or across it), -1 if
 * against it. Decided per TRIP, not per leg: a trip's legs form one continuous path, and a constant
 * sign keeps its lane on the same side of that path around every corner. (Deciding per leg made two
 * trips sharing a short sideways leg pick different signs there and land on top of each other.)
 */
function tripDirection(itinerary: Itinerary, axis: LaneAxis | undefined): 1 | -1 {
  if (!axis) return 1;
  const [x0, y0] = firstPoint(itinerary);
  const [x1, y1] = lastPoint(itinerary);
  const dot = (x1 - x0) * axis.k * axis.dx + (y1 - y0) * axis.dy;
  return dot < 0 ? -1 : 1;
}

/**
 * The order of lanes, left to right, as seen looking along the reference direction (laneAxis).
 *
 * Why it matters: MapLibre's `line-offset` shifts a line sideways relative to the line's direction.
 * If lanes were handed out in list order, a trip that already runs just left of another could be
 * shifted right, INTO it, and two near-identical routes (e.g. two flights into the same airport)
 * would still look like one. Ordering lanes by where each trip actually is makes every shift move
 * trips apart.
 *
 * How: for each trip take the average of all its points (its centre) and measure how far left
 * (negative) or right (positive) of the axis that centre lies. Sort by that; ties keep list order.
 */
export function laneOrder(itineraries: readonly Itinerary[]): string[] {
  const axis = laneAxis(itineraries);
  if (itineraries.length < 2 || !axis) return itineraries.map((it) => it.id);

  // Signed distance of a trip's centre from the axis: > 0 = right of the axis direction.
  // (Right of a direction (dx, dy) in east/north coordinates is the direction (dy, -dx).)
  const side = (it: Itinerary) => {
    const [cx, cy] = average(it.legs.flatMap((leg) => leg.geometry.coordinates));
    return (cx - axis.start[0]) * axis.k * axis.dy - (cy - axis.start[1]) * axis.dx;
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
 * layers in layers.ts read their properties (color, dash, selected, dimmed, sortKey, lane, direction).
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
  const visible = itineraries.filter((it) => isItineraryVisible(it, visibleModes));
  const visibleIds = laneOrder(visible);
  const axis = laneAxis(visible); // the same reference direction laneOrder measured lanes across
  const centre = (visibleIds.length - 1) / 2;
  const laneOf = (id: string) => visibleIds.indexOf(id) - centre;
  // Colours over the WHOLE list (not just visible trips), so switching tabs never recolours a trip.
  const colorOf = colorsFor(itineraries, options.colors);

  itineraries.forEach((itinerary, index) => {
    if (!isItineraryVisible(itinerary, visibleModes)) return; // hidden by the tab: no lines at all

    const lane = laneOf(itinerary.id); // one lane for the whole trip
    const direction = tripDirection(itinerary, axis); // and one direction, so the lane never switches sides
    const selected = itinerary.id === selectedItineraryId;
    const dimmed = hasSelection && !selected; // only dim when something else is selected
    const color = colorOf(itinerary.id); // one colour for the whole trip

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
          lane,
          direction
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
  const colorOf = colorsFor(itineraries, options.colors); // same colours as the lines

  for (const itinerary of itineraries) {
    // Same tab rule as the lines: a hidden trip gets no dots either.
    if (!isItineraryVisible(itinerary, visibleModes)) continue;

    const legs = itinerary.legs;
    const first = legs[0]!; // the contract guarantees at least one leg (LegSchema .min(1))
    const last = legs[legs.length - 1]!;

    // Every dot of this trip shares these properties; only position, kind and name differ.
    const shared = {
      itineraryId: itinerary.id,
      color: colorOf(itinerary.id),
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
