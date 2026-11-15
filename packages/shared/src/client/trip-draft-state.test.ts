import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import { AgentMessageResponseSchema, type AgentProgressEvent, type AgentProgressUpdate } from '../domain/agent.js';
import { PlanResponseSchema } from '../domain/api.js';
import { initialAgentProgress, reduceAgentProgress } from './agent-progress.js';
import { createDeviceId } from './device-id.js';
import {
  applyDraftPatch,
  describePatch,
  initialDraftState,
  toTripRequest,
  TripDraftPatchSchema,
  type TripDraftPatch
} from './trip-draft-state.js';

const home = { name: 'Home', coordinates: [-71.06, 42.36] as [number, number] };
const work = { name: 'Work', coordinates: [-71.09, 42.34] as [number, number] };

describe('applyDraftPatch', () => {
  it('records agent provenance with dotted paths for nested fields', () => {
    const state = applyDraftPatch(initialDraftState(), { constraints: { maxWalkMinutes: 15 }, origin: home }, 'agent');
    expect(state.draft.constraints.maxWalkMinutes).toBe(15);
    expect(state.provenance).toEqual({ origin: 'agent', 'constraints.maxWalkMinutes': 'agent' });
  });

  it('flips provenance to user when the user later edits the same field', () => {
    const agent = applyDraftPatch(initialDraftState(), { constraints: { maxWalkMinutes: 15, maxTransfers: 1 } }, 'agent');
    const user = applyDraftPatch(agent, { constraints: { maxWalkMinutes: 10 } }, 'user');
    expect(user.draft.constraints).toEqual({ maxWalkMinutes: 10, maxTransfers: 1 });
    expect(user.provenance['constraints.maxWalkMinutes']).toBe('user');
    expect(user.provenance['constraints.maxTransfers']).toBe('agent');
  });

  it('clears constraints.arriveBy and top-level fields with null', () => {
    const set = applyDraftPatch(initialDraftState(), { origin: home, constraints: { arriveBy: '2026-11-13T09:00:00-05:00' } }, 'agent');
    const cleared = applyDraftPatch(set, { origin: null, constraints: { arriveBy: null } }, 'user');
    expect(cleared.draft.constraints).not.toHaveProperty('arriveBy');
    expect(cleared.draft).not.toHaveProperty('origin');
    expect(cleared.provenance['constraints.arriveBy']).toBe('user');
  });

  it('replaces modes wholesale and merges preferences per key', () => {
    const state = applyDraftPatch(initialDraftState(), { modes: ['bike'], preferences: { comfortVsCost: 0.9 } }, 'user');
    expect(state.draft.modes).toEqual(['bike']);
    expect(state.draft.preferences).toEqual({ comfortVsCost: 0.9, transferRisk: 0.3, lateTolerance: 'some', activeTravel: 0.5 });
  });

  it('merges vehicles per key without resetting other fields', () => {
    const owns = applyDraftPatch(initialDraftState(), { vehicles: { ownsCar: true } }, 'profile');
    const mpg = applyDraftPatch(owns, { vehicles: { carMpg: 30 } }, 'user');
    expect(mpg.draft.vehicles).toEqual({ ownsBike: false, ownsCar: true, carMpg: 30 });
  });

  it('does not mutate the previous state', () => {
    const before = initialDraftState();
    const snapshot = structuredClone(before);
    applyDraftPatch(before, { modes: ['car'], constraints: { maxDriveMinutes: 30 } }, 'user');
    expect(before).toEqual(snapshot);
  });

  it('throws a ZodError for an invalid patch', () => {
    expect(() => applyDraftPatch(initialDraftState(), { preferences: { comfortVsCost: 2 } }, 'agent')).toThrow(ZodError);
  });

  it('applies initial defaults with profile provenance', () => {
    const state = initialDraftState({ vehicles: { ownsBike: true } });
    expect(state.draft.vehicles.ownsBike).toBe(true);
    expect(state.provenance).toEqual({ 'vehicles.ownsBike': 'profile' });
  });
});

describe('toTripRequest', () => {
  it('reports missing fields', () => {
    const result = toTripRequest(applyDraftPatch(initialDraftState(), { origin: home }, 'user').draft);
    expect(result).toEqual({ ok: false, missing: ['destination', 'time'] });
  });

  it('returns a request once origin, destination and time are set', () => {
    const state = applyDraftPatch(initialDraftState(), {
      origin: home,
      destination: work,
      time: { type: 'arriveBy', at: '2026-11-13T09:00:00-05:00' }
    }, 'user');
    const result = toTripRequest(state.draft);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.request.destination.name).toBe('Work');
  });
});

