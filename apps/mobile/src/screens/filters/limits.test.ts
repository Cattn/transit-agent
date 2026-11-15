import { expect, it } from 'vitest';
import { parseCustomLimit } from './limits';

const minutes = { suffix: 'min', max: 240 };

it('accepts whole numbers', () => {
  expect(parseCustomLimit(' 25 ', minutes)).toEqual({ value: 25 });
  expect(parseCustomLimit('0', minutes)).toEqual({ value: 0 });
});

it('rejects empty, fractional or negative numbers and values over the cap', () => {
  expect(parseCustomLimit('', minutes)).toEqual({ error: 'Enter a number' });
  expect(parseCustomLimit('7.5', minutes)).toEqual({ error: 'Use a whole number' });
  expect(parseCustomLimit('-3', minutes)).toEqual({ error: 'Use a whole number' });
  expect(parseCustomLimit('300', minutes)).toEqual({ error: 'At most 240 min' });
});
