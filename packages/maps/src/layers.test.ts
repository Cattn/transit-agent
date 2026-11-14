import { describe, expect, it } from 'vitest';
import {
  CASING_EXTRA_WIDTH,
  FOCUS_INK,
  LANE_SPACING,
  LINE_WIDTH,
  LINE_WIDTH_ZOOMED_IN,
  SELECTED_LINE_WIDTH,
  SELECTED_LINE_WIDTH_ZOOMED_IN,
  UNFOCUSED_ROUTE_COLOR
} from './colors.js';
import {
  DESTINATION_DOT_RADIUS,
  END_ICON_ID,
  HIT_LINE_WIDTH,
  HOLLOW_START_RING_WIDTH,
  MARKER_BORDER_WIDTH,
  ORIGIN_DOT_RADIUS,
  POINT_SOURCE_ID,
  ROUTE_SOURCE_ID,
  TOUCH_HIT_LINE_WIDTH,
  interactiveLayerIds,
  routeLayers
} from './layers.js';
import { evaluate, matchesFilter, type FeatureProps } from './test-helpers/style-expressions.js';
import type { RouteFeatureProps, RoutePointProps } from './to-geojson.js';

const ROUTE_KEYS = ['itineraryId', 'legId', 'mode', 'color', 'modeColor', 'mainModeColor', 'dash', 'selected', 'dimmed', 'sortKey', 'lane', 'direction'] satisfies Array<keyof RouteFeatureProps>;
const POINT_KEYS = ['itineraryId', 'kind', 'name', 'color', 'mainModeColor', 'modeColor', 'selected', 'dimmed'] satisfies Array<keyof RoutePointProps>;

/** Collect X from every ['get', X] expression anywhere inside a value. */
function getKeys(value: unknown, out: string[] = []): string[] {
  if (Array.isArray(value)) {
    if (value[0] === 'get' && typeof value[1] === 'string') out.push(value[1]);
    value.forEach((v) => getKeys(v, out));
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((v) => getKeys(v, out));
  }
  return out;
}

const dashLayer = (dash: string) =>
  routeLayers().find((l) => l.type === 'line' && JSON.stringify(l.filter ?? []).includes('"dash"') && JSON.stringify(l.filter).includes(`"${dash}"`));

describe('routeLayers', () => {
  it('has unique ids', () => {
    const ids = routeLayers().map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has one line layer per dash style: mode colours in focus, grey out of focus by default', () => {
    for (const dash of ['solid', 'dashed', 'dotted']) {
      const layer = dashLayer(dash);
      expect(layer, `missing a line layer filtered on dash = ${dash}`).toBeDefined();
      expect(layer!.source).toBe(ROUTE_SOURCE_ID);
      const color = layer!.paint['line-color'];
      expect(evaluate(color, { selected: true, modeColor: '#2563eb', color: '#db2777' })).toBe('#2563eb');
      expect(evaluate(color, { selected: false, modeColor: '#2563eb', color: '#db2777' })).toBe(UNFOCUSED_ROUTE_COLOR);
    }
  });

  it('can colour each route out of focus by the mode it uses most, so it keeps that colour when selected', () => {
    const layer = routeLayers({ unfocused: 'mode' }).find((l) => l.id === 'route-solid')!;
    expect(evaluate(layer.paint['line-color'], { selected: false, modeColor: '#6b7280', mainModeColor: '#7c3aed' })).toBe('#7c3aed');
  });

  it("can colour routes out of focus with each trip's own colour instead", () => {
    const layer = routeLayers({ unfocused: 'trip' }).find((l) => l.id === 'route-solid')!;
    expect(evaluate(layer.paint['line-color'], { selected: false, modeColor: '#2563eb', color: '#db2777' })).toBe('#db2777');
    expect(evaluate(layer.paint['line-color'], { selected: true, modeColor: '#2563eb', color: '#db2777' })).toBe('#2563eb');
  });


  it('has a circle layer for endpoint/transfer points', () => {
    expect(routeLayers().some((l) => l.type === 'circle' && l.source === POINT_SOURCE_ID)).toBe(true);
  });

  it('only reads properties that the features actually have', () => {
    for (const layer of [...routeLayers(), ...routeLayers({ unfocused: 'trip' }), ...routeLayers({ unfocused: 'mode' })]) {
      const allowed: string[] = layer.source === ROUTE_SOURCE_ID ? ROUTE_KEYS : POINT_KEYS;
      for (const key of getKeys([layer.filter, layer.paint, layer.layout])) {
        expect(allowed, `layer "${layer.id}" reads unknown property "${key}"`).toContain(key);
      }
    }
  });
});

