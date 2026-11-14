import type { Itinerary, TripPreferences, TripRequest } from '@transit/shared';

type RiskLevel = Itinerary['risk']['level'];

/** Shifts the buffer thresholds: strict riders need more slack, flexible riders accept less. */
export const lateToleranceShift: Record<TripPreferences['lateTolerance'], number> = { strict: 3, some: 0, flexible: -1 };

const order: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };

/**
 * Deterministic transfer-risk rules ("how evil is this transfer"). No probabilities, no invented
 * percentages: reasons only state facts (buffer minutes, scheduled vs live times).
 */
export function assessRisk(it: Itinerary, req: TripRequest): Itinerary['risk'] {
  const s = lateToleranceShift[req.preferences.lateTolerance];
  let level: RiskLevel = 'low';
  const reasons: string[] = [];

  it.legs.forEach((leg, index) => {
    const buffer = leg.transferBufferMinutes;
    if (buffer === undefined) return;
    const target = leg.routeName ?? leg.mode;
    const previous = index > 0 ? it.legs[index - 1] : undefined;
    const afterScheduledBus = previous?.mode === 'bus' && previous.timeSource === 'scheduled';

    let legLevel: RiskLevel = 'low';
    let reason: string | undefined;
    if (buffer < 3 + s) {
      legLevel = 'high';
      reason = `Tight ${buffer} min transfer to ${target}`;
    } else if (afterScheduledBus && buffer < 10 + s) {
      legLevel = 'medium';
      reason = `${buffer} min transfer to ${target} after a scheduled (not live) bus`;
    } else if (buffer < 6 + s) {
      legLevel = 'medium';
      reason = `Short ${buffer} min transfer to ${target}`;
    }

    if (reason) reasons.push(reason);
    if (order[legLevel] > order[level]) level = legLevel;
  });

  return { level, reasons };
}
