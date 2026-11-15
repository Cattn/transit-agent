import { PassThrough } from 'node:stream';
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { AgentMessageRequestSchema, type AgentProgressUpdate } from '@transit/shared';
import type { ServerDeps } from '../app.js';
import { getDeviceId } from '../http/device.js';
import { ApiError } from '../http/errors.js';
import { parse } from '../http/validate.js';

export const agentRoutes: FastifyPluginAsync<ServerDeps> = async (app, deps) => {
  const buckets = new Map<string, { count: number; until: number }>();

  const admit = (request: FastifyRequest) => {
    const deviceId = getDeviceId(request);
    if (!deps.agent) throw new ApiError(503, 'agent_unavailable', 'Set GEMINI_API_KEY, or Vertex AI with Application Default Credentials, on the server');
    const input = parse(AgentMessageRequestSchema, request.body);
    const now = Date.now();
    for (const [id, bucket] of buckets) if (bucket.until <= now) buckets.delete(id);
    const bucket = buckets.get(deviceId) ?? { count: 0, until: now + 60_000 };
    if (bucket.count >= 20) throw new ApiError(429, 'rate_limited', 'Try again in a minute');
    bucket.count++;
    buckets.set(deviceId, bucket);
    return { agent: deps.agent, input: { ...input, deviceId } };
  };

  app.post('/api/agent/messages', async (request) => {
    const { agent, input } = admit(request);
    return agent.respond(input);
  });

  app.post('/api/agent/messages/stream', async (request, reply) => {
    const { agent, input } = admit(request);
    const out = new PassThrough();
    const controller = new AbortController();
    let seq = 0;
    const write = (update: AgentProgressUpdate) => {
      if (!out.writableEnded) out.write(`${JSON.stringify({ ...update, seq: seq++, at: new Date().toISOString() })}\n`);
    };
    reply.raw.on('close', () => {
      if (!reply.raw.writableFinished) controller.abort();
    });
    const turn = agent.stream
      ? agent.stream(input, write, controller.signal)
      : (write({ type: 'thinking' }), agent.respond(input, controller.signal).then((response) => (write({ type: 'done', response }), response)));
    turn
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        request.log.error(error);
        write(error instanceof ApiError ? { type: 'error', code: error.code, message: error.message } : { type: 'error', code: 'internal', message: 'Internal error' });
      })
      .finally(() => out.end());
    return reply.header('cache-control', 'no-cache').type('application/x-ndjson').send(out);
  });
};