describe('selected trip draws on top (PR #35 review, issue 1)', () => {
  // MapLibre draws whole layers in order; line-sort-key only sorts WITHIN a layer. So "selected on top"
  // must hold across layers: every layer that can draw a selected line must come after every layer
  // that can draw an unselected one, whatever the two lines' dash styles are.
  const layers = routeLayers();
  const visibleLines = layers.filter((l) => l.type === 'line' && l.source === ROUTE_SOURCE_ID && !interactiveLayerIds().includes(l.id));
  const selected = (dash: string): FeatureProps => ({ selected: true, dimmed: false, dash });
  const unselected = (dash: string): FeatureProps => ({ selected: false, dimmed: true, dash });
  const indicesDrawing = (props: FeatureProps) =>
    visibleLines.filter((l) => matchesFilter(l.filter, props)).map((l) => layers.indexOf(l));
  const DASHES = ['solid', 'dashed', 'dotted'];

  it('every dash style is drawn both when selected and when not', () => {
    for (const dash of DASHES) {
      expect(indicesDrawing(selected(dash)).length, `selected ${dash}`).toBeGreaterThan(0);
      expect(indicesDrawing(unselected(dash)).length, `unselected ${dash}`).toBeGreaterThan(0);
    }
  });

  it('a selected line (and its white casing) is above every unselected line, for every pair of dash styles', () => {
    for (const selDash of DASHES) {
      for (const otherDash of DASHES) {
        const lowestSelected = Math.min(...indicesDrawing(selected(selDash)));
        const highestUnselected = Math.max(...indicesDrawing(unselected(otherDash)));
        expect(lowestSelected, `selected ${selDash} vs unselected ${otherDash}`).toBeGreaterThan(highestUnselected);
      }
    }
  });

  it('the casing sits directly under the selected lines, not above them', () => {
    const casing = layers.findIndex((l) => l.id.includes('casing'));
    expect(casing).toBeGreaterThanOrEqual(0);
    for (const dash of DASHES) {
      const selectedLine = indicesDrawing(selected(dash)).filter((i) => i !== casing);
      expect(Math.min(...selectedLine), `selected ${dash}`).toBeGreaterThan(casing);
    }
  });
});

describe('routes are drawn on their real street', () => {
  it('no line layer shifts lines sideways, so legs join up and markers sit on the lines at every zoom', () => {
    for (const layer of routeLayers({ hitLineWidth: TOUCH_HIT_LINE_WIDTH })) {
      expect(layer.paint['line-offset'], `layer "${layer.id}"`).toBeUndefined();
    }
  });

  it('the mouse click target stays narrow, so a click on one route rarely also catches its neighbour', () => {
    const hit = routeLayers().find((l) => l.id === interactiveLayerIds()[0])!;
    expect(hit.paint['line-width']).toBeLessThanOrEqual(1.5 * LANE_SPACING);
  });
});

