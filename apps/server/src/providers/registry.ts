import { gasPriceFromEnv } from '../flights/ground-cost.js';
import { FixtureProvider } from './fixture.js';
import { TransitousProvider } from './transitous.js';
import type { RouteProvider } from './types.js';

export const DEFAULT_TRANSITOUS_URL = 'https://api.transitous.org';

export function createRouteProviders(env: Record<string, string | undefined> = process.env, fetchImpl?: typeof globalThis.fetch): RouteProvider[] {
  const names = (env.ROUTE_PROVIDERS?.trim() || 'fixture').split(',').map((name) => name.trim()).filter(Boolean);
  if (new Set(names).size !== names.length) throw new Error(`ROUTE_PROVIDERS lists a provider twice: ${names.join(',')}`);
  if (names.includes('fixture') && names.length > 1) throw new Error('ROUTE_PROVIDERS cannot mix fixture with live providers');
  return names.map((name) => {
    if (name === 'fixture') return new FixtureProvider();
    if (name === 'transitous') {
      const userAgent = env.ROUTING_USER_AGENT?.trim();
      if (!userAgent) throw new Error('ROUTING_USER_AGENT is required for the transitous provider');
      return new TransitousProvider({ baseUrl: env.TRANSITOUS_URL?.trim() || DEFAULT_TRANSITOUS_URL, userAgent, fetch: fetchImpl, gasUsdPerGallon: gasPriceFromEnv(env) });
    }
    throw new Error(`Unknown route provider "${name}" in ROUTE_PROVIDERS`);
  });
}
