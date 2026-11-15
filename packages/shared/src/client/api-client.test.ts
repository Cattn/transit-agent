import { describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { sampleItinerary } from '../domain/fixtures.js';
import { ApiClientError, createApiClient } from './api-client.js';
import type { AgentProgressEvent } from '../domain/agent.js';

function stubFetch(response: Response) {
  return vi.fn(async (url: string, init: RequestInit) => {
    void url; void init; // typed so tests can read mock.calls
    return response.clone();
  });
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const tripRequest = {
  origin: { name: 'Home', coordinates: [-71.06, 42.36] as [number, number] },
  destination: { name: 'Work', coordinates: [-71.09, 42.34] as [number, number] },
  time: { type: 'departAt' as const, at: '2026-11-13T08:00:00-05:00' },
  modes: ['walk' as const, 'bus' as const],
  vehicles: { ownsBike: false, ownsCar: false },
  constraints: {},
  preferences: { comfortVsCost: 0.5, transferRisk: 0.3, lateTolerance: 'some' as const, activeTravel: 0.5 }
};

async function catchError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected promise to reject');
}

describe('createApiClient', () => {
  it('handles a trailing slash on the base url', async () => {
    const fetch = stubFetch(json({ status: 'ok', service: 't' }));
    await createApiClient('http://x/', { fetch }).health();
    expect(fetch.mock.calls[0]?.[0]).toBe('http://x/api/health');
  });

  it('sets x-device-id from a string or a function', async () => {
    const fetch = stubFetch(json({ itineraries: [] }));
    await createApiClient('http://x', { fetch, deviceId: 'device-123' }).listItineraries();
    let deviceId = 'first-device';
    const client = createApiClient('http://x', { fetch, deviceId: () => deviceId });
    deviceId = 'later-device';
    await client.listItineraries();
    const headers = fetch.mock.calls.map((call) => (call[1].headers as Record<string, string>)['x-device-id']);
    expect(headers).toEqual(['device-123', 'later-device']);
  });

  it('omits x-device-id when none is available', async () => {
    const fetch = stubFetch(json({ status: 'ok', service: 't' }));
    await createApiClient('http://x', { fetch, deviceId: () => undefined }).health();
    expect(fetch.mock.calls[0]?.[1].headers).not.toHaveProperty('x-device-id');
  });

  it('maps an API error body to ApiClientError with the server code', async () => {
    const fetch = stubFetch(json({ error: { code: 'not_found', message: 'No such itinerary', details: { id: 'a' } } }, 404));
    const error = await catchError(createApiClient('http://x', { fetch }).getItinerary('a'));
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({ status: 404, code: 'not_found', message: 'No such itinerary', details: { id: 'a' } });
  });

  it("reports a non-JSON 502 as code 'http_error'", async () => {
    const fetch = stubFetch(new Response('<html>Bad gateway</html>', { status: 502 }));
    const error = await catchError(createApiClient('http://x', { fetch }).health());
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({ status: 502, code: 'http_error' });
  });

  it("reports a timeout as code 'network' with status 0", async () => {
    const fetch = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
    }));
    const error = await catchError(createApiClient('http://x', { fetch, timeoutMs: 10 }).health());
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({ status: 0, code: 'network' });
  });

  it("reports a failed connection as code 'network'", async () => {
    const fetch = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    const error = await catchError(createApiClient('http://x', { fetch }).health());
    expect(error).toMatchObject({ status: 0, code: 'network' });
  });

  it('returns undefined for 204 and encodes the id in the path', async () => {
    const fetch = stubFetch(new Response(null, { status: 204 }));
    await expect(createApiClient('http://x', { fetch }).deleteItinerary('a/b c')).resolves.toBeUndefined();
    expect(fetch.mock.calls[0]?.[0]).toBe('http://x/api/itineraries/a%2Fb%20c');
    expect(fetch.mock.calls[0]?.[1].method).toBe('DELETE');
  });

  it('posts planTrip as JSON and validates the response', async () => {
    const fetch = stubFetch(json({ itineraries: [sampleItinerary], nearMisses: [], warnings: [] }));
    const result = await createApiClient('http://x', { fetch }).planTrip(tripRequest);
    expect(result.itineraries).toHaveLength(1);
    const init = fetch.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect((init?.headers as Record<string, string>)['content-type']).toBe('application/json');
    expect(JSON.parse(init?.body as string)).toEqual(tripRequest);
  });

  it('rejects a response that does not match the shared schema', async () => {
    const fetch = stubFetch(json({ itineraries: 'nope' }));
    const error = await catchError(createApiClient('http://x', { fetch }).planTrip(tripRequest));
    expect(error).toBeInstanceOf(ZodError);
  });

  it('unwraps listItineraries and searchPlaces responses', async () => {
    const fetch = vi.fn(async (url: string) => url.startsWith('http://x/api/places')
      ? json({ places: [{ name: 'South Station', coordinates: [-71.055, 42.352] }] })
      : json({ itineraries: [] }));
    const client = createApiClient('http://x', { fetch });
    await expect(client.listItineraries()).resolves.toEqual([]);
    const places = await client.searchPlaces('south st&n', [-71.06, 42.36]);
    expect(places[0]?.name).toBe('South Station');
    expect(fetch.mock.calls[1]?.[0]).toBe('http://x/api/places?q=south%20st%26n&near=-71.06,42.36');
  });

  describe('body-read failures', () => {
    const failingBody = (status: number) => new Response(
      new ReadableStream({ start(controller) { controller.error(new TypeError('connection reset')); } }),
      { status }
    );

    it("reports a 2xx body-read failure as 'network' with the cause attached", async () => {
      const fetch = vi.fn(async () => failingBody(200));
      const error = await catchError(createApiClient('http://x', { fetch }).planTrip(tripRequest));
      expect(error).toBeInstanceOf(ApiClientError);
      expect(error).toMatchObject({ status: 0, code: 'network' });
      expect((error as ApiClientError).details).toBeInstanceOf(TypeError);
    });

    it("reports a 500 body-read failure as 'network', not 'http_error'", async () => {
      const fetch = vi.fn(async () => failingBody(500));
      const error = await catchError(createApiClient('http://x', { fetch }).health());
      expect(error).toBeInstanceOf(ApiClientError);
      expect(error).toMatchObject({ status: 0, code: 'network' });
    });

    it("reports a timeout during a slow body read as 'network'", async () => {
      // Headers arrive immediately; the body never finishes and the stream ignores the abort signal.
      const fetch = vi.fn(async () => new Response(new ReadableStream({ start() { /* never enqueues */ } }), { status: 200 }));
      const error = await catchError(createApiClient('http://x', { fetch, timeoutMs: 20 }).health());
      expect(error).toBeInstanceOf(ApiClientError);
      expect(error).toMatchObject({ status: 0, code: 'network' });
      expect((error as ApiClientError).message).toMatch(/timed out/);
    });

    it("reports a 2xx response with invalid JSON as 'invalid_response'", async () => {
      const fetch = vi.fn(async () => new Response('<html>captive portal</html>', { status: 200 }));
      const error = await catchError(createApiClient('http://x', { fetch }).planTrip(tripRequest));
      expect(error).toBeInstanceOf(ApiClientError);
      expect(error).toMatchObject({ status: 200, code: 'invalid_response' });
    });

    it('still throws the ZodError unchanged on a schema mismatch', async () => {
      const fetch = vi.fn(async () => json({ places: [{ name: 'No coordinates' }] }));
      const error = await catchError(createApiClient('http://x', { fetch }).searchPlaces('x'));
      expect(error).toBeInstanceOf(ZodError);
      expect(error).not.toBeInstanceOf(ApiClientError);
    });
  });

  it('reports a missing agent endpoint as not_found', async () => {
    const fetch = stubFetch(json({ error: { code: 'not_found', message: 'Route POST:/api/agent/messages not found' } }, 404));
    const error = await catchError(createApiClient('http://x', { fetch }).sendAgentMessage({ message: 'hi', draft: tripRequest }));
    expect(error).toMatchObject({ status: 404, code: 'not_found' });
    expect(fetch.mock.calls[0]?.[0]).toBe('http://x/api/agent/messages');
  });
});

