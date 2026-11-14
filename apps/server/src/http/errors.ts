import type { FastifyInstance } from 'fastify';
import type { ApiErrorBody } from '@transit/shared';

export class ApiError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function errorBody(code: string, message: string, details?: unknown): ApiErrorBody {
  return details === undefined ? { error: { code, message } } : { error: { code, message, details } };
}

/** Maps errors to the shared `ApiErrorBody` shape. Never leaks stack traces. */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ApiError) {
      return reply.status(error.statusCode).send(errorBody(error.code, error.message, error.details));
    }
    const statusCode = (error as { statusCode?: unknown }).statusCode;
    if (typeof statusCode === 'number' && statusCode >= 400 && statusCode < 500) {
      // Fastify's own client errors (malformed JSON, unsupported media type, body too large, ...).
      const code = (error as { code?: unknown }).code;
      const message = error instanceof Error ? error.message : 'Bad request';
      return reply
        .status(statusCode)
        .send(errorBody(typeof code === 'string' ? code.toLowerCase() : 'bad_request', message));
    }
    request.log.error(error);
    return reply.status(500).send(errorBody('internal', 'Internal error'));
  });

  app.setNotFoundHandler((request, reply) => {
    reply.status(404).send(errorBody('not_found', `Route ${request.method} ${request.url} not found`));
  });
}
