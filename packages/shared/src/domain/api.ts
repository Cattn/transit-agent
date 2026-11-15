import { z } from 'zod';
import { ItinerarySchema, SavedItinerarySchema } from './itinerary.js';
import { LngLatSchema } from './places.js';
import { TripRequestSchema } from './trip-draft.js';

export const PlanRequestSchema = TripRequestSchema;

export const LONG_RETURN_WAIT_MINUTES = 60;

export const ReturnOptionSchema = z.object({
  itinerary: ItinerarySchema,
  waitMinutes: z.number().nonnegative()
});
export type ReturnOption = z.infer<typeof ReturnOptionSchema>;

export const ReturnPlanSchema = z.object({
  requestedDepartAt: z.iso.datetime({ offset: true }),
  request: TripRequestSchema,
  status: z.enum(['ok', 'no_routes', 'unavailable', 'unsupported']),
  options: z.array(ReturnOptionSchema),
  firstMorningOptionId: z.string().optional(),
  nearMisses: z.array(ItinerarySchema),
  warnings: z.array(z.string())
});
export type ReturnPlan = z.infer<typeof ReturnPlanSchema>;

export const PlanResponseSchema = z.object({
  itineraries: z.array(ItinerarySchema),
  /** Near-misses that break a hard constraint, with reasons — shown as "almost works". */
  nearMisses: z.array(ItinerarySchema),
  warnings: z.array(z.string()),
  returnPlan: ReturnPlanSchema.optional()
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

export const WatchLocationReportSchema = z.object({
  coordinates: LngLatSchema,
  accuracyMeters: z.number().nonnegative().optional()
}).strict();
export type WatchLocationReport = z.infer<typeof WatchLocationReportSchema>;

export const SavedItineraryListSchema = z.object({ itineraries: z.array(SavedItinerarySchema) });

export const UpdateItineraryRequestSchema = z.object({
  label: z.string().max(80).optional(),
  watch: z.boolean().optional(),
  boarding: z.object({ legIndex: z.number().int().nonnegative(), tripId: z.string(), state: z.enum(['boarded', 'missed']) }).optional(),
  dismissChangeId: z.string().optional()
}).strict();
export type UpdateItineraryRequest = z.infer<typeof UpdateItineraryRequestSchema>;

export const ApiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() })
});
export type ApiErrorBody = z.infer<typeof ApiErrorSchema>;
