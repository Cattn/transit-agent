import { describe, it, expect } from 'vitest';
import { driveCost, gasPriceFromEnv, transitCost } from './ground-cost.js';

describe('driveCost', () => {
  it('prices gas and default parking, with no tolls line', () => {
    expect(driveCost(100, 2, { mpg: 25, gasUsdPerGallon: 3.2 })).toEqual([
      { label: 'Gas', usd: 12.8, estimated: true },
      { label: 'Parking', usd: 50, estimated: true }
    ]);
  });

  it('uses the airport parking rate, skips parking for 0 days, and adds tolls when > 0', () => {
    expect(driveCost(50, 0, { mpg: 25, gasUsdPerGallon: 4, parkingUsdPerDay: 14, tollsUsd: 6.5 })).toEqual([
      { label: 'Gas', usd: 8, estimated: true },
      { label: 'Tolls', usd: 6.5, estimated: true }
    ]);
    expect(driveCost(50, 3, { mpg: 25, gasUsdPerGallon: 4, parkingUsdPerDay: 14, tollsUsd: 0 }).map((l) => l.label)).toEqual(['Gas', 'Parking']);
    expect(driveCost(50, 3, { mpg: 25, gasUsdPerGallon: 4, parkingUsdPerDay: 14 })[1]!.usd).toBe(42);
  });
});

describe('transitCost', () => {
  it('multiplies fare by trips', () => {
    expect(transitCost(2.05, 2)).toEqual([{ label: 'Transit', usd: 4.1, estimated: true }]);
  });
});

describe('gasPriceFromEnv', () => {
  it('reads GAS_USD_PER_GALLON and falls back to 3.20 when missing or invalid', () => {
    expect(gasPriceFromEnv({ GAS_USD_PER_GALLON: '3.85' })).toBe(3.85);
    expect(gasPriceFromEnv({ GAS_USD_PER_GALLON: 'abc' })).toBe(3.2);
    expect(gasPriceFromEnv({ GAS_USD_PER_GALLON: '-1' })).toBe(3.2);
    expect(gasPriceFromEnv({ GAS_USD_PER_GALLON: '' })).toBe(3.2);
    expect(gasPriceFromEnv({})).toBe(3.2);
  });
});
