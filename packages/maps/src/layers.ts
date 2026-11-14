/**
 * Plan 009 step 3: the MapLibre style layers, shared by web and native.
 *
 * A "layer" tells MapLibre HOW to draw features from a source: line colour, width, dash, and
 * which features it applies to (filter). These are plain objects (style-spec JSON), so they live
 * in the pure package and both renderers reuse them.
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
  FOCUS_INK,
  LINE_WIDTH,
  LINE_WIDTH_ZOOMED_IN,
  LINE_WIDTH_ZOOMED_OUT,
  SELECTED_LINE_WIDTH,
  SELECTED_LINE_WIDTH_ZOOMED_IN,
  SELECTED_LINE_WIDTH_ZOOMED_OUT,
  UNFOCUSED_ROUTE_COLOR
} from './colors.js';
import type { Dash } from './to-geojson.js';

export const ROUTE_SOURCE_ID = 'routes';
export const POINT_SOURCE_ID = 'route-points';

/** A minimal style-spec layer type. It is compatible with react-map-gl's <Layer {...layer} />. */
export interface RouteLayer {
  id: string;
  type: 'line' | 'circle' | 'symbol';
  source: typeof ROUTE_SOURCE_ID | typeof POINT_SOURCE_ID;
  filter?: unknown[];
  layout?: Record<string, unknown>;
  paint: Record<string, unknown>;
}

const CASING_LAYER_ID = 'route-casing';
const HIT_LAYER_ID = 'route-hit';
export const END_ICON_ID = 'route-end-icon';
export type UnfocusedColors = 'grey' | 'trip' | 'mode';
export type MapVariant = 'saved' | 'choosing';
export const DEFAULT_ACCENT_COLOR = '#6750A4';
export const HOLLOW_START_RING_WIDTH = 3;
export const ORIGIN_DOT_RADIUS = 6;
export const DESTINATION_DOT_RADIUS = 9;
export const TRANSFER_DOT_RADIUS = 4;
export const MARKER_BORDER_WIDTH = 2;

/**
 * Width of the invisible click target, in pixels. The visible lines are only 3–7 px wide, which is
 * fiddly to hit with a mouse and very hard with a finger. 14 px gives about 7 px of slack each side.
 * Kept below about 1.5 × LANE_SPACING: wider, and a click on one lane would almost always also hit
 * its neighbour and open the picker.
 */
export const HIT_LINE_WIDTH = 14;
export const TOUCH_HIT_LINE_WIDTH = 34;

/** Dash patterns, measured in line widths: [dash length, gap length, ...]. Solid has none. */
const DASH_PATTERNS: Record<Dash, number[] | undefined> = {
  solid: undefined,
  dashed: [2, 1.5], // dash 2× the line width long, gap 1.5× wide
  dotted: [0.1, 2] // a near-zero dash plus a round cap draws a dot; gap of 2 widths between dots
};

/** Zoom levels the widths blend between: 5 ≈ several states on screen, 14 ≈ a neighbourhood. */
const ZOOMED_OUT = 5;
const CITY = 14;
const STREET = 17;

/**
 * Line width by zoom AND selection: thin when zoomed out, full width at city zoom, smoothly in between
 * (['interpolate', ['linear'], ['zoom'], …] blends linearly between the listed zoom levels). The selected
 * trip is always 2 px thicker.
 */
const LINE_WIDTH_EXPR = [
  'interpolate', ['linear'], ['zoom'],
  ZOOMED_OUT, ['case', ['get', 'selected'], SELECTED_LINE_WIDTH_ZOOMED_OUT, LINE_WIDTH_ZOOMED_OUT],
  CITY, ['case', ['get', 'selected'], SELECTED_LINE_WIDTH, LINE_WIDTH],
  STREET, ['case', ['get', 'selected'], SELECTED_LINE_WIDTH_ZOOMED_IN, LINE_WIDTH_ZOOMED_IN]
];

/** The white border under the selected trip: its line width + CASING_EXTRA_WIDTH, at every zoom. */
const CASING_WIDTH_EXPR = [
  'interpolate', ['linear'], ['zoom'],
  ZOOMED_OUT, SELECTED_LINE_WIDTH_ZOOMED_OUT + CASING_EXTRA_WIDTH,
  CITY, SELECTED_LINE_WIDTH + CASING_EXTRA_WIDTH,
  STREET, SELECTED_LINE_WIDTH_ZOOMED_IN + CASING_EXTRA_WIDTH
];

/** Fade every trip that isn't selected, including when nothing is selected: only the selected trip is in focus. */
const OPACITY_EXPR = ['case', ['get', 'selected'], 1, DIMMED_OPACITY];
const SELECTED_ON_TOP = ['case', ['get', 'selected'], 1, 0];

