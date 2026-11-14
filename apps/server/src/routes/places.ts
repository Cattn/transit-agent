import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { PlaceSearchResponse } from '@transit/shared';
import type { ServerDeps } from '../app.js';
import { parse } from '../http/validate.js';
import { searchPlaces } from '../places/gazetteer.js';

const PlaceSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
  near: z
    .string()
    .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/)
    .optional()
});

export const placeRoutes: FastifyPluginAsync<ServerDeps> = async (app) => {
  /** GET /api/places?q=&near=lng,lat. `near` is accepted but not used yet (plan 007 adds a geocoder). */
  app.get('/api/places', async (request): Promise<PlaceSearchResponse> => {
    const { q } = parse(PlaceSearchQuerySchema, request.query);
    return { places: searchPlaces(q) };
  });
};
