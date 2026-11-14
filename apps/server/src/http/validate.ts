import { z } from 'zod';
import { ApiError } from './errors.js';

/** Parses `value` with `schema`, or throws a 400 `invalid_request` ApiError. */
export function parse<T extends z.ZodType>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError(400, 'invalid_request', 'Request validation failed', z.treeifyError(result.error));
  }
  return result.data;
}
