import { z } from 'zod';
import { PlaceSchema } from './places.js';

/** GET /api/places?q=&near=lng,lat response. */
export const PlaceSearchResponseSchema = z.object({ places: z.array(PlaceSchema) });
export type PlaceSearchResponse = z.infer<typeof PlaceSearchResponseSchema>;
