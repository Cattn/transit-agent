import { z } from 'zod';

export const LngLatSchema = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]); // GeoJSON order: [lng, lat]
export type LngLat = z.infer<typeof LngLatSchema>;

export const PlaceSchema = z.object({
  name: z.string().min(1).optional(),
  coordinates: LngLatSchema,
  kind: z.enum(['address', 'stop', 'station', 'airport', 'bikeDock', 'poi']).optional(),
  /** Provider code: IATA for airports, stop_id for transit stops, station_id for bike docks. */
  code: z.string().optional()
});
export type Place = z.infer<typeof PlaceSchema>;
