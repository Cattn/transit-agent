import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { SaveItineraryRequestSchema, WatchLocationReportSchema, type SavedItinerary } from '@transit/shared';
import type { ServerDeps } from '../app.js';
import { getDeviceId } from '../http/device.js';
import { ApiError } from '../http/errors.js';
import { parse } from '../http/validate.js';

const PatchItinerarySchema = z
  .object({
    label: z.string().max(80).optional(),
    watch: z.boolean().optional()
  })
  .strict();

const notFound = (id: string) => new ApiError(404, 'not_found', `Saved itinerary ${id} not found`);

type IdParams = { Params: { id: string } };

export const itineraryRoutes: FastifyPluginAsync<ServerDeps> = async (app, deps) => {
  const store = deps.itineraries;

  app.get('/api/itineraries', async (request): Promise<{ itineraries: SavedItinerary[] }> => {
    const items = await store.list(getDeviceId(request));
    items.sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt));
    return { itineraries: items };
  });

  app.get<IdParams>('/api/itineraries/:id', async (request): Promise<SavedItinerary> => {
    const item = await store.get(getDeviceId(request), request.params.id);
    if (!item) throw notFound(request.params.id);
    return item;
  });

  app.post('/api/itineraries', async (request, reply): Promise<SavedItinerary> => {
    const deviceId = getDeviceId(request);
    const input = parse(SaveItineraryRequestSchema, request.body);
    const saved = await store.save(deviceId, input);
    reply.status(201);
    return saved;
  });

  app.patch<IdParams>('/api/itineraries/:id', async (request): Promise<SavedItinerary> => {
    const deviceId = getDeviceId(request);
    const patch = parse(PatchItinerarySchema, request.body);
    const updated = await store.update(deviceId, request.params.id, patch);
    if (!updated) throw notFound(request.params.id);
    return updated;
  });

  app.delete<IdParams>('/api/itineraries/:id', async (request, reply) => {
    const deviceId = getDeviceId(request);
    const removed = await store.remove(deviceId, request.params.id);
    if (!removed) throw notFound(request.params.id);
    deps.locations.forget(deviceId, request.params.id);
    return reply.status(204).send();
  });

  app.post<IdParams>('/api/itineraries/:id/location', async (request, reply) => {
    const deviceId = getDeviceId(request);
    const report = parse(WatchLocationReportSchema, request.body);
    const item = await store.get(deviceId, request.params.id);
    if (!item?.watch) throw notFound(request.params.id);
    deps.locations.report(deviceId, request.params.id, report);
    return reply.status(204).send();
  });
};
