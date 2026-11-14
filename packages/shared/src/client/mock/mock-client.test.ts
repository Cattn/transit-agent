import { expect, it } from 'vitest';
import type { ApiClient } from '../api-client.js';
import { createMockApiClient } from './mock-client.js';

const _check: ApiClient = createMockApiClient({ latencyMs: 0 });

it('implements the API client', async () => {
  expect(await _check.health()).toEqual({ status: 'ok', service: 'mock' });
});
