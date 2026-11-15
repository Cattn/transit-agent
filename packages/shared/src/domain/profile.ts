import { z } from 'zod';
import { TripDraftPatchSchema } from '../client/trip-draft-state.js';
import { PlaceSchema } from './places.js';

export const PRESET_KEYS = ['home', 'office', 'gym'] as const;
export const PresetKeySchema = z.enum(PRESET_KEYS);

export const PRESET_ICONS = ['home', 'work', 'fitness', 'school', 'cafe', 'shopping', 'favorite', 'park', 'restaurant'] as const;
export const PresetIconSchema = z.enum(PRESET_ICONS);

const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/);

export const PlacePresetSchema = z.object({
  color: HexColorSchema.optional(),
  icon: PresetIconSchema.optional(),
  place: PlaceSchema.optional()
});

export const MAX_CUSTOM_PLACES = 5;
export const MAX_PLACE_NAME = 30;

export const CustomPlaceSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,40}$/),
  name: z.string().trim().min(1).max(MAX_PLACE_NAME),
  icon: PresetIconSchema,
  color: HexColorSchema,
  place: PlaceSchema
});

export const TravelProfileSchema = z.object({
  displayName: z.string().max(60).optional(),
  home: PlaceSchema.optional(),
  work: PlaceSchema.optional(),
  defaults: TripDraftPatchSchema.default({}),
  presets: z.partialRecord(PresetKeySchema, PlacePresetSchema).optional(),
  places: z
    .array(CustomPlaceSchema)
    .max(MAX_CUSTOM_PLACES)
    .refine((places) => new Set(places.map((place) => place.id)).size === places.length, { message: 'Place ids must be unique' })
    .optional(),
  updatedAt: z.iso.datetime({ offset: true })
});

export const PutProfileRequestSchema = TravelProfileSchema.omit({ updatedAt: true });
export type TravelProfile = z.infer<typeof TravelProfileSchema>;
export type PresetKey = z.infer<typeof PresetKeySchema>;
export type PresetIcon = z.infer<typeof PresetIconSchema>;
export type PlacePreset = z.infer<typeof PlacePresetSchema>;
export type CustomPlace = z.infer<typeof CustomPlaceSchema>;
export type PutProfileRequest = z.input<typeof PutProfileRequestSchema>;