describe('describePatch', () => {
  it('returns readable strings', () => {
    const patch: TripDraftPatch = {
      time: { type: 'departAt', at: '2026-11-13T17:30:00-05:00' },
      modes: ['walk', 'rail'],
      constraints: { maxWalkMinutes: 15, arriveBy: '2026-11-13T09:00:00-05:00', maxTransfers: null },
      preferences: { lateTolerance: 'strict' }
    };
    expect(describePatch(patch)).toEqual([
      'Leave at 5:30 PM',
      'Modes: walk, rail',
      'Max walk: 15 min',
      'Must arrive by 9:00 AM',
      'Max transfers: no limit',
      'Late tolerance: strict'
    ]);
  });
});

describe('TripDraftPatchSchema', () => {
  it('does not inject defaults into partial nested patches', () => {
    expect(TripDraftPatchSchema.parse({ vehicles: { carMpg: 30 }, preferences: { transferRisk: 1 } }))
      .toEqual({ vehicles: { carMpg: 30 }, preferences: { transferRisk: 1 } });
  });

  it('is used by the agent response contract', () => {
    const response = AgentMessageResponseSchema.parse({
      sessionId: 's1',
      reply: 'Capped walking at 15 minutes.',
      draftPatch: { constraints: { maxWalkMinutes: 15 } },
      questions: [{ field: 'time', question: 'When do you need to arrive?' }]
    });
    expect(response.draftPatch.constraints?.maxWalkMinutes).toBe(15);
  });
});

describe('createDeviceId', () => {
  it('returns distinct ids that the server header rule accepts', () => {
    const a = createDeviceId();
    const b = createDeviceId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });
});

describe('reduceAgentProgress (plan 029)', () => {
  const at = '2026-11-14T09:00:00.000Z';
  const plan = PlanResponseSchema.parse({ itineraries: [], nearMisses: [], warnings: [] });
  const laterPlan = PlanResponseSchema.parse({ itineraries: [], nearMisses: [], warnings: ['later'] });
  const draft = applyDraftPatch(initialDraftState(), { origin: home, destination: work }, 'agent').draft;
  const response = AgentMessageResponseSchema.parse({ sessionId: 's', reply: 'Done.', draftPatch: {}, questions: [] });
  const play = (updates: AgentProgressUpdate[]) =>
    updates.map((update, seq) => ({ ...update, seq, at }) as AgentProgressEvent).reduce(reduceAgentProgress, initialAgentProgress);

  it('follows a full turn: thinking, places, draft, searching, routes, done', () => {
    const steps: AgentProgressUpdate[] = [
      { type: 'thinking' },
      { type: 'places', query: 'work', places: [work, home] },
      { type: 'draft', patch: { origin: home, destination: work }, draft },
      { type: 'searching', origin: home, destination: work },
      { type: 'routes', plan },
      { type: 'done', response }
    ];
    const phases = steps.map((_, i) => play(steps.slice(0, i + 1)).phase);
    expect(phases).toEqual(['thinking', 'locating', 'locating', 'searching', 'routes', 'done']);
    expect(play(steps.slice(0, 2)).candidates).toEqual([work, home]);
    const end = play(steps);
    expect(end.candidates).toEqual([]);
    expect(end).toMatchObject({ origin: home, destination: work, plan });
  });

  it('ignores events that arrive out of order', () => {
    const state = reduceAgentProgress(reduceAgentProgress(initialAgentProgress, { type: 'routes', plan, seq: 4, at }), { type: 'thinking', seq: 2, at });
    expect(state.phase).toBe('routes');
    expect(state.lastSeq).toBe(4);
  });

  it('keeps the old plan after a later draft change until new routes arrive', () => {
    const changed = play([{ type: 'routes', plan }, { type: 'draft', patch: { destination: home }, draft: { ...draft, destination: home } }]);
    expect(changed.plan).toBe(plan);
    expect(changed.destination).toEqual(home);
    expect(play([{ type: 'routes', plan }, { type: 'draft', patch: {}, draft }, { type: 'routes', plan: laterPlan }]).plan).toBe(laterPlan);
  });

  it('keeps the streamed plan when the final response has none', () => {
    expect(play([{ type: 'routes', plan }, { type: 'done', response }]).plan).toBe(plan);
  });

  it('sets phase error on an error event', () => {
    expect(play([{ type: 'thinking' }, { type: 'error', code: 'internal', message: 'Internal error' }]).phase).toBe('error');
  });
});
