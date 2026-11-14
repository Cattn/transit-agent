// Regenerates packages/maps/src/samples.ts (the example routes) from real routes.
// Fetches transit from Transitous and drive/bike/walk from the public OSRM servers, so it needs internet.
// Usage (from the repo root): node packages/maps/scripts/gen-samples.mjs packages/maps/src/samples.ts
// Then run: npm run test:unit -w @transit/maps (the tests rely on the shapes noted in the samples header).
import { writeFileSync } from 'node:fs';

const OUT = process.argv[2];
const UA = { 'User-Agent': 'transit-demo-fixture-generator/0.1' };
const QUERY_TIME = '2026-11-16T13:30:00Z'; // Monday 8:30 AM Boston time
const FETCHED_AT = '2026-11-14T05:00:00Z';

// ---------- helpers ----------
function decode(encoded, precision) {
  const f = 10 ** precision; const out = []; let i = 0, lat = 0, lng = 0;
  while (i < encoded.length) {
    const v = [];
    for (let k = 0; k < 2; k++) { let r = 0, s = 0, b; do { b = encoded.charCodeAt(i++) - 63; r |= (b & 0x1f) << s; s += 5; } while (b >= 0x20); v.push(r & 1 ? ~(r >> 1) : r >> 1); }
    lat += v[0]; lng += v[1]; out.push([lng / f, lat / f]);
  }
  return out;
}
const round = (p) => [Math.round(p[0] * 1e5) / 1e5, Math.round(p[1] * 1e5) / 1e5];
/** Keep at most `max` points (always first + last), and drop consecutive duplicates. */
function simplify(points, max = 60) {
  const r = points.map(round).filter((p, i, a) => i === 0 || p[0] !== a[i - 1][0] || p[1] !== a[i - 1][1]);
  if (r.length <= max) return r.length >= 2 ? r : [r[0], r[0]];
  const step = (r.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => r[Math.round(i * step)]);
}
const MODE = (m) => ({ WALK: 'walk', BIKE: 'bike', BUS: 'bus', COACH: 'bus', TRAM: 'rail', SUBWAY: 'rail', METRO: 'rail', RAIL: 'rail', REGIONAL_RAIL: 'rail', SUBURBAN: 'rail', FERRY: 'ferry', CAR: 'car', AIRPLANE: 'flight' }[m] ?? (() => { throw new Error('unknown mode ' + m); })());
const minutes = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 60000);
const iso = (ms) => new Date(ms).toISOString().replace('.000Z', 'Z');

async function osrm(profileUrl, from, to) {
  const res = await fetch(`${profileUrl}/${from.join(',')};${to.join(',')}?overview=full&geometries=geojson`, { headers: UA });
  const d = await res.json(); if (d.code !== 'Ok') throw new Error('osrm ' + d.code);
  return d.routes[0];
}

/** Readable line names: 'Bus 1' instead of '1', 'Yellow Line' instead of 'Y'. */
function niceName(mode, l) {
  const short = l.routeShortName || l.displayName || '';
  if (mode === 'bus') return /^[A-Z]*\d+[A-Z]*$/i.test(short) ? `Bus ${short}` : short || l.routeLongName;
  // Rail: short names are often a letter ('R') or a train number ('6009'); the long name reads better.
  if ((short.length <= 2 || /^\d{3,}$/.test(short)) && l.routeLongName) return /line/i.test(l.routeLongName) ? l.routeLongName : `${l.routeLongName} Line`;
  return short || l.routeLongName;
}

