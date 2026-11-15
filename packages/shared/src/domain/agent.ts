import { z } from 'zod';
import { TripDraftPatchSchema } from '../client/trip-draft-state.js';
import { PlanResponseSchema } from './api.js';
import { PlaceSchema } from './places.js';
import { TripDraftSchema } from './trip-draft.js';

/** POST /api/agent/messages body. */
export const AgentMessageRequestSchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().min(1).max(2000),
  /** Client's current draft (filters state). The agent edits relative to this. */
  draft: TripDraftSchema
});

/** A focused clarifying question, tied to the draft field it would fill (e.g. 'constraints.arriveBy'). */
export const AgentQuestionSchema = z.object({
  field: z.string(),
  question: z.string(),
  options: z.array(z.string()).optional()
});

export const AgentMessageResponseSchema = z.object({
  sessionId: z.string(),
  reply: z.string(),
  /** Everything the agent changed this turn. Client applies it with source 'agent' and shows editable chips. */
  draftPatch: TripDraftPatchSchema,
  /** Focused clarifying questions, each tied to the draft field it would fill. */
  questions: z.array(AgentQuestionSchema),
  /** Present when the agent ran a search this turn. Same shape as POST /api/plan. */
  plan: PlanResponseSchema.optional()
});

export type AgentMessageRequest = z.infer<typeof AgentMessageRequestSchema>;
export type AgentQuestion = z.infer<typeof AgentQuestionSchema>;
export type AgentMessageResponse = z.infer<typeof AgentMessageResponseSchema>;

const progressStamp = { seq: z.number().int().nonnegative(), at: z.string() };

export const AgentProgressEventSchema = z.discriminatedUnion('type', [
  z.object({ ...progressStamp, type: z.literal('thinking') }),
  z.object({ ...progressStamp, type: z.literal('places'), query: z.string(), places: z.array(PlaceSchema) }),
  z.object({ ...progressStamp, type: z.literal('draft'), patch: TripDraftPatchSchema, draft: TripDraftSchema }),
  z.object({ ...progressStamp, type: z.literal('searching'), origin: PlaceSchema, destination: PlaceSchema }),
  z.object({ ...progressStamp, type: z.literal('routes'), plan: PlanResponseSchema }),
  z.object({ ...progressStamp, type: z.literal('question'), question: AgentQuestionSchema }),
  z.object({ ...progressStamp, type: z.literal('done'), response: AgentMessageResponseSchema }),
  z.object({ ...progressStamp, type: z.literal('error'), code: z.string(), message: z.string() })
]);

export type AgentProgressEvent = z.infer<typeof AgentProgressEventSchema>;
export type AgentProgressUpdate = AgentProgressEvent extends infer E ? (E extends AgentProgressEvent ? Omit<E, 'seq' | 'at'> : never) : never;
