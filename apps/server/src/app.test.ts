import { describe, it, expect, afterEach } from 'vitest';
import { PlaceSearchResponseSchema } from '@transit/shared';
import { createServer } from './app.js';
import { plannerConfigured } from './agent/models.js';
import { createPlannerTools } from './agent/tools.js';
import { instructions } from './agent/instructions.js';
import { createPlaceSearcher } from './places/geocoder.js';

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

describe('Photon place search', () => {
  const feature = (name: string, coordinates: [number, number], props: Record<string, string> = {}) =>
    ({ type: 'Feature', properties: { osm_key: 'place', osm_value: 'locality', city: 'Cambridge', ...props, name }, geometry: { type: 'Point', coordinates } });
  const kendallSample = [
    feature('Kendall/MIT', [-71.0857239, 42.3624178], { osm_key: 'railway', osm_value: 'station', housenumber: '300', street: 'Main Street' }),
    feature('Kendall Square', [-71.0876102, 42.362611]),
    feature('Kendall/MIT (Alewife)', [-71.0855646, 42.3624363], { osm_key: 'railway', osm_value: 'platform' })
  ];
  const farAway = [
    feature('Kendall Pond', [-71.2, 42.5], { city: 'Lexington' }),
    feature('Kendall Hotel', [-71.3, 42.6], { osm_key: 'tourism', osm_value: 'hotel', city: 'Lowell' }),
    feature('Kendall Street', [-71.4, 42.7], { osm_key: 'highway', osm_value: 'residential', city: 'Nashua' }),
    feature('Kendall Station', [-71.5, 42.8], { osm_key: 'aeroway', osm_value: 'aerodrome', city: 'Concord' }),
    feature('Kendall Library', [-71.6, 42.9], { city: 'Keene' })
  ];
  const fakeFetch = (respond: () => Response | Promise<Response>) => {
    const calls: URL[] = [];
    const fn = (async (input: URL) => {
      calls.push(new URL(input));
      return respond();
    }) as unknown as typeof fetch;
    return { calls, fn };
  };
  const ok = (features: unknown[]) => () => new Response(JSON.stringify({ type: 'FeatureCollection', features }), { status: 200 });
  const serve = (fetchImpl: typeof fetch) => {
    app = createServer({ places: createPlaceSearcher({ photonUrl: 'https://photon.test/', fetch: fetchImpl }) });
    return (url: string) => app!.inject({ method: 'GET', url });
  };

  it('puts hand-list results first, drops Photon results within 150 m of them, and caps at 5', async () => {
    const { calls, fn } = fakeFetch(ok([...kendallSample, ...farAway]));
    const res = await serve(fn)('/api/places?q=Kendall');
    expect(res.statusCode).toBe(200);
    const { places } = PlaceSearchResponseSchema.parse(res.json());
    expect(places.map((place) => place.name)).toEqual(['Kendall/MIT station', 'Kendall Pond, Lexington', 'Kendall Hotel, Lowell', 'Kendall Street, Nashua', 'Kendall Station, Concord']);
    expect(places[4]?.kind).toBe('airport');
    expect(calls[0]?.pathname).toBe('/api/');
    expect(calls[0]?.searchParams.get('limit')).toBe('5');
  });

  it('maps Photon features to places with a distinct name and kind', async () => {
    const { fn } = fakeFetch(ok([
      ...kendallSample,
      feature('', [-71.1, 42.37], { osm_key: 'building', osm_value: 'yes', housenumber: '77', street: 'Massachusetts Avenue' })
    ]));
    const res = await serve(fn)('/api/places?q=Union%20Square');
    expect(res.json().places).toEqual([
      { name: 'Kendall/MIT, Cambridge', coordinates: [-71.0857239, 42.3624178], kind: 'station' },
      { name: 'Kendall Square, Cambridge', coordinates: [-71.0876102, 42.362611], kind: 'poi' },
      { name: 'Kendall/MIT (Alewife), Cambridge', coordinates: [-71.0855646, 42.3624363], kind: 'stop' },
      { name: '77 Massachusetts Avenue, Cambridge', coordinates: [-71.1, 42.37], kind: 'address' }
    ]);
  });

  it('passes near to Photon as lat and lon', async () => {
    const { calls, fn } = fakeFetch(ok(kendallSample));
    await serve(fn)('/api/places?q=Brookline%20Village&near=-71.06,42.36');
    expect(calls[0]?.searchParams.get('lat')).toBe('42.36');
    expect(calls[0]?.searchParams.get('lon')).toBe('-71.06');
  });

  it('never calls Photon for a query shorter than 3 characters', async () => {
    const { calls, fn } = fakeFetch(ok(kendallSample));
    const res = await serve(fn)('/api/places?q=BO');
    expect(res.statusCode).toBe(200);
    expect(calls).toHaveLength(0);
  });

  it.each([
    ['throws', () => { throw new Error('network down'); }],
    ['returns a 500', () => new Response('oops', { status: 500 })],
    ['returns bad JSON', () => new Response('not json', { status: 200 })]
  ])('falls back to the hand list when fetch %s', async (_, respond) => {
    const { fn } = fakeFetch(respond);
    const res = await serve(fn)('/api/places?q=south');
    expect(res.statusCode).toBe(200);
    expect(res.json().places.map((place: { name?: string }) => place.name)).toEqual(['South Station']);
  });

  it('serves a repeated query from the cache', async () => {
    const { calls, fn } = fakeFetch(ok(kendallSample));
    const get = serve(fn);
    const first = await get('/api/places?q=Kendall%20Square&near=-71.061,42.361');
    const second = await get('/api/places?q=kendall%20square%20&near=-71.059,42.359');
    expect(second.json()).toEqual(first.json());
    expect(calls).toHaveLength(1);
  });

  it('backs the find_place tool', async () => {
    const { fn } = fakeFetch(ok(kendallSample));
    const tools = createPlannerTools({ places: createPlaceSearcher({ photonUrl: 'https://photon.test', fetch: fn }) } as never);
    const findPlace = tools.find((tool) => tool.name === 'find_place')!;
    const places = await findPlace.runAsync({ args: { query: 'Union Square' }, toolContext: {} as never });
    expect((places as { name?: string }[]).map((place) => place.name)).toContain('Kendall Square, Cambridge');
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
