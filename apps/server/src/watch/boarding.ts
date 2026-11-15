import type { Leg, LngLat, WatchLocationReport } from '@transit/shared';
import { haversineMeters } from '../planning/geo.js';

const MINUTE_MS = 60_000;
const KEEP_MS = 30 * MINUTE_MS;
const MAX_POINTS = 20;
const SETTLE_MS = 2 * MINUTE_MS;
const STALE_MS = 5 * MINUTE_MS;
const ON_ROUTE_METERS = 75;
const MAX_TOLERANCE_METERS = 300;
const LEFT_STOP_METERS = 250;
const OFF_ROUTE_METERS = 400;

export interface LocationPoint {
  coordinates: LngLat;
  accuracyMeters?: number;
  atMs: number;
}

export type Boarding = 'boarded' | 'missed' | 'unknown';

export class TripLocations {
  private readonly points = new Map<string, LocationPoint[]>();
  private readonly expiry = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(private readonly now: () => Date = () => new Date()) {}

  report(deviceId: string, id: string, report: WatchLocationReport): void {
    const atMs = this.now().getTime();
    const key = JSON.stringify([deviceId, id]);
    const kept = (this.points.get(key) ?? []).filter((point) => atMs - point.atMs <= KEEP_MS);
    kept.push({ ...report, atMs });
    this.points.set(key, kept.slice(-MAX_POINTS));
    clearTimeout(this.expiry.get(key));
    const timer = setTimeout(() => this.forget(deviceId, id), KEEP_MS);
    timer.unref();
    this.expiry.set(key, timer);
  }

  recent(deviceId: string, id: string): LocationPoint[] {
    const nowMs = this.now().getTime();
    return (this.points.get(JSON.stringify([deviceId, id])) ?? []).filter((point) => nowMs - point.atMs <= KEEP_MS);
  }

  forget(deviceId: string, id: string): void {
    const key = JSON.stringify([deviceId, id]);
    clearTimeout(this.expiry.get(key));
    this.expiry.delete(key);
    this.points.delete(key);
  }
}

function metersToSegment(point: LngLat, a: LngLat, b: LngLat): number {
  const scale = Math.cos((point[1] * Math.PI) / 180);
  const ax = (a[0] - point[0]) * scale;
  const ay = a[1] - point[1];
  const bx = (b[0] - point[0]) * scale;
  const by = b[1] - point[1];
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
  const closest: LngLat = [point[0] + (ax + t * dx) / scale, point[1] + ay + t * dy];
  return haversineMeters(point, closest);
}

export function metersToLine(point: LngLat, line: LngLat[]): number {
  let best = Infinity;
  for (let index = 1; index < line.length; index++) best = Math.min(best, metersToSegment(point, line[index - 1]!, line[index]!));
  return best;
}

export function boardingFrom(leg: Leg, points: LocationPoint[], now: Date): Boarding {
  const settled = Date.parse(leg.departAt) + SETTLE_MS;
  const after = points.filter((point) => point.atMs >= settled && now.getTime() - point.atMs <= STALE_MS && (point.accuracyMeters ?? Infinity) <= 100);
  const latest = after[after.length - 1];
  if (!latest || now.getTime() - latest.atMs > STALE_MS) return 'unknown';
  const tolerance = (point: LocationPoint) => Math.min(MAX_TOLERANCE_METERS, Math.max(ON_ROUTE_METERS, point.accuracyMeters ?? 0));
  const fromStop = (point: LocationPoint) => haversineMeters(point.coordinates, leg.from.coordinates);
  const fromRoute = (point: LocationPoint) => metersToLine(point.coordinates, leg.geometry.coordinates);
  const first = after[0];
  if (!first || latest.atMs - first.atMs < 30_000) return 'unknown';
  const travel = haversineMeters(first.coordinates, latest.coordinates);
  const speed = travel / ((latest.atMs - first.atMs) / 1000);
  if (after.length >= 2 && fromRoute(first) <= tolerance(first) && fromRoute(latest) <= tolerance(latest)
    && fromStop(latest) > LEFT_STOP_METERS && fromStop(latest) > fromStop(first) + 100 && speed >= 3 && speed <= 60) return 'boarded';
  if (after.every((point) => fromStop(point) <= tolerance(point)) || after.every((point) => fromRoute(point) > OFF_ROUTE_METERS)) return 'missed';
  return 'unknown';
}
