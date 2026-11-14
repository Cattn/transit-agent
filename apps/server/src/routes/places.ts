import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { PlaceSearchResponse } from '@transit/shared';
import type { ServerDeps } from '../app.js';
import { parse } from '../http/validate.js';

const PlaceSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
  near: z
    .string()
    .regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/)
    .optional()
});

export const placeRoutes: FastifyPluginAsync<ServerDeps> = async (app, deps) => {
  app.get('/api/places', async (request): Promise<PlaceSearchResponse> => {
    const { q, near } = parse(PlaceSearchQuerySchema, request.query);
    const point = near ? (near.split(',').map(Number) as [number, number]) : undefined;
    return { places: await deps.places.search(q, point) };
  });
};
