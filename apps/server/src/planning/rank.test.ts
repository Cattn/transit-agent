import { describe, expect, it } from 'vitest';
import { sampleItinerary, type Itinerary, type TripPreferences } from '@transit/shared';
import { rankItineraries, scoreItinerary } from './rank.js';

const prefs = (overrides: Partial<TripPreferences> = {}): TripPreferences => ({
  comfortVsCost: 0.5,
  transferRisk: 0.3,
  lateTolerance: 'some',
  activeTravel: 0.5,
  ...overrides
});

const trip = (id: string, durationMinutes: number, totalUsd: number, level: Itinerary['risk']['level'] = 'low'): Itinerary => ({
  ...sampleItinerary,
  id,
  durationMinutes,
  transfers: 0,
  walkMinutes: 0,
  cost: { totalUsd, lines: [] },
  risk: { level, reasons: [] }
});

const cheapSlow = trip('cheap-slow', 60, 3);
const priceyFast = trip('pricey-fast', 50, 25);

describe('rankItineraries', () => {
  it('prefers the cheap trip when comfortVsCost is 0', () => {
    expect(rankItineraries([priceyFast, cheapSlow], prefs({ comfortVsCost: 0 })).map((it) => it.id)).toEqual([
      'cheap-slow',
      'pricey-fast'
    ]);
  });

  it('prefers the fast trip when comfortVsCost is 1', () => {
    expect(rankItineraries([cheapSlow, priceyFast], prefs({ comfortVsCost: 1 })).map((it) => it.id)).toEqual([
      'pricey-fast',
      'cheap-slow'
    ]);
  });

  it('penalises a high-risk trip when transferRisk is 0', () => {
    const risky = trip('risky', 40, 5, 'high');
    const safe = trip('safe', 40, 5, 'low');
    expect(rankItineraries([risky, safe], prefs({ transferRisk: 0 })).map((it) => it.id)).toEqual(['safe', 'risky']);
  });

  it('ignores risk when transferRisk is 1 (tie keeps input order)', () => {
    const risky = trip('risky', 40, 5, 'high');
    const safe = trip('safe', 40, 5, 'low');
    expect(scoreItinerary(risky, prefs({ transferRisk: 1 }))).toBe(scoreItinerary(safe, prefs({ transferRisk: 1 })));
    expect(rankItineraries([risky, safe], prefs({ transferRisk: 1 })).map((it) => it.id)).toEqual(['risky', 'safe']);
  });
});
