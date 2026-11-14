/**
 * Plan 009 step 3: the MapLibre style layers, shared by web and native.
 *
 * A "layer" tells MapLibre HOW to draw features from a source: line colour, width, dash, and
 * which features it applies to (filter). These are plain objects (style-spec JSON), so they live
 * in the pure package and both renderers reuse them. Native converts the keys with toRnStyle().
 *
 * Expressions used below (they run inside MapLibre, once per feature):
 *   ['get', 'color']                 → read the feature's `color` property
 *   ['==', ['get', 'dash'], 'solid'] → true when the feature's dash is 'solid'
 *   ['case', cond, a, b]             → a if cond is true, else b (like `cond ? a : b`)
 *   ['match', value, 'x', a, b]      → a if value === 'x', else b (like a switch)
 * Docs: https://maplibre.org/maplibre-style-spec/expressions/
 */
import {
  CASING_EXTRA_WIDTH,
  DIMMED_OPACITY,
  LANE_SPACING,
  LINE_WIDTH,
  LINE_WIDTH_ZOOMED_OUT,
  SELECTED_LINE_WIDTH,
  SELECTED_LINE_WIDTH_ZOOMED_OUT
} from './colors.js';
import type { Dash } from './to-geojson.js';

export const ROUTE_SOURCE_ID = 'routes';
export const POINT_SOURCE_ID = 'route-points';

/** A minimal style-spec layer type. It is compatible with react-map-gl's <Layer {...layer} />. */
export interface RouteLayer {
  id: string;
  type: 'line' | 'circle';
  source: typeof ROUTE_SOURCE_ID | typeof POINT_SOURCE_ID;
  filter?: unknown[];
  layout?: Record<string, unknown>;
  paint: Record<string, unknown>;
}

const CASING_LAYER_ID = 'route-casing';
const HIT_LAYER_ID = 'route-hit';

/**
 * Width of the invisible click target, in pixels. The visible lines are only 3–7 px wide, which is
 * fiddly to hit with a mouse and very hard with a finger. 14 px gives about 7 px of slack each side.
 * Kept below about 1.5 × LANE_SPACING: wider, and a click on one lane would almost always also hit
 * its neighbour and open the picker.
 */
export const HIT_LINE_WIDTH = 14;

/** Dash patterns, measured in line widths: [dash length, gap length, ...]. Solid has none. */
const DASH_PATTERNS: Record<Dash, number[] | undefined> = {
  solid: undefined,
  dashed: [2, 1.5], // dash 2× the line width long, gap 1.5× wide
  dotted: [0.1, 2] // a near-zero dash plus a round cap draws a dot; gap of 2 widths between dots
};

/** Zoom levels the widths blend between: 5 ≈ several states on screen, 14 ≈ a neighbourhood. */
const ZOOMED_OUT = 5;
const CITY = 14;

/**
 * Line width by zoom AND selection: thin when zoomed out, full width at city zoom, smoothly in between
 * (['interpolate', ['linear'], ['zoom'], …] blends linearly between the listed zoom levels). The selected
 * trip is always 2 px thicker.
 */
const LINE_WIDTH_EXPR = [
  'interpolate', ['linear'], ['zoom'],
  ZOOMED_OUT, ['case', ['get', 'selected'], SELECTED_LINE_WIDTH_ZOOMED_OUT, LINE_WIDTH_ZOOMED_OUT],
  CITY, ['case', ['get', 'selected'], SELECTED_LINE_WIDTH, LINE_WIDTH]
];

/** The white border under the selected trip: its line width + CASING_EXTRA_WIDTH, at every zoom. */
const CASING_WIDTH_EXPR = [
  'interpolate', ['linear'], ['zoom'],
  ZOOMED_OUT, SELECTED_LINE_WIDTH_ZOOMED_OUT + CASING_EXTRA_WIDTH,
  CITY, SELECTED_LINE_WIDTH + CASING_EXTRA_WIDTH
];

/** Fade trips that aren't selected (only while something IS selected; that's what `dimmed` means). */
const OPACITY_EXPR = ['case', ['get', 'dimmed'], DIMMED_OPACITY, 1];

/**
 * Draw each trip in its own lane: shifted sideways by lane × direction × LANE_SPACING screen pixels.
 * `lane` is the trip's lane (−1, 0, +1, … across the shared reference direction) and `direction` is
 * 1 or -1 depending on which way THIS leg's line runs. MapLibre shifts relative to each line's own
 * direction, so multiplying by `direction` keeps every leg of a trip on the same physical side.
 * Used by every line layer (casing, visible lines, hit line) so they all stay lined up. The
 * start/end/transfer dots are not shifted: those points are shared anyway.
 */
