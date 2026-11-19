/**
 * The Material date picker counts days in UTC: it opens on, and reports, midnight UTC of the
 * chosen calendar day. These convert between that and the trip time's local calendar day.
 */

/** The picker's selection for the local calendar day of `at`. */
export function pickerDay(at: Date): string {
  return new Date(Date.UTC(at.getFullYear(), at.getMonth(), at.getDate())).toISOString();
}

/** `at` moved to the day the picker reported, keeping its clock time. */
export function onPickedDay(picked: Date, at: Date): Date {
  const next = new Date(at);
  next.setFullYear(picked.getUTCFullYear(), picked.getUTCMonth(), picked.getUTCDate());
  next.setSeconds(0, 0);
  return next;
}
