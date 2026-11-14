import { z } from 'zod';
import { TravelModeSchema } from './modes.js';
import { PlaceSchema } from './places.js';

const IsoDateTime = z.iso.datetime({ offset: true });
const Unit = z.number().min(0).max(1);

/** True for IANA zones like 'America/New_York'. Uses Intl (works in browsers, Node and Hermes). */
export function isValidTimeZone(zone: string): boolean {
  try { new Intl.DateTimeFormat('en-US', { timeZone: zone }); return true; } catch { return false; }
}

export const TripTimeSchema = z.object({
  type: z.enum(['departAt', 'arriveBy']),
  at: IsoDateTime
});

/** Requirements. An itinerary that violates any of these is excluded (or shown only as an explained near-miss). */
export const TripConstraintsSchema = z.object({
  arriveBy: IsoDateTime.optional(),
  maxBudgetUsd: z.number().nonnegative().optional(),
  maxWalkMinutes: z.number().int().nonnegative().optional(),
  maxBikeMinutes: z.number().int().nonnegative().optional(),
  maxTransfers: z.number().int().nonnegative().optional(),
  minTransferBufferMinutes: z.number().int().nonnegative().optional(),
  maxDriveMinutes: z.number().int().nonnegative().optional(),
  wheelchairAccessible: z.boolean().optional()
});

/** Preferences. Only affect ranking. 0..1 sliders map directly to UI sliders. */
export const TripPreferencesSchema = z.object({
  /** 0 = cheapest, 1 = most comfortable ("how rich are you"). */
  comfortVsCost: Unit.default(0.5),
  /** 0 = only safe transfers, 1 = "evil" tight transfers are fine. */
  transferRisk: Unit.default(0.3),
  /** "Do you HAVE to be there on time?" */
  lateTolerance: z.enum(['strict', 'some', 'flexible']).default('some'),
  /** 0 = minimise walking/biking effort, 1 = happy to walk/bike more for a better trip. */
  activeTravel: Unit.default(0.5)
});

export const VehiclesSchema = z.object({
  ownsBike: z.boolean().default(false),
  ownsCar: z.boolean().default(false),
  /** Used for driving cost (issue #1 gas prices). */
  carMpg: z.number().positive().optional()
});

export const TripDraftSchema = z.object({
  origin: PlaceSchema.optional(),
  destination: PlaceSchema.optional(),
  time: TripTimeSchema.optional(),
  /** "Can I make it back?" — plan also checks the latest viable return after this time. */
  returnTime: IsoDateTime.optional(),
  /** IANA zone used to DISPLAY this trip's times (user-choosable, review #6 Q5). Omitted = the origin's local zone. Stored times keep their own offsets regardless. */
  timeZone: z.string().refine(isValidTimeZone, { message: 'Unknown IANA time zone' }).optional(),
  modes: z.array(TravelModeSchema).min(1).default(['walk', 'bus', 'rail']),
  vehicles: VehiclesSchema.default({ ownsBike: false, ownsCar: false }),
  constraints: TripConstraintsSchema.default({}),
  preferences: TripPreferencesSchema.default({ comfortVsCost: 0.5, transferRisk: 0.3, lateTolerance: 'some', activeTravel: 0.5 })
});
export type TripDraft = z.infer<typeof TripDraftSchema>;

/** A draft that is complete enough to search. */
export const TripRequestSchema = TripDraftSchema.extend({
  origin: PlaceSchema,
  destination: PlaceSchema,
  time: TripTimeSchema
});
export type TripRequest = z.infer<typeof TripRequestSchema>;
export type TripConstraints = z.infer<typeof TripConstraintsSchema>;
export type TripPreferences = z.infer<typeof TripPreferencesSchema>;
