import { z } from 'zod';
import { TripDraftPatchSchema } from '../client/trip-draft-state.js';
import { PlanResponseSchema } from './api.js';
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
