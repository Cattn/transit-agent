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

const streetAbbreviations: Record<string, string> = {
  st: 'street', ave: 'avenue', av: 'avenue', rd: 'road', dr: 'drive', ln: 'lane', blvd: 'boulevard', pl: 'place', ct: 'court',
  ter: 'terrace', sq: 'square', hwy: 'highway', pkwy: 'parkway', cir: 'circle', n: 'north', s: 'south', e: 'east', w: 'west'
};
const streetTypes = new Set(['street', 'avenue', 'road', 'drive', 'lane', 'boulevard', 'place', 'court', 'terrace', 'square', 'highway', 'parkway', 'circle', 'way']);
const unitWords = new Set(['apt', 'apartment', 'unit', 'suite', 'ste', 'floor', 'fl', 'room', 'rm', '#']);
const houseNumberPattern = /^\d+[a-z]?(?:[-/]\d+[a-z]?)?$/;

const directions = new Set(['north', 'south', 'east', 'west']);

function words(value: string) {
  return value.toLowerCase().replace(/([#,])/g, ' $1 ').split(/[\s.;]+/).filter(Boolean);
}

function streetWord(word: string) {
  return streetAbbreviations[word] ?? word;
}

interface AddressCandidate {
  number: string;
  before: string[];
  after: string[];
}

interface AddressQuery {
  candidates: AddressCandidate[];
}

export function addressQuery(q: string): AddressQuery | undefined {
  const tokens = words(q);
  const candidates = tokens.flatMap((token, index) => {
    if (!houseNumberPattern.test(token) || unitWords.has(tokens[index - 1] ?? '')) return [];
    const after = tokens.slice(tokens[index + 1] === ',' ? index + 2 : index + 1);
    const end = tokens[index - 1] === ',' ? index - 1 : index;
    const start = tokens.lastIndexOf(',', end - 1) + 1;
    return [{ number: token, before: tokens.slice(start, end), after }];
  });
  return candidates.length ? { candidates } : undefined;
}

function startsWith(list: string[], prefix: string[], normalize: (word: string) => string = (word) => word) {
  return prefix.length > 0 && prefix.every((word, index) => list[index] !== undefined && normalize(list[index]) === word);
}

const countryWords = new Set(['us', 'usa']);

function localityFit(rest: string[], props: Record<string, unknown>): number {
  const phrases = ['city', 'district', 'locality', 'county', 'state', 'postcode', 'country']
    .flatMap((field) => { const name = text(props[field]); return name ? [{ words: words(name), city: field === 'city' }] : []; })
    .sort((x, y) => y.words.length - x.words.length);
  let cityHit = false;
  let afterComma = false;
  let consumed = false;
  for (let i = 0; i < rest.length;) {
    const token = rest[i]!;
    if (token === ',') { afterComma = true; consumed = true; i += 1; continue; }
    if (unitWords.has(token)) { consumed = true; i += 2; continue; }
    const phrase = phrases.find((candidate) => startsWith(rest.slice(i), candidate.words));
    if (phrase) {
      cityHit ||= phrase.city;
      consumed = true;
      i += phrase.words.length;
      continue;
    }
    const looksLikeStreet = streetTypes.has(streetWord(token)) || directions.has(streetWord(token));
    if (countryWords.has(token) || (/^[a-z]{2}$/.test(token) && (consumed || !looksLikeStreet))) { consumed = true; i += 1; continue; }
    if (!afterComma) return 0;
    const comma = rest.indexOf(',', i);
    i = comma < 0 ? rest.length : comma;
  }
  return cityHit ? 2 : 1;
}

function addressScore(query: AddressQuery | undefined, props: Record<string, unknown>): number {
  const housenumber = text(props.housenumber);
  const street = text(props.street);
  if (!query || !housenumber || !street) return 0;
  const number = housenumber.toLowerCase().replace(/\s+/g, '');
  const full = words(street).map(streetWord);
  const core = streetTypes.has(full.at(-1) ?? '') ? full.slice(0, -1) : full;
  return Math.max(0, ...query.candidates.filter((candidate) => candidate.number === number).flatMap(({ before, after }) => {
    const cityFirst = before.length > 0 && localityFit(before, props) === 2;
    return [
      ...[full, core].map((street) => {
        const fit = startsWith(after, street, streetWord) ? localityFit(after.slice(street.length), props) : 0;
        return fit && cityFirst ? 2 : fit;
      }),
      startsWith(before.slice(-full.length), full, streetWord) && !before.slice(0, -full.length).some((word) => houseNumberPattern.test(word)) ? localityFit(after, props) : 0
    ];
  }));
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

function toPlace(feature: PhotonFeature, query?: AddressQuery): { place: Place; score: number } | undefined {
  const props = feature.properties ?? {};
  const street = text(props.street);
  const housenumber = text(props.housenumber);
  const unit = text(props.unit);
  const address = street ? [housenumber, street].filter(Boolean).join(' ') + (unit ? ` #${unit}` : '') : undefined;
  const score = addressScore(query, props);
  const base = score ? address : text(props.name) ?? address;
  const area = text(props.city) ?? text(props.state);
  const name = base && area && area !== base ? `${base}, ${area}` : base;
  const result = PlaceSchema.safeParse({ name, coordinates: feature.geometry?.coordinates, kind: kindOf(props) });
  return result.success ? { place: result.data, score } : undefined;
}

export function photonFeatureToPlace(feature: PhotonFeature, q?: string): Place | undefined {
  return toPlace(feature, q === undefined ? undefined : addressQuery(q))?.place;
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
    const address = addressQuery(q);
    url.searchParams.set('limit', String(address ? addressFetchLimit : maxResults));
    url.searchParams.set('lang', 'en');
    if (near) {
      url.searchParams.set('lat', String(near[1]));
      url.searchParams.set('lon', String(near[0]));
    }
    const res = await fetchImpl(url, { headers: { 'User-Agent': 'transit-agent' }, signal: AbortSignal.timeout(3000) });
    if (!res.ok) throw new Error(`Photon returned ${res.status}`);
    const body = (await res.json()) as { features?: PhotonFeature[] };
    if (!Array.isArray(body.features)) throw new Error('Photon response has no features');
    const mapped = body.features.flatMap((feature) => toPlace(feature, address) ?? []);
    let rows = mapped.filter((row, index) => !row.score || !mapped.slice(0, index).some((earlier) => earlier.score && earlier.place.name === row.place.name && distanceMeters(earlier.place.coordinates, row.place.coordinates) < dedupeMeters));
    if (near && rows.some((row) => row.score && distanceMeters(row.place.coordinates, near) < addressNearbyMeters)) {
      rows = rows.filter((row) => row.score || distanceMeters(row.place.coordinates, near) < addressNearbyMeters);
    }
    const places = rows.map((row, index) => ({ row, index })).sort((x, y) => y.row.score - x.row.score || x.index - y.index).map(({ row }) => row.place);
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