describe('interactiveLayerIds', () => {
  it('is a single invisible line layer, wider than the visible lines, covering every route', () => {
    const ids = interactiveLayerIds();
    expect(ids).toHaveLength(1);
    const hit = routeLayers().find((l) => l.id === ids[0])!;
    expect(hit.type).toBe('line');
    expect(hit.source).toBe(ROUTE_SOURCE_ID);
    expect(hit.filter).toBeUndefined(); // no filter: every leg of every visible trip is clickable
    expect(hit.paint['line-opacity']).toBe(0);
    expect(hit.paint['line-width']).toBe(HIT_LINE_WIDTH);
    expect(HIT_LINE_WIDTH).toBeGreaterThan(SELECTED_LINE_WIDTH + CASING_EXTRA_WIDTH);
  });
});

describe('touch-sized hit area (plan 009 step 4)', () => {
  const hitOf = (layers: ReturnType<typeof routeLayers>) => layers.find((l) => l.id === interactiveLayerIds()[0])!;
  const touch = routeLayers({ hitLineWidth: TOUCH_HIT_LINE_WIDTH });

  it('keeps the mouse default unchanged when no width is given', () => {
    expect(routeLayers({})).toEqual(routeLayers());
    expect(hitOf(routeLayers()).paint['line-width']).toBe(HIT_LINE_WIDTH);
  });

  it('only widens the hit layer: same layers, same order, everything else identical', () => {
    const mouse = routeLayers();
    expect(touch.map((l) => l.id)).toEqual(mouse.map((l) => l.id));
    for (const [i, layer] of touch.entries()) {
      if (layer.id === interactiveLayerIds()[0]) continue;
      expect(layer).toEqual(mouse[i]);
    }
    expect(hitOf(touch).paint['line-width']).toBe(TOUCH_HIT_LINE_WIDTH);
  });

  it('is finger sized: catches a tap at least 16 px either side of the route', () => {
    expect(TOUCH_HIT_LINE_WIDTH / 2).toBeGreaterThanOrEqual(16);
  });

  it('is invisible and sits exactly on the drawn route', () => {
    const hit = hitOf(touch);
    expect(hit.paint['line-offset']).toBeUndefined();
    expect(hit.paint['line-opacity']).toBe(0);
  });
});

describe('zooming in makes routes bigger', () => {
  const layers = routeLayers();
  const width = layers[0]!.paint['line-width'];
  const casing = layers.find((l) => JSON.stringify(l.paint['line-color']) === '"#ffffff"')!;
  const at = (expr: unknown, props: FeatureProps, zoom: number) => Number(evaluate(expr, props, zoom));

  it('lines keep growing past neighbourhood zoom, up to street zoom', () => {
    expect(at(width, { selected: false }, 14)).toBe(LINE_WIDTH);
    expect(at(width, { selected: false }, 17)).toBe(LINE_WIDTH_ZOOMED_IN);
    expect(at(width, { selected: true }, 17)).toBe(SELECTED_LINE_WIDTH_ZOOMED_IN);
    expect(at(width, { selected: false }, 15.5)).toBeGreaterThan(LINE_WIDTH);
    expect(at(width, { selected: false }, 15.5)).toBeLessThan(LINE_WIDTH_ZOOMED_IN);
  });

  it('the white border grows with the selected line', () => {
    expect(at(casing.paint['line-width'], {}, 17)).toBe(SELECTED_LINE_WIDTH_ZOOMED_IN + CASING_EXTRA_WIDTH);
  });
});

