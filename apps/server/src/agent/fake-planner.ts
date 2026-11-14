import { randomUUID } from 'node:crypto';
import { applyDraftPatch, toTripRequest, type TripDraftPatch } from '@transit/shared';
import type { AgentTurnInput, PlannerAgent } from './types.js';
import type { RouteProvider } from '../providers/types.js';
import { planTrip } from '../planning/plan-trip.js';

export class FakePlanner implements PlannerAgent {
  constructor(private readonly providers: RouteProvider[] = []) {}

  async respond(input: AgentTurnInput, signal?: AbortSignal) {
    const patch: TripDraftPatch = {};
    if (/15 min walk/i.test(input.message)) patch.constraints = { maxWalkMinutes: 15 };
    if (/can't be late/i.test(input.message)) patch.preferences = { lateTolerance: 'strict' };
    const draft = applyDraftPatch({ draft: input.draft, provenance: {} }, patch, 'agent').draft;
    const request = toTripRequest(draft);
    const plan = /search/i.test(input.message) && request.ok ? await planTrip(request.request, this.providers, signal) : undefined;
    return { sessionId: input.sessionId ?? randomUUID(), reply: 'Updated your trip preferences.', draftPatch: patch, questions: [], plan };
  }
}
