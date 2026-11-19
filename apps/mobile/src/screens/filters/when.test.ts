import { expect, it } from 'vitest';
import { onPickedDay, pickerDay } from './when';

it('opens the picker on the local calendar day, as midnight UTC', () => {
  const late = new Date(2026, 10, 18, 23, 30);
  expect(pickerDay(late)).toBe('2026-11-18T00:00:00.000Z');
  const early = new Date(2026, 10, 18, 0, 15);
  expect(pickerDay(early)).toBe('2026-11-18T00:00:00.000Z');
});

it('moves the trip to the picked day and keeps its clock time', () => {
  const at = new Date(2026, 10, 18, 23, 30, 12);
  const next = onPickedDay(new Date('2026-11-21T00:00:00.000Z'), at);
  expect([next.getFullYear(), next.getMonth(), next.getDate(), next.getHours(), next.getMinutes(), next.getSeconds()]).toEqual([2026, 10, 21, 23, 30, 0]);
});

it('round-trips a day through the picker', () => {
  const at = new Date(2026, 11, 31, 8, 5);
  const next = onPickedDay(new Date(pickerDay(at)), at);
  expect(next.getTime()).toBe(new Date(2026, 11, 31, 8, 5).getTime());
});
