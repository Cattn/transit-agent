import { describe, expect, it } from 'vitest';
import { sampleItinerary } from './fixtures.js';
import { ItinerarySchema } from './itinerary.js';

describe('ItinerarySchema', () => {
  it('parses the 3-leg sample itinerary', () => {
    expect(sampleItinerary.legs).toHaveLength(3);
    expect(ItinerarySchema.safeParse(sampleItinerary).success).toBe(true);
  });

  it('rejects a leg whose LineString has one point', () => {
    const [first, ...rest] = sampleItinerary.legs;
    const bad = {
      ...sampleItinerary,
      legs: [{ ...first, geometry: { type: 'LineString', coordinates: [[-71.06, 42.36]] } }, ...rest]
    };
    expect(ItinerarySchema.safeParse(bad).success).toBe(false);
  });
});