describe('start and end markers (mockup: small dot at the start, bigger circle with an icon at the end)', () => {
  const layers = routeLayers();
  const dots = layers.find((l) => l.id === 'route-points')!;
  const icon = layers.find((l) => l.id === END_ICON_ID)!;
  const point = (kind: string, extra: FeatureProps = {}): FeatureProps => ({ kind, color: '#db2777', selected: false, dimmed: false, ...extra });

  it('draws the start as a solid dot with a white border, and the end as a bigger one', () => {
    for (const selected of [true, false]) {
      expect(evaluate(dots.paint['circle-radius'], point('origin', { selected }))).toBe(ORIGIN_DOT_RADIUS);
      expect(evaluate(dots.paint['circle-radius'], point('destination', { selected }))).toBe(DESTINATION_DOT_RADIUS);
      for (const kind of ['origin', 'destination']) {
        expect(evaluate(dots.paint['circle-stroke-color'], point(kind, { selected }))).toBe('#ffffff');
        expect(evaluate(dots.paint['circle-stroke-width'], point(kind, { selected }))).toBe(MARKER_BORDER_WIDTH);
      }
    }
    expect(DESTINATION_DOT_RADIUS).toBeGreaterThan(ORIGIN_DOT_RADIUS);
  });

  it('colours start and end like their trip: dark or grey with grey routes, the main mode colour with mode colours', () => {
    expect(evaluate(dots.paint['circle-color'], point('origin', { selected: true }))).toBe(FOCUS_INK);
    expect(evaluate(dots.paint['circle-color'], point('destination'))).toBe(UNFOCUSED_ROUTE_COLOR);
    const byMode = routeLayers({ unfocused: 'mode' }).find((l) => l.id === 'route-points')!;
    for (const selected of [true, false]) {
      for (const kind of ['origin', 'destination']) {
        expect(evaluate(byMode.paint['circle-color'], point(kind, { selected, mainModeColor: '#7c3aed' }))).toBe('#7c3aed');
      }
    }
  });

  it('shows transfers on the selected trip as white dots ringed in the colour of the leg you switch onto', () => {
    const focused = point('transfer', { selected: true, modeColor: '#ea580c' });
    expect(evaluate(dots.paint['circle-color'], focused)).toBe('#ffffff');
    expect(evaluate(dots.paint['circle-stroke-color'], focused)).toBe('#ea580c');
    expect(evaluate(dots.paint['circle-stroke-width'], focused)).toBeGreaterThan(0);
    expect(evaluate(dots.paint['circle-radius'], focused)).toBeGreaterThan(0);
    expect(evaluate(dots.paint['circle-radius'], point('transfer'))).toBe(0);
    expect(evaluate(dots.paint['circle-stroke-width'], point('transfer')), 'no leftover ring speck').toBe(0);
  });

  it('puts the icon only on end points, drawn after (on top of) the dots, fading with its trip', () => {
    expect(icon.type).toBe('symbol');
    expect(icon.source).toBe(POINT_SOURCE_ID);
    expect(icon.layout!['icon-image']).toBe(END_ICON_ID);
    expect(matchesFilter(icon.filter, point('destination'))).toBe(true);
    expect(matchesFilter(icon.filter, point('origin'))).toBe(false);
    expect(matchesFilter(icon.filter, point('transfer'))).toBe(false);
    expect(layers.indexOf(icon)).toBeGreaterThan(layers.indexOf(dots));
    expect(evaluate(icon.paint['icon-opacity'], point('destination', { dimmed: true }))).toBeLessThan(1);
  });
});

describe('only the selected trip is in focus', () => {
  const layers = routeLayers({ unfocused: 'mode' });
  const line = layers.find((l) => l.id === 'route-solid')!;
  const dots = layers.find((l) => l.id === 'route-points')!;
  const icon = layers.find((l) => l.id === END_ICON_ID)!;

  it('fades every trip when the map first shows, before anything is selected', () => {
    const atLoad = { selected: false, dimmed: false, kind: 'origin', mainModeColor: '#7c3aed' };
    const otherSelected = { ...atLoad, dimmed: true };
    expect(evaluate(line.paint['line-opacity'], atLoad)).toBeLessThan(1);
    expect(evaluate(line.paint['line-opacity'], atLoad)).toBe(evaluate(line.paint['line-opacity'], otherSelected));
    expect(evaluate(dots.paint['circle-opacity'], atLoad)).toBeLessThan(1);
  });

  it('draws the selected trip at full strength', () => {
    const selectedLine = layers.find((l) => l.id === 'route-solid-selected')!;
    expect(evaluate(selectedLine.paint['line-opacity'], { selected: true, dimmed: false })).toBe(1);
  });

  it('draws the selected trip\'s start and end on top when trips share the same start or end', () => {
    for (const [layer, key] of [[dots, 'circle-sort-key'], [icon, 'symbol-sort-key']] as const) {
      const sortKey = layer.layout![key];
      expect(Number(evaluate(sortKey, { selected: true }))).toBeGreaterThan(Number(evaluate(sortKey, { selected: false })));
    }
  });
});

