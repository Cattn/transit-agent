import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { sampleItinerary, SavedItinerarySchema, TripRequestSchema, TravelProfileSchema } from '@transit/shared';
import { createServer } from '../app.js';
import { migrate } from '../store/migrations.js';
import { MemoryItineraryStore } from '../store/memory.js';
import { SqliteItineraryStore } from '../store/sqlite.js';
import { MemoryProfileStore, SqliteProfileStore } from '../store/profiles.js';
import fixtureRequest from '../providers/fixture-request.json';

let db: DatabaseSync | undefined;
let app: ReturnType<typeof createServer> | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
  db?.close();
  db = undefined;
  vi.restoreAllMocks();
});

const DEVICE_A = 'test-device-1';
const DEVICE_B = 'test-device-2';
const saveBody = (id = sampleItinerary.id, label?: string) => ({
  itinerary: { ...sampleItinerary, id },
  request: fixtureRequest,
  ...(label === undefined ? {} : { label })
});

describe.each(['memory', 'sqlite'])('%s persistence API', (implementation) => {
  function server() {
    if (implementation === 'memory') {
      return createServer({ itineraries: new MemoryItineraryStore(), profiles: new MemoryProfileStore() });
    }
    db = new DatabaseSync(':memory:');
    migrate(db);
    return createServer({ itineraries: new SqliteItineraryStore(db), profiles: new SqliteProfileStore(db) });
  }
  it('save → list → get → patch → delete → get 404', async () => {
    app = server();
    const headers = { 'x-device-id': DEVICE_A };

    const saved = await app.inject({ method: 'POST', url: '/api/itineraries', headers, payload: saveBody(undefined, 'Morning commute') });
    expect(saved.statusCode).toBe(201);
    const savedBody = SavedItinerarySchema.parse(saved.json());
    expect(savedBody.watch).toBe(true);
    expect(savedBody.label).toBe('Morning commute');

    const list = await app.inject({ method: 'GET', url: '/api/itineraries', headers });
    expect(list.statusCode).toBe(200);
    expect(list.json().itineraries.map((it: { id: string }) => it.id)).toEqual([sampleItinerary.id]);

    const url = `/api/itineraries/${sampleItinerary.id}`;
    const got = await app.inject({ method: 'GET', url, headers });
    expect(got.statusCode).toBe(200);
    expect(got.json().id).toBe(sampleItinerary.id);

    const patched = await app.inject({ method: 'PATCH', url, headers, payload: { watch: false } });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().watch).toBe(false);
    expect(patched.json().label).toBe('Morning commute');

    const deleted = await app.inject({ method: 'DELETE', url, headers });
    expect(deleted.statusCode).toBe(204);

    const gone = await app.inject({ method: 'GET', url, headers });
    expect(gone.statusCode).toBe(404);
    expect(gone.json().error.code).toBe('not_found');
  });

  it('lists newest savedAt first and overwrites on re-save', async () => {
    app = server();
    const headers = { 'x-device-id': DEVICE_A };
    await app.inject({ method: 'POST', url: '/api/itineraries', headers, payload: saveBody('first') });
    await new Promise((resolve) => setTimeout(resolve, 5));
    await app.inject({ method: 'POST', url: '/api/itineraries', headers, payload: saveBody('second') });
    await app.inject({ method: 'POST', url: '/api/itineraries', headers, payload: saveBody('second', 'renamed') });

    const list = await app.inject({ method: 'GET', url: '/api/itineraries', headers });
    const items = list.json().itineraries as { id: string; label?: string }[];
    expect(items.map((it) => it.id)).toEqual(['second', 'first']);
    expect(items[0]?.label).toBe('renamed');
  });

  it('stores a trip color, keeps the first one on re-save and rejects invalid colors', async () => {
    app = server();
    const headers = { 'x-device-id': DEVICE_A };
    const first = await app.inject({ method: 'POST', url: '/api/itineraries', headers, payload: { ...saveBody(), color: '#1D4ED8' } });
    expect(first.statusCode).toBe(201);
    expect(first.json().color).toBe('#1D4ED8');

    const again = await app.inject({ method: 'POST', url: '/api/itineraries', headers, payload: { ...saveBody(sampleItinerary.id, 'again'), color: '#BE185D' } });
    expect(again.json()).toMatchObject({ color: '#1D4ED8', label: 'again' });

    const plain = await app.inject({ method: 'POST', url: '/api/itineraries', headers, payload: saveBody('no-color') });
    expect(plain.json().color).toBeUndefined();

    const list = await app.inject({ method: 'GET', url: '/api/itineraries', headers });
    const colors = Object.fromEntries((list.json().itineraries as { id: string; color?: string }[]).map((item) => [item.id, item.color]));
    expect(colors).toEqual({ [sampleItinerary.id]: '#1D4ED8', 'no-color': undefined });
    expect((await app.inject({ method: 'GET', url: `/api/itineraries/${sampleItinerary.id}`, headers })).json().color).toBe('#1D4ED8');

    const bad = await app.inject({ method: 'POST', url: '/api/itineraries', headers, payload: { ...saveBody('bad'), color: 'blue' } });
    expect(bad.statusCode).toBe(400);
    expect(bad.json().error.code).toBe('invalid_request');
  });

  it('requires x-device-id', async () => {
    app = server();
    const res = await app.inject({ method: 'GET', url: '/api/itineraries' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('missing_device_id');

    const tooShort = await app.inject({ method: 'GET', url: '/api/itineraries', headers: { 'x-device-id': 'abc' } });
    expect(tooShort.json().error.code).toBe('missing_device_id');
  });

  it('isolates devices from each other', async () => {
    app = server();
    await app.inject({ method: 'POST', url: '/api/itineraries', headers: { 'x-device-id': DEVICE_A }, payload: saveBody() });

    const other = { 'x-device-id': DEVICE_B };
    const list = await app.inject({ method: 'GET', url: '/api/itineraries', headers: other });
    expect(list.json().itineraries).toEqual([]);
    const got = await app.inject({ method: 'GET', url: `/api/itineraries/${sampleItinerary.id}`, headers: other });
    expect(got.statusCode).toBe(404);
    const removed = await app.inject({ method: 'DELETE', url: `/api/itineraries/${sampleItinerary.id}`, headers: other });
    expect(removed.statusCode).toBe(404);
  });

  it('accepts location reports only for the owner of a watched trip', async () => {
    app = server();
    const headers = { 'x-device-id': DEVICE_A };
    await app.inject({ method: 'POST', url: '/api/itineraries', headers, payload: saveBody() });
    const url = `/api/itineraries/${sampleItinerary.id}/location`;
    expect((await app.inject({ method: 'POST', url, headers, payload: { coordinates: [-71.06, 42.35], accuracyMeters: 20 } })).statusCode).toBe(204);
    expect((await app.inject({ method: 'POST', url, headers: { 'x-device-id': DEVICE_B }, payload: { coordinates: [-71.06, 42.35] } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'POST', url, headers, payload: { coordinates: [200, 42.35] } })).statusCode).toBe(400);
    const index = sampleItinerary.legs.findIndex((leg) => leg.mode === 'bus');
    const leg = sampleItinerary.legs[index]!;
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse(leg.departAt));
    const boarding = { legIndex: index, tripId: leg.trip?.tripId ?? leg.id, state: 'boarded' };
    const patchUrl = `/api/itineraries/${sampleItinerary.id}`;
    expect((await app.inject({ method: 'PATCH', url: patchUrl, headers: { 'x-device-id': DEVICE_B }, payload: { boarding } })).statusCode).toBe(404);
    expect((await app.inject({ method: 'PATCH', url: patchUrl, headers, payload: { boarding: { ...boarding, tripId: 'old-trip' } } })).statusCode).toBe(409);
    const boarded = await app.inject({ method: 'PATCH', url: patchUrl, headers, payload: { boarding } });
    expect(boarded.statusCode).toBe(200);
    expect(boarded.json().watchStatus).toMatchObject({ boardedLegIndex: index, phase: 'riding' });
    vi.mocked(Date.now).mockReturnValue(Date.parse(leg.arriveAt) + 16 * 60_000);
    expect((await app.inject({ method: 'PATCH', url: patchUrl, headers, payload: { boarding } })).statusCode).toBe(409);
  });

  it('validates save and patch bodies', async () => {
    app = server();
    const headers = { 'x-device-id': DEVICE_A };
    const badSave = await app.inject({ method: 'POST', url: '/api/itineraries', headers, payload: { itinerary: {} } });
    expect(badSave.statusCode).toBe(400);
    expect(badSave.json().error.code).toBe('invalid_request');

    await app.inject({ method: 'POST', url: '/api/itineraries', headers, payload: saveBody() });
    const badPatch = await app.inject({
      method: 'PATCH',
      url: `/api/itineraries/${sampleItinerary.id}`,
      headers,
      payload: { watch: false, extra: 1 }
    });
    expect(badPatch.statusCode).toBe(400);
    expect(badPatch.json().error.code).toBe('invalid_request');

    const missing = await app.inject({ method: 'PATCH', url: '/api/itineraries/nope', headers, payload: { watch: true } });
    expect(missing.statusCode).toBe(404);
  });

  it('gets, replaces and isolates profiles with server timestamps', async () => {
    app = server();
    const headers = { 'x-device-id': DEVICE_A };
    expect((await app.inject({ method: 'GET', url: '/api/profile', headers })).statusCode).toBe(404);
    const payload = { displayName: 'Commuter', home: sampleItinerary.legs[0]!.from, work: sampleItinerary.legs[0]!.to, defaults: { preferences: { comfortVsCost: 0.8 }, constraints: { maxWalkMinutes: null } } };
    const saved = await app.inject({ method: 'PUT', url: '/api/profile', headers, payload });
    expect(saved.statusCode).toBe(200);
    expect(saved.json()).toMatchObject(payload);
    expect(Number.isFinite(Date.parse(saved.json().updatedAt))).toBe(true);
    expect((await app.inject({ method: 'GET', url: '/api/profile', headers })).json()).toEqual(saved.json());
    expect((await app.inject({ method: 'GET', url: '/api/profile', headers: { 'x-device-id': DEVICE_B } })).statusCode).toBe(404);
    const replaced = await app.inject({ method: 'PUT', url: '/api/profile', headers, payload: {} });
    expect(replaced.json().defaults).toEqual({});
    expect(replaced.json()).not.toHaveProperty('home');
    for (const method of ['GET', 'PUT'] as const) {
      expect((await app.inject({ method, url: '/api/profile', ...(method === 'PUT' ? { payload: {} } : {}) })).statusCode).toBe(400);
      expect((await app.inject({ method, url: '/api/profile', headers: { 'x-device-id': 'bad' }, ...(method === 'PUT' ? { payload: {} } : {}) })).statusCode).toBe(400);
    }
    const presets = { gym: { color: '#16a34a', icon: 'fitness', place: sampleItinerary.legs[0]!.to }, office: { color: '#2563eb', icon: 'work' } };
    const withPresets = await app.inject({ method: 'PUT', url: '/api/profile', headers, payload: { ...payload, presets } });
    expect(withPresets.json().presets).toEqual(presets);
    expect((await app.inject({ method: 'GET', url: '/api/profile', headers })).json().presets).toEqual(presets);
    for (const invalid of [{ displayName: 'a'.repeat(61) }, { home: { coordinates: [181, 0] } }, { defaults: { preferences: { comfortVsCost: 2 } } }, { presets: { gym: { icon: 'rocket' } } }, { presets: { gym: { color: 'green' } } }, { presets: { cinema: { color: '#16a34a' } } }]) {
      expect((await app.inject({ method: 'PUT', url: '/api/profile', headers, payload: invalid })).statusCode).toBe(400);
    }
    const preflight = await app.inject({ method: 'OPTIONS', url: '/api/profile', headers: { origin: 'http://localhost:5173', 'access-control-request-method': 'PUT', 'access-control-request-headers': 'x-device-id,content-type' } });
    expect(preflight.statusCode).toBeLessThan(300);
    expect(preflight.headers['access-control-allow-methods']).toContain('PUT');
  });
  it('allows x-device-id in the CORS preflight', async () => {
    app = server();
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/api/itineraries',
      headers: {
        origin: 'http://localhost:5173',
        'access-control-request-method': 'GET',
        'access-control-request-headers': 'x-device-id'
      }
    });
    expect(res.statusCode).toBeLessThan(300);
    expect(String(res.headers['access-control-allow-headers'] ?? '').toLowerCase()).toContain('x-device-id');
    const methods = String(res.headers['access-control-allow-methods'] ?? '').split(',').map((method) => method.trim());
    expect(methods).toEqual(expect.arrayContaining(['GET', 'POST', 'PATCH', 'DELETE']));
  });
});

