import type { FastifyPluginAsync } from 'fastify';
import { PutProfileRequestSchema, type TravelProfile } from '@transit/shared';
import type { ServerDeps } from '../app.js';
import { getDeviceId } from '../http/device.js';
import { ApiError } from '../http/errors.js';
import { parse } from '../http/validate.js';

export const profileRoutes: FastifyPluginAsync<ServerDeps> = async (app, deps) => {
  app.get('/api/profile', async (request): Promise<TravelProfile> => {
    const profile = await deps.profiles.get(getDeviceId(request));
    if (!profile) throw new ApiError(404, 'not_found', 'Travel profile not found');
    return profile;
  });

  app.put('/api/profile', async (request): Promise<TravelProfile> => {
    const deviceId = getDeviceId(request);
    const input = parse(PutProfileRequestSchema, request.body);
    return deps.profiles.put(deviceId, { ...input, updatedAt: new Date().toISOString() });
  });
};
