import type { FastifyPluginAsync } from 'fastify';
import { AgentMessageRequestSchema } from '@transit/shared';
import type { ServerDeps } from '../app.js';
import { getDeviceId } from '../http/device.js';
import { ApiError } from '../http/errors.js';
import { parse } from '../http/validate.js';

export const agentRoutes: FastifyPluginAsync<ServerDeps> = async (app, deps) => {
  const buckets = new Map<string, { count: number; until: number }>();
  app.post('/api/agent/messages', async (request) => {
    const deviceId = getDeviceId(request);
    if (!deps.agent) throw new ApiError(503, 'agent_unavailable', 'Set GEMINI_API_KEY, or Vertex AI with Application Default Credentials, on the server');
    const input = parse(AgentMessageRequestSchema, request.body);
    const now = Date.now();
    for (const [id, bucket] of buckets) if (bucket.until <= now) buckets.delete(id);
    const bucket = buckets.get(deviceId) ?? { count: 0, until: now + 60_000 };
    if (bucket.count >= 20) throw new ApiError(429, 'rate_limited', 'Try again in a minute');
    bucket.count++;
    buckets.set(deviceId, bucket);
    return deps.agent.respond({ ...input, deviceId });
  });
};
