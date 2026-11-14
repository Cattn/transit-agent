import { FunctionTool } from '@google/adk';
import { z } from 'zod';
import { AgentQuestionSchema, TripDraftPatchSchema, applyDraftPatch, describePatch, toTripRequest, type AgentQuestion, type PlanResponse, type TripDraft, type TripDraftPatch } from '@transit/shared';
import type { RouteProvider } from '../providers/types.js';
import type { ItineraryStore } from '../store/types.js';
import { planTrip } from '../planning/plan-trip.js';
import { searchPlaces } from '../places/gazetteer.js';

export interface TurnContext {
  deviceId: string;
  draft: TripDraft;
  patch: TripDraftPatch;
  questions: AgentQuestion[];
  plan?: PlanResponse;
  providers: RouteProvider[];
  itineraries: ItineraryStore;
  signal?: AbortSignal;
}

export function createPlannerTools(turn: TurnContext) {
  return [
    new FunctionTool({ name: 'update_trip_draft', description: 'Apply stated trip requirements and preferences.', parameters: TripDraftPatchSchema, execute: (patch: TripDraftPatch) => {
      const next = applyDraftPatch({ draft: turn.draft, provenance: {} }, patch, 'agent');
      turn.patch = { ...turn.patch, ...patch,
        constraints: { ...turn.patch.constraints, ...patch.constraints },
        preferences: { ...turn.patch.preferences, ...patch.preferences },
        vehicles: { ...turn.patch.vehicles, ...patch.vehicles } };
      turn.draft = next.draft;
      const request = toTripRequest(turn.draft);
      return { status: 'updated', draftSummary: describePatch(patch), missing: request.ok ? [] : request.missing };
    } }),
    new FunctionTool({ name: 'find_place', description: 'Find up to five known places by name or airport code.', parameters: z.object({ query: z.string() }), execute: ({ query }: { query: string }) => searchPlaces(query) }),
    new FunctionTool({ name: 'search_routes', description: 'Search actual route providers for the current draft.', parameters: z.object({}), execute: async () => {
      const request = toTripRequest(turn.draft);
      if (!request.ok) return { status: 'incomplete', missing: request.missing };
      turn.plan = await planTrip(request.request, turn.providers, turn.signal);
      const compact = ({ id, summary, departAt, arriveAt, durationMinutes, cost, risk, violations }: PlanResponse['itineraries'][number]) => ({ id, summary, departAt, arriveAt, durationMinutes, cost: { totalUsd: cost.totalUsd }, risk, violations });
      return { itineraries: turn.plan.itineraries.map(compact), nearMisses: turn.plan.nearMisses.map(compact), warnings: turn.plan.warnings };
    } }),
    new FunctionTool({ name: 'ask_user', description: 'Queue a focused question about a missing or ambiguous field.', parameters: AgentQuestionSchema, execute: (question: AgentQuestion) => { turn.questions.push(question); return { status: 'queued' }; } }),
    new FunctionTool({ name: 'list_saved_trips', description: 'Read up to twenty saved trips for this device.', parameters: z.object({}), execute: async () => (await turn.itineraries.list(turn.deviceId)).slice(0, 20).map(({ id, label, summary, departAt, arriveAt, request, watch }) => ({ id, label, summary, departAt, arriveAt, watch, request: { origin: request.origin, destination: request.destination, time: request.time, modes: request.modes } })) })
  ];
}
