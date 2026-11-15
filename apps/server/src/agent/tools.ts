import { FunctionTool, type ToolInputParameters } from '@google/adk';
import { z } from 'zod';
import { AgentQuestionSchema, TripDraftPatchSchema, applyDraftPatch, describePatch, toTripRequest, type AgentQuestion, type PlanResponse, type TripDraft, type TripDraftPatch } from '@transit/shared';
import type { RouteProvider } from '../providers/types.js';
import type { ItineraryStore } from '../store/types.js';
import { planTrip } from '../planning/plan-trip.js';
import type { PlaceSearcher } from '../places/geocoder.js';
import type { ProgressEmitter } from './types.js';

export interface TurnContext {
  deviceId: string;
  draft: TripDraft;
  patch: TripDraftPatch;
  questions: AgentQuestion[];
  plan?: PlanResponse;
  providers: RouteProvider[];
  itineraries: ItineraryStore;
  places: PlaceSearcher;
  signal?: AbortSignal;
  emit?: ProgressEmitter;
}

const unsupportedSchemaKeys = new Set(['exclusiveMinimum', 'exclusiveMaximum']);

export function stripUnsupportedSchemaKeys<T>(value: T): T {
  if (Array.isArray(value)) return value.map(stripUnsupportedSchemaKeys) as T;
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !unsupportedSchemaKeys.has(key))
    .map(([key, child]) => [key, key === 'properties' ? Object.fromEntries(Object.entries(child as object).map(([name, field]) => [name, stripUnsupportedSchemaKeys(field)])) : stripUnsupportedSchemaKeys(child)])) as T;
}

class PlannerTool<T extends ToolInputParameters> extends FunctionTool<T> {
  override _getDeclaration() {
    const declaration = super._getDeclaration();
    return { ...declaration, parameters: stripUnsupportedSchemaKeys(declaration.parameters) };
  }
}

export function createPlannerTools(turn: TurnContext) {
  let revision = 0;
  const report: ProgressEmitter = (update) => {
    try {
      turn.emit?.(update);
    } catch {
      return;
    }
  };
  return [
    new PlannerTool({ name: 'update_trip_draft', description: 'Apply every requirement and preference stated this turn in one call. Search only after this returns.', parameters: TripDraftPatchSchema.omit({ timeZone: true }), execute: (patch: TripDraftPatch) => {
      const next = applyDraftPatch({ draft: turn.draft, provenance: {} }, patch, 'agent');
      turn.patch = { ...turn.patch, ...patch,
        constraints: { ...turn.patch.constraints, ...patch.constraints },
        preferences: { ...turn.patch.preferences, ...patch.preferences },
        vehicles: { ...turn.patch.vehicles, ...patch.vehicles } };
      turn.draft = next.draft;
      revision++;
      turn.plan = undefined;
      report({ type: 'draft', patch, draft: turn.draft });
      const request = toTripRequest(turn.draft);
      return { status: 'updated', draftSummary: describePatch(patch), missing: request.ok ? [] : request.missing };
    } }),
    new PlannerTool({ name: 'find_place', description: 'Find up to five places (stations, airports, landmarks, addresses) by name, address or airport code. Look up all places in the same step.', parameters: z.object({ query: z.string() }), execute: async ({ query }: { query: string }) => {
      const places = await turn.places.search(query);
      report({ type: 'places', query, places });
      return places;
    } }),
    new PlannerTool({ name: 'search_routes', description: 'Search actual route providers for the current draft. Call only after update_trip_draft has returned.', parameters: z.object({}), execute: async () => {
      const request = toTripRequest(turn.draft);
      if (!request.ok) return { status: 'incomplete', missing: request.missing };
      report({ type: 'searching', origin: request.request.origin, destination: request.request.destination });
      const searchedRevision = revision;
      const plan = await planTrip(request.request, turn.providers, turn.signal);
      if (searchedRevision !== revision) return { status: 'draft_changed', message: 'Search again using the updated draft.' };
      turn.plan = plan;
      report({ type: 'routes', plan });
      const compact = ({ id, summary, departAt, arriveAt, durationMinutes, cost, risk, violations }: PlanResponse['itineraries'][number]) => ({ id, summary, departAt, arriveAt, durationMinutes, cost: { totalUsd: cost.totalUsd }, risk, violations });
      const back = turn.plan.returnPlan;
      const returnPlan = back && { status: back.status, requestedDepartAt: back.requestedDepartAt, options: back.options.map(({ itinerary, waitMinutes }) => ({ ...compact(itinerary), waitMinutes, firstMorning: itinerary.id === back.firstMorningOptionId })), nearMisses: back.nearMisses.map(compact), warnings: back.warnings };
      return { itineraries: turn.plan.itineraries.map(compact), nearMisses: turn.plan.nearMisses.map(compact), warnings: turn.plan.warnings, ...(returnPlan ? { returnPlan } : {}) };
    } }),
    new PlannerTool({ name: 'ask_user', description: 'Queue a focused question about a missing or ambiguous field. The app shows it to the user, so do not repeat it in your reply.', parameters: AgentQuestionSchema, execute: (question: AgentQuestion) => {
      if (turn.questions.length >= 2) return { status: 'limit_reached', message: 'At most two questions per turn. Wait for the user to answer.' };
      turn.questions.push(question);
      report({ type: 'question', question });
      return { status: 'queued' };
    } }),
    new PlannerTool({ name: 'list_saved_trips', description: 'Read up to twenty saved trips for this device. Use only when the user refers to a saved trip, home, or work.', parameters: z.object({}), execute: async () => (await turn.itineraries.list(turn.deviceId)).slice(0, 20).map(({ id, label, summary, departAt, arriveAt, request, watch }) => ({ id, label, summary, departAt, arriveAt, watch, request: { origin: request.origin, destination: request.destination, time: request.time, modes: request.modes } })) })
  ];
}
