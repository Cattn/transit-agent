import { expect, it } from 'vitest';
import { mockSearchPlaces } from './mock-places.js';

it('matches Boston places without case sensitivity', () => {
  expect(mockSearchPlaces('BOSTON').map((place) => place.name)).toEqual(['Boston Common', 'Boston University']);
});

it('returns no places for short or unknown queries', () => {
  expect(mockSearchPlaces('MI')).toEqual([]);
  expect(mockSearchPlaces('Atlantis')).toEqual([]);
});

it('provides Logan airport metadata', () => {
  expect(mockSearchPlaces('Logan')[0]).toMatchObject({ kind: 'airport', code: 'BOS' });
});

it('finds Wentworth and other added Boston places', () => {
  expect(mockSearchPlaces('wentworth').map((place) => place.name)).toEqual(['Wentworth Institute of Technology']);
  expect(mockSearchPlaces('square').map((place) => place.name)).toEqual(['Harvard Square', 'Davis Square', 'Copley Square', 'Central Square', 'Porter Square']);
});
