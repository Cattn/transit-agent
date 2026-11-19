import { PlaceSchema, type Place } from '@transit/shared';
import { searchPlaces } from './gazetteer.js';

export interface PlaceSearcher {
  search(q: string, near?: [number, number]): Promise<Place[]>;
}

interface PhotonFeature {
  geometry?: { coordinates?: unknown };
  properties?: Record<string, unknown>;
}

const maxResults = 5;
const addressFetchLimit = 10;
const dedupeMeters = 150;
const addressNearbyMeters = 50_000;
const cacheTtlMs = 24 * 60 * 60 * 1000;
const cacheMax = 500;

function distanceMeters([lng1, lat1]: [number, number], [lng2, lat2]: [number, number]) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(a));
}

const coordinatePattern = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

export function coordinatePlace(q: string): Place | undefined {
  const match = coordinatePattern.exec(q);
  if (!match) return undefined;
  const result = PlaceSchema.safeParse({ name: `${match[1]}, ${match[2]}`, coordinates: [Number(match[2]), Number(match[1])], kind: 'address' });
  return result.success ? result.data : undefined;
}

const addressPattern = /^\s*\d+[a-z]?(?:[-/]\d+[a-z]?)?\s+\S/i;

/** A query that starts with a house number, such as "550 Huntington Ave". */
export function isAddressQuery(q: string) {
  return addressPattern.test(q);
}

function text(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function kindOf(props: Record<string, unknown>): Place['kind'] {
  const key = text(props.osm_key);
  const value = text(props.osm_value) ?? '';
  if (key === 'aeroway' && value === 'aerodrome') return 'airport';
  if ((key === 'railway' || key === 'public_transport') && /station|halt/.test(value)) return 'station';
  if ((key === 'highway' && value === 'bus_stop') || ((key === 'railway' || key === 'public_transport') && /stop|platform|tram/.test(value))) return 'stop';
  if (text(props.housenumber)) return 'address';
  return 'poi';
}

/**
 * With `preferAddress`, a feature that has a house number is named by its street address, not by
 * the business or building at it, so an address search lists the address the user typed.
 */
export function photonFeatureToPlace(feature: PhotonFeature, { preferAddress = false }: { preferAddress?: boolean } = {}): Place | undefined {
  const props = feature.properties ?? {};
  const street = text(props.street);
  const housenumber = text(props.housenumber);
  const address = street ? [housenumber, street].filter(Boolean).join(' ') : undefined;
  const asAddress = preferAddress && Boolean(housenumber && street);
  const base = asAddress ? address : text(props.name) ?? address;
  const area = text(props.city) ?? text(props.state);
  const name = base && area && area !== base ? `${base}, ${area}` : base;
  const result = PlaceSchema.safeParse({ name, coordinates: feature.geometry?.coordinates, kind: asAddress ? 'address' : kindOf(props) });
  return result.success ? result.data : undefined;
}

export function createPlaceSearcher({ photonUrl, fetch: fetchImpl = globalThis.fetch }: { photonUrl?: string; fetch?: typeof globalThis.fetch } = {}): PlaceSearcher {
  const cache = new Map<string, { at: number; places: Place[] }>();
  const baseUrl = photonUrl?.replace(/\/+$/, '');

  async function photon(q: string, near?: [number, number]): Promise<Place[]> {
    const key = `${q.toLowerCase().trim()}|${near ? near.map((n) => n.toFixed(2)).join(',') : ''}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < cacheTtlMs) return hit.places;
    cache.delete(key);
    const url = new URL(`${baseUrl}/api/`);
    url.searchParams.set('q', q);
    const addressMode = isAddressQuery(q);
    url.searchParams.set('limit', String(addressMode ? addressFetchLimit : maxResults));
    url.searchParams.set('lang', 'en');
    if (near) {
      url.searchParams.set('lat', String(near[1]));
      url.searchParams.set('lon', String(near[0]));
    }
    const res = await fetchImpl(url, { headers: { 'User-Agent': 'transit-agent' }, signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`Photon returned ${res.status}`);
    const body = (await res.json()) as { features?: PhotonFeature[] };
    if (!Array.isArray(body.features)) throw new Error('Photon response has no features');
    const mapped = body.features
      .map((feature) => photonFeatureToPlace(feature, { preferAddress: addressMode }))
      .filter((place): place is Place => Boolean(place));
    // Several businesses at one address collapse into a single result.
    let places = mapped.filter((place, index) => !mapped.slice(0, index).some((earlier) => earlier.name === place.name && distanceMeters(earlier.coordinates, place.coordinates) < dedupeMeters));
    // The same street number exists in many towns: once one is nearby, drop the distant ones.
    if (addressMode && near && places.some((place) => distanceMeters(place.coordinates, near) < addressNearbyMeters)) {
      places = places.filter((place) => distanceMeters(place.coordinates, near) < addressNearbyMeters);
    }
    cache.set(key, { at: Date.now(), places });
    while (cache.size > cacheMax) cache.delete(cache.keys().next().value!);
    return places;
  }

  return {
    async search(q, near) {
      const point = coordinatePlace(q);
      if (point) return [point];
      const local = searchPlaces(q).flatMap((place) => {
        const result = PlaceSchema.safeParse(place);
        return result.success ? [result.data] : [];
      });
      if (!baseUrl || q.trim().length < 3 || local.length >= maxResults) return local.slice(0, maxResults);
      let remote: Place[];
      try {
        remote = await photon(q.trim(), near);
      } catch (error) {
        console.warn('Photon place search failed; using the built-in place list', error);
        return local;
      }
      const extra = remote.filter((place) => !local.some((known) => distanceMeters(known.coordinates, place.coordinates) < dedupeMeters));
      return [...local, ...extra].slice(0, maxResults);
    }
  };
}
