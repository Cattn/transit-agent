import { describe, expect, it } from 'vitest';
import { CASING_EXTRA_WIDTH, LANE_SPACING, SELECTED_LINE_WIDTH } from './colors.js';
import { HIT_LINE_WIDTH, POINT_SOURCE_ID, ROUTE_SOURCE_ID, interactiveLayerIds, routeLayers } from './layers.js';
import type { RouteFeatureProps, RoutePointProps } from './to-geojson.js';

const ROUTE_KEYS = ['itineraryId', 'legId', 'mode', 'color', 'dash', 'selected', 'dimmed', 'sortKey', 'lane'] satisfies Array<keyof RouteFeatureProps>;
const POINT_KEYS = ['itineraryId', 'kind', 'name', 'color', 'selected', 'dimmed'] satisfies Array<keyof RoutePointProps>;

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

  it('has one line layer per dash style, coloured by the feature', () => {
    for (const dash of ['solid', 'dashed', 'dotted']) {
      const layer = dashLayer(dash);
      expect(layer, `missing a line layer filtered on dash = ${dash}`).toBeDefined();
      expect(layer!.source).toBe(ROUTE_SOURCE_ID);
      expect(layer!.paint['line-color']).toEqual(['get', 'color']);
    }
  });

  it('draws a casing under the route lines', () => {
    const layers = routeLayers();
    const casing = layers.findIndex((l) => l.id.includes('casing'));
    expect(casing).toBeGreaterThanOrEqual(0);
    for (const dash of ['solid', 'dashed', 'dotted']) {
      const lineIndex = layers.findIndex((l) => l.id === dashLayer(dash)?.id);
      expect(lineIndex, `missing a line layer for dash = ${dash}`).toBeGreaterThanOrEqual(0);
      expect(casing).toBeLessThan(lineIndex);
    }
  });

  it('has a circle layer for endpoint/transfer points', () => {
    expect(routeLayers().some((l) => l.type === 'circle' && l.source === POINT_SOURCE_ID)).toBe(true);
  });

  it('only reads properties that the features actually have', () => {
    for (const layer of routeLayers()) {
      const allowed: string[] = layer.source === ROUTE_SOURCE_ID ? ROUTE_KEYS : POINT_KEYS;
      for (const key of getKeys([layer.filter, layer.paint, layer.layout])) {
        expect(allowed, `layer "${layer.id}" reads unknown property "${key}"`).toContain(key);
      }
    }
  });
});

describe('lanes (side-by-side routes)', () => {
  it('every route line layer (casing, visible lines, hit line) is shifted by lane × LANE_SPACING', () => {
    for (const layer of routeLayers().filter((l) => l.type === 'line')) {
      expect(layer.paint['line-offset'], `layer "${layer.id}"`).toEqual(['*', ['get', 'lane'], LANE_SPACING]);
    }
  });

  it('leaves a visible gap between neighbouring lanes at every zoom', () => {
    // widest visible line is the selected one at city zoom
    expect(LANE_SPACING - SELECTED_LINE_WIDTH).toBeGreaterThanOrEqual(3);
  });

  it('the click target is not so wide that every click hits the neighbouring lane too', () => {
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
