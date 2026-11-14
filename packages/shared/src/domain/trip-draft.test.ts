import { describe, expect, it } from 'vitest';
import { TravelModeSchema } from './modes.js';
import { PlaceSchema } from './places.js';
import { TripDraftSchema, TripRequestSchema } from './trip-draft.js';

describe('TripDraftSchema', () => {
  it('parses an empty draft and fills defaults', () => {
    const draft = TripDraftSchema.parse({});
    expect(draft.preferences.lateTolerance).toBe('some');
    expect(draft.modes).toEqual(['walk', 'bus', 'rail']);
  });

  it('rejects comfortVsCost above 1', () => {
    expect(TripDraftSchema.safeParse({ preferences: { comfortVsCost: 1.5 } }).success).toBe(false);
  });

  it('validates the display time zone', () => {
    expect(TripDraftSchema.safeParse({ timeZone: 'America/New_York' }).success).toBe(true);
    expect(TripDraftSchema.safeParse({ timeZone: 'Mars/Olympus' }).success).toBe(false);
  });

  it('validates ISO datetimes with offsets', () => {
    expect(TripDraftSchema.safeParse({ returnTime: '2026-11-13 08:00' }).success).toBe(false);
    expect(TripDraftSchema.safeParse({ returnTime: '2026-11-13T08:00:00-05:00' }).success).toBe(true);
  });
});

describe('TripRequestSchema', () => {
  it('requires origin, destination and time', () => {
    const result = TripRequestSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((issue) => issue.path[0]);
      expect(paths).toEqual(expect.arrayContaining(['origin', 'destination', 'time']));
    }
  });
});

describe('PlaceSchema', () => {
  it('rejects out-of-range longitude and accepts Boston', () => {
    expect(PlaceSchema.safeParse({ coordinates: [200, 10] }).success).toBe(false);
    expect(PlaceSchema.safeParse({ coordinates: [-71.06, 42.36] }).success).toBe(true);
  });
});

describe('TravelModeSchema', () => {
  it('rejects rideshare', () => {
    expect(TravelModeSchema.safeParse('rideshare').success).toBe(false);
  });
});
