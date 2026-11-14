// Airports used by flight search (plan 014).
//
// Codes and names: Cattn/clovis client/src/lib/airports.ts (from OurAirports).
// Coordinates: OurAirports airports.csv (latitude_deg, longitude_deg), https://ourairports.com/data/,
// rounded to 4 decimals and stored [lng, lat]. Northeast airports are read from the generated
// ./northeast-airports.ts (rerun `npm run airports:northeast`); the rest were looked up with
// `npm run airports:northeast -- --lookup <codes>` on 2026-11-13.
// Parking: only where the operator publishes a per-day long-term rate (cited inline, read
// 2026-11-13). Everything else falls back to DEFAULT_PARKING_USD_PER_DAY in ground-cost.ts.

import type { LngLat, Place } from '@transit/shared';
import { haversineKm } from './geo.js';
import { NORTHEAST_AIRPORTS } from './northeast-airports.js';

export interface Airport {
  iata: string;
  name: string;
  coordinates: LngLat;
  metro: string;
  /** IANA zone, e.g. 'America/New_York'. Needed to turn local flight times into ISO times with offsets (plan 019). */
  timeZone: string;
  parkingUsdPerDay?: number;
}

type Extra = Pick<Airport, 'metro'> & Partial<Pick<Airport, 'parkingUsdPerDay'>>;

/** A Northeast airport, with name, coordinates and time zone from the generated list. */
function northeast(iata: string, extra: Extra): Airport {
  const a = NORTHEAST_AIRPORTS.find((n) => n.iata === iata);
  if (!a) throw new Error(`${iata} is not in NORTHEAST_AIRPORTS; rerun npm run airports:northeast`);
  return { iata, name: a.name, coordinates: a.coordinates, timeZone: a.timeZone, ...extra };
}

export const AIRPORTS: readonly Airport[] = [
  // Northeast (US Census region)
  // Logan Economy Parking, $37.00 per 6–24 h day: https://www.massport.com/logan-airport/getting-to-logan/parking/economy-parking
  northeast('BOS', { metro: 'Boston', parkingUsdPerDay: 37 }),
  northeast('PVD', { metro: 'Providence' }),
  // Garage, "flat daily rate of $14" after 24 h: https://www.flymanchester.com/parking
  northeast('MHT', { metro: 'Manchester', parkingUsdPerDay: 14 }),
  northeast('BDL', { metro: 'Hartford' }),
  northeast('HVN', { metro: 'New Haven' }),
  northeast('ALB', { metro: 'Albany' }),
  northeast('PWM', { metro: 'Portland, ME' }),
  northeast('JFK', { metro: 'New York' }),
  northeast('LGA', { metro: 'New York' }),
  northeast('EWR', { metro: 'New York' }),
  northeast('HPN', { metro: 'New York' }),
  northeast('ISP', { metro: 'New York' }),
  northeast('PHL', { metro: 'Philadelphia' }),
  // Elsewhere (mostly destinations)
  { iata: 'BWI', name: 'Baltimore/Washington International Thurgood Marshall Airport', coordinates: [-76.6683, 39.1754], metro: 'Washington', timeZone: 'America/New_York' },
  { iata: 'DCA', name: 'Ronald Reagan Washington National Airport', coordinates: [-77.0377, 38.8521], metro: 'Washington', timeZone: 'America/New_York' },
  { iata: 'IAD', name: 'Washington Dulles International Airport', coordinates: [-77.4558, 38.9445], metro: 'Washington', timeZone: 'America/New_York' },
  { iata: 'ORD', name: "Chicago O'Hare International Airport", coordinates: [-87.9048, 41.9786], metro: 'Chicago', timeZone: 'America/Chicago' },
  { iata: 'ATL', name: 'Hartsfield Jackson Atlanta International Airport', coordinates: [-84.4281, 33.6367], metro: 'Atlanta', timeZone: 'America/New_York' },
  { iata: 'DFW', name: 'Dallas Fort Worth International Airport', coordinates: [-97.038, 32.8968], metro: 'Dallas-Fort Worth', timeZone: 'America/Chicago' },
  { iata: 'DEN', name: 'Denver International Airport', coordinates: [-104.6738, 39.86], metro: 'Denver', timeZone: 'America/Denver' },
  { iata: 'LAX', name: 'Los Angeles International Airport', coordinates: [-118.408, 33.9425], metro: 'Los Angeles', timeZone: 'America/Los_Angeles' },
  { iata: 'SFO', name: 'San Francisco International Airport', coordinates: [-122.3748, 37.6198], metro: 'San Francisco', timeZone: 'America/Los_Angeles' },
  { iata: 'SEA', name: 'Seattle–Tacoma International Airport', coordinates: [-122.3103, 47.4479], metro: 'Seattle', timeZone: 'America/Los_Angeles' },
  { iata: 'MIA', name: 'Miami International Airport', coordinates: [-80.2898, 25.796], metro: 'Miami', timeZone: 'America/New_York' },
  { iata: 'MCO', name: 'Orlando International Airport', coordinates: [-81.309, 28.4294], metro: 'Orlando', timeZone: 'America/New_York' },
  // Fallback connection hubs for the sample fares (fares.ts), looked up 2026-11-14
  { iata: 'DTW', name: 'Detroit Metropolitan Wayne County Airport', coordinates: [-83.3538, 42.2138], metro: 'Detroit', timeZone: 'America/Detroit' },
  { iata: 'CLT', name: 'Charlotte Douglas International Airport', coordinates: [-80.9431, 35.214], metro: 'Charlotte', timeZone: 'America/New_York' }
];

export function airportByIata(iata: string): Airport | undefined {
  return AIRPORTS.find((a) => a.iata === iata);
}

/** Airports within `radiusKm` of `point` (great-circle), nearest first. */
export function airportsNear(point: LngLat, radiusKm: number): Array<Airport & { distanceKm: number }> {
  return AIRPORTS.map((a) => ({ ...a, distanceKm: haversineKm(point, a.coordinates) }))
    .filter((a) => a.distanceKm <= radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm);
}

export function airportToPlace(a: Airport): Place {
  return { name: a.name, coordinates: a.coordinates, kind: 'airport', code: a.iata };
}
