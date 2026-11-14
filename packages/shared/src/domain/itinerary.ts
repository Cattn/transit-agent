import { z } from 'zod';
import { TravelModeSchema } from './modes.js';
import { LngLatSchema, PlaceSchema } from './places.js';
import { TripRequestSchema } from './trip-draft.js';

const IsoDateTime = z.iso.datetime({ offset: true });

export const LineStringSchema = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(LngLatSchema).min(2)
});

export const TimeSourceSchema = z.enum(['realtime', 'scheduled', 'estimated']);

export const LegSchema = z.object({
  id: z.string().min(1),
  mode: TravelModeSchema,
  from: PlaceSchema,
  to: PlaceSchema,
  departAt: IsoDateTime,
  arriveAt: IsoDateTime,
  durationMinutes: z.number().nonnegative(),
  distanceMeters: z.number().nonnegative().optional(),
  geometry: LineStringSchema,
  timeSource: TimeSourceSchema,
  /** Transit/flight line label, e.g. "Red Line", "Bus 1", "B6 1123". */
  routeName: z.string().optional(),
  agency: z.string().optional(),
  /** Realtime minus scheduled, minutes. Present only when timeSource === 'realtime'. */
  delayMinutes: z.number().optional(),
  /** Minutes between previous leg's arrival and this leg's departure (transfers only). */
  transferBufferMinutes: z.number().optional()
});
export type Leg = z.infer<typeof LegSchema>;

export const CostLineSchema = z.object({
  label: z.string(),           // "Fare", "Gas", "Parking", "Bikeshare unlock"
  usd: z.number(),
  estimated: z.boolean()
});

export const ItinerarySchema = z.object({
  id: z.string().min(1),
  legs: z.array(LegSchema).min(1),
  departAt: IsoDateTime,
  arriveAt: IsoDateTime,
  durationMinutes: z.number().nonnegative(),
  transfers: z.number().int().nonnegative(),
  walkMinutes: z.number().nonnegative(),
  cost: z.object({ totalUsd: z.number().nonnegative(), lines: z.array(CostLineSchema) }),
  risk: z.object({
    level: z.enum(['low', 'medium', 'high']),
    /** Human-readable, deterministic reasons, e.g. "4 min transfer at Park St (scheduled times)". No invented probabilities. */
    reasons: z.array(z.string())
  }),
  /** Hard constraints this option breaks. Empty for normal results. */
  violations: z.array(z.string()),
  /** Short one-liner for list rows, e.g. "Bike 6 min → Red Line → walk 4 min". */
  summary: z.string(),
  source: z.object({ provider: z.string(), fetchedAt: IsoDateTime })
});
export type Itinerary = z.infer<typeof ItinerarySchema>;

export const WatchStateSchema = z.enum(['scheduled', 'onTrack', 'leaveSoon', 'leaveNow', 'atRisk', 'missed', 'done']);
export const WatchStatusSchema = z.object({
  state: WatchStateSchema,
  leaveBy: IsoDateTime.optional(),
  /** Deterministic sentence, e.g. "Leave by 8:12 AM. Bus 1 is 4 min late (live)." */
  message: z.string(),
  checkedAt: IsoDateTime,
  /** True if any leg used live data. The UI must not present schedule-only times as live. */
  usedRealtime: z.boolean()
});
export type WatchStatus = z.infer<typeof WatchStatusSchema>;

export const SavedItinerarySchema = ItinerarySchema.extend({
  savedAt: IsoDateTime,
  label: z.string().optional(),       // "Morning commute"
  watch: z.boolean(),                 // auto-watched after saving (map thread)
  /** Computed by the watch engine (plan 008). */
  leaveBy: IsoDateTime.optional(),
  /** Latest watch result (computeWatchStatus, plan 013). */
  watchStatus: WatchStatusSchema.optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  /** The request that produced this itinerary — needed to re-plan when watching. */
  request: TripRequestSchema
});
export type SavedItinerary = z.infer<typeof SavedItinerarySchema>;
