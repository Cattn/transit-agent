import type { z } from 'zod';
import {
  ApiErrorSchema,
  PlanResponseSchema,
  SavedItineraryListSchema,
  type PlanResponse,
  type SaveItineraryRequest
} from '../domain/api.js';
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
    let response: Response;
    try {
      response = await doFetch(`${url}${path}`, {
        method,
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: controller.signal
      });
    } catch (error) {
      clearTimeout(timeout);
      const reason = controller.signal.aborted ? 'timed out' : error instanceof Error ? error.message : String(error);
      throw new ApiClientError(0, 'network', `API request ${method} ${path} failed: ${reason}`, error);
    }

    try {
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        let json: unknown;
        try { json = text ? JSON.parse(text) : undefined; } catch { json = undefined; }
        const parsed = ApiErrorSchema.safeParse(json);
        if (parsed.success) {
          const { code, message, details } = parsed.data.error;
          throw new ApiClientError(response.status, code, message, details);
        }
        throw new ApiClientError(response.status, 'http_error', `API request failed (${response.status})`, text || undefined);
      }
      if (response.status === 204) return undefined as T;
      const json: unknown = await response.json();
      return init.schema ? init.schema.parse(json) : json as T;
    } catch (error) {
      if (error instanceof ApiClientError) throw error;
      if (controller.signal.aborted) {
        throw new ApiClientError(0, 'network', `API request ${method} ${path} failed: timed out`, error);
      }
      throw error;
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
    }
  };
}

/** The client's shape. Alternative implementations (e.g. the mock client, plan 012) implement this. */
export type ApiClient = ReturnType<typeof createApiClient>;
