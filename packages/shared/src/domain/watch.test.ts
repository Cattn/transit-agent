import { describe, expect, it } from 'vitest';
import { sampleItinerary } from './fixtures.js';
import { SavedItinerarySchema, type Itinerary } from './itinerary.js';
import { TripRequestSchema, type TripRequest } from './trip-draft.js';
import { computeWatchStatus, leaveBufferMinutes, leaveByLabel, leaveSoonMinutes } from './watch.js';

const DAY = '2026-11-13';
const at = (hhmm: string) => `${DAY}T${hhmm}:00-05:00`;
const now = (hhmm: string) => new Date(at(hhmm));

const [walk1, bus, walk2] = sampleItinerary.legs as [Itinerary['legs'][number], Itinerary['legs'][number], Itinerary['legs'][number]];

/** walk 08:00–08:05, Bus 1 08:05–08:20 (schedule only), walk 08:20–08:25. */
function fixture(busOverrides: Partial<Itinerary['legs'][number]> = {}): Itinerary {
  const busLeg = { ...bus, departAt: at('08:05'), arriveAt: at('08:20'), durationMinutes: 15, timeSource: 'scheduled' as const, routeName: 'Bus 1', delayMinutes: undefined, ...busOverrides };
  return {
    ...sampleItinerary,
    legs: [
      { ...walk1, departAt: at('08:00'), arriveAt: at('08:05'), durationMinutes: 5 },
      busLeg,
      { ...walk2, departAt: at('08:20'), arriveAt: at('08:25'), durationMinutes: 5 }
    ],
    departAt: at('08:00'),
    arriveAt: at('08:25'),
    durationMinutes: 25
  };
}

function request(lateTolerance: TripRequest['preferences']['lateTolerance'] = 'some', arriveBy?: string): TripRequest {
  return TripRequestSchema.parse({
    origin: walk1.from,
    destination: walk2.to,
    time: { type: 'departAt', at: at('08:00') },
    timeZone: 'America/New_York',
    constraints: arriveBy ? { arriveBy } : {},
    preferences: { lateTolerance }
  });
}

describe('computeWatchStatus', () => {
  it.each([
    ['04:00', 'some', 'scheduled', '07:58'],
    ['07:40', 'some', 'onTrack', '07:58'],
    ['07:50', 'some', 'leaveSoon', '07:58'],
    ['07:58', 'some', 'leaveNow', '07:58'],
    ['07:50', 'strict', 'leaveSoon', '07:55'],
    ['08:06', 'some', 'missed', undefined],
    ['08:30', 'some', 'done', undefined]
  ] as const)('at %s with %s tolerance → %s (leave by %s)', (time, tolerance, state, leaveBy) => {
    const status = computeWatchStatus(fixture(), request(tolerance), now(time));
    expect(status.state).toBe(state);
    expect(status.leaveBy).toBe(leaveBy && at(leaveBy));
    expect(status.checkedAt).toBe(now(time).toISOString());
    expect(status.usedRealtime).toBe(false);
  });

  it('is atRisk when the trip lands after arriveBy', () => {
    const status = computeWatchStatus(fixture(), request('some', at('08:20')), now('07:40'));
    expect(status.state).toBe('atRisk');
    expect(status.message).toBe('You may arrive after 8:20 AM.');
  });

  it('uses the live departure as-is (delay already included) and says the bus is late', () => {
    const live = fixture({ departAt: at('08:09'), arriveAt: at('08:20'), durationMinutes: 11, timeSource: 'realtime', delayMinutes: 4 });
    const status = computeWatchStatus(live, request('some'), now('07:40'));
    expect(status.leaveBy).toBe(at('08:02'));
    expect(status.usedRealtime).toBe(true);
    expect(status.message).toBe('Leave by 8:02 AM. Bus 1 is 4 min late (live).');
    expect(status.message).toContain('4 min late (live)');
  });

  it('stays quiet about schedule-only times and leaves the live flag to the UI', () => {
    const status = computeWatchStatus(fixture(), request('some'), now('07:40'));
    expect(status.message).toBe('Leave by 7:58 AM.');
    expect(status.usedRealtime).toBe(false);
  });

  it('names the anchor in missed and done messages', () => {
    expect(computeWatchStatus(fixture(), request(), now('08:06')).message).toBe('Bus 1 has left. Check the next option.');
    expect(computeWatchStatus(fixture(), request(), now('08:30')).message).toBe('Trip finished.');
  });

  it('anchors on the first leg when no leg is timetabled', () => {
    const walkOnly: Itinerary = { ...sampleItinerary, legs: [{ ...walk1, departAt: at('08:00'), arriveAt: at('08:05'), durationMinutes: 5 }] };
    const status = computeWatchStatus(walkOnly, request('flexible'), now('07:55'));
    expect(status.leaveBy).toBe(at('08:00'));
    expect(status.state).toBe('leaveSoon');
  });

  it('keeps thresholds in the exported constants', () => {
    expect(leaveBufferMinutes).toEqual({ strict: 5, some: 2, flexible: 0 });
    expect(leaveSoonMinutes).toBe(10);
  });

  it('produces a status a SavedItinerary accepts', () => {
    const status = computeWatchStatus(fixture(), request(), now('07:40'));
    const saved = { ...fixture(), savedAt: at('07:00'), watch: true, request: request(), watchStatus: status };
    expect(SavedItinerarySchema.parse(saved).watchStatus).toEqual(status);
  });
});

describe('leaveByLabel', () => {
  const leaveBy = at('08:00');
  const offset = (ms: number) => new Date(Date.parse(leaveBy) - ms);

  it.each([
    [6 * 60_000 + 50_000, 'Leave in 6 min'],
    [0, 'Leave now'],
    [-3 * 60_000, 'Left 3 min ago'],
    [80 * 60_000, 'Leave in 1 h 20 min'],
    [60 * 60_000, 'Leave in 1 h']
  ])('%i ms before leaveBy → %s', (msBefore, label) => {
    expect(leaveByLabel(leaveBy, offset(msBefore))).toBe(label);
  });
});
