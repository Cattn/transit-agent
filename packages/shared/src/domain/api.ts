import { z } from 'zod';
import { ItinerarySchema, SavedItinerarySchema } from './itinerary.js';
import { TripRequestSchema } from './trip-draft.js';

export const PlanRequestSchema = TripRequestSchema;
export const PlanResponseSchema = z.object({
  itineraries: z.array(ItinerarySchema),
  /** Near-misses that break a hard constraint, with reasons — shown as "almost works". */
  nearMisses: z.array(ItinerarySchema),
  warnings: z.array(z.string())
});
export type PlanResponse = z.infer<typeof PlanResponseSchema>;

export const SaveItineraryRequestSchema = z.object({
  itinerary: ItinerarySchema,
  request: TripRequestSchema,
  label: z.string().max(80).optional(),
  watch: z.boolean().default(true),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional()
});
export type SaveItineraryRequest = z.infer<typeof SaveItineraryRequestSchema>;

export const SavedItineraryListSchema = z.object({ itineraries: z.array(SavedItinerarySchema) });

export const ApiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() })
});
export type ApiErrorBody = z.infer<typeof ApiErrorSchema>;
