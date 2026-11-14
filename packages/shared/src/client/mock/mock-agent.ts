import { AgentMessageResponseSchema, type AgentMessageRequest, type AgentMessageResponse } from '../../domain/agent.js';
import type { PlanResponse } from '../../domain/api.js';
import type { TripRequest } from '../../domain/trip-draft.js';
import { applyDraftPatch, describePatch, toTripRequest, type TripDraftPatch } from '../trip-draft-state.js';
import { mockSearchPlaces } from './mock-places.js';

export function mockAgentReply(body: AgentMessageRequest, now: Date, plan?: (r: TripRequest) => PlanResponse): AgentMessageResponse {
  const message = body.message.toLowerCase();
  const draftPatch: TripDraftPatch = {};
  const walk = /walk (?:at most |max |under )?(\d+)/.exec(message);
  if (walk) draftPatch.constraints = { maxWalkMinutes: Number(walk[1]) };
  const preferences: NonNullable<TripDraftPatch['preferences']> = {};
  if (/cheap|budget|save money/.test(message)) preferences.comfortVsCost = 0.2;
  if (/comfort|comfy/.test(message)) preferences.comfortVsCost = 0.8;
  if (/tight|risky|evil/.test(message)) preferences.transferRisk = 0.8;
  if (/safe|no rush|careful/.test(message)) preferences.transferRisk = 0.1;
  if (/must be on time|can't be late|interview|flight/.test(message)) preferences.lateTolerance = 'strict';
  if (Object.keys(preferences).length) draftPatch.preferences = preferences;
  const modes = new Set(body.draft.modes);
  if (/bike/.test(message)) modes.add('bike');
  if (/drive|car/.test(message)) modes.add('car');
  if (modes.size !== body.draft.modes.length) draftPatch.modes = [...modes];
  const destination = /to (harvard|mit|logan|south station)/.exec(message);
  if (destination) draftPatch.destination = mockSearchPlaces(destination[1]!)[0];
  const { draft } = applyDraftPatch({ draft: body.draft, provenance: {} }, draftPatch, 'agent');
  const request = toTripRequest(draft);
  const description = describePatch(draftPatch);
  return AgentMessageResponseSchema.parse({
    sessionId: body.sessionId ?? 'mock-session',
    reply: description.length ? `Got it: ${description.join(', ')}.` : 'I\'m a mock agent. Try "cheap, walk at most 10 min, to Harvard".',
    draftPatch,
    questions: draft.destination ? [] : [{ field: 'destination', question: 'Where are you going?' }],
    ...(request.ok && plan ? { plan: plan(request.request) } : {})
  });
}