it('gets and puts validated profiles with device headers', async () => {
  const profile = { displayName: 'Commuter', defaults: {}, updatedAt: '2026-11-13T13:00:00Z' };
  const fetch = stubFetch(json(profile));
  const client = createApiClient('http://x', { fetch, deviceId: 'test-device' });
  expect(await client.getProfile()).toEqual(profile);
  expect(await client.putProfile({ displayName: 'Commuter' })).toEqual(profile);
  expect(fetch.mock.calls.map(([url, init]) => [url, init.method, (init.headers as Record<string, string>)['x-device-id']]))
    .toEqual([['http://x/api/profile', 'GET', 'test-device'], ['http://x/api/profile', 'PUT', 'test-device']]);
  expect(JSON.parse(fetch.mock.calls[1]![1].body as string)).toEqual({ displayName: 'Commuter' });
});

it('returns undefined only for profile 404s and validates profile responses', async () => {
  const missing = createApiClient('http://x', { fetch: stubFetch(json({ error: { code: 'not_found', message: 'Missing' } }, 404)) });
  await expect(missing.getProfile()).resolves.toBeUndefined();
  const unauthorized = createApiClient('http://x', { fetch: stubFetch(json({ error: { code: 'missing_device_id', message: 'Required' } }, 400)) });
  await expect(unauthorized.getProfile()).rejects.toMatchObject({ status: 400 });
  const invalid = createApiClient('http://x', { fetch: stubFetch(json({ updatedAt: 'bad' })) });
  await expect(invalid.getProfile()).rejects.toBeInstanceOf(ZodError);
  await expect(invalid.putProfile({})).rejects.toBeInstanceOf(ZodError);
});

