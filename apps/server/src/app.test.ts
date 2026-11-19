import { describe, it, expect, afterEach, vi } from 'vitest';
import { Gemini, type LlmRequest } from '@google/adk';
import { ThinkingLevel } from '@google/genai';
import { AgentProgressEventSchema, PlaceSearchResponseSchema, TripDraftSchema, type AgentProgressEvent } from '@transit/shared';
import { createServer } from './app.js';
import { plannerConfigured, thinkingFor } from './agent/models.js';
import { AdkPlanner } from './agent/adk-planner.js';
import { createPlannerTools } from './agent/tools.js';
import { instructions } from './agent/instructions.js';
import { createPlaceSearcher } from './places/geocoder.js';
import { FakePlanner } from './agent/fake-planner.js';
import type { PlannerAgent } from './agent/types.js';
import { FixtureProvider } from './providers/fixture.js';
import fixtureRequest from './providers/fixture-request.json';

let app: ReturnType<typeof createServer> | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
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

  it('GET /connect links the app to the server it was opened from', async () => {
    app = createServer();
    const res = await app.inject({ method: 'GET', url: '/connect', headers: { host: 'laptop.example.ts.net', 'x-forwarded-proto': 'https' } });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('href="transit-agent://connect?url=https%3A%2F%2Flaptop.example.ts.net"');
    expect(res.body).toContain('releases/latest/download/transit-agent.apk');
    expect(res.body).not.toContain('Expo Go');
  });

  it('GET /connect uses PUBLIC_URL, APK_URL and EXPO_GO_URL when set', async () => {
    vi.stubEnv('PUBLIC_URL', 'https://public.example/');
    vi.stubEnv('APK_URL', 'https://example.test/a.apk?x=1&y=2');
    vi.stubEnv('EXPO_GO_URL', 'exp://abc.exp.direct');
    app = createServer();
    const res = await app.inject({ method: 'GET', url: '/connect', headers: { host: 'localhost:3001' } });
    expect(res.body).toContain('transit-agent://connect?url=https%3A%2F%2Fpublic.example"');
    expect(res.body).toContain('href="https://example.test/a.apk?x=1&#38;y=2"');
    expect(res.body).toContain('href="exp://abc.exp.direct/--/connect?url=https%3A%2F%2Fpublic.example"');
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

  it.each([['42.3601, -71.0589'], ['42.3601 -71.0589']])('turns %s into a place at those coordinates', async (q) => {
    const res = await get(`/api/places?q=${encodeURIComponent(q)}`);
    expect(res.statusCode).toBe(200);
    expect(res.json().places).toEqual([{ name: '42.3601, -71.0589', coordinates: [-71.0589, 42.3601], kind: 'address' }]);
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

  it('names address-search results by their address, merges duplicates and drops distant towns (#127)', async () => {
    const { calls, fn } = fakeFetch(ok([
      feature("Dunkin'", [-71.0957524, 42.3357476], { osm_key: 'amenity', osm_value: 'fast_food', housenumber: '550', street: 'Huntington Avenue', city: 'Boston' }),
      feature('Alumni Library', [-71.0955638, 42.3356047], { osm_key: 'amenity', osm_value: 'library', housenumber: '550', street: 'Huntington Avenue', city: 'Boston' }),
      feature('Huntington Avenue', [-93.2438987, 44.6722642], { osm_key: 'highway', osm_value: 'residential', city: 'Lakeville' })
    ]));
    const res = await serve(fn)('/api/places?q=550%20Huntington%20Ave&near=-71.06,42.36');
    expect(res.json().places).toEqual([{ name: '550 Huntington Avenue, Boston', coordinates: [-71.0957524, 42.3357476], kind: 'address' }]);
    expect(calls[0]?.searchParams.get('limit')).toBe('10');
  });

  it('keeps distant address matches when none is nearby', async () => {
    const { fn } = fakeFetch(ok([feature('Shop', [-93.2, 44.6], { housenumber: '12', street: 'Main Street', city: 'Lakeville' })]));
    const res = await serve(fn)('/api/places?q=12%20Main%20St&near=-71.06,42.36');
    expect(res.json().places.map((place: { name?: string }) => place.name)).toEqual(['12 Main Street, Lakeville']);
  });

  it('keeps a distant address that matches when a nearby result only shares the street', async () => {
    const { fn } = fakeFetch(ok([
      feature('Main Street', [-71.07, 42.37], { osm_key: 'highway', osm_value: 'residential', city: 'Boston' }),
      feature('Shop', [-79.99, 40.44], { housenumber: '550', street: 'Main Street', city: 'Pittsburgh' })
    ]));
    const res = await serve(fn)('/api/places?q=550%20Main%20St%2C%20Pittsburgh&near=-71.06,42.36');
    expect(res.json().places.map((place: { name?: string }) => place.name)).toEqual(['550 Main Street, Pittsburgh', 'Main Street, Boston']);
  });

  it('keeps same-name stops apart in a name search', async () => {
    const { fn } = fakeFetch(ok([
      feature('Central Square', [-71.1036, 42.3655], { osm_key: 'highway', osm_value: 'bus_stop' }),
      feature('Central Square', [-71.1027, 42.3651], { osm_key: 'highway', osm_value: 'bus_stop' })
    ]));
    const res = await serve(fn)('/api/places?q=Central%20Square');
    expect(res.json().places).toHaveLength(2);
  });

  it('keeps the name and kind of a place whose address the query does not ask for', async () => {
    const { fn } = fakeFetch(ok([
      feature('200 Degrees Coffee', [-1.15, 52.95], { osm_key: 'amenity', osm_value: 'cafe', housenumber: '9', street: 'Market Street', city: 'Nottingham' }),
      feature('Central', [-71.1036, 42.3655], { osm_key: 'railway', osm_value: 'station', housenumber: '300', street: 'Main Street' })
    ]));
    const coffee = await serve(fn)('/api/places?q=200%20Degrees%20Coffee');
    expect(coffee.json().places[0]).toMatchObject({ name: '200 Degrees Coffee, Nottingham' });
    const station = await serve(fn)('/api/places?q=300%20Main%20St');
    expect(station.json().places[0]).toEqual({ name: '300 Main Street, Cambridge', coordinates: [-71.1036, 42.3655], kind: 'station' });
  });

  it.each([['12, rue de Rivoli'], ['Rue de Rivoli 12'], ['Rue de Rivoli, 12'], ['Rue de Rivoli 12, Paris']])('recognises the address in %s', async (q) => {
    const { fn } = fakeFetch(ok([feature('Café', [2.35, 48.86], { osm_key: 'amenity', osm_value: 'cafe', housenumber: '12', street: 'Rue de Rivoli', city: 'Paris' })]));
    const res = await serve(fn)(`/api/places?q=${encodeURIComponent(q)}`);
    expect(res.json().places[0]?.name).toBe('12 Rue de Rivoli, Paris');
  });

  it.each([
    ['9 West St', 'Brattle Book Shop', '9', 'West Street', '9 West Street, Boston'],
    ['550 Main St, Pittsburgh', 'Diner', '550', 'Main Road', 'Diner, Boston'],
    ['5 Market Cafe', 'Market Cafe', '5', 'Market Street', 'Market Cafe, Boston'],
    ['5 Market Boston Pizza', '5 Market Boston Pizza', '5', 'Market Street', '5 Market Boston Pizza, Boston'],
    ['550 Main St, Boston, MA 02118', 'Shop', '550', 'Main Street', '550 Main Street, Boston'],
    ['1 Union Pl Boston CT', 'Subway', '1', 'Union Place', '1 Union Place, Boston'],
    ['10 Summer St', 'Shop', '10', 'Summer Avenue', 'Shop, Boston'],
    ['550 Huntington', 'Dunkin', '550', 'Huntington Avenue', '550 Huntington Avenue, Boston'],
    ['550 N Main St', 'Shop', '550', 'North Main Street', '550 North Main Street, Boston'],
    ['Apt 4, 550 Main St', 'Shop', '4', 'Main Street', 'Shop, Boston'],
    ['550 Main St #4', 'Shop', '4', 'Main Street', 'Shop, Boston'],
    ['550 Main St #4', 'Shop', '550', 'Main Street', '550 Main Street, Boston'],
    ['100 Main St W', 'Shop', '100', 'Main Street', 'Shop, Boston'],
    ['100 Main St W', 'Shop', '100', 'Main Street West', '100 Main Street West, Boston'],
    ['10 Downing Street Cafe', 'Downing Cafe', '10', 'Downing Street', 'Downing Cafe, Boston'],
    ['550 Huntington Boston', 'Dunkin', '550', 'Huntington Avenue', '550 Huntington Avenue, Boston'],
    ['1 Beacon St Boston MA', 'Shop', '1', 'Beacon Street', '1 Beacon Street, Boston']
  ])('for %s, names %s at %s %s as %s', async (q, name, housenumber, street, expected) => {
    const { fn } = fakeFetch(ok([feature(name, [-71.06, 42.36], { osm_key: 'amenity', osm_value: 'cafe', housenumber, street, city: 'Boston' })]));
    const res = await serve(fn)(`/api/places?q=${encodeURIComponent(q)}`);
    expect(res.json().places[0]?.name).toBe(expected);
  });

  it('puts matching addresses ahead of other results before the cap', async () => {
    const { fn } = fakeFetch(ok([
      ...[0, 1, 2, 3, 4].map((i) => feature('Main Street', [-71.06 + i * 0.01, 42.36], { osm_key: 'highway', osm_value: 'residential', city: 'Boston' })),
      feature('Shop', [-79.99, 40.44], { housenumber: '550', street: 'Main Street', city: 'Pittsburgh' })
    ]));
    const res = await serve(fn)('/api/places?q=550%20Main%20St%2C%20Pittsburgh');
    expect(res.json().places[0]?.name).toBe('550 Main Street, Pittsburgh');
    expect(res.json().places).toHaveLength(5);
  });

  it('puts a matching address in the requested city ahead of other matching addresses', async () => {
    const { fn } = fakeFetch(ok([
      ...['Medford', 'Malden', 'Stoneham', 'Watertown', 'Winchester'].map((city, i) => feature('', [-71.1 + i * 0.01, 42.4], { housenumber: '550', street: 'Main Street', city })),
      feature('', [-79.99, 40.44], { housenumber: '550', street: 'Main Street', city: 'Pittsburgh' })
    ]));
    const res = await serve(fn)('/api/places?q=550%20Main%20St%2C%20Pittsburgh&near=-71.06,42.36');
    expect(res.json().places[0]?.name).toBe('550 Main Street, Pittsburgh');
  });

  it('prefers the whole requested city over a shorter name inside it', async () => {
    const { fn } = fakeFetch(ok([
      ...[0, 1, 2, 3, 4].map((i) => feature('', [-72.59 + i * 0.01, 42.1], { housenumber: '550', street: 'Main Street', city: 'Springfield' })),
      feature('', [-72.62, 42.11], { housenumber: '550', street: 'Main Street', city: 'West Springfield' })
    ]));
    const res = await serve(fn)('/api/places?q=550%20Main%20St%2C%20West%20Springfield');
    expect(res.json().places[0]?.name).toBe('550 Main Street, West Springfield');
  });

  it('keeps a state code after the city (1 Union Pl Hartford CT)', async () => {
    const { fn } = fakeFetch(ok([
      feature('Hartford Union Station', [-72.6815, 41.7678], { osm_key: 'building', osm_value: 'train_station', housenumber: '1', street: 'Union Place', city: 'Hartford', state: 'Connecticut' }),
      feature('Subway', [-72.6816, 41.7679], { osm_key: 'amenity', osm_value: 'fast_food', housenumber: '1', street: 'Union Place', city: 'Hartford', state: 'Connecticut' })
    ]));
    const res = await serve(fn)('/api/places?q=1%20Union%20Pl%20Hartford%20CT');
    expect(res.json().places.map((place: { name?: string }) => place.name)).toEqual(['1 Union Place, Hartford']);
  });

  it.each([['1 Union Pl CT'], ['1 Union Pl Hartford CT']])('keeps the address for %s', async (q) => {
    const { fn } = fakeFetch(ok([
      feature('Hartford Union Station', [-72.6815, 41.7678], { osm_key: 'building', osm_value: 'train_station', housenumber: '1', street: 'Union Place', city: 'Hartford', state: 'Connecticut' }),
      feature('Subway', [-72.6816, 41.7679], { osm_key: 'amenity', osm_value: 'fast_food', housenumber: '1', street: 'Union Place', city: 'Hartford', state: 'Connecticut' })
    ]));
    const res = await serve(fn)(`/api/places?q=${encodeURIComponent(q)}`);
    expect(res.json().places.map((place: { name?: string }) => place.name)).toEqual(['1 Union Place, Hartford']);
  });

  it('reads an abbreviated direction in the city (381 Main St W Springfield)', async () => {
    const { fn } = fakeFetch(ok([
      feature('West Springfield Police Dept - Subst.', [-72.62, 42.107], { osm_key: 'amenity', osm_value: 'police', housenumber: '381', street: 'Main Street', city: 'West Springfield', state: 'Massachusetts' }),
      feature('', [-70.25, 43.66], { housenumber: '381', street: 'Main Street', city: 'Westbrook', state: 'Maine' })
    ]));
    const res = await serve(fn)('/api/places?q=381%20Main%20St%20W%20Springfield&near=-72.6,42.1');
    expect(res.json().places.map((place: { name?: string }) => place.name)).toEqual(['381 Main Street, West Springfield']);
  });

  it('does not read a street-type abbreviation as a state code', async () => {
    const { fn } = fakeFetch(ok([feature('Shop', [-72.6, 41.7], { housenumber: '10', street: 'Summer Avenue', city: 'Hartford', state: 'Connecticut' })]));
    const res = await serve(fn)('/api/places?q=10%20Summer%20St');
    expect(res.json().places[0]?.name).toBe('Shop, Hartford');
  });

  it('does not read a court abbreviation as a state code on another street type', async () => {
    const { fn } = fakeFetch(ok([feature('Shop', [-72.6, 41.7], { housenumber: '10', street: 'Summer Street', city: 'Hartford', state: 'Connecticut' })]));
    const res = await serve(fn)('/api/places?q=10%20Summer%20Ct');
    expect(res.json().places[0]?.name).toBe('Shop, Hartford');
  });

  it('gives priority to a city typed before the address', async () => {
    const { fn } = fakeFetch(ok([
      ...['Arlington', 'Lexington', 'Walpole', 'Boston', 'Worcester'].map((city, i) => feature('', [-71.2 + i * 0.01, 42.4], { housenumber: '77', street: 'Massachusetts Avenue', city })),
      feature('', [-71.0937, 42.3594], { housenumber: '77', street: 'Massachusetts Avenue', city: 'Cambridge' })
    ]));
    const res = await serve(fn)('/api/places?q=Cambridge%2077%20Massachusetts%20Ave');
    expect(res.json().places[0]?.name).toBe('77 Massachusetts Avenue, Cambridge');
  });

  it('keeps units at one address apart', async () => {
    const { fn } = fakeFetch(ok([
      feature('A', [-71.06, 42.36], { housenumber: '550', street: 'Main Street', unit: '3' }),
      feature('B', [-71.06, 42.36], { housenumber: '550', street: 'Main Street', unit: '4' })
    ]));
    const res = await serve(fn)('/api/places?q=550%20Main%20St');
    expect(res.json().places.map((place: { name?: string }) => place.name)).toEqual(['550 Main Street #3, Cambridge', '550 Main Street #4, Cambridge']);
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

  it('biases find_place toward the device location and skips Photon for coordinates', async () => {
    const { calls, fn } = fakeFetch(ok(kendallSample));
    const findPlace = createPlannerTools({ location: [-71.06, 42.36], places: createPlaceSearcher({ photonUrl: 'https://photon.test', fetch: fn }) } as never).find((tool) => tool.name === 'find_place')!;
    await findPlace.runAsync({ args: { query: 'Union Square' }, toolContext: {} as never });
    expect(calls[0]?.searchParams.get('lat')).toBe('42.36');
    const places = await findPlace.runAsync({ args: { query: '42.35,-71.05' }, toolContext: {} as never });
    expect(places).toEqual([{ name: '42.35, -71.05', coordinates: [-71.05, 42.35], kind: 'address' }]);
    expect(calls).toHaveLength(1);
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

describe('planner thinking configuration', () => {
  it.each([undefined, '', '   ', 'invalid', 'MINIMAL', ' minimal ', 'THINKING_LEVEL_UNSPECIFIED'])('defaults %s to LOW', (level) => {
    expect(thinkingFor('planner', { AGENT_THINKING_PLANNER: level })).toBe(ThinkingLevel.LOW);
  });

  it.each([
    [' low ', ThinkingLevel.LOW],
    [' Medium ', ThinkingLevel.MEDIUM],
    ['hIgH', ThinkingLevel.HIGH]
  ])('normalizes %s', (level, expected) => {
    expect(thinkingFor('planner', { AGENT_THINKING_PLANNER: level })).toBe(expected);
  });

  it('ignores thinking settings for other tasks and global model settings', () => {
    const env = { AGENT_THINKING_BACKGROUND: 'HIGH', AGENT_THINKING: 'HIGH', GEMINI_MODEL: 'HIGH', AGENT_MODEL_PLANNER: 'HIGH' };
    expect(thinkingFor('planner', env)).toBe(ThinkingLevel.LOW);
    expect(thinkingFor('planner', { ...env, AGENT_THINKING_PLANNER: 'MEDIUM' })).toBe(ThinkingLevel.MEDIUM);
  });

  it.each([
    [undefined, ThinkingLevel.LOW],
    [' medium ', ThinkingLevel.MEDIUM],
    ['HIGH', ThinkingLevel.HIGH],
    ['MINIMAL', ThinkingLevel.LOW]
  ])('passes %s into the model request while retaining planner tools', async (level, expected) => {
    vi.stubEnv('AGENT_THINKING_PLANNER', level);
    vi.stubEnv('AGENT_MODEL_PLANNER', 'gemini-3.8-flash');
    vi.stubEnv('GOOGLE_GENAI_USE_ENTERPRISE', 'false');
    vi.stubEnv('GOOGLE_GENAI_USE_VERTEXAI', 'false');
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    const requests: LlmRequest[] = [];
    vi.spyOn(Gemini.prototype, 'generateContentAsync').mockImplementation(async function* (request) {
      requests.push(request);
      yield { content: { role: 'model', parts: [{ text: 'Where would you like to go?' }] } };
    });
    const planner = new AdkPlanner({ providers: [], itineraries: {} as never, places: {} as never });
    const result = await planner.respond({ deviceId: 'thinking-config-test', message: 'Hello', draft: TripDraftSchema.parse({}) });
    expect(result.reply).toBe('Where would you like to go?');
    expect(requests).toHaveLength(1);
    expect(requests[0]?.config?.thinkingConfig?.thinkingLevel).toBe(expected);
    expect(requests[0]?.config?.tools?.flatMap((tool) => 'functionDeclarations' in tool ? tool.functionDeclarations?.map((declaration) => declaration.name) ?? [] : []).sort()).toEqual([
      'ask_user', 'find_place', 'list_saved_trips', 'search_routes', 'update_trip_draft'
    ]);
  });
});

describe('planner progress (plan 029)', () => {
  it('runs each tool during the turn, so its event comes before the model\'s final answer', async () => {
    vi.stubEnv('GOOGLE_GENAI_USE_ENTERPRISE', 'false');
    vi.stubEnv('GOOGLE_GENAI_USE_VERTEXAI', 'false');
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    const timeline: string[] = [];
    let calls = 0;
    vi.spyOn(Gemini.prototype, 'generateContentAsync').mockImplementation(async function* () {
      calls++;
      timeline.push(`model ${calls}`);
      yield calls === 1
        ? { content: { role: 'model', parts: [{ functionCall: { id: 'call-1', name: 'find_place', args: { query: 'South Station' } } }] } }
        : { content: { role: 'model', parts: [{ text: 'Found it.' }] } };
    });
    const place = { name: 'South Station', coordinates: [-71.055, 42.352] as [number, number] };
    const planner = new AdkPlanner({ providers: [], itineraries: {} as never, places: { search: async () => [place] } });
    const result = await planner.stream({ deviceId: 'progress-order', message: 'to South Station', draft: TripDraftSchema.parse({}) }, (update) => timeline.push(update.type));
    expect(result.reply).toBe('Found it.');
    expect(timeline).toEqual(['thinking', 'model 1', 'places', 'model 2', 'done']);
  });
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
    expect(text).toContain('Today is Saturday 2026-11-14 and the current time is 04:05, timezone America/New_York.');
  });
});

describe('POST /api/agent/messages/stream (plan 029)', () => {
  const body = { sessionId: 'stream-test', message: 'search with a 15 min walk', draft: fixtureRequest };
  const headers = { 'x-device-id': 'stream-device' };
  const lines = (payload: string) => payload.trim().split('\n').map((line) => AgentProgressEventSchema.parse(JSON.parse(line)));

  it('streams a searching turn as thinking … routes … done, one schema-valid event per line', async () => {
    app = createServer({ agent: new FakePlanner([new FixtureProvider()]) });
    const res = await app.inject({ method: 'POST', url: '/api/agent/messages/stream', headers, payload: body });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('application/x-ndjson');
    expect(res.headers['cache-control']).toBe('no-cache');
    const events = lines(res.payload);
    expect(events.map((event) => event.type)).toEqual(['thinking', 'draft', 'searching', 'routes', 'done']);
    expect(events.map((event) => event.seq)).toEqual([0, 1, 2, 3, 4]);
  });

  it('ends with the same response the JSON route returns', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-14T09:00:00Z'));
    try {
      app = createServer({ agent: new FakePlanner([new FixtureProvider()]) });
      const streamed = lines((await app.inject({ method: 'POST', url: '/api/agent/messages/stream', headers, payload: body })).payload).at(-1)!;
      const json = (await app.inject({ method: 'POST', url: '/api/agent/messages', headers, payload: body })).json();
      expect(streamed.type).toBe('done');
      expect(streamed.type === 'done' && streamed.response).toEqual(json);
    } finally {
      vi.useRealTimers();
    }
  });

  it('shares the rate limit with the JSON route', async () => {
    app = createServer({ agent: new FakePlanner() });
    const chat = { ...body, message: 'hello' };
    for (let i = 0; i < 20; i++) await app.inject({ method: 'POST', url: i % 2 ? '/api/agent/messages' : '/api/agent/messages/stream', headers, payload: chat });
    const res = await app.inject({ method: 'POST', url: '/api/agent/messages/stream', headers, payload: chat });
    expect(res.statusCode).toBe(429);
    expect(res.json().error.code).toBe('rate_limited');
  });

  it('answers 503 JSON when no agent is configured', async () => {
    app = createServer();
    const res = await app.inject({ method: 'POST', url: '/api/agent/messages/stream', headers, payload: body });
    expect(res.statusCode).toBe(503);
    expect(res.json().error.code).toBe('agent_unavailable');
  });

  it('sends an error event and ends when the agent fails after the stream started', async () => {
    const failing: PlannerAgent = {
      respond: () => Promise.reject(new Error('unused')),
      stream: async (_input, emit) => {
        emit({ type: 'thinking' });
        throw new Error('model exploded');
      }
    };
    app = createServer({ agent: failing });
    const res = await app.inject({ method: 'POST', url: '/api/agent/messages/stream', headers, payload: body });
    expect(res.statusCode).toBe(200);
    expect(lines(res.payload).map((event) => [event.type, 'code' in event ? event.code : undefined])).toEqual([['thinking', undefined], ['error', 'internal']]);
  });

  it('sends each line as it happens, not all at the end', async () => {
    const slow: PlannerAgent = {
      respond: () => Promise.reject(new Error('unused')),
      stream: async (input, emit) => {
        emit({ type: 'thinking' });
        await new Promise((resolve) => setTimeout(resolve, 300));
        const response = { sessionId: 's', reply: 'ok', draftPatch: {}, questions: [] };
        emit({ type: 'done', response });
        return response;
      }
    };
    app = createServer({ agent: slow });
    const address = await app.listen({ port: 0, host: '127.0.0.1' });
    const started = Date.now();
    const res = await fetch(`${address}/api/agent/messages/stream`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();
    const arrivals: { type: AgentProgressEvent['type']; ms: number }[] = [];
    let buffer = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        arrivals.push({ type: AgentProgressEventSchema.parse(JSON.parse(buffer.slice(0, newline))).type, ms: Date.now() - started });
        buffer = buffer.slice(newline + 1);
      }
    }
    expect(arrivals.map((arrival) => arrival.type)).toEqual(['thinking', 'done']);
    expect(arrivals[1]!.ms - arrivals[0]!.ms).toBeGreaterThanOrEqual(200);
  });
});
