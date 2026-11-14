import { afterEach, describe, expect, it } from 'vitest';
import { sampleItinerary, SavedItinerarySchema } from '@transit/shared';
import { createServer } from '../app.js';
import fixtureRequest from '../providers/fixture-request.json';

let app: ReturnType<typeof createServer> | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

const DEVICE_A = 'test-device-1';
const DEVICE_B = 'test-device-2';
const saveBody = (id = sampleItinerary.id, label?: string) => ({
  itinerary: { ...sampleItinerary, id },
  request: fixtureRequest,
  ...(label === undefined ? {} : { label })
});

describe('/api/itineraries', () => {
  it('save → list → get → patch → delete → get 404', async () => {
    app = createServer();
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
    app = createServer();
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
    app = createServer();
    const res = await app.inject({ method: 'GET', url: '/api/itineraries' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('missing_device_id');

    const tooShort = await app.inject({ method: 'GET', url: '/api/itineraries', headers: { 'x-device-id': 'abc' } });
    expect(tooShort.json().error.code).toBe('missing_device_id');
  });

  it('isolates devices from each other', async () => {
    app = createServer();
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
    app = createServer();
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

  it('allows x-device-id in the CORS preflight', async () => {
    app = createServer();
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
