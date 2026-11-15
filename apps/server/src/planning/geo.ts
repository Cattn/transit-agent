import type { LngLat } from '@transit/shared';

const EARTH_RADIUS_METERS = 6_371_008.8;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance between two [lng, lat] points, in meters. */
export function haversineMeters(a: LngLat, b: LngLat): number {
  const dLat = toRadians(b[1] - a[1]);
  const dLng = toRadians(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(a[1])) * Math.cos(toRadians(b[1])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Point at fraction `t` (0..1) between a and b. Linear in lng/lat, fine at city scale. */
export function interpolate(a: LngLat, b: LngLat, t: number): LngLat {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

/**
 * A gently curved polyline from a to b (perpendicular sine offset), so fixture routes
 * don't render as overlapping straight lines. Different seeds bend by different amounts/sides.
 * Deterministic: same inputs → same output.
 */
export function wobbleLine(a: LngLat, b: LngLat, points = 12, amplitude = 0.002, seed = 0): LngLat[] {
  const count = Math.max(2, Math.floor(points));
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = Math.hypot(dx, dy);
  const side = seed % 2 === 0 ? 1 : -1;
  const scale = amplitude * (1 + Math.floor(seed / 2) * 0.6) * side;
  // Unit perpendicular (in degree space); zero when a === b.
  const px = length === 0 ? 0 : -dy / length;
  const py = length === 0 ? 0 : dx / length;

  const line: LngLat[] = [];
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    if (i === 0) {
      line.push([a[0], a[1]]);
    } else if (i === count - 1) {
      line.push([b[0], b[1]]);
    } else {
      const [lng, lat] = interpolate(a, b, t);
      const offset = Math.sin(Math.PI * t) * scale;
      line.push([lng + px * offset, lat + py * offset]);
    }
  }
  return line;
}

export function decodePolyline(encoded: string, precision: number): LngLat[] {
  const factor = 10 ** precision;
  const points: LngLat[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const next = () => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      if (index >= encoded.length) throw new Error('Truncated polyline');
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (index < encoded.length) {
    lat += next();
    lng += next();
    points.push([lng / factor, lat / factor]);
  }
  return points;
}
