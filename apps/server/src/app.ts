import Fastify from 'fastify';
import cors from '@fastify/cors';
import { sections, type HealthResponse } from '@transit/shared';
import { registerErrorHandler } from './http/errors.js';
import { FixtureProvider } from './providers/fixture.js';
import type { RouteProvider } from './providers/types.js';
import { itineraryRoutes } from './routes/itineraries.js';
import { planRoutes } from './routes/plan.js';
import { MemoryItineraryStore } from './store/memory.js';
import type { ItineraryStore } from './store/types.js';

export interface ServerDeps {
  providers: RouteProvider[];
  itineraries: ItineraryStore;
}

export function createServer(deps: Partial<ServerDeps> = {}) {
  const resolved: ServerDeps = {
    providers: deps.providers ?? [new FixtureProvider()],
    itineraries: deps.itineraries ?? new MemoryItineraryStore()
  };

  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((origin) => origin.trim())
  });

  app.get('/api/health', async (): Promise<HealthResponse> => ({
    status: 'ok',
    service: 'transit-agent'
  }));

  app.get('/api/sections', async () => sections);

  registerErrorHandler(app);
  app.register(planRoutes, resolved);
  app.register(itineraryRoutes, resolved);

  return app;
}