describe('choosing look for search results (Figma frame 02)', () => {
  const accent = '#6750A4';
  const layers = routeLayers({ variant: 'choosing', accentColor: accent });
  const solid = layers.find((l) => l.id === 'route-solid')!;
  const selectedSolid = layers.find((l) => l.id === 'route-solid-selected')!;
  const dotted = layers.find((l) => l.id === 'route-dotted-selected')!;
  const dots = layers.find((l) => l.id === 'route-points')!;
  const point = (kind: string, selected: boolean): FeatureProps => ({ kind, selected, dimmed: !selected, modeColor: '#ea580c', mainModeColor: '#ea580c', color: '#db2777' });

  it('draws the selected option in one accent colour, whatever its modes', () => {
    for (const modeColor of ['#ea580c', '#7c3aed', '#6b7280']) {
      expect(evaluate(selectedSolid.paint['line-color'], { selected: true, modeColor })).toBe(accent);
    }
    expect(evaluate(dotted.paint['line-color'], { selected: true, modeColor: '#6b7280' })).toBe(accent);
  });

  it('draws the other options in plain grey at full strength, not faded', () => {
    expect(evaluate(solid.paint['line-color'], { selected: false, modeColor: '#ea580c', mainModeColor: '#ea580c' })).toBe(UNFOCUSED_ROUTE_COLOR);
    expect(evaluate(solid.paint['line-opacity'], { selected: false, dimmed: true })).toBe(1);
  });

  it('marks the start of the selected option with a hollow ring in the accent colour', () => {
    expect(evaluate(dots.paint['circle-color'], point('origin', true))).toBe('#ffffff');
    expect(evaluate(dots.paint['circle-stroke-color'], point('origin', true))).toBe(accent);
    expect(evaluate(dots.paint['circle-stroke-width'], point('origin', true))).toBe(HOLLOW_START_RING_WIDTH);
  });

  it('draws the end and the transfers of the selected option in the accent colour', () => {
    expect(evaluate(dots.paint['circle-color'], point('destination', true))).toBe(accent);
    expect(evaluate(dots.paint['circle-stroke-color'], point('transfer', true))).toBe(accent);
  });

  it('keeps the start and end of the other options grey and solid', () => {
    for (const kind of ['origin', 'destination']) {
      expect(evaluate(dots.paint['circle-color'], point(kind, false))).toBe(UNFOCUSED_ROUTE_COLOR);
      expect(evaluate(dots.paint['circle-stroke-color'], point(kind, false))).toBe('#ffffff');
    }
  });

  it('leaves the saved look exactly as it was when no variant is given', () => {
    expect(routeLayers()).toEqual(routeLayers({ variant: 'saved' }));
  });
});

describe('hidden transfer dots leave nothing behind', () => {
  it('draws no ring for transfers of trips that are not selected, in both looks', () => {
    for (const variant of ['saved', 'choosing'] as const) {
      const dots = routeLayers({ variant, unfocused: 'mode' }).find((l) => l.id === 'route-points')!;
      const hidden = { kind: 'transfer', selected: false, dimmed: false, modeColor: '#ea580c', mainModeColor: '#7c3aed' };
      expect(evaluate(dots.paint['circle-radius'], hidden), variant).toBe(0);
      expect(evaluate(dots.paint['circle-stroke-width'], hidden), variant).toBe(0);
    }
  });
});
