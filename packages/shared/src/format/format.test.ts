import { describe, expect, it } from 'vitest';
import { sampleItinerary } from '../domain/fixtures.js';
import type { Itinerary } from '../domain/itinerary.js';
import { travelModes } from '../domain/modes.js';
import {
  formatAge,
  formatClock,
  formatCost,
  formatDuration,
  formatTimeRange,
  itineraryFreshness,
  legFreshness,
  legLabel,
  modeLabel,
  riskBadge,
  watchStateBadge
} from './format.js';

type Leg = Itinerary['legs'][number];
const NY = 'America/New_York';
const [walk, bus] = sampleItinerary.legs as [Leg, Leg, Leg];

describe('formatClock', () => {
  it.each([
    ['2026-11-13T08:12:00-05:00', '8:12 AM'],
    ['2026-11-13T00:05:00-05:00', '12:05 AM'],
    ['2026-11-13T17:30:00Z', '12:30 PM'],
    ['2026-07-01T23:59:00-04:00', '11:59 PM']
  ])('%s → %s', (iso, expected) => {
    expect(formatClock(iso, NY)).toBe(expected);
  });

  it('uses a plain space before AM/PM', () => {
    expect(formatClock('2026-11-13T08:12:00-05:00', NY)).toMatch(/^8:12 AM$/);
  });
});

describe('formatTimeRange', () => {
  it.each([
    ['2026-11-13T08:00:00-05:00', '2026-11-13T08:42:00-05:00', '8:00 – 8:42 AM'],
    ['2026-11-13T11:40:00-05:00', '2026-11-13T12:15:00-05:00', '11:40 AM – 12:15 PM'],
    ['2026-11-13T23:40:00-05:00', '2026-11-14T00:15:00-05:00', '11:40 PM – 12:15 AM (+1 day)'],
    ['2026-11-13T01:00:00-05:00', '2026-11-14T02:00:00-05:00', '1:00 AM – 2:00 AM (+1 day)'],
    ['2026-11-13T22:00:00-05:00', '2026-11-15T06:00:00-05:00', '10:00 PM – 6:00 AM (+2 days)']
  ])('%s – %s → %s', (from, to, expected) => {
    expect(formatTimeRange(from, to, NY)).toBe(expected);
  });

  it('decides "+1 day" in the display zone, not by UTC date', () => {
    // 19:00–20:30 in New York crosses midnight UTC but not local midnight.
    expect(formatTimeRange('2026-11-13T19:00:00-05:00', '2026-11-13T20:30:00-05:00', NY)).toBe('7:00 – 8:30 PM');
  });
});

describe('formatDuration', () => {
  it.each([
    [0, '0 min'],
    [45, '45 min'],
    [65, '1 h 5 min'],
    [120, '2 h'],
    [6.4, '6 min']
  ])('%d → %s', (minutes, expected) => {
    expect(formatDuration(minutes)).toBe(expected);
  });
});

describe('formatAge', () => {
  const now = new Date('2026-11-13T12:00:00Z');
  const ago = (seconds: number) => new Date(now.getTime() - seconds * 1000).toISOString();

  it.each([
    [0, 'just now'],
    [9, 'just now'],
    [40, '40 s ago'],
    [3 * 60 + 20, '3 min ago'],
    [2 * 3600 + 59 * 60, '2 h ago']
  ])('%i s old → %s', (seconds, expected) => {
    expect(formatAge(ago(seconds), now)).toBe(expected);
  });
});

describe('formatCost', () => {
  it.each([
    ['free', { totalUsd: 0, lines: [] }, 'Free'],
    ['exact', { totalUsd: 4.1, lines: [{ label: 'Fare', usd: 4.1, estimated: false }] }, '$4.10'],
    [
      'one estimated line',
      { totalUsd: 4.1, lines: [{ label: 'Fare', usd: 2.4, estimated: false }, { label: 'Gas', usd: 1.7, estimated: true }] },
      '~$4.10'
    ],
    ['thousands', { totalUsd: 1234.5, lines: [{ label: 'Flight', usd: 1234.5, estimated: false }] }, '$1,234.50']
  ])('%s → %s', (_name, cost, expected) => {
    expect(formatCost(cost)).toBe(expected);
  });
});

