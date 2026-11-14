import { z } from 'zod';
import { TripDraftPatchSchema } from '../client/trip-draft-state.js';
import { PlaceSchema } from './places.js';

export const TravelProfileSchema = z.object({
  displayName: z.string().max(60).optional(),
  home: PlaceSchema.optional(),
  work: PlaceSchema.optional(),
  defaults: TripDraftPatchSchema.default({}),
  updatedAt: z.iso.datetime({ offset: true })
});

export const PutProfileRequestSchema = TravelProfileSchema.omit({ updatedAt: true });
export type TravelProfile = z.infer<typeof TravelProfileSchema>;
export type PutProfileRequest = z.input<typeof PutProfileRequestSchema>;