/** One line layer for one dash style. */
/**
 * One line layer for one dash style, drawing EITHER the unselected trips OR the selected trip.
 * The two halves are separate layers so the selected trip can be drawn after (on top of) every
 * unselected line, whatever their dash styles: line-sort-key only orders lines inside one layer.
 */
function unfocusedColor(unfocused: UnfocusedColors): unknown {
  if (unfocused === 'mode') return ['get', 'mainModeColor'];
  return unfocused === 'trip' ? ['get', 'color'] : UNFOCUSED_ROUTE_COLOR;
}

function markerColor(unfocused: UnfocusedColors): unknown {
  return unfocused === 'grey' ? ['case', ['get', 'selected'], FOCUS_INK, UNFOCUSED_ROUTE_COLOR] : unfocusedColor(unfocused);
}

interface Look {
  selectedLine: unknown;
  otherLine: unknown;
  marker: unknown;
  transferRing: unknown;
  opacity: unknown;
  hollowStart?: unknown;
  accent: string;
}

function look(unfocused: UnfocusedColors, variant: MapVariant, accent: string): Look {
  if (variant === 'choosing') {
    return {
      selectedLine: accent,
      otherLine: UNFOCUSED_ROUTE_COLOR,
      marker: ['case', ['get', 'selected'], accent, UNFOCUSED_ROUTE_COLOR],
      transferRing: accent,
      opacity: 1,
      hollowStart: ['all', ['==', ['get', 'kind'], 'origin'], ['get', 'selected']],
      accent
    };
  }
  return {
    selectedLine: ['get', 'modeColor'],
    otherLine: unfocusedColor(unfocused),
    marker: markerColor(unfocused),
    transferRing: ['get', 'modeColor'],
    opacity: OPACITY_EXPR,
    accent
  };
}

function dashLayer(dash: Dash, which: 'unselected' | 'selected', style: Look): RouteLayer {
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
      'line-color': ['case', ['get', 'selected'], style.selectedLine, style.otherLine],
      'line-width': LINE_WIDTH_EXPR,
      'line-opacity': style.opacity,
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
export function routeLayers({
  hitLineWidth = HIT_LINE_WIDTH,
  unfocused = 'grey',
  variant = 'saved',
  accentColor = DEFAULT_ACCENT_COLOR
}: { hitLineWidth?: number; unfocused?: UnfocusedColors; variant?: MapVariant; accentColor?: string } = {}): RouteLayer[] {
  const style = look(unfocused, variant, accentColor);
  const isTransfer = ['==', ['get', 'kind'], 'transfer'];
  const hollow = (whenHollow: unknown, otherwise: unknown) =>
    style.hollowStart ? ['case', style.hollowStart, whenHollow, otherwise] : otherwise;
  return [
    dashLayer('solid', 'unselected', style),
    dashLayer('dashed', 'unselected', style),
    dashLayer('dotted', 'unselected', style),
    {
      id: CASING_LAYER_ID,
      type: 'line',
      source: ROUTE_SOURCE_ID,
      filter: ['==', ['get', 'selected'], true], // only behind the selected trip
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': '#ffffff',
        'line-width': CASING_WIDTH_EXPR, // wider than the line, so a white border shows
      }
    },
    dashLayer('solid', 'selected', style),
    dashLayer('dashed', 'selected', style),
    dashLayer('dotted', 'selected', style),
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
        'line-width': hitLineWidth,
        // Fully transparent. MapLibre still includes it in click queries, because hit-testing uses
        // the line's geometry and width, not what's visible. (visibility: 'none' WOULD remove it.)
        'line-opacity': 0
      }
    },
    {
      id: 'route-points',
      type: 'circle',
      source: POINT_SOURCE_ID,
      layout: { 'circle-sort-key': SELECTED_ON_TOP },
      paint: {
        'circle-color': ['case', isTransfer, '#ffffff', hollow('#ffffff', style.marker)],
        'circle-stroke-color': ['case', isTransfer, style.transferRing, hollow(style.accent, '#ffffff')],
        'circle-stroke-width': ['case', isTransfer, ['case', ['get', 'selected'], 2.5, 0], hollow(HOLLOW_START_RING_WIDTH, MARKER_BORDER_WIDTH)],
        'circle-radius': [
          'match', ['get', 'kind'],
          'origin', ORIGIN_DOT_RADIUS,
          'destination', DESTINATION_DOT_RADIUS,
          ['case', ['get', 'selected'], TRANSFER_DOT_RADIUS, 0]
        ],
        'circle-opacity': style.opacity,
        'circle-stroke-opacity': style.opacity
      }
    },
    {
      id: END_ICON_ID,
      type: 'symbol',
      source: POINT_SOURCE_ID,
      filter: ['==', ['get', 'kind'], 'destination'],
      layout: {
        'icon-image': END_ICON_ID,
        'symbol-sort-key': SELECTED_ON_TOP,
        'icon-allow-overlap': true,
        'icon-ignore-placement': true
      },
      paint: {
        'icon-opacity': style.opacity
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
