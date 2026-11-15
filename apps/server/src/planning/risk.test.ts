import { describe, expect, it } from 'vitest';
import { sampleItinerary, TripRequestSchema, type Itinerary, type Leg } from '@transit/shared';
import { assessRisk } from './risk.js';

const request = (lateTolerance: 'strict' | 'some' | 'flexible' = 'some') =>
  TripRequestSchema.parse({
    origin: { coordinates: [-71.0589, 42.3601] },
    destination: { coordinates: [-71.0735, 42.3505] },
    time: { type: 'departAt', at: '2026-11-13T08:00:00-05:00' },
    preferences: { lateTolerance }
  });

const [walk, bus] = sampleItinerary.legs as [Leg, Leg, Leg];

/** walk → <previous> → rail (with the given buffer). */
const transfer = (buffer: number, previous: Leg = walk): Itinerary => ({
  ...sampleItinerary,
  legs: [previous, { ...bus, mode: 'rail', routeName: 'Red Line', timeSource: 'scheduled', transferBufferMinutes: buffer }]
});

describe('assessRisk', () => {
  it('is low with no reasons when there are no transfers', () => {
    expect(assessRisk(sampleItinerary, request())).toEqual({ level: 'low', reasons: [] });
  });

  it('marks a 2 min transfer as high', () => {
    expect(assessRisk(transfer(2), request())).toEqual({ level: 'high', reasons: ['Tight 2 min transfer to Red Line'] });
  });

  it('marks a 5 min transfer as medium and a 7 min transfer as low', () => {
    expect(assessRisk(transfer(5), request()).level).toBe('medium');
    expect(assessRisk(transfer(7), request())).toEqual({ level: 'low', reasons: [] });
  });

  it('treats a transfer after a scheduled (not live) bus as medium below 10 min', () => {
    const scheduledBus: Leg = { ...bus, timeSource: 'scheduled' };
    const risk = assessRisk(transfer(8, scheduledBus), request());
    expect(risk.level).toBe('medium');
    expect(risk.reasons[0]).toMatch(/scheduled \(not live\) bus/);
    // A realtime bus with the same buffer is fine.
    expect(assessRisk(transfer(8, bus), request()).level).toBe('low');
  });

  it('looks past a transfer walk to the previous scheduled bus', () => {
    const scheduledBus: Leg = { ...bus, timeSource: 'scheduled' };
    const it: Itinerary = { ...sampleItinerary, legs: [scheduledBus, walk, { ...bus, mode: 'rail', routeName: 'Red Line', timeSource: 'scheduled', transferBufferMinutes: 8 }] };
    expect(assessRisk(it, request()).reasons).toEqual(['8 min transfer to Red Line after a scheduled (not live) bus']);
  });

  it('shifts thresholds with lateTolerance', () => {
    expect(assessRisk(transfer(4), request('strict')).level).toBe('high');
    expect(assessRisk(transfer(4), request('some')).level).toBe('medium');
    expect(assessRisk(transfer(5), request('flexible')).level).toBe('low');
  });

  it('never invents probabilities', () => {
    const { reasons } = assessRisk(transfer(2, { ...bus, timeSource: 'scheduled' }), request('strict'));
    for (const reason of reasons) expect(reason).not.toMatch(/%|percent|probab|chance/i);
  });
});
