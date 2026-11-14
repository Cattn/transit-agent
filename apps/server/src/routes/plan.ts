import type { FastifyPluginAsync } from 'fastify';
import { TripRequestSchema, type PlanResponse } from '@transit/shared';
import type { ServerDeps } from '../app.js';
import { parse } from '../http/validate.js';
import { planTrip } from '../planning/plan-trip.js';

export const planRoutes: FastifyPluginAsync<ServerDeps> = async (app, deps) => {
  app.post('/api/plan', async (request): Promise<PlanResponse> => {
    const tripRequest = parse(TripRequestSchema, request.body);
    return planTrip(tripRequest, deps.providers, undefined, request.log);
  });
};
