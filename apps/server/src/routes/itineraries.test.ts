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
    for (const invalid of [{ displayName: 'a'.repeat(61) }, { home: { coordinates: [181, 0] } }, { defaults: { preferences: { comfortVsCost: 2 } } }]) {
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
    expect(db.prepare('PRAGMA user_version').get()?.user_version).toBe(1);
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

  it('lists watched departures in the inclusive window across devices and offsets', async () => {
    db = new DatabaseSync(':memory:');
    migrate(db);
    const store = new SqliteItineraryStore(db);
    const request = TripRequestSchema.parse(fixtureRequest);
    await store.save(DEVICE_A, { itinerary: sampleItinerary, request, watch: true });
    await store.save(DEVICE_B, { itinerary: { ...sampleItinerary, id: 'other' }, request, watch: true });
    await store.save(DEVICE_A, { itinerary: { ...sampleItinerary, id: 'off' }, request, watch: false });
    await store.save(DEVICE_A, { itinerary: { ...sampleItinerary, id: 'later', departAt: '2026-11-14T13:00:00Z' }, request, watch: true });
    expect((await store.listWatched('2026-11-13T13:00:00Z', '2026-11-13T13:00:00Z')).map((item) => item.id)).toEqual([sampleItinerary.id, 'other']);
    expect(await store.listWatched('2026-11-13T13:00:01Z', '2026-11-13T14:00:00Z')).toEqual([]);
  });
});

describe.each(['memory', 'sqlite'])('%s store contract', (implementation) => {
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