describe('streamAgentMessage (plan 029)', () => {
  const at = '2026-11-14T09:00:00.000Z';
  const response = { sessionId: 's1', reply: 'Here you go.', draftPatch: {}, questions: [] };
  const line = (event: object) => `${JSON.stringify({ at, ...event })}\n`;
  const chunked = (text: string, sizes: number[]) => {
    const bytes = new TextEncoder().encode(text);
    const parts: Uint8Array[] = [];
    let offset = 0;
    for (const size of sizes) {
      parts.push(bytes.slice(offset, offset + size));
      offset += size;
    }
    parts.push(bytes.slice(offset));
    return new ReadableStream<Uint8Array>({ start(controller) { for (const part of parts) controller.enqueue(part); controller.close(); } });
  };
  const streamed = (text: string, sizes: number[] = []) =>
    vi.fn(async (url: string, init: RequestInit) => {
      void url; void init;
      return new Response(chunked(text, sizes), { status: 200, headers: { 'content-type': 'application/x-ndjson' } });
    });

  it('reports every event in order, even when lines are split across chunks, and resolves with done.response', async () => {
    const text = line({ type: 'thinking', seq: 0 }) + line({ type: 'searching', seq: 1, origin: tripRequest.origin, destination: tripRequest.destination }) + line({ type: 'done', seq: 2, response });
    const fetch = streamed(text, [5, 40, 3]);
    const events: AgentProgressEvent[] = [];
    const result = await createApiClient('http://x', { fetch, deviceId: 'd1' }).streamAgentMessage({ message: 'hi', draft: tripRequest }, (event) => events.push(event));
    expect(events.map((event) => event.type)).toEqual(['thinking', 'searching', 'done']);
    expect(result).toEqual(response);
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe('http://x/api/agent/messages/stream');
    expect((init.headers as Record<string, string>)['x-device-id']).toBe('d1');
  });

  it('falls back to the JSON route and reports one done event when the fetch cannot stream', async () => {
    const fetch = vi.fn(async (url: string, init: RequestInit) => {
      void init;
      return url.endsWith('/stream') ? new Response(null, { status: 200 }) : json(response);
    });
    const events: AgentProgressEvent[] = [];
    const result = await createApiClient('http://x', { fetch }).streamAgentMessage({ message: 'hi', draft: tripRequest }, (event) => events.push(event));
    expect(result).toEqual(response);
    expect(events.map((event) => event.type)).toEqual(['done']);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual(['http://x/api/agent/messages/stream', 'http://x/api/agent/messages']);
  });

  it('falls back to the JSON route when the server has no stream route (404)', async () => {
    const fetch = vi.fn(async (url: string, init: RequestInit) => {
      void init;
      return url.endsWith('/stream') ? json({ error: { code: 'not_found', message: 'Route not found' } }, 404) : json(response);
    });
    const events: AgentProgressEvent[] = [];
    const result = await createApiClient('http://x', { fetch }).streamAgentMessage({ message: 'hi', draft: tripRequest }, (event) => events.push(event));
    expect(result).toEqual(response);
    expect(events.map((event) => event.type)).toEqual(['done']);
  });

  it('uses streamFetch for the stream only, when given', async () => {
    const fetch = stubFetch(json(response));
    const streamFetch = streamed(line({ type: 'done', seq: 0, response }));
    await createApiClient('http://x', { fetch, streamFetch }).streamAgentMessage({ message: 'hi', draft: tripRequest }, () => undefined);
    expect(streamFetch).toHaveBeenCalledTimes(1);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('rejects with ApiClientError on an error event', async () => {
    const fetch = streamed(line({ type: 'thinking', seq: 0 }) + line({ type: 'error', seq: 1, code: 'internal', message: 'Internal error' }));
    const error = await catchError(createApiClient('http://x', { fetch }).streamAgentMessage({ message: 'hi', draft: tripRequest }, () => undefined));
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({ code: 'internal', message: 'Internal error' });
  });

  it('uses the JSON error body when the server refuses before streaming', async () => {
    const fetch = stubFetch(json({ error: { code: 'agent_unavailable', message: 'No agent' } }, 503));
    const error = await catchError(createApiClient('http://x', { fetch }).streamAgentMessage({ message: 'hi', draft: tripRequest }, () => undefined));
    expect(error).toMatchObject({ status: 503, code: 'agent_unavailable' });
  });

  it('rejects as a network error when the stream ends before done', async () => {
    const fetch = streamed(line({ type: 'thinking', seq: 0 }));
    const error = await catchError(createApiClient('http://x', { fetch }).streamAgentMessage({ message: 'hi', draft: tripRequest }, () => undefined));
    expect(error).toMatchObject({ status: 0, code: 'network' });
  });
});
