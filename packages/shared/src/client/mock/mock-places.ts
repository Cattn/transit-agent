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
  { name: 'Providence Station', coordinates: [-71.4133, 41.829], kind: 'station' },
  { name: 'Wentworth Institute of Technology', coordinates: [-71.0995, 42.3363], kind: 'poi' },
  { name: 'Museum of Fine Arts', coordinates: [-71.094, 42.3394], kind: 'poi' },
  { name: 'Isabella Stewart Gardner Museum', coordinates: [-71.099, 42.3382], kind: 'poi' },
  { name: 'Longwood Medical Area', coordinates: [-71.104, 42.3374], kind: 'poi' },
  { name: 'Ruggles station', coordinates: [-71.089, 42.3364], kind: 'station' },
  { name: 'Copley Square', coordinates: [-71.077, 42.35], kind: 'poi' },
  { name: 'Prudential Center', coordinates: [-71.0819, 42.3471], kind: 'poi' },
  { name: 'Faneuil Hall', coordinates: [-71.0566, 42.36], kind: 'poi' },
  { name: 'New England Aquarium', coordinates: [-71.049, 42.3591], kind: 'poi' },
  { name: 'TD Garden', coordinates: [-71.0621, 42.3662], kind: 'poi' },
  { name: 'Chinatown', coordinates: [-71.0621, 42.3519], kind: 'poi' },
  { name: 'Massachusetts General Hospital', coordinates: [-71.0686, 42.3632], kind: 'poi' },
  { name: 'Charles/MGH station', coordinates: [-71.0707, 42.3612], kind: 'station' },
  { name: 'CambridgeSide', coordinates: [-71.0766, 42.3678], kind: 'poi' },
  { name: 'Central Square', coordinates: [-71.1037, 42.3655], kind: 'poi' },
  { name: 'Porter Square', coordinates: [-71.119, 42.3884], kind: 'poi' },
  { name: 'Alewife station', coordinates: [-71.1418, 42.3954], kind: 'station' },
  { name: 'Assembly Row', coordinates: [-71.0772, 42.3926], kind: 'poi' },
  { name: 'Brookline Village', coordinates: [-71.1167, 42.3326], kind: 'station' },
  { name: 'Forest Hills station', coordinates: [-71.1137, 42.3005], kind: 'station' },
  { name: 'Arnold Arboretum', coordinates: [-71.122, 42.3008], kind: 'poi' },
  { name: 'JFK/UMass station', coordinates: [-71.0522, 42.3207], kind: 'station' },
  { name: 'Quincy Center', coordinates: [-71.0054, 42.2513], kind: 'station' },
  { name: 'Salem Station', coordinates: [-70.8967, 42.5241], kind: 'station' }
];

export function mockSearchPlaces(q: string): Place[] {
  return PlaceSearchResponseSchema.parse({
    places: q.length < 3 ? [] : places.filter((place) => place.name!.toLowerCase().includes(q.toLowerCase()))
  }).places;
}
