import type { Itinerary, Leg, TravelMode, TripRequest } from '@transit/shared';

const minutesIn = (it: Itinerary, modes: readonly TravelMode[]) =>
  it.legs.filter((leg) => modes.includes(leg.mode)).reduce((sum, leg) => sum + leg.durationMinutes, 0);

const usd = (value: number) => `$${value.toFixed(2)}`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const legTarget = (leg: Leg) => leg.routeName ?? leg.mode;

/** Hard requirements an itinerary breaks, one human-readable string each. Empty = acceptable. */
export function checkConstraints(it: Itinerary, req: TripRequest): string[] {
  const violations: string[] = [];
  const c = req.constraints;

  const disallowed = [...new Set(it.legs.map((leg) => leg.mode))].filter((mode) => !req.modes.includes(mode));
  for (const mode of disallowed) violations.push(`Uses ${mode}, which is not selected`);

  if (c.arriveBy !== undefined && Date.parse(it.arriveAt) > Date.parse(c.arriveBy)) {
    const format = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: req.timeZone });
    violations.push(`Arrives ${format.format(new Date(it.arriveAt))}, after the ${format.format(new Date(c.arriveBy))} deadline`);
  }

  if (c.maxBudgetUsd !== undefined && it.cost.totalUsd > c.maxBudgetUsd) {
    violations.push(`Costs ${usd(it.cost.totalUsd)}, over the ${usd(c.maxBudgetUsd)} budget`);
  }

  if (c.maxWalkMinutes !== undefined && it.walkMinutes > c.maxWalkMinutes) {
    violations.push(`Walks ${it.walkMinutes} min, over the ${c.maxWalkMinutes} min limit`);
  }

  const bikeMinutes = minutesIn(it, ['bike', 'bikeshare']);
  if (c.maxBikeMinutes !== undefined && bikeMinutes > c.maxBikeMinutes) {
    violations.push(`Bikes ${bikeMinutes} min, over the ${c.maxBikeMinutes} min limit`);
  }

  const driveMinutes = minutesIn(it, ['car']);
  if (c.maxDriveMinutes !== undefined && driveMinutes > c.maxDriveMinutes) {
    violations.push(`Drives ${driveMinutes} min, over the ${c.maxDriveMinutes} min limit`);
  }

  if (c.maxTransfers !== undefined && it.transfers > c.maxTransfers) {
    violations.push(`${plural(it.transfers, 'transfer')}, more than the ${c.maxTransfers} allowed`);
  }

  if (c.minTransferBufferMinutes !== undefined) {
    for (const leg of it.legs) {
      if (leg.transferBufferMinutes !== undefined && leg.transferBufferMinutes < c.minTransferBufferMinutes) {
        violations.push(
          `Only ${leg.transferBufferMinutes} min to transfer to ${legTarget(leg)}, under the ${c.minTransferBufferMinutes} min minimum`
        );
      }
    }
  }

  return violations;
}
