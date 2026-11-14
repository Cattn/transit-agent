import { describe, it, expect } from 'vitest';
import { AIRPORTS, airportsNear, airportToPlace } from './airports.js';
import { haversineKm } from './geo.js';
import { NORTHEAST_AIRPORTS } from './northeast-airports.js';

const BOSTON: [number, number] = [-71.0589, 42.3601];

describe('airportsNear', () => {
  it('finds BOS first and includes PVD and MHT, but not JFK, within 100 km of Boston', () => {
    const near = airportsNear(BOSTON, 100).map((a) => a.iata);
    expect(near[0]).toBe('BOS');
    expect(near).toEqual(expect.arrayContaining(['PVD', 'MHT']));
    expect(near).not.toContain('JFK');
  });

  it('includes JFK within 350 km, sorted nearest first', () => {
    const near = airportsNear(BOSTON, 350);
    expect(near.map((a) => a.iata)).toContain('JFK');
    const distances = near.map((a) => a.distanceKm);
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
  });
});

describe('AIRPORTS', () => {
  it('has the 25 planned airports, each with valid [lng, lat] and a time zone', () => {
    expect(AIRPORTS.map((a) => a.iata).sort()).toEqual(
      ['BOS', 'PVD', 'MHT', 'BDL', 'HVN', 'ALB', 'PWM', 'JFK', 'LGA', 'EWR', 'HPN', 'ISP', 'PHL', 'BWI', 'DCA', 'IAD', 'ORD', 'ATL', 'DFW', 'DEN', 'LAX', 'SFO', 'SEA', 'MIA', 'MCO'].sort()
    );
    for (const a of AIRPORTS) {
      const [lng, lat] = a.coordinates;
      // Continental US: longitudes are west (negative), latitudes 24–50 N. Catches swapped [lat, lng].
      expect(lng, a.iata).toBeLessThan(-66);
      expect(lng, a.iata).toBeGreaterThan(-125);
      expect(lat, a.iata).toBeGreaterThan(24);
      expect(lat, a.iata).toBeLessThan(50);
      expect(() => new Intl.DateTimeFormat('en-US', { timeZone: a.timeZone }), a.iata).not.toThrow();
    }
  });

  it('puts known pairs at realistic distances', () => {
    const at = (iata: string) => AIRPORTS.find((a) => a.iata === iata)!.coordinates;
    expect(haversineKm(at('BOS'), at('JFK'))).toBeGreaterThan(280);
    expect(haversineKm(at('BOS'), at('JFK'))).toBeLessThan(310);
    expect(haversineKm(at('JFK'), at('LAX'))).toBeGreaterThan(3950);
    expect(haversineKm(at('JFK'), at('LAX'))).toBeLessThan(4000);
  });

  it('converts to a shared Place', () => {
    const bos = AIRPORTS.find((a) => a.iata === 'BOS')!;
    expect(airportToPlace(bos)).toEqual({ name: bos.name, coordinates: bos.coordinates, kind: 'airport', code: 'BOS' });
  });
});

describe('NORTHEAST_AIRPORTS (generated)', () => {
  const NORTHEAST = new Set(['US-CT', 'US-ME', 'US-MA', 'US-NH', 'US-RI', 'US-VT', 'US-NJ', 'US-NY', 'US-PA']);

  it('only has Northeast airports on Eastern time, with unique codes', () => {
    expect(NORTHEAST_AIRPORTS.length).toBeGreaterThan(20);
    for (const a of NORTHEAST_AIRPORTS) {
      expect(NORTHEAST.has(a.region), a.iata).toBe(true);
      expect(a.timeZone).toBe('America/New_York');
    }
    expect(new Set(NORTHEAST_AIRPORTS.map((a) => a.iata)).size).toBe(NORTHEAST_AIRPORTS.length);
  });

  it('supplies every Northeast airport in AIRPORTS', () => {
    const codes = new Set(NORTHEAST_AIRPORTS.map((a) => a.iata));
    for (const iata of ['BOS', 'PVD', 'MHT', 'BDL', 'HVN', 'ALB', 'PWM', 'JFK', 'LGA', 'EWR', 'HPN', 'ISP', 'PHL']) {
      expect(codes.has(iata), iata).toBe(true);
    }
  });
});
