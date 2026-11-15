import { randomUUID } from 'node:crypto';
import { applyDraftPatch, toTripRequest, type TripDraftPatch } from '@transit/shared';
import type { AgentTurnInput, PlannerAgent, ProgressEmitter } from './types.js';
import type { RouteProvider } from '../providers/types.js';
import { planTrip } from '../planning/plan-trip.js';

export class FakePlanner implements PlannerAgent {
  constructor(private readonly providers: RouteProvider[] = []) {}

  respond(input: AgentTurnInput, signal?: AbortSignal) {
    return this.run(input, () => undefined, signal);
  }

  stream(input: AgentTurnInput, emit: ProgressEmitter, signal?: AbortSignal) {
    return this.run(input, emit, signal);
  }

  private async run(input: AgentTurnInput, emit: ProgressEmitter, signal?: AbortSignal) {
    emit({ type: 'thinking' });
    const patch: TripDraftPatch = {};
    if (/15 min walk/i.test(input.message)) patch.constraints = { maxWalkMinutes: 15 };
    if (/can't be late/i.test(input.message)) patch.preferences = { lateTolerance: 'strict' };
    const draft = applyDraftPatch({ draft: input.draft, provenance: {} }, patch, 'agent').draft;
    if (Object.keys(patch).length) emit({ type: 'draft', patch, draft });
    const request = toTripRequest(draft);
    const searching = /search/i.test(input.message) && request.ok;
    if (searching) emit({ type: 'searching', origin: request.request.origin, destination: request.request.destination });
    const plan = searching ? await planTrip(request.request, this.providers, signal) : undefined;
    if (plan) emit({ type: 'routes', plan });
    const response = { sessionId: input.sessionId ?? randomUUID(), reply: 'Updated your trip preferences.', draftPatch: patch, questions: [], plan };
    emit({ type: 'done', response });
    return response;
  }
}
