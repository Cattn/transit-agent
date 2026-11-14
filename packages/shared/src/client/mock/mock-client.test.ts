import { expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import type { ApiClient } from '../api-client.js';
import { createMockApiClient } from './mock-client.js';
import type { MockScenario } from './mock-client.js';
import { TripRequestSchema } from '../../domain/trip-draft.js';

const now = () => new Date('2026-11-13T12:00:00Z');
const request = TripRequestSchema.parse({
  origin: { coordinates: [-71.0656, 42.355] }, destination: { coordinates: [-71.119, 42.3734] },
  time: { type: 'departAt', at: '2026-11-13T13:00:00Z' }
});
const client = () => createMockApiClient({ latencyMs: 0, now, seedSaved: false });

const _check: ApiClient = createMockApiClient({ latencyMs: 0 });

it('implements the API client', async () => {
  expect(await _check.health()).toEqual({ status: 'ok', service: 'mock' });
});

it('moves fast routes into near misses for a zero transfer limit', async () => {
  const result = await client().planTrip({ ...request, constraints: { maxTransfers: 0 } });
  expect(result.nearMisses.some((route) => route.id.startsWith('mock-fast-'))).toBe(true);
  expect(result.itineraries.every((route) => route.transfers === 0)).toBe(true);
});

it('saves, lists, updates and deletes itineraries', async () => {
  const api = client();
  const itinerary = (await api.planTrip(request)).itineraries[0]!;
  const saved = await api.saveItinerary({ itinerary, request, label: 'Work', watch: true });
  expect(await api.listItineraries()).toEqual([saved]);
  expect(await api.getItinerary(saved.id)).toEqual(saved);
  expect(await api.updateItinerary(saved.id, { label: 'Home', watch: false })).toMatchObject({ label: 'Home', watch: false });
  await api.deleteItinerary(saved.id);
  await expect(api.getItinerary(saved.id)).rejects.toMatchObject({ status: 404, code: 'not_found' });
  await expect(api.updateItinerary(saved.id, {})).rejects.toMatchObject({ code: 'not_found' });
  await expect(api.deleteItinerary(saved.id)).rejects.toMatchObject({ code: 'not_found' });
});

it('rejects every method in error scenarios', async () => {
  const itinerary = (await client().planTrip(request)).itineraries[0]!;
  for (const scenario of ['offline', 'serverError'] as const) {
    const api = createMockApiClient({ scenario, latencyMs: 0, now });
    const calls = [api.health(), api.sections(), api.planTrip(request), api.listItineraries(), api.getItinerary('x'),
      api.saveItinerary({ itinerary, request, watch: true }), api.updateItinerary('x', {}), api.deleteItinerary('x'),
      api.sendAgentMessage({ message: 'hello', draft: request }), api.searchPlaces('Boston'), api.getProfile(), api.putProfile({})];
    await Promise.all(calls.map((call) => expect(call).rejects.toMatchObject(scenario === 'offline'
      ? { status: 0, code: 'network', message: 'Network error' } : { status: 500, code: 'internal', message: 'Internal error' })));
  }
});

it('switches scenarios between calls', async () => {
  let scenario: MockScenario = 'empty';
  const api = createMockApiClient({ scenario: () => scenario, latencyMs: 0, now });
  expect(await api.planTrip(request)).toEqual({ itineraries: [], nearMisses: [], warnings: ['No routes found for this trip'] });
  scenario = 'nearMissOnly';
  const result = await api.planTrip(request);
  expect(result.itineraries).toEqual([]);
  expect(result.nearMisses.length).toBeGreaterThan(0);
  expect(result.nearMisses.every((route) => route.violations.length)).toBe(true);
});

it('seeds two upcoming trips and isolates client state', async () => {
  const api = createMockApiClient({ latencyMs: 0, now });
  const trips = await api.listItineraries();
  expect(trips.map((trip) => trip.label)).toEqual(['Morning commute', 'Dinner']);
  expect(trips.map((trip) => Date.parse(trip.departAt) - now().getTime())).toEqual([25 * 60000, 180 * 60000]);
  await api.deleteItinerary(trips[0]!.id);
  expect(await createMockApiClient({ latencyMs: 0, now }).listItineraries()).toHaveLength(2);
  expect(await client().listItineraries()).toEqual([]);
});

it('rejects invalid planning requests as API errors', async () => {
  await expect(client().planTrip({ ...request, modes: [] })).rejects.toMatchObject({ status: 400, code: 'invalid_request' });
});

it('checks walk, budget and arrival limits', async () => {
  const result = await client().planTrip({ ...request, constraints: { maxWalkMinutes: 0, maxBudgetUsd: 0, arriveBy: request.time.at } });
  expect(result.itineraries).toEqual([]);
  expect(result.nearMisses[0]!.violations).toEqual(expect.arrayContaining([
    expect.stringMatching(/^Walks /), expect.stringMatching(/^Costs /), expect.stringMatching(/^Arrives /)
  ]));
});

it('includes a plan in agent replies for completed drafts', async () => {
  const result = await client().sendAgentMessage({ message: 'cheap to Harvard', draft: request });
  expect(result.plan?.itineraries.length).toBeGreaterThan(0);
});

it('returns saved trips newest first and protects stored state', async () => {
  let clock = now();
  const api = createMockApiClient({ latencyMs: 0, now: () => clock, seedSaved: false });
  const routes = (await api.planTrip(request)).itineraries;
  await api.saveItinerary({ itinerary: routes[0]!, request, watch: true });
  clock = new Date(clock.getTime() + 1000);
  const latest = await api.saveItinerary({ itinerary: routes[1]!, request, watch: false });
  latest.legs[0]!.from.name = 'Changed';
  const list = await api.listItineraries();
  expect(list[0]!.id).toBe(latest.id);
  expect(list[0]!.legs[0]!.from.name).not.toBe('Changed');
});

it('round-trips and replaces one profile per instance without exposing stored state', async () => {
  const api = client();
  expect(await api.getProfile()).toBeUndefined();
  const input = { displayName: 'Commuter', home: request.origin, work: request.destination, defaults: { modes: ['bike' as const] } };
  const saved = await api.putProfile(input);
  expect(saved).toEqual({ ...input, updatedAt: now().toISOString() });
  input.defaults.modes.push('bike');
  saved.defaults.modes?.push('car');
  const loaded = await api.getProfile();
  expect(loaded?.defaults.modes).toEqual(['bike']);
  loaded!.defaults.modes?.push('car');
  expect((await api.getProfile())?.defaults.modes).toEqual(['bike']);
  expect(await client().getProfile()).toBeUndefined();
  expect(await api.putProfile({ displayName: 'Replacement' })).toEqual({ displayName: 'Replacement', defaults: {}, updatedAt: now().toISOString() });
});

it('validates profile writes and keeps the previous profile on failure', async () => {
  const api = client();
  const saved = await api.putProfile({ displayName: 'Valid' });
  await expect(api.putProfile({ displayName: 'x'.repeat(61) })).rejects.toBeInstanceOf(ZodError);
  await expect(api.putProfile({ defaults: { preferences: { comfortVsCost: 2 } } })).rejects.toBeInstanceOf(ZodError);
  expect(await api.getProfile()).toEqual(saved);
});

it('applies profile latency and reads the current scenario before changing state', async () => {
  vi.useFakeTimers();
  try {
    let scenario: MockScenario = 'normal';
    const api = createMockApiClient({ scenario: () => scenario, latencyMs: 50, now });
    const saved = api.putProfile({ displayName: 'Original' });
    await vi.advanceTimersByTimeAsync(50);
    expect(await saved).toMatchObject({ displayName: 'Original' });
    let completed = false;
    const pending = api.getProfile().then((profile) => { completed = true; return profile; });
    await vi.advanceTimersByTimeAsync(49);
    expect(completed).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toMatchObject({ displayName: 'Original' });
    const failed = expect(api.putProfile({ displayName: 'Lost' })).rejects.toMatchObject({ code: 'network' });
    scenario = 'offline';
    await vi.advanceTimersByTimeAsync(50);
    await failed;
    scenario = 'normal';
    const loaded = api.getProfile();
    await vi.advanceTimersByTimeAsync(50);
    expect(await loaded).toMatchObject({ displayName: 'Original' });
  } finally {
    vi.useRealTimers();
  }
});
