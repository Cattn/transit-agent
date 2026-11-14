import Fastify from 'fastify';
import cors from '@fastify/cors';
import { sections, type HealthResponse } from '@transit/shared';

export function createServer() {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(',').map((origin) => origin.trim())
  });

  app.get('/api/health', async (): Promise<HealthResponse> => ({
    status: 'ok',
    service: 'transit-agent'
  }));

  app.get('/api/sections', async () => sections);

  return app;
}
