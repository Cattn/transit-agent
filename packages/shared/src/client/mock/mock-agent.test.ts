import { expect, it } from 'vitest';
import { AgentMessageResponseSchema } from '../../domain/agent.js';
import { TripDraftSchema } from '../../domain/trip-draft.js';
import { mockAgentReply } from './mock-agent.js';

const now = new Date('2026-11-13T12:00:00Z');

it('patches walk limits and cost preferences', () => {
  const result = mockAgentReply({ message: 'cheap, walk at most 10 min', draft: TripDraftSchema.parse({}) }, now);
  expect(result.draftPatch.constraints?.maxWalkMinutes).toBe(10);
  expect(result.draftPatch.preferences?.comfortVsCost).toBe(0.2);
  expect(AgentMessageResponseSchema.parse(result)).toEqual(result);
});

it('asks for a missing destination', () => {
  expect(mockAgentReply({ message: 'hello', draft: TripDraftSchema.parse({}) }, now).questions).toEqual([
    { field: 'destination', question: 'Where are you going?' }
  ]);
});

it('resolves destinations and adds modes', () => {
  const result = mockAgentReply({ message: 'safe bike to Harvard', draft: TripDraftSchema.parse({}) }, now);
  expect(result.draftPatch.destination?.name).toBe('Harvard Square');
  expect(result.draftPatch.modes).toContain('bike');
  expect(result.draftPatch.preferences?.transferRisk).toBe(0.1);
  expect(result.questions).toEqual([]);
});
