import { describe, it, expect, afterEach } from 'vitest';
import { PlaceSearchResponseSchema } from '@transit/shared';
import { createServer } from './app.js';
import { plannerConfigured } from './agent/models.js';
import { createPlannerTools } from './agent/tools.js';
import { instructions } from './agent/instructions.js';

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

describe('plannerConfigured', () => {
  it('is off with no credentials', () => expect(plannerConfigured({})).toBe(false));
  it('accepts a Gemini API key', () => expect(plannerConfigured({ GEMINI_API_KEY: 'k' })).toBe(true));
  it('accepts Vertex AI with project and location (ADC)', () =>
    expect(plannerConfigured({ GOOGLE_GENAI_USE_VERTEXAI: 'true', GOOGLE_CLOUD_PROJECT: 'p', GOOGLE_CLOUD_LOCATION: 'global' })).toBe(true));
  it('needs project and location in Vertex mode', () =>
    expect(plannerConfigured({ GOOGLE_GENAI_USE_ENTERPRISE: '1', GOOGLE_CLOUD_PROJECT: 'p', GEMINI_API_KEY: 'k' })).toBe(false));
  it('lets GOOGLE_GENAI_USE_ENTERPRISE=false override the deprecated flag', () =>
    expect(plannerConfigured({ GOOGLE_GENAI_USE_ENTERPRISE: 'false', GOOGLE_GENAI_USE_VERTEXAI: 'true', GEMINI_API_KEY: 'k' })).toBe(true));
});

describe('planner tool declarations', () => {
  it('omit schema keywords Gemini function declarations reject', () => {
    const declarations = JSON.stringify(createPlannerTools({} as never).map((tool) => tool._getDeclaration()));
    expect(declarations).not.toMatch(/exclusiveM(in|ax)imum/);
    expect(declarations).toContain('carMpg');
  });
});

describe('planner instructions', () => {
  it('include the current local date and time so "now" resolves', () => {
    const text = instructions('America/New_York', new Date('2026-11-14T09:05:00Z'));
    expect(text).toContain('Today is 2026-11-14 and the current time is 04:05, timezone America/New_York.');
  });
});
