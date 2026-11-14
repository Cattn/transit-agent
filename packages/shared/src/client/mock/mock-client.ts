import { z } from 'zod';
import { ApiClientError, type ApiClient } from '../api-client.js';
import { PlanResponseSchema } from '../../domain/api.js';
import { AgentMessageResponseSchema } from '../../domain/agent.js';
import { PlaceSearchResponseSchema } from '../../domain/place-search.js';
import { SavedItinerarySchema } from '../../domain/itinerary.js';

export type MockScenario = 'normal' | 'empty' | 'nearMissOnly' | 'serverError' | 'offline';

export interface MockApiClientOptions {
  scenario?: MockScenario | (() => MockScenario);
  latencyMs?: number;
  now?: () => Date;
  seedSaved?: boolean;
}

export function createMockApiClient(options: MockApiClientOptions = {}): ApiClient {
  async function beforeCall() {
    await new Promise((resolve) => setTimeout(resolve, options.latencyMs ?? 400));
    const scenario = typeof options.scenario === 'function' ? options.scenario() : options.scenario ?? 'normal';
    if (scenario === 'serverError') throw new ApiClientError(500, 'internal', 'Internal error');
    if (scenario === 'offline') throw new ApiClientError(0, 'network', 'Network error');
    return scenario;
  }

  function notFound(): never {
    throw new ApiClientError(404, 'not_found', 'Itinerary not found');
  }

  return {
    async health() {
      await beforeCall();
      return z.object({ status: z.literal('ok'), service: z.string() }).parse({ status: 'ok', service: 'mock' });
    },
    async sections() {
      await beforeCall();
      return z.array(z.object({ id: z.enum(['flight', 'commute', 'biking', 'agent']), title: z.string(), description: z.string() })).parse([]);
    },
    async planTrip() {
      await beforeCall();
      return PlanResponseSchema.parse({ itineraries: [], nearMisses: [], warnings: [] });
    },
    async listItineraries() {
      await beforeCall();
      return z.array(SavedItinerarySchema).parse([]);
    },
    async getItinerary() { await beforeCall(); return notFound(); },
    async saveItinerary(input) {
      await beforeCall();
      return SavedItinerarySchema.parse({ ...input.itinerary, ...input, savedAt: (options.now?.() ?? new Date()).toISOString() });
    },
    async updateItinerary() { await beforeCall(); return notFound(); },
    async deleteItinerary() { await beforeCall(); return notFound(); },
    async sendAgentMessage() {
      await beforeCall();
      return AgentMessageResponseSchema.parse({ sessionId: 'mock-session', reply: '', draftPatch: {}, questions: [] });
    },
    async searchPlaces() {
      await beforeCall();
      return PlaceSearchResponseSchema.parse({ places: [] }).places;
    }
  };
}
