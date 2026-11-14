import { describe, it, expect, afterEach } from 'vitest';
import { PlaceSearchResponseSchema } from '@transit/shared';
import { createServer } from './app.js';

let app: ReturnType<typeof createServer> | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('server', () => {
  it('GET /api/health returns ok', async () => {
    app = createServer();
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('ok');
  });

  it('returns 404 for unknown routes', async () => {
    app = createServer();
    const res = await app.inject({ method: 'GET', url: '/api/nope' });
    expect(res.statusCode).toBe(404);
  });
});

describe('GET /api/places', () => {
  const get = (url: string) => {
    app = createServer();
    return app.inject({ method: 'GET', url });
  };

  it('finds South Station by name and returns a schema-valid body', async () => {
    const res = await get('/api/places?q=south');
    expect(res.statusCode).toBe(200);
    const body = PlaceSearchResponseSchema.parse(res.json());
    expect(body.places.map((place) => place.name)).toContain('South Station');
  });

  it('finds Logan Airport by its airport code', async () => {
    const res = await get('/api/places?q=BOS');
    expect(res.statusCode).toBe(200);
    expect(res.json().places.map((place: { name?: string }) => place.name)).toContain('Logan Airport');
  });

  it('returns an empty list when nothing matches', async () => {
    const res = await get('/api/places?q=zzzz');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ places: [] });
  });

  it('rejects a missing q with invalid_request', async () => {
    const res = await get('/api/places');
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('invalid_request');
  });

  it('rejects a malformed near', async () => {
    const res = await get('/api/places?q=south&near=abc');
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe('invalid_request');
  });
});
