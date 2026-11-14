import type { Itinerary } from './itinerary.js';

/** 3-leg fixture (walk -> bus -> walk) in Boston, for tests and map rendering before the server exists. */
export const sampleItinerary: Itinerary = {
  id: 'itin-sample-1',
  legs: [
    {
      id: 'leg-1',
      mode: 'walk',
      from: { name: 'Home', coordinates: [-71.0589, 42.3601], kind: 'address' },
      to: { name: 'Tremont St @ Park St', coordinates: [-71.062, 42.3564], kind: 'stop', code: 'stop-park' },
      departAt: '2026-11-13T08:00:00-05:00',
      arriveAt: '2026-11-13T08:06:00-05:00',
      durationMinutes: 6,
      distanceMeters: 480,
      geometry: { type: 'LineString', coordinates: [[-71.0589, 42.3601], [-71.0605, 42.3582], [-71.062, 42.3564]] },
      timeSource: 'estimated'
    },
    {
      id: 'leg-2',
      mode: 'bus',
      from: { name: 'Tremont St @ Park St', coordinates: [-71.062, 42.3564], kind: 'stop', code: 'stop-park' },
      to: { name: 'Boylston St @ Arlington', coordinates: [-71.071, 42.352], kind: 'stop', code: 'stop-arlington' },
      departAt: '2026-11-13T08:10:00-05:00',
      arriveAt: '2026-11-13T08:22:00-05:00',
      durationMinutes: 12,
      distanceMeters: 1100,
      geometry: { type: 'LineString', coordinates: [[-71.062, 42.3564], [-71.0665, 42.354], [-71.071, 42.352]] },
      timeSource: 'realtime',
      routeName: 'Bus 1',
      agency: 'MBTA',
      delayMinutes: 1,
      transferBufferMinutes: 4
    },
    {
      id: 'leg-3',
      mode: 'walk',
      from: { name: 'Boylston St @ Arlington', coordinates: [-71.071, 42.352], kind: 'stop', code: 'stop-arlington' },
      to: { name: 'Office', coordinates: [-71.0735, 42.3505], kind: 'address' },
      departAt: '2026-11-13T08:22:00-05:00',
      arriveAt: '2026-11-13T08:27:00-05:00',
      durationMinutes: 5,
      distanceMeters: 330,
      geometry: { type: 'LineString', coordinates: [[-71.071, 42.352], [-71.0735, 42.3505]] },
      timeSource: 'estimated'
    }
  ],
  departAt: '2026-11-13T08:00:00-05:00',
  arriveAt: '2026-11-13T08:27:00-05:00',
  durationMinutes: 27,
  transfers: 0,
  walkMinutes: 11,
  cost: { totalUsd: 1.7, lines: [{ label: 'Fare', usd: 1.7, estimated: false }] },
  risk: { level: 'medium', reasons: ['4 min transfer at Park St (scheduled times)'] },
  violations: [],
  summary: 'Walk 6 min → Bus 1 → walk 5 min',
  source: { provider: 'fixture', fetchedAt: '2026-11-13T07:55:00-05:00' }
};
