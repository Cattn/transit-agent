import type { FastifyRequest } from 'fastify';
import { ApiError } from './errors.js';

const DEVICE_ID = /^[A-Za-z0-9_-]{8,64}$/;

/** Reads the anonymous device id from the `x-device-id` header (decision D4). */
export function getDeviceId(request: FastifyRequest): string {
  const value = request.headers['x-device-id'];
  if (typeof value !== 'string' || !DEVICE_ID.test(value)) {
    throw new ApiError(400, 'missing_device_id', 'Header x-device-id is required (8-64 chars: letters, digits, _ or -)');
  }
  return value;
}