/** Convert a MOTIS leg into our contract Leg. */
function motisLeg(id, l, nameOverride = {}) {
  const mode = MODE(l.mode);
  const transit = ['bus', 'rail', 'ferry'].includes(mode);
  return {
    id, mode,
    from: { name: nameOverride.from ?? l.from.name, coordinates: round([l.from.lon, l.from.lat]), ...(l.from.stopId ? { kind: 'stop', code: l.from.stopId } : {}) },
    to: { name: nameOverride.to ?? l.to.name, coordinates: round([l.to.lon, l.to.lat]), ...(l.to.stopId ? { kind: 'stop', code: l.to.stopId } : {}) },
    departAt: l.startTime, arriveAt: l.endTime,
    durationMinutes: Math.max(1, minutes(l.startTime, l.endTime)),
    ...(l.distance ? { distanceMeters: Math.round(l.distance) } : {}),
    geometry: { type: 'LineString', coordinates: simplify(decode(l.legGeometry.points, l.legGeometry.precision)) },
    timeSource: transit ? 'scheduled' : 'estimated',
    ...(transit ? { routeName: niceName(mode, l), agency: l.agencyName } : {})
  };
}

const FARE = { bus: 1.7, rail: 2.4, ferry: 2.4 };
function finish(id, legs, provider, extras = {}) {
  // fix up START/END names, transfer buffers
  let prevTransit = null;
  for (const leg of legs) {
    if (['bus', 'rail', 'ferry', 'flight'].includes(leg.mode)) {
      if (prevTransit) leg.transferBufferMinutes = minutes(prevTransit.arriveAt, leg.departAt);
      prevTransit = leg;
    }
  }
  const transitLegs = legs.filter((l) => ['bus', 'rail', 'ferry', 'flight'].includes(l.mode));
  const fareLines = transitLegs.filter((l) => FARE[l.mode]).map((l) => ({ label: `Fare (${l.routeName})`, usd: FARE[l.mode], estimated: true }));
  const lines = [...fareLines, ...(extras.costLines ?? [])];
  const summary = legs.map((l) => l.mode === 'walk' ? `walk ${l.durationMinutes} min` : l.mode === 'bike' ? `bike ${l.durationMinutes} min` : l.mode === 'car' ? `drive ${l.durationMinutes} min` : l.routeName).join(' → ');
  return {
    id, legs,
    departAt: legs[0].departAt, arriveAt: legs.at(-1).arriveAt,
    durationMinutes: minutes(legs[0].departAt, legs.at(-1).arriveAt),
    transfers: Math.max(0, transitLegs.length - 1),
    walkMinutes: legs.filter((l) => l.mode === 'walk').reduce((s, l) => s + l.durationMinutes, 0),
    cost: { totalUsd: Math.round(lines.reduce((s, c) => s + c.usd, 0) * 100) / 100, lines },
    risk: extras.risk ?? { level: 'low', reasons: [] },
    violations: [],
    summary: summary.charAt(0).toUpperCase() + summary.slice(1),
    source: { provider, fetchedAt: FETCHED_AT }
  };
}

// Great-circle arc between two [lng, lat] points (spherical interpolation), n points.
function greatCircle(a, b, n = 64) {
  const rad = Math.PI / 180, toV = ([lng, lat]) => [Math.cos(lat * rad) * Math.cos(lng * rad), Math.cos(lat * rad) * Math.sin(lng * rad), Math.sin(lat * rad)];
  const A = toV(a), B = toV(b), d = Math.acos(A[0] * B[0] + A[1] * B[1] + A[2] * B[2]);
  return Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1), s1 = Math.sin((1 - t) * d) / Math.sin(d), s2 = Math.sin(t * d) / Math.sin(d);
    const v = [s1 * A[0] + s2 * B[0], s1 * A[1] + s2 * B[1], s1 * A[2] + s2 * B[2]];
    return round([Math.atan2(v[1], v[0]) / rad, Math.atan2(v[2], Math.hypot(v[0], v[1])) / rad]);
  });
}

// ---------- scenario helpers ----------
const MIT = [-71.0905, 42.3616];
const SOUTH_STATION = [-71.0552, 42.3523];
const AIRPORTS = {
  BOS: { name: 'Boston Logan (BOS)', terminal: [-71.0167, 42.3631], runway: [-71.0052, 42.3656] },
  PVD: { name: 'Providence T.F. Green (PVD)', terminal: [-71.4332, 41.7267], runway: [-71.4280, 41.7240] },
  MHT: { name: 'Manchester-Boston (MHT)', terminal: [-71.4357, 42.9326], runway: [-71.4357, 42.9326] },
  MCO: { name: 'Orlando International (MCO)', terminal: [-81.3089, 28.4312], runway: [-81.3089, 28.4312] },
  SFB: { name: 'Orlando Sanford (SFB)', terminal: [-81.2375, 28.7776], runway: [-81.2375, 28.7776] }
};
const DOWNTOWN_ORLANDO = [-81.3731, 28.5432];

