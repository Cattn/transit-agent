import { describe, expect, it } from 'vitest';
import type { Place } from '@transit/shared';
import { canAddStop, movePatch, pickPatch, placeSlots, removeStopPatch } from './places';

const place = (name: string): Place => ({ name, coordinates: [-71, 42] });
const home = place('Home');
const shop = place('Shop');
const gym = place('Gym');
const work = place('Work');

describe('place rows', () => {
  it('lists From, stops, then To', () => {
    expect(placeSlots({ origin: home, stops: [shop], destination: undefined })).toEqual([home, shop, undefined]);
    expect(placeSlots({ origin: home, destination: work })).toEqual([home, work]);
  });

  it('adds, replaces and removes stops', () => {
    expect(pickPatch({}, 'add', shop)).toEqual({ stops: [shop] });
    expect(pickPatch({ stops: [shop, gym] }, 1, work)).toEqual({ stops: [shop, work] });
    expect(pickPatch({ stops: [shop] }, 'origin', home)).toEqual({ origin: home });
    expect(removeStopPatch({ stops: [shop, gym] }, 0)).toEqual({ stops: [gym] });
    expect(canAddStop({ stops: [shop, gym] })).toBe(true);
    expect(canAddStop({ stops: [shop, gym, work] })).toBe(false);
  });

  it('moves a stop between other stops', () => {
    expect(movePatch({ origin: home, stops: [shop, gym], destination: work }, 1, 2)).toEqual({ origin: home, destination: work, stops: [gym, shop] });
  });

  it('makes whatever lands first From and last To', () => {
    expect(movePatch({ origin: home, stops: [shop], destination: work }, 0, 2)).toEqual({ origin: shop, destination: home, stops: [work] });
    expect(movePatch({ origin: home, destination: work }, 1, 0)).toEqual({ origin: work, destination: home, stops: [] });
  });

  it('drops an empty end that lands in the middle', () => {
    expect(movePatch({ origin: undefined, stops: [shop], destination: work }, 0, 1)).toEqual({ origin: shop, destination: work, stops: [] });
  });

  it('ignores a drop in place and clamps past the ends', () => {
    expect(movePatch({ origin: home, destination: work }, 1, 1)).toBeUndefined();
    expect(movePatch({ origin: home, stops: [shop], destination: work }, 0, 9)).toEqual({ origin: shop, destination: home, stops: [work] });
  });
});
