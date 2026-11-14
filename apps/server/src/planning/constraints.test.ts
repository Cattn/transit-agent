import { describe, expect, it } from 'vitest';
import { sampleItinerary, TripRequestSchema, type Itinerary } from '@transit/shared';
import { checkConstraints } from './constraints.js';

const request = (overrides: Record<string, unknown> = {}) =>
  TripRequestSchema.parse({
    origin: { coordinates: [-71.0589, 42.3601] },
    destination: { coordinates: [-71.0735, 42.3505] },
    time: { type: 'departAt', at: '2026-11-13T08:00:00-05:00' },
    timeZone: 'America/New_York',
    ...overrides
  });

const withTransfer = (buffer: number): Itinerary => ({
  ...sampleItinerary,
  legs: sampleItinerary.legs.map((leg, index) => (index === 1 ? { ...leg, transferBufferMinutes: buffer } : leg))
});

describe('checkConstraints', () => {
  it('returns no violations for the sample itinerary with default request', () => {
    expect(checkConstraints(sampleItinerary, request())).toEqual([]);
  });

  it('flags modes that are not selected', () => {
    expect(checkConstraints(sampleItinerary, request({ modes: ['walk', 'rail'] }))).toEqual([
      'Uses bus, which is not selected'
    ]);
  });

  it('flags arriving after the arriveBy deadline', () => {
    const [violation] = checkConstraints(sampleItinerary, request({ constraints: { arriveBy: '2026-11-13T08:20:00-05:00' } }));
    expect(violation).toMatch(/^Arrives 8:27\sAM, after the 8:20\sAM deadline$/);
  });

  it('flags budget, walk, transfer and buffer limits', () => {
    const violations = checkConstraints(
      { ...withTransfer(2), transfers: 1 },
      request({ constraints: { maxBudgetUsd: 1, maxWalkMinutes: 5, maxTransfers: 0, minTransferBufferMinutes: 5 } })
    );
    expect(violations).toEqual([
      'Costs $1.70, over the $1.00 budget',
      'Walks 11 min, over the 5 min limit',
      '1 transfer, more than the 0 allowed',
      'Only 2 min to transfer to Bus 1, under the 5 min minimum'
    ]);
  });

  it('flags bike and drive minutes', () => {
    const it: Itinerary = {
      ...sampleItinerary,
      legs: [
        { ...sampleItinerary.legs[0]!, mode: 'bikeshare', durationMinutes: 20 },
        { ...sampleItinerary.legs[2]!, mode: 'car', durationMinutes: 30 }
      ]
    };
    expect(checkConstraints(it, request({ modes: ['bikeshare', 'car'], constraints: { maxBikeMinutes: 10, maxDriveMinutes: 15 } }))).toEqual([
      'Bikes 20 min, over the 10 min limit',
      'Drives 30 min, over the 15 min limit'
    ]);
  });
});
