import { PlaceSearchResponseSchema } from '../../domain/place-search.js';
import type { Place } from '../../domain/places.js';

const places: Place[] = [
  { name: 'Boston Common', coordinates: [-71.0656, 42.355], kind: 'poi' },
  { name: 'Harvard Square', coordinates: [-71.119, 42.3734], kind: 'poi' },
  { name: 'MIT', coordinates: [-71.0921, 42.3601], kind: 'poi' },
  { name: 'Kendall/MIT station', coordinates: [-71.0862, 42.3625], kind: 'station' },
  { name: 'South Station', coordinates: [-71.0552, 42.3523], kind: 'station' },
  { name: 'North Station', coordinates: [-71.0618, 42.3656], kind: 'station' },
  { name: 'Back Bay', coordinates: [-71.075, 42.3473], kind: 'station' },
  { name: 'Logan Airport', coordinates: [-71.0096, 42.3656], kind: 'airport', code: 'BOS' },
  { name: 'Fenway Park', coordinates: [-71.0972, 42.3467], kind: 'poi' },
  { name: 'Davis Square', coordinates: [-71.1224, 42.3967], kind: 'poi' },
  { name: 'Downtown Crossing', coordinates: [-71.0605, 42.3555], kind: 'station' },
  { name: 'Seaport', coordinates: [-71.0435, 42.3519], kind: 'poi' },
  { name: 'Boston University', coordinates: [-71.1097, 42.3505], kind: 'poi' },
  { name: 'Northeastern University', coordinates: [-71.0892, 42.3398], kind: 'poi' },
  { name: 'Providence Station', coordinates: [-71.4133, 41.829], kind: 'station' }
];

export function mockSearchPlaces(q: string): Place[] {
  return PlaceSearchResponseSchema.parse({
    places: q.length < 3 ? [] : places.filter((place) => place.name!.toLowerCase().includes(q.toLowerCase()))
  }).places;
}
