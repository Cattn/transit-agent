import type { z } from 'zod';
import {
  ApiErrorSchema,
  PlanResponseSchema,
  SavedItineraryListSchema,
  type PlanResponse,
  type SaveItineraryRequest
} from '../domain/api.js';
import { AgentMessageResponseSchema, type AgentMessageRequest, type AgentMessageResponse } from '../domain/agent.js';
import { PlaceSearchResponseSchema } from '../domain/place-search.js';
import type { LngLat, Place } from '../domain/places.js';
import { SavedItinerarySchema, type SavedItinerary } from '../domain/itinerary.js';
import type { TripRequest } from '../domain/trip-draft.js';
import type { HealthResponse, Section } from '../index.js';

/** Every failed API call rejects with this. `status` is 0 for network errors and timeouts. */
export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export interface ApiClientOptions {
  /** Sent as the `x-device-id` header. Pass a function to read the current value on every request. */
  deviceId?: string | (() => string | undefined);
  /** Default request timeout in ms (8000). Some methods use a longer one. */
  timeoutMs?: number;
  /** Override the fetch implementation (tests, custom transports). Defaults to the global fetch. */
  fetch?: typeof fetch;
}

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface RequestOptions<T> {
  body?: unknown;
  schema?: z.ZodType<T>;
  timeoutMs?: number;
}

export function createApiClient(baseUrl: string, options: ApiClientOptions = {}) {
  const url = baseUrl.replace(/\/$/, '');
  const defaultTimeoutMs = options.timeoutMs ?? 8000;

  function currentDeviceId(): string | undefined {
    const { deviceId } = options;
    return typeof deviceId === 'function' ? deviceId() : deviceId;
  }

  async function request<T>(method: HttpMethod, path: string, init: RequestOptions<T> = {}): Promise<T> {
    const doFetch = options.fetch ?? globalThis.fetch;
    const headers: Record<string, string> = { accept: 'application/json' };
    if (init.body !== undefined) headers['content-type'] = 'application/json';
    const deviceId = currentDeviceId();
    if (deviceId) headers['x-device-id'] = deviceId;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), init.timeoutMs ?? defaultTimeoutMs);

    const networkError = (error: unknown) => {
      const reason = controller.signal.aborted ? 'timed out' : error instanceof Error ? error.message : String(error);
      return new ApiClientError(0, 'network', `API request ${method} ${path} failed: ${reason}`, error);
    };

    /** Rejects when the timeout fires, even if the transport ignores the abort signal while streaming the body. */
    const aborted = new Promise<never>((_resolve, reject) => {
      controller.signal.addEventListener('abort', () => reject(new Error('timed out')), { once: true });
    });
    aborted.catch(() => undefined); // only observed through Promise.race below

    try {
      // Phase (a): send the request. Any failure here is a transport failure.
      let response: Response;
      try {
        response = await Promise.race([
          doFetch(`${url}${path}`, {
            method,
            headers,
            body: init.body === undefined ? undefined : JSON.stringify(init.body),
            signal: controller.signal
          }),
          aborted
        ]);
      } catch (error) {
        throw networkError(error);
      }

      if (response.ok && response.status === 204) return undefined as T;

      // Phase (b): read the body. A dropped connection or timeout mid-body is also a transport failure.
      let text: string;
      try {
        text = await Promise.race([response.text(), aborted]);
      } catch (error) {
        throw networkError(error);
      }

      // Phase (c): parse JSON, then validate. Schema mismatches throw the ZodError unchanged (004-Q1).
      let json: unknown;
      let isJson = text.length > 0;
      if (isJson) {
        try { json = JSON.parse(text); } catch { isJson = false; }
      }

      if (!response.ok) {
        const parsed = ApiErrorSchema.safeParse(json);
        if (isJson && parsed.success) {
          const { code, message, details } = parsed.data.error;
          throw new ApiClientError(response.status, code, message, details);
        }
        throw new ApiClientError(response.status, 'http_error', `API request failed (${response.status})`, text || undefined);
      }
      if (!isJson) {
        throw new ApiClientError(response.status, 'invalid_response', `API response for ${method} ${path} was not valid JSON`, text || undefined);
      }
      return init.schema ? init.schema.parse(json) : json as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  const itineraryPath = (id: string) => `/api/itineraries/${encodeURIComponent(id)}`;

  return {
    health: (): Promise<HealthResponse> => request<HealthResponse>('GET', '/api/health'),
    sections: (): Promise<Section[]> => request<Section[]>('GET', '/api/sections'),

    /** POST /api/plan. Longer timeout: planning fans out to several providers. */
    planTrip: (tripRequest: TripRequest): Promise<PlanResponse> =>
      request('POST', '/api/plan', { body: tripRequest, schema: PlanResponseSchema, timeoutMs: 20_000 }),

    /** GET /api/itineraries (requires a device id). Newest first. */
    listItineraries: async (): Promise<SavedItinerary[]> =>
      (await request('GET', '/api/itineraries', { schema: SavedItineraryListSchema })).itineraries,

    getItinerary: (id: string): Promise<SavedItinerary> =>
      request('GET', itineraryPath(id), { schema: SavedItinerarySchema }),

    saveItinerary: (input: SaveItineraryRequest): Promise<SavedItinerary> =>
      request('POST', '/api/itineraries', { body: input, schema: SavedItinerarySchema }),

    updateItinerary: (id: string, patch: { label?: string; watch?: boolean }): Promise<SavedItinerary> =>
      request('PATCH', itineraryPath(id), { body: patch, schema: SavedItinerarySchema }),

    deleteItinerary: async (id: string): Promise<void> => {
      await request<undefined>('DELETE', itineraryPath(id));
    },

    /** POST /api/agent/messages (plan 006). Long timeout: the agent may call tools and plan a trip. */
    sendAgentMessage: (body: AgentMessageRequest): Promise<AgentMessageResponse> =>
      request('POST', '/api/agent/messages', { body, schema: AgentMessageResponseSchema, timeoutMs: 45_000 }),

    /** GET /api/places?q=&near=lng,lat (plan 007). `near` biases results toward a point. */
    searchPlaces: async (q: string, near?: LngLat): Promise<Place[]> => {
      let path = `/api/places?q=${encodeURIComponent(q)}`;
      if (near) path += `&near=${near[0]},${near[1]}`;
      return (await request('GET', path, { schema: PlaceSearchResponseSchema })).places;
    }
  };
}

/** The client's shape. Alternative implementations (e.g. the mock client, plan 012) implement this. */
export type ApiClient = ReturnType<typeof createApiClient>;
