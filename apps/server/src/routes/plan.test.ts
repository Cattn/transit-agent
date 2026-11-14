import { afterEach, describe, expect, it } from 'vitest';
import { ItinerarySchema, PlanResponseSchema, type Itinerary } from '@transit/shared';
import { createServer } from '../app.js';
import fixtureRequest from '../providers/fixture-request.json';
import type { RouteProvider } from '../providers/types.js';

let app: ReturnType<typeof createServer> | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

const post = (payload: unknown) => app!.inject({ method: 'POST', url: '/api/plan', payload: payload as object });

describe('POST /api/plan', () => {
  it('returns ≥ 3 schema-valid itineraries for the fixture request', async () => {
    app = createServer();
    const res = await post(fixtureRequest);
    expect(res.statusCode).toBe(200);
    const body = PlanResponseSchema.parse(res.json());
    expect(body.itineraries.length).toBeGreaterThanOrEqual(3);
    for (const it of body.itineraries) expect(() => ItinerarySchema.parse(it)).not.toThrow();
  });

  it('rejects an empty body with invalid_request', async () => {
    app = createServer();
    const res = await post({});
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('invalid_request');
    expect(res.json().error.details).toBeDefined();
  });

  it('rejects malformed JSON as a 4xx error body, not a 500', async () => {
    app = createServer();
    const res = await app.inject({
      method: 'POST',
      url: '/api/plan',
      headers: { 'content-type': 'application/json' },
      payload: '{"origin":'
    });
    expect(res.statusCode).toBe(400);
    expect(typeof res.json().error.code).toBe('string');
  });

  it('moves the multi-transfer transit option to nearMisses when maxTransfers is 0', async () => {
    app = createServer();
    const res = await post({ ...fixtureRequest, constraints: { maxTransfers: 0 } });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { itineraries: Itinerary[]; nearMisses: Itinerary[] };
    const transitId = /^fx-transit-[0-9a-f]{8}$/;
    expect(body.itineraries.some((it) => transitId.test(it.id))).toBe(false);
    expect(body.nearMisses.some((it) => transitId.test(it.id))).toBe(true);
  });

  it('reports a failing provider as a warning', async () => {
    const broken: RouteProvider = {
      name: 'broken',
      supports: () => true,
      search: async () => {
        throw new Error('upstream down');
      }
    };
    app = createServer({ providers: [broken] });
    const res = await post(fixtureRequest);
    expect(res.statusCode).toBe(200);
    expect(res.json().warnings).toEqual(['broken unavailable', 'No routes found for this trip']);
  });

  it('returns the shared 404 error body for unknown routes', async () => {
    app = createServer();
    const res = await app.inject({ method: 'GET', url: '/api/nope' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error.code).toBe('not_found');
  });

  it('hides internal errors behind a generic 500', async () => {
    const exploding: RouteProvider = {
      name: 'exploding',
      supports: () => {
        throw new Error('secret stack detail');
      },
      search: async () => []
    };
    app = createServer({ providers: [exploding] });
    const res = await post(fixtureRequest);
    expect(res.statusCode).toBe(500);
    expect(res.json()).toEqual({ error: { code: 'internal', message: 'Internal error' } });
  });
});