/** One leg driven by car, from OSRM, starting at `startMs`. */
async function carLeg(id, from, to, startMs) {
  const r = await osrm('https://router.project-osrm.org/route/v1/driving', from.coordinates, to.coordinates);
  const mins = Math.round(r.duration / 60);
  return { id, mode: 'car', from, to, departAt: iso(startMs), arriveAt: iso(startMs + mins * 60000), durationMinutes: mins, distanceMeters: Math.round(r.distance), geometry: { type: 'LineString', coordinates: simplify(r.geometry.coordinates, 80) }, timeSource: 'estimated' };
}
/** One leg by bike or on foot, from the public OSRM profiles. */
async function activeLeg(id, mode, from, to, startMs) {
  const url = mode === 'bike' ? 'https://routing.openstreetmap.de/routed-bike/route/v1/driving' : 'https://routing.openstreetmap.de/routed-foot/route/v1/driving';
  const r = await osrm(url, from.coordinates, to.coordinates);
  const mins = Math.round(r.duration / 60);
  return { id, mode, from, to, departAt: iso(startMs), arriveAt: iso(startMs + mins * 60000), durationMinutes: mins, distanceMeters: Math.round(r.distance), geometry: { type: 'LineString', coordinates: simplify(r.geometry.coordinates) }, timeSource: 'estimated' };
}
/** A SAMPLE flight (made-up schedule) drawn along the great-circle arc between two airports. */
function flightLeg(id, fromCode, toCode, departMs, minutesInAir) {
  const a = AIRPORTS[fromCode], b = AIRPORTS[toCode];
  return {
    id, mode: 'flight',
    from: { name: a.name, coordinates: a.runway, kind: 'airport', code: fromCode },
    to: { name: b.name, coordinates: b.runway, kind: 'airport', code: toCode },
    departAt: iso(departMs), arriveAt: iso(departMs + minutesInAir * 60000), durationMinutes: minutesInAir,
    geometry: { type: 'LineString', coordinates: greatCircle(a.runway, b.runway) },
    timeSource: 'scheduled', routeName: `${fromCode} → ${toCode} (sample flight)`
  };
}
/** Transit from a to b via Transitous, keeping only walk/bus/rail itineraries; picks the first that matches `want`. */
async function transitLegs(idPrefix, from, to, timeIso, want = () => true, extra = {}) {
  const q = new URLSearchParams({ fromPlace: `${from.coordinates[1]},${from.coordinates[0]}`, toPlace: `${to.coordinates[1]},${to.coordinates[0]}`, time: timeIso, ...extra });
  const plan = await (await fetch(`https://api.transitous.org/api/v5/plan?${q}`, { headers: UA })).json();
  const options = [...plan.itineraries, ...(plan.direct ?? [])];
  // Of the itineraries that match, take the one with the fewest vehicles, then the fastest.
  const vehicles = (x) => x.legs.filter((l) => l.mode !== 'WALK' && l.mode !== 'BIKE').length;
  const it = options
    .filter((x) => { try { return want(x.legs.map((l) => MODE(l.mode))); } catch { return false; } })
    .sort((x, y) => vehicles(x) - vehicles(y) || x.duration - y.duration)[0];
  if (!it) throw new Error(`${idPrefix}: nothing matched; got ${options.map((x) => x.legs.map((l) => l.mode).join(',')).join(' | ')}`);
  return it.legs.map((l, i, all) => motisLeg(`${idPrefix}-${i}`, l, { from: i === 0 ? from.name : undefined, to: i === all.length - 1 ? to.name : undefined }));
}
const renumber = (id, legs) => legs.map((leg, i) => ({ ...leg, id: `${id}-${i}` }));

