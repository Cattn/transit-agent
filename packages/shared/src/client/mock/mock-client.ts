import { z } from 'zod';
import { ApiClientError, type ApiClient } from '../api-client.js';
import { PlanResponseSchema } from '../../domain/api.js';
import { AgentMessageResponseSchema } from '../../domain/agent.js';
import { PlaceSearchResponseSchema } from '../../domain/place-search.js';
import { SavedItinerarySchema } from '../../domain/itinerary.js';
import { TripRequestSchema, type TripRequest } from '../../domain/trip-draft.js';
import { mockItineraries } from './mock-routes.js';

export type MockScenario = 'normal' | 'empty' | 'nearMissOnly' | 'serverError' | 'offline';

export interface MockApiClientOptions {
  scenario?: MockScenario | (() => MockScenario);
  latencyMs?: number;
  now?: () => Date;
  seedSaved?: boolean;
}

export function createMockApiClient(options: MockApiClientOptions = {}): ApiClient {
  const now = options.now ?? (() => new Date());

  function planTrip(input: TripRequest, scenario: MockScenario) {
    const parsed = TripRequestSchema.safeParse(input);
    if (!parsed.success) throw new ApiClientError(400, 'invalid_request', 'Request validation failed');
    const request = parsed.data;
    if (scenario === 'empty') return PlanResponseSchema.parse({ itineraries: [], nearMisses: [], warnings: ['No routes found for this trip'] });
    const routes = mockItineraries(request, now).map((route) => {
      const violations: string[] = [];
      const c = request.constraints;
      if (c.maxWalkMinutes !== undefined && route.walkMinutes > c.maxWalkMinutes) violations.push(`Walks ${route.walkMinutes} min, over the ${c.maxWalkMinutes} min limit`);
      if (c.maxTransfers !== undefined && route.transfers > c.maxTransfers) violations.push(`${route.transfers} transfer${route.transfers === 1 ? '' : 's'}, more than the ${c.maxTransfers} allowed`);
      if (c.maxBudgetUsd !== undefined && route.cost.totalUsd > c.maxBudgetUsd) violations.push(`Costs $${route.cost.totalUsd.toFixed(2)}, over the $${c.maxBudgetUsd.toFixed(2)} budget`);
      if (c.arriveBy !== undefined && Date.parse(route.arriveAt) > Date.parse(c.arriveBy)) {
        const format = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: request.timeZone });
        violations.push(`Arrives ${format.format(new Date(route.arriveAt))}, after the ${format.format(new Date(c.arriveBy))} deadline`);
      }
      if (scenario === 'nearMissOnly' && violations.length === 0) violations.push('Exceeds the mock scenario constraint');
      return { ...route, violations };
    });
    return PlanResponseSchema.parse({
      itineraries: routes.filter((route) => route.violations.length === 0).sort((a, b) => a.durationMinutes - b.durationMinutes),
      nearMisses: routes.filter((route) => route.violations.length > 0).slice(0, 3), warnings: []
    });
  }
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
    async planTrip(request) {
      const scenario = await beforeCall();
      return planTrip(request, scenario);
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
