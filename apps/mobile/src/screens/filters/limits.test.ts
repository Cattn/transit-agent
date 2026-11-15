import { expect, it } from 'vitest';
import { parseCustomLimit } from './limits';

const minutes = { suffix: 'min', decimal: false, max: 240 };
const dollars = { prefix: '$', decimal: true, max: 1000 };

it('accepts whole minutes and cents for budgets', () => {
  expect(parseCustomLimit(' 25 ', minutes)).toEqual({ value: 25 });
  expect(parseCustomLimit('0', minutes)).toEqual({ value: 0 });
  expect(parseCustomLimit('12.5', dollars)).toEqual({ value: 12.5 });
});

it('rejects empty, fractional minutes, bad numbers and values over the cap', () => {
  expect(parseCustomLimit('', minutes)).toEqual({ error: 'Enter a number' });
  expect(parseCustomLimit('7.5', minutes)).toEqual({ error: 'Use a whole number' });
  expect(parseCustomLimit('-3', dollars)).toEqual({ error: 'Use a number like 12 or 12.50' });
  expect(parseCustomLimit('12.345', dollars)).toEqual({ error: 'Use a number like 12 or 12.50' });
  expect(parseCustomLimit('300', minutes)).toEqual({ error: 'At most 240 min' });
  expect(parseCustomLimit('1001', dollars)).toEqual({ error: 'At most $1000' });
});