// ---------- Scenario 1: one commute, every way of doing it (MIT → South Station, Monday 8:30 AM) ----------
const home = { name: 'MIT Stata Center', coordinates: MIT, kind: 'address' };
const station = { name: 'South Station', coordinates: SOUTH_STATION, kind: 'station' };
const commuteStart = Date.parse(QUERY_TIME);
const commute = {};

commute.sampleItinerary = finish('commute-red-line',
  await transitLegs('commute-red-line', home, station, QUERY_TIME, (m) => m.join(',') === 'walk,rail,walk'),
  'transitous (recorded)');
commute.commuteBus = finish('commute-bus',
  await transitLegs('commute-bus', home, station, QUERY_TIME, (m) => m.includes('bus') && !m.includes('rail'), { transitModes: 'BUS' }),
  'transitous (recorded)', { risk: { level: 'medium', reasons: ['Bus times are scheduled, not live (sample)'] } });
commute.commuteBikeTransit = finish('commute-bike-transit',
  await transitLegs('commute-bike-transit', home, station, QUERY_TIME, (m) => m[0] === 'bike' && m.some((x) => x === 'rail' || x === 'bus'), { preTransitModes: 'BIKE', postTransitModes: 'BIKE', requireBikeTransport: 'true', directModes: 'BIKE' }),
  'transitous (recorded)', { risk: { level: 'medium', reasons: ['Bike on board: check peak-hour bike rules (sample)'] } });
commute.commuteBike = finish('commute-bike', [await activeLeg('commute-bike-0', 'bike', home, station, commuteStart)], 'osrm (recorded)');
commute.commuteWalk = finish('commute-walk', [await activeLeg('commute-walk-0', 'walk', home, station, commuteStart)], 'osrm (recorded)');
{
  const leg = await carLeg('commute-drive-0', home, station, commuteStart);
  const miles = leg.distanceMeters / 1609.34;
  commute.sampleDrive = finish('commute-drive', [leg], 'osrm (recorded)', { costLines: [{ label: 'Gas', usd: Math.round((miles / 28) * 3.2 * 100) / 100, estimated: true }, { label: 'Parking', usd: 30, estimated: true }] });
}

// ---------- Scenario 2: getting to Florida, door to door (MIT → downtown Orlando, Monday from 7:00 AM) ----------
// Each option = ground leg(s) to an airport + a sample flight to MCO or SFB + a drive into downtown Orlando.
const flightDayStart = Date.parse('2026-11-16T12:00:00Z'); // 7:00 AM Boston
const orlando = { name: 'Downtown Orlando', coordinates: DOWNTOWN_ORLANDO, kind: 'address' };
const airportPlace = (code) => ({ name: AIRPORTS[code].name, coordinates: AIRPORTS[code].terminal, kind: 'airport', code });
const CHECK_IN_MIN = 90; // arrive at the airport 90 min before departure (sample rule)
const flights = {};

/** Ground legs to `code`, a sample flight `code` → `arrive`, then a taxi from `arrive` into downtown Orlando. */
async function flyVia(id, code, ground, minutesInAir, fareUsd, groundCost, risk, arrive = 'MCO', taxiUsd = 40) {
  const last = ground.at(-1);
  const depart = Date.parse(last.arriveAt) + CHECK_IN_MIN * 60000;
  const flight = flightLeg('tmp', code, arrive, depart, minutesInAir);
  const taxi = await carLeg('tmp', airportPlace(arrive), orlando, Date.parse(flight.arriveAt) + 25 * 60000);
  const legs = renumber(id, [...ground, flight, taxi]);
  return finish(id, legs, 'sample flight + transitous/osrm (recorded)', {
    costLines: [{ label: `Flight ${code} → ${arrive} (sample fare)`, usd: fareUsd, estimated: true }, ...groundCost, { label: `Taxi ${arrive} → downtown`, usd: taxiUsd, estimated: true }],
    risk
  });
}

