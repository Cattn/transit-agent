import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import type { LngLat } from '@transit/shared';
import type { BuildPreview } from './contract.js';
import { metersBetween, type RouteFeatureProps } from './to-geojson.js';

export const REVEAL_PER_ROUTE_MS = 600;
export const REVEAL_STAGGER_MS = 150;
export const SEARCH_PULSE_PERIOD_MS = 1200;
export const SEARCH_PULSE_LENGTH = 0.25;

export type PreviewKind = 'candidate' | 'origin' | 'destination' | 'searching-track' | 'searching-pulse';

export interface PreviewFeatureProps {
  kind: PreviewKind;
}

export interface RevealOptions {
  perRouteMs?: number;
  staggerMs?: number;
  animate?: ReadonlySet<string>;
  order?: readonly string[];
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

function sliceBetween(coords: readonly LngLat[], from: number, to: number): LngLat[] {
  if (coords.length < 2) return [...coords];
  const steps = coords.slice(1).map((point, i) => metersBetween(coords[i]!, point));
  const total = steps.reduce((sum, step) => sum + step, 0);
  if (total === 0) return [coords[0]!, coords[0]!];
  const start = clamp01(from) * total;
  const end = Math.max(start, clamp01(to) * total);
  const at = (distance: number): LngLat => {
    let walked = 0;
    for (const [i, step] of steps.entries()) {
      if (distance <= walked + step && step > 0) {
        const t = (distance - walked) / step;
        const [lng0, lat0] = coords[i]!;
        const [lng1, lat1] = coords[i + 1]!;
        return [lng0 + (lng1 - lng0) * t, lat0 + (lat1 - lat0) * t];
      }
      walked += step;
    }
    return coords.at(-1)!;
  };
  const out: LngLat[] = [at(start)];
  let walked = 0;
  for (const [i, step] of steps.entries()) {
    walked += step;
    if (walked > start && walked < end) out.push(coords[i + 1]!);
  }
  out.push(at(end));
  return out;
}

export function sliceLine(coords: readonly LngLat[], fraction: number): LngLat[] {
  return sliceBetween(coords, 0, fraction);
}

export function revealFeatures(
  lines: FeatureCollection<LineString, RouteFeatureProps>,
  startedAt: number,
  now: number,
  { perRouteMs = REVEAL_PER_ROUTE_MS, staggerMs = REVEAL_STAGGER_MS, animate, order }: RevealOptions = {}
): { data: FeatureCollection<LineString, RouteFeatureProps>; finished: boolean } {
  const present = [...new Set(lines.features.map((f) => f.properties.itineraryId))];
  const ordered = order ? [...order.filter((id) => present.includes(id)), ...present.filter((id) => !order.includes(id))] : present;
  const animated = ordered.filter((id) => !animate || animate.has(id));
  const elapsed = now - startedAt;
  const finished = animated.length === 0 || elapsed >= staggerMs * (animated.length - 1) + perRouteMs;

  const lengthOf = (coords: readonly LngLat[]) => coords.slice(1).reduce((sum, p, i) => sum + metersBetween(coords[i]!, p), 0);
  const totals = new Map<string, number>();
  for (const f of lines.features) {
    const id = f.properties.itineraryId;
    totals.set(id, (totals.get(id) ?? 0) + lengthOf(f.geometry.coordinates as LngLat[]));
  }

  const budget = new Map(animated.map((id, k) => [id, clamp01((elapsed - k * staggerMs) / perRouteMs) * (totals.get(id) ?? 0)]));
  const features: Feature<LineString, RouteFeatureProps>[] = [];
  for (const f of lines.features) {
    const id = f.properties.itineraryId;
    const left = budget.get(id);
    if (left === undefined || finished) {
      features.push(f);
      continue;
    }
    const coords = f.geometry.coordinates as LngLat[];
    const length = lengthOf(coords);
    if (left <= 0) continue;
    budget.set(id, left - length);
    if (left >= length) features.push(f);
    else features.push({ ...f, geometry: { type: 'LineString', coordinates: sliceLine(coords, length === 0 ? 1 : left / length) } });
  }
  return { data: { type: 'FeatureCollection', features }, finished };
}

export function previewFeatures(
  preview: BuildPreview | undefined,
  now: number
): FeatureCollection<Point | LineString, PreviewFeatureProps> {
  const features: Feature<Point | LineString, PreviewFeatureProps>[] = [];
  if (!preview || preview.phase === 'idle' || preview.phase === 'drawing') return { type: 'FeatureCollection', features };
  const point = (coordinates: LngLat, kind: PreviewKind): Feature<Point, PreviewFeatureProps> => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates },
    properties: { kind }
  });
  const { origin, destination } = preview;
  if (preview.phase === 'searching' && origin && destination) {
    const track: LngLat[] = [origin, destination];
    const head = (now % SEARCH_PULSE_PERIOD_MS) / SEARCH_PULSE_PERIOD_MS;
    features.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: track }, properties: { kind: 'searching-track' } });
    features.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: sliceBetween(track, head - SEARCH_PULSE_LENGTH, head) },
      properties: { kind: 'searching-pulse' }
    });
  }
  if (preview.phase === 'locating') for (const c of preview.candidates ?? []) features.push(point(c, 'candidate'));
  if (origin) features.push(point(origin, 'origin'));
  if (destination) features.push(point(destination, 'destination'));
  return { type: 'FeatureCollection', features };
}
