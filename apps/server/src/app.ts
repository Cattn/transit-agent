import Fastify from 'fastify';
import type { PlannerAgent } from './agent/types.js';
import { agentRoutes } from './routes/agent.js';
import cors from '@fastify/cors';
import { sections, type HealthResponse } from '@transit/shared';
import { registerErrorHandler } from './http/errors.js';
import { FixtureProvider } from './providers/fixture.js';
import type { RouteProvider } from './providers/types.js';
import { itineraryRoutes } from './routes/itineraries.js';
import { placeRoutes } from './routes/places.js';
import { profileRoutes } from './routes/profile.js';
import { MemoryProfileStore, type ProfileStore } from './store/profiles.js';
import { planRoutes } from './routes/plan.js';
import { MemoryItineraryStore } from './store/memory.js';
import type { ItineraryStore } from './store/types.js';

export interface ServerDeps {
  agent?: PlannerAgent;
  providers: RouteProvider[];
  itineraries: ItineraryStore;
  profiles: ProfileStore;
}

export function createServer(deps: Partial<ServerDeps> = {}) {
  const resolved: ServerDeps = {
    agent: deps.agent,
    providers: deps.providers ?? [new FixtureProvider()],
    itineraries: deps.itineraries ?? new MemoryItineraryStore(),
    profiles: deps.profiles ?? new MemoryProfileStore()
  };

  const app = Fastify({ logger: true });

  app.register(cors, {
    methods: ['GET', 'HEAD', 'POST', 'PATCH', 'DELETE', 'PUT'],
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
  app.register(profileRoutes, resolved);
  app.register(placeRoutes, resolved);
  app.register(agentRoutes, resolved);

  return app;
}