const LANE_OFFSET_EXPR = ['*', ['get', 'lane'], ['get', 'direction'], LANE_SPACING];

/** One line layer for one dash style. */
/**
 * One line layer for one dash style, drawing EITHER the unselected trips OR the selected trip.
 * The two halves are separate layers so the selected trip can be drawn after (on top of) every
 * unselected line, whatever their dash styles: line-sort-key only orders lines inside one layer.
 */
function dashLayer(dash: Dash, which: 'unselected' | 'selected'): RouteLayer {
  const pattern = DASH_PATTERNS[dash];
  return {
    id: which === 'selected' ? `route-${dash}-selected` : `route-${dash}`,
    type: 'line',
    source: ROUTE_SOURCE_ID,
    // only legs with this dash style, and only selected / only unselected ones
    filter: ['all', ['==', ['get', 'dash'], dash], ['==', ['get', 'selected'], which === 'selected']],
    layout: {
      'line-cap': 'round', // round ends: makes dots round, and makes leg joins look seamless
      'line-join': 'round',
      'line-sort-key': ['get', 'sortKey'] // higher sortKey draws on top, so the selected trip wins
    },
    paint: {
      'line-color': ['get', 'color'], // the trip's colour from routeColor()
      'line-width': LINE_WIDTH_EXPR,
      'line-offset': LANE_OFFSET_EXPR,
      'line-opacity': OPACITY_EXPR,
      // Only add a dasharray when there is one. Solid lines simply leave it out.
      ...(pattern ? { 'line-dasharray': pattern } : {})
    }
  };
}

/**
 * All layers in DRAW ORDER: the first one is drawn at the bottom.
 *   1. unselected trips: solid / dashed / dotted, one layer per dash style
 *      (separate layers because line-dasharray can't reliably be data-driven on every renderer)
 *   2. casing: a wide white line under the SELECTED trip, so it stands out from the map and the others
 *   3. the selected trip: solid / dashed / dotted again. Because these layers come after every
 *      unselected layer, the selected trip is always on top, even where a solid selected line
 *      crosses a dotted or dashed unselected one.
 *   4. hit: an INVISIBLE, extra-wide copy of every route line. It's the only layer that
 *      responds to clicks, so you can click near a line rather than exactly on it.
 *   5. points: start, end and transfer dots on top of the lines
 */
export function routeLayers(): RouteLayer[] {
  return [
    dashLayer('solid', 'unselected'),
    dashLayer('dashed', 'unselected'),
    dashLayer('dotted', 'unselected'),
    {
      id: CASING_LAYER_ID,
      type: 'line',
      source: ROUTE_SOURCE_ID,
      filter: ['==', ['get', 'selected'], true], // only behind the selected trip
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#ffffff',
        'line-width': CASING_WIDTH_EXPR, // wider than the line, so a white border shows
        'line-offset': LANE_OFFSET_EXPR // stay under the selected trip's lane
      }
    },
    dashLayer('solid', 'selected'),
    dashLayer('dashed', 'selected'),
    dashLayer('dotted', 'selected'),
    {
      id: HIT_LAYER_ID,
      type: 'line',
      source: ROUTE_SOURCE_ID, // same features as the visible lines (every leg of every visible trip)
      layout: {
        'line-cap': 'round', // round ends extend the target past line ends too
        'line-join': 'round',
        'line-sort-key': ['get', 'sortKey'] // keep the selected trip on top here too
      },
      paint: {
        'line-color': '#000000', // any colour; it's never seen
        'line-width': HIT_LINE_WIDTH,
        'line-offset': LANE_OFFSET_EXPR, // clicks land where the line is actually drawn
        // Fully transparent. MapLibre still includes it in click queries, because hit-testing uses
        // the line's geometry and width, not what's visible. (visibility: 'none' WOULD remove it.)
        'line-opacity': 0
      }
    },
    {
      id: 'route-points',
      type: 'circle',
      source: POINT_SOURCE_ID,
      paint: {
        'circle-color': '#ffffff', // white centre…
        'circle-stroke-color': ['get', 'color'], // …with a ring in the trip's colour
        'circle-stroke-width': 3,
        // Start/end dots are bigger than transfer dots.
        'circle-radius': ['match', ['get', 'kind'], 'transfer', 4, 6],
        'circle-opacity': OPACITY_EXPR,
        'circle-stroke-opacity': OPACITY_EXPR
      }
    }
  ];
}

/**
 * Layers that respond to clicks: only the invisible wide hit layer. The visible lines, the casing
 * and the dots are decoration. The web renderer passes this to react-map-gl's `interactiveLayerIds`.
 */
export function interactiveLayerIds(): string[] {
  return [HIT_LAYER_ID];
}
