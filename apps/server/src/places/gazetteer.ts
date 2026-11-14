import type { Place } from '@transit/shared';

const places: Place[] = [
  { name: 'Providence Airport', coordinates: [-71.4282, 41.724], kind: 'airport', code: 'PVD' },
  { name: 'Manchester Airport', coordinates: [-71.4357, 42.9326], kind: 'airport', code: 'MHT' },
  { name: 'Bradley Airport', coordinates: [-72.6832, 41.9389], kind: 'airport', code: 'BDL' },
  { name: 'Tweed New Haven Airport', coordinates: [-72.8868, 41.2637], kind: 'airport', code: 'HVN' },
  { name: 'John F. Kennedy Airport', coordinates: [-73.7781, 40.6413], kind: 'airport', code: 'JFK' },
  { name: 'LaGuardia Airport', coordinates: [-73.874, 40.7769], kind: 'airport', code: 'LGA' },
  { name: 'Newark Airport', coordinates: [-74.1745, 40.6895], kind: 'airport', code: 'EWR' },
  { name: 'New Haven Union Station', coordinates: [-72.925, 41.2988], kind: 'station' },
  { name: 'NYC Penn Station', coordinates: [-73.9935, 40.7506], kind: 'station' },
  { name: 'DC Union Station', coordinates: [-77.0064, 38.8971], kind: 'station' },
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

export function searchPlaces(query: string): Place[] {
  const q = query.trim().toLowerCase();
  return q ? places.filter((place) => place.name?.toLowerCase().includes(q) || place.code?.toLowerCase() === q).slice(0, 5) : [];
}
