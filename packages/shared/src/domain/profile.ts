import { z } from 'zod';
import { TripDraftPatchSchema } from '../client/trip-draft-state.js';
import { PlaceSchema } from './places.js';

export const PRESET_KEYS = ['home', 'office', 'gym'] as const;
export const PresetKeySchema = z.enum(PRESET_KEYS);

export const PRESET_ICONS = ['home', 'work', 'fitness', 'school', 'cafe', 'shopping', 'favorite', 'park'] as const;
export const PresetIconSchema = z.enum(PRESET_ICONS);

export const PlacePresetSchema = z.object({
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: PresetIconSchema.optional(),
  place: PlaceSchema.optional()
});

export const TravelProfileSchema = z.object({
  displayName: z.string().max(60).optional(),
  home: PlaceSchema.optional(),
  work: PlaceSchema.optional(),
  defaults: TripDraftPatchSchema.default({}),
  presets: z.partialRecord(PresetKeySchema, PlacePresetSchema).optional(),
  updatedAt: z.iso.datetime({ offset: true })
});

export const PutProfileRequestSchema = TravelProfileSchema.omit({ updatedAt: true });
export type TravelProfile = z.infer<typeof TravelProfileSchema>;
export type PresetKey = z.infer<typeof PresetKeySchema>;
export type PresetIcon = z.infer<typeof PresetIconSchema>;
export type PlacePreset = z.infer<typeof PlacePresetSchema>;
export type PutProfileRequest = z.input<typeof PutProfileRequestSchema>;
