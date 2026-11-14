import { z } from 'zod';
import { ApiClientError, type ApiClient } from '../api-client.js';
import { PlanResponseSchema } from '../../domain/api.js';
import { AgentMessageResponseSchema } from '../../domain/agent.js';
import { PlaceSearchResponseSchema } from '../../domain/place-search.js';
import { SavedItinerarySchema, type SavedItinerary } from '../../domain/itinerary.js';
import { TravelProfileSchema, type TravelProfile } from '../../domain/profile.js';
import { sections } from '../../index.js';
import { TripRequestSchema, type TripRequest } from '../../domain/trip-draft.js';
import { mockItineraries } from './mock-routes.js';
import { mockAgentReply } from './mock-agent.js';
import { mockSearchPlaces } from './mock-places.js';

export type MockScenario = 'normal' | 'empty' | 'nearMissOnly' | 'serverError' | 'offline';

export interface MockApiClientOptions {
  scenario?: MockScenario | (() => MockScenario);
  latencyMs?: number;
  now?: () => Date;
  seedSaved?: boolean;
}

export function createMockApiClient(options: MockApiClientOptions = {}): ApiClient {
  const now = options.now ?? (() => new Date());
  const saved = new Map<string, SavedItinerary>();
  let profile: TravelProfile | undefined;
  if (options.seedSaved ?? true) {
    const clock = now();
    for (const [minutes, label] of [[25, 'Morning commute'], [180, 'Dinner']] as const) {
      const request = TripRequestSchema.parse({
        origin: { name: 'Boston Common', coordinates: [-71.0656, 42.355] },
        destination: { name: 'Harvard Square', coordinates: [-71.119, 42.3734] },
        time: { type: 'departAt', at: new Date(clock.getTime() + minutes * 60000).toISOString() }
      });
      const itinerary = mockItineraries(request, now)[0]!;
      saved.set(itinerary.id, SavedItinerarySchema.parse({ ...itinerary, savedAt: clock.toISOString(), label, watch: true, request }));
    }
  }

  function getSaved(id: string): SavedItinerary {
    const itinerary = saved.get(id);
    if (!itinerary) return notFound();
    return SavedItinerarySchema.parse(itinerary);
  }

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
      return z.array(z.object({ id: z.enum(['flight', 'commute', 'biking', 'agent']), title: z.string(), description: z.string() })).parse(sections);
    },
    /** Mock results sort by duration and do not reproduce server ranking. */
    async planTrip(request) {
      const scenario = await beforeCall();
      return planTrip(request, scenario);
    },
    async listItineraries() {
      await beforeCall();
      return z.array(SavedItinerarySchema).parse([...saved.values()].sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt)));
    },
    async getItinerary(id) { await beforeCall(); return getSaved(id); },
    async getProfile() {
      await beforeCall();
      return profile && TravelProfileSchema.parse(profile);
    },
    async putProfile(input) {
      await beforeCall();
      profile = TravelProfileSchema.parse({ ...input, updatedAt: now().toISOString() });
      return TravelProfileSchema.parse(profile);
    },
    async saveItinerary(input) {
      await beforeCall();
      const itinerary = SavedItinerarySchema.parse({ ...input.itinerary, savedAt: now().toISOString(), label: input.label, watch: input.watch, request: input.request });
      saved.set(itinerary.id, itinerary);
      return SavedItinerarySchema.parse(itinerary);
    },
    async updateItinerary(id, patch) {
      await beforeCall();
      const itinerary = SavedItinerarySchema.parse({ ...getSaved(id), ...patch });
      saved.set(id, itinerary);
      return SavedItinerarySchema.parse(itinerary);
    },
    async deleteItinerary(id) {
      await beforeCall();
      getSaved(id);
      saved.delete(id);
      return z.undefined().parse(undefined);
    },
    async sendAgentMessage(body) {
      const scenario = await beforeCall();
      return AgentMessageResponseSchema.parse(mockAgentReply(body, now(), (request) => planTrip(request, scenario)));
    },
    async searchPlaces(q) {
      await beforeCall();
      return PlaceSearchResponseSchema.parse({ places: mockSearchPlaces(q) }).places;
    }
  };
}