// A. Transit to Logan, fly from Boston
flights.flyFromBoston = await flyVia('fly-bos', 'BOS',
  await transitLegs('fly-bos', home, airportPlace('BOS'), iso(flightDayStart), (m) => m.every((x) => ['walk', 'bus', 'rail'].includes(x)) && m.some((x) => x !== 'walk')),
  185, 189, [], { level: 'low', reasons: [] });
// B. Commuter rail to Providence (T.F. Green has its own station), fly PVD → Orlando SANFORD (SFB):
//    a smaller airport north of Orlando, cheaper flight but a longer drive into downtown.
flights.flyFromProvidence = await flyVia('fly-pvd', 'PVD',
  await transitLegs('fly-pvd', home, airportPlace('PVD'), iso(flightDayStart), (m) => m.every((x) => ['walk', 'bus', 'rail'].includes(x)) && m.includes('rail')),
  170, 99, [{ label: 'Commuter rail to PVD', usd: 12.25, estimated: true }], { level: 'medium', reasons: ['Depends on one commuter rail train (scheduled times)'] },
  'SFB', 65);
// C. Drive to Manchester NH, park, fly from MHT
{
  const drive = await carLeg('tmp', home, airportPlace('MHT'), flightDayStart);
  const miles = drive.distanceMeters / 1609.34;
  flights.flyFromManchester = await flyVia('fly-mht', 'MHT', [drive], 190, 139,
    [{ label: 'Gas', usd: Math.round((miles / 28) * 3.2 * 100) / 100, estimated: true }, { label: 'Airport parking, 5 days', usd: 75, estimated: true }],
    { level: 'low', reasons: [] });
}

// ---------- write ----------
const header = `/**
 * Example routes for the demo page, the tests, and UI work before the server exists
 * (import from '@transit/maps/samples'). Two scenarios:
 *
 *   commuteOptions: ONE trip (MIT Stata Center → South Station, Monday 8:30 AM) by Red Line, bus and car.
 *     (Bike, bike + transit and walk versions are also generated below but not in the list.)
 *   flightOptions:  "how do I get to Florida?" (MIT → downtown Orlando), door to door:
 *     transit to Logan + fly BOS → MCO, commuter rail to Providence + fly PVD → Orlando Sanford (SFB),
 *     drive to Manchester NH + fly MHT → MCO.
 *
 * GENERATED from REAL route geometry (Transitous for transit, OSRM for drive/bike/walk), simplified to at
 * most 60 to 80 points per leg. Flights are SAMPLE schedules and fares (not real flights), drawn as
 * great-circle arcs, the shape the server will send (plan 011).
 * Do not edit by hand. Regenerate with: node packages/maps/scripts/gen-samples.mjs packages/maps/src/samples.ts
 *
 * Tests rely on: sampleItinerary = walk → Red Line → walk starting at 'MIT Stata Center';
 * sampleDrive = one car leg; sampleItineraries = commuteOptions.
 */
import type { Itinerary } from '@transit/shared';
`;
const compact = (it) => JSON.stringify(it, null, 2).replace(/\[\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g, '[$1, $2]');
const all = { ...commute, ...flights };
const body = Object.entries(all).map(([name, it]) => `\nexport const ${name}: Itinerary = ${compact(it)};\n`).join('');
const footer = `
/**
 * Scenario 1: the same trip by transit and by car. The bike and walk versions above are kept in this
 * file but left out of the demo (mode choice is the UI team's job); add them back here if needed.
 */
export const commuteOptions: Itinerary[] = [sampleItinerary, commuteBus, sampleDrive];

/** Scenario 2: Boston area to Orlando, flying from three airports into two (MCO, SFB). */
export const flightOptions: Itinerary[] = [${Object.keys(flights).join(', ')}];

/** Used by the tests. */
export const sampleItineraries: Itinerary[] = commuteOptions;
`;
writeFileSync(OUT, header + body + footer);
for (const [name, it] of Object.entries(all)) console.log(name.padEnd(20), String(it.durationMinutes).padStart(4) + ' min', '$' + it.cost.totalUsd, '|', it.summary);
