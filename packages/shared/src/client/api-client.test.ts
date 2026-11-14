import { describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { sampleItinerary } from '../domain/fixtures.js';
import { ApiClientError, createApiClient } from './api-client.js';

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

  it('reports a missing agent endpoint as not_found', async () => {
    const fetch = stubFetch(json({ error: { code: 'not_found', message: 'Route POST:/api/agent/messages not found' } }, 404));
    const error = await catchError(createApiClient('http://x', { fetch }).sendAgentMessage({ message: 'hi', draft: tripRequest }));
    expect(error).toMatchObject({ status: 404, code: 'not_found' });
    expect(fetch.mock.calls[0]?.[0]).toBe('http://x/api/agent/messages');
  });
});
