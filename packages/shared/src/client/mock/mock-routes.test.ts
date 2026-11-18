import { expect, it } from 'vitest';
import { ItinerarySchema } from '../../domain/itinerary.js';
import { TripRequestSchema } from '../../domain/trip-draft.js';
import { mockItineraries, mockTripsWithStops } from './mock-routes.js';

export const request = TripRequestSchema.parse({
  origin: { name: 'Boston Common', coordinates: [-71.0656, 42.355] },
  destination: { name: 'Harvard Square', coordinates: [-71.119, 42.3734] },
  time: { type: 'departAt', at: '2026-11-13T13:00:00Z' },
  modes: ['walk', 'bus', 'rail', 'bike', 'car']
});

it('generates valid options with six geometry points per leg', () => {
  const routes = mockItineraries(request);
  expect(routes).toHaveLength(4);
  for (const route of routes) {
    expect(ItinerarySchema.parse(route)).toEqual(route);
    expect(route.legs.every((leg) => leg.geometry.coordinates.length === 6)).toBe(true);
  }
});

it('keeps route IDs stable', () => {
  expect(mockItineraries(request).map((r) => r.id)).toEqual(mockItineraries(request).map((r) => r.id));
});

it('only returns safe for walk and bus', () => {
  const routes = mockItineraries({ ...request, modes: ['walk', 'bus'] });
  expect(routes).toHaveLength(1);
  expect(routes[0]!.id).toContain('mock-safe-');
});

it('ends arriveBy routes exactly at the requested instant', () => {
  for (const route of mockItineraries({ ...request, time: { ...request.time, type: 'arriveBy' } })) {
    expect(Date.parse(route.arriveAt)).toBe(Date.parse(request.time.at));
  }
});

it('uses bikeshare when only that cycling mode is selected', () => {
  const route = mockItineraries({ ...request, modes: ['bikeshare', 'rail'] })[0]!;
  expect(route.legs[0]!.mode).toBe('bikeshare');
  expect(route.cost.lines).toContainEqual({ label: 'Bikeshare unlock', usd: 2.95, estimated: true });
});

it('chains mock trips through stops, arriving by the deadline for arrive-by trips', () => {
  const stop = { name: 'Central', coordinates: [-71.1036, 42.3655] as [number, number] };
  const departing = mockTripsWithStops({ ...request, stops: [stop] });
  expect(departing).toHaveLength(4);
  for (const route of departing) {
    expect(ItinerarySchema.parse(route)).toEqual(route);
    expect(route.legs[route.stops![0]!.legIndex]!.from).toEqual(stop);
    expect(route.departAt).toBe('2026-11-13T13:00:00.000Z');
  }
  const arriving = mockTripsWithStops({ ...request, stops: [stop], time: { type: 'arriveBy', at: '2026-11-13T14:00:00Z' } });
  for (const route of arriving) expect(Date.parse(route.arriveAt)).toBe(Date.parse('2026-11-13T14:00:00Z'));
});