describe('SQLite storage', () => {
  it('applies migrations idempotently', () => {
    db = new DatabaseSync(':memory:');
    migrate(db);
    migrate(db);
    expect(db.prepare('PRAGMA user_version').get()?.user_version).toBe(3);
  });

  it('keeps saved trip colors across a restart', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'transit-colors-'));
    const file = join(dir, 'transit.db');
    try {
      const before = new DatabaseSync(file);
      migrate(before);
      await new SqliteItineraryStore(before).save(DEVICE_A, { itinerary: sampleItinerary, request: TripRequestSchema.parse(fixtureRequest), watch: true, color: '#0F766E' });
      before.close();

      const after = new DatabaseSync(file);
      migrate(after);
      const items = await new SqliteItineraryStore(after).list(DEVICE_A);
      after.close();
      expect(items.map((item) => item.color)).toEqual(['#0F766E']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('skips malformed JSON and schema-invalid rows without breaking reads', async () => {
    db = new DatabaseSync(':memory:');
    migrate(db);
    const store = new SqliteItineraryStore(db);
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await store.save(DEVICE_A, { ...saveBody(), request: TripRequestSchema.parse(fixtureRequest), watch: true });
    const insert = db.prepare('INSERT INTO saved_itineraries (device_id, id, saved_at, itinerary_json, request_json) VALUES (?, ?, ?, ?, ?)');
    insert.run(DEVICE_A, 'invalid-json', new Date().toISOString(), '{', '{}');
    insert.run(DEVICE_A, 'invalid-schema', new Date().toISOString(), '{}', '{}');
    insert.run(DEVICE_A, 'invalid-request', new Date().toISOString(), JSON.stringify(sampleItinerary), '{}');
    expect(await store.list(DEVICE_A)).toHaveLength(1);
    expect(await store.get(DEVICE_A, 'invalid-json')).toBeUndefined();
    expect(await store.update(DEVICE_A, 'invalid-schema', { watch: false })).toBeUndefined();
    expect(log).toHaveBeenCalled();
  });

  it('keeps watch status across a restart and clears it on re-save', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'transit-watch-'));
    const path = join(dir, 'db.sqlite');
    try {
      const request = TripRequestSchema.parse(fixtureRequest);
      const watchStatus = { state: 'onTrack' as const, leaveBy: '2026-11-13T08:04:00-05:00', message: 'Leave by 8:04 AM.', checkedAt: '2026-11-13T12:30:00.000Z', usedRealtime: false, boardedLegIndex: 1, change: { id: 'switch-1', message: 'Switched to a later bus.', changedAt: '2026-11-13T12:30:00.000Z' } };
      let first: DatabaseSync | undefined = new DatabaseSync(path);
      migrate(first);
      await new SqliteItineraryStore(first).save(DEVICE_A, { itinerary: sampleItinerary, request, watch: true });
      await new SqliteItineraryStore(first).applyWatch(DEVICE_A, sampleItinerary.id, { itinerary: sampleItinerary, request, watchStatus });
      first.close();
      first = undefined;
      db = new DatabaseSync(path);
      migrate(db);
      const store = new SqliteItineraryStore(db);
      expect(await store.get(DEVICE_A, sampleItinerary.id)).toMatchObject({ watchStatus, leaveBy: watchStatus.leaveBy });
      await store.save(DEVICE_A, { itinerary: sampleItinerary, request, watch: true });
      expect(await store.get(DEVICE_A, sampleItinerary.id)).not.toHaveProperty('watchStatus');
    } finally {
      db?.close();
      db = undefined;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe.each(['memory', 'sqlite'])('%s watch store', (implementation) => {
  function store() {
    if (implementation === 'sqlite') {
      db = new DatabaseSync(':memory:');
      migrate(db);
      return new SqliteItineraryStore(db);
    }
    return new MemoryItineraryStore();
  }

  it('lists watched trips across owners until they arrive, including departed ones', async () => {
    const items = store();
    const request = TripRequestSchema.parse(fixtureRequest);
    await items.save(DEVICE_A, { itinerary: sampleItinerary, request, watch: true });
    await items.save(DEVICE_B, { itinerary: { ...sampleItinerary, id: 'other' }, request, watch: true });
    await items.save(DEVICE_A, { itinerary: { ...sampleItinerary, id: 'off' }, request, watch: false });
    await items.save(DEVICE_A, { itinerary: { ...sampleItinerary, id: 'later', departAt: '2026-11-14T13:00:00Z', arriveAt: '2026-11-14T13:27:00Z' }, request, watch: true });
    const ids = async (after: string, before: string) => (await items.listWatched(after, before)).map(({ deviceId, item }) => `${deviceId}:${item.id}`);
    expect(await ids('2026-11-13T13:00:00Z', '2026-11-13T13:00:00Z')).toEqual([`${DEVICE_A}:${sampleItinerary.id}`, `${DEVICE_B}:other`]);
    expect(await ids('2026-11-13T13:10:00Z', '2026-11-13T14:00:00Z')).toEqual([`${DEVICE_A}:${sampleItinerary.id}`, `${DEVICE_B}:other`]);
    expect(await ids('2026-11-13T13:27:01Z', '2026-11-13T14:00:00Z')).toEqual([]);
  });

  it('applies a replacement itinerary and status while keeping saved identity, owner and label', async () => {
    const items = store();
    const request = TripRequestSchema.parse(fixtureRequest);
    const saved = await items.save(DEVICE_A, { itinerary: sampleItinerary, request, watch: true, label: 'Commute', color: '#123456' });
    await items.save(DEVICE_B, { itinerary: sampleItinerary, request, watch: true });
    const replacement = { ...sampleItinerary, id: 'replacement', summary: 'Later bus' };
    const replanned = { ...request, time: { type: 'departAt' as const, at: '2026-11-13T08:15:00-05:00' } };
    const watchStatus = { state: 'onTrack' as const, message: 'Missed Bus 1, switched.', checkedAt: '2026-11-13T13:15:00.000Z', usedRealtime: false };
    const applied = await items.applyWatch(DEVICE_A, saved.id, { itinerary: replacement, request: replanned, watchStatus });
    expect(applied).toMatchObject({ id: saved.id, label: 'Commute', color: '#123456', savedAt: saved.savedAt, watch: true, summary: 'Later bus', request: replanned, watchStatus });
    expect(applied).not.toHaveProperty('leaveBy');
    expect(await items.get(DEVICE_A, saved.id)).toEqual(applied);
    expect((await items.get(DEVICE_B, saved.id))?.summary).toBe(sampleItinerary.summary);
    expect(await items.applyWatch(DEVICE_B, 'missing', { itinerary: replacement, request, watchStatus })).toBeUndefined();
    await items.update(DEVICE_A, saved.id, { boarding: { legIndex: 1, tripId: replacement.legs[1]!.trip?.tripId ?? replacement.legs[1]!.id, state: 'boarded' } });
    expect(await items.applyWatch(DEVICE_A, saved.id, { itinerary: replacement, request, watchStatus, previousStatus: watchStatus })).toBeUndefined();
    expect((await items.get(DEVICE_A, saved.id))?.watchStatus?.boardedLegIndex).toBe(1);
  });
});

describe.each(['memory', 'sqlite'])('%s store contract', (implementation) => {
  it('preserves concurrent independent patches', async () => {
    if (implementation === 'sqlite') {
      db = new DatabaseSync(':memory:');
      migrate(db);
    }
    const store = db ? new SqliteItineraryStore(db) : new MemoryItineraryStore();
    const saved = await store.save(DEVICE_A, {
      ...saveBody(undefined, 'Original'), request: TripRequestSchema.parse(fixtureRequest), watch: true
    });
    const [renamed, unwatched] = await Promise.all([
      store.update(DEVICE_A, saved.id, { label: 'Renamed' }),
      store.update(DEVICE_A, saved.id, { watch: false })
    ]);
    expect(renamed).toMatchObject({ label: 'Renamed' });
    expect(unwatched).toMatchObject({ label: 'Renamed', watch: false });
    expect(await store.get(DEVICE_A, saved.id)).toMatchObject({ label: 'Renamed', watch: false });
  });

  it('round-trips, isolates and replaces itineraries and profiles without exposing mutable state', async () => {
    if (implementation === 'sqlite') {
      db = new DatabaseSync(':memory:');
      migrate(db);
    }
    const store = db ? new SqliteItineraryStore(db) : new MemoryItineraryStore();
    const profiles = db ? new SqliteProfileStore(db) : new MemoryProfileStore();
    const input = { itinerary: structuredClone(sampleItinerary), request: TripRequestSchema.parse(fixtureRequest), watch: true, label: 'Commute' };
    expect(await store.get(DEVICE_A, 'missing')).toBeUndefined();
    expect(await store.update(DEVICE_A, 'missing', {})).toBeUndefined();
    expect(await store.remove(DEVICE_A, 'missing')).toBe(false);
    const saved = await store.save(DEVICE_A, input);
    saved.legs[0]!.from.name = 'Changed';
    expect((await store.get(DEVICE_A, saved.id))?.legs[0]?.from.name).toBe(sampleItinerary.legs[0]?.from.name);
    await store.save(DEVICE_A, { ...input, itinerary: { ...input.itinerary, id: 'second' } });
    expect((await store.list(DEVICE_A)).map((item) => item.id)).toEqual([sampleItinerary.id, 'second']);
    expect(await store.get(DEVICE_B, saved.id)).toBeUndefined();
    expect(await store.update(DEVICE_B, saved.id, { watch: false })).toBeUndefined();
    expect(await store.remove(DEVICE_B, saved.id)).toBe(false);
    expect(await store.update(DEVICE_A, saved.id, { label: 'Renamed', watch: false })).toMatchObject({ label: 'Renamed', watch: false });
    expect(await store.update(DEVICE_A, saved.id, {})).toMatchObject({ label: 'Renamed', watch: false });
    await store.save(DEVICE_A, { itinerary: input.itinerary, request: input.request, watch: true });
    const replaced = await store.get(DEVICE_A, saved.id);
    expect(replaced).not.toHaveProperty('label');
    expect(replaced?.watch).toBe(true);
    expect(await store.list(DEVICE_A)).toHaveLength(2);
    expect(await store.remove(DEVICE_A, saved.id)).toBe(true);
    expect(await store.get(DEVICE_A, saved.id)).toBeUndefined();
    const profile = TravelProfileSchema.parse({ displayName: 'First', defaults: { modes: ['bike'] }, updatedAt: new Date().toISOString() });
    expect(await profiles.get(DEVICE_A)).toBeUndefined();
    const result = await profiles.put(DEVICE_A, profile);
    result.defaults.modes?.push('car');
    expect(await profiles.get(DEVICE_A)).toEqual(profile);
    expect(await profiles.get(DEVICE_B)).toBeUndefined();
    await profiles.put(DEVICE_A, { ...profile, displayName: 'Second' });
    expect((await profiles.get(DEVICE_A))?.displayName).toBe('Second');
  });
});
