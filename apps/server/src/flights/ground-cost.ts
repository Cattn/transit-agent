import type { Itinerary } from '@transit/shared';

/** `{ label, usd, estimated }` from the shared contract (CostLineSchema). */
export type CostLine = Itinerary['cost']['lines'][number];

export interface DriveCostOptions {
  mpg: number;
  gasUsdPerGallon: number;
  parkingUsdPerDay?: number;
  tollsUsd?: number;
}

/** Used when an airport has no published long-term rate (014-Q2, decided). */
export const DEFAULT_PARKING_USD_PER_DAY = 25;
export const DEFAULT_GAS_USD_PER_GALLON = 3.2;

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Cost of driving `miles` (ONE way; the caller doubles it for a round trip) and parking for
 * `days`. Lines, in order: Gas, Parking (when days > 0), Tolls (when tollsUsd > 0). All estimated.
 */
export function driveCost(miles: number, days: number, opts: DriveCostOptions): CostLine[] {
  const lines: CostLine[] = [{ label: 'Gas', usd: round2((miles / opts.mpg) * opts.gasUsdPerGallon), estimated: true }];
  if (days > 0) {
    lines.push({ label: 'Parking', usd: round2(days * (opts.parkingUsdPerDay ?? DEFAULT_PARKING_USD_PER_DAY)), estimated: true });
  }
  if (opts.tollsUsd !== undefined && opts.tollsUsd > 0) {
    lines.push({ label: 'Tolls', usd: round2(opts.tollsUsd), estimated: true });
  }
  return lines;
}

/** Transit to/from the airport: `trips` rides at `fareUsd` each, as one estimated "Transit" line. */
export function transitCost(fareUsd: number, trips: number): CostLine[] {
  return [{ label: 'Transit', usd: round2(fareUsd * trips), estimated: true }];
}

/** GAS_USD_PER_GALLON from the environment; missing, non-numeric or ≤ 0 → $3.20. */
export function gasPriceFromEnv(env: Record<string, string | undefined> = process.env): number {
  const raw = env.GAS_USD_PER_GALLON?.trim();
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_GAS_USD_PER_GALLON;
}