describe('modeLabel', () => {
  it.each(travelModes)('%s has a label', (mode) => {
    expect(modeLabel(mode).length).toBeGreaterThan(0);
  });

  it('uses the product wording', () => {
    expect(travelModes.map(modeLabel)).toEqual(['Walk', 'Bike', 'Bikeshare', 'Bus', 'Train', 'Ferry', 'Drive', 'Flight']);
  });
});

describe('legLabel', () => {
  it.each([
    ['walk', { ...walk, durationMinutes: 5 }, 'Walk 5 min'],
    ['bike', { ...walk, mode: 'bike', durationMinutes: 12 }, 'Bike 12 min'],
    ['car', { ...walk, mode: 'car', durationMinutes: 65 }, 'Drive 1 h 5 min'],
    ['bus with route', bus, 'Bus 1'],
    ['rail without route', { ...bus, mode: 'rail', routeName: undefined }, 'Train']
  ] as [string, Leg, string][])('%s → %s', (_name, leg, expected) => {
    expect(legLabel(leg)).toBe(expected);
  });
});

describe('legFreshness', () => {
  it.each([
    ['live, late', { ...bus, timeSource: 'realtime', delayMinutes: 4 }, { label: 'Live · 4 min late', tone: 'warn' }],
    ['live, early', { ...bus, timeSource: 'realtime', delayMinutes: -2 }, { label: 'Live · 2 min early', tone: 'info' }],
    ['live, zero delay', { ...bus, timeSource: 'realtime', delayMinutes: 0 }, { label: 'Live · on time', tone: 'ok' }],
    ['live, no delay field', { ...bus, timeSource: 'realtime', delayMinutes: undefined }, { label: 'Live · on time', tone: 'ok' }],
    ['scheduled', { ...bus, timeSource: 'scheduled', delayMinutes: undefined }, { label: 'Scheduled (not live)', tone: 'neutral' }],
    ['estimated', walk, { label: 'Estimated', tone: 'neutral' }]
  ] as [string, Leg, unknown][])('%s', (_name, leg, expected) => {
    expect(legFreshness(leg)).toEqual(expected);
  });

  it('says "not live" for schedule-only times and "early" for a negative delay', () => {
    expect(legFreshness({ ...bus, timeSource: 'scheduled', delayMinutes: undefined }).label).toContain('not live');
    expect(legFreshness({ ...bus, timeSource: 'realtime', delayMinutes: -3 }).label).toContain('early');
  });
});

describe('itineraryFreshness', () => {
  const withBus = (b: Partial<Leg>): Itinerary => ({ ...sampleItinerary, legs: sampleItinerary.legs.map((l) => (l.mode === 'bus' ? { ...l, ...b } : l)) });

  it.each([
    ['a live leg', withBus({ timeSource: 'realtime' }), { label: 'Live', tone: 'ok' }],
    ['schedule-only transit', withBus({ timeSource: 'scheduled', delayMinutes: undefined }), { label: 'Scheduled (not live)', tone: 'neutral' }],
    ['only estimates', withBus({ timeSource: 'estimated', delayMinutes: undefined }), { label: 'Estimated', tone: 'neutral' }]
  ] as [string, Itinerary, unknown][])('%s', (_name, it_, expected) => {
    expect(itineraryFreshness(it_)).toEqual(expected);
  });
});

describe('riskBadge', () => {
  it.each([
    ['low', { label: 'Safe', tone: 'ok' }],
    ['medium', { label: 'Some risk', tone: 'warn' }],
    ['high', { label: 'Tight', tone: 'danger' }]
  ] as const)('%s', (level, expected) => {
    expect(riskBadge({ level, reasons: [] })).toEqual(expected);
  });
});

describe('watchStateBadge', () => {
  it.each([
    ['scheduled', 'Later', 'neutral'],
    ['onTrack', 'On track', 'ok'],
    ['leaveSoon', 'Leave soon', 'warn'],
    ['leaveNow', 'Leave now', 'danger'],
    ['atRisk', 'Might be late', 'danger'],
    ['missed', 'Missed', 'danger'],
    ['done', 'Done', 'neutral']
  ] as const)('%s → %s (%s)', (state, label, tone) => {
    expect(watchStateBadge(state)).toEqual({ label, tone });
  });

  it('returns a copy, so callers cannot change the shared wording', () => {
    watchStateBadge('done').label = 'changed';
    expect(watchStateBadge('done').label).toBe('Done');
  });
});
