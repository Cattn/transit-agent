const MINUTE = 60_000;
const DAY = 86_400_000;

interface Wall { year: number; month: number; day: number; hour: number; minute: number }

function wallOf(ms: number, timeZone: string | undefined): Wall & { second: number } {
  if (timeZone === undefined) {
    const at = new Date(ms);
    return { year: at.getFullYear(), month: at.getMonth(), day: at.getDate(), hour: at.getHours(), minute: at.getMinutes(), second: at.getSeconds() };
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric'
  }).formatToParts(ms);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: part('year'), month: part('month') - 1, day: part('day'), hour: part('hour') % 24, minute: part('minute'), second: part('second') };
}

function offsetAt(ms: number, timeZone: string | undefined): number {
  const wall = wallOf(ms, timeZone);
  return Date.UTC(wall.year, wall.month, wall.day, wall.hour, wall.minute, wall.second) - Math.floor(ms / 1000) * 1000;
}

function sameWall(a: Wall, b: Wall): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day && a.hour === b.hour && a.minute === b.minute;
}

function sameDay(a: Wall, b: Wall): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function instantOf(wall: Wall, timeZone: string | undefined): number {
  const local = Date.UTC(wall.year, wall.month, wall.day, wall.hour, wall.minute);
  const before = local - offsetAt(local - 2 * DAY, timeZone);
  const after = local - offsetAt(local + 2 * DAY, timeZone);
  const valid = [before, after].filter((ms) => sameWall(wallOf(ms, timeZone), wall)).sort((a, b) => a - b);
  if (valid.length) return valid[0]!;
  let low = Math.min(before, after);
  let high = Math.max(before, after);
  while (high - low > MINUTE) {
    const mid = Math.floor((low + high) / 2 / MINUTE) * MINUTE;
    if (offsetAt(mid, timeZone) === offsetAt(low, timeZone)) low = mid;
    else high = mid;
  }
  return high;
}

export function pickerDay(at: string, timeZone: string | undefined): string {
  const wall = wallOf(Date.parse(at), timeZone);
  return new Date(Date.UTC(wall.year, wall.month, wall.day)).toISOString();
}

export function earliestDay(now: Date, timeZone: string | undefined): string {
  const wall = wallOf(now.getTime(), timeZone);
  return new Date(wall.year, wall.month, wall.day).toISOString();
}

export function pickerClock(at: string, timeZone: string | undefined): string {
  const wall = wallOf(Date.parse(at), timeZone);
  let day = wall.day;
  while (new Date(wall.year, wall.month, day - 1, 12).getTimezoneOffset() !== new Date(wall.year, wall.month, day + 1, 12).getTimezoneOffset()) day -= 1;
  return new Date(wall.year, wall.month, day, wall.hour, wall.minute).toISOString();
}

function notBefore(ms: number, now: Date, timeZone: string | undefined): string {
  if (ms >= now.getTime()) return new Date(ms).toISOString();
  const next = Math.ceil(now.getTime() / MINUTE) * MINUTE;
  const chosen = wallOf(ms, timeZone);
  const today = sameDay(wallOf(now.getTime(), timeZone), chosen) && !sameDay(wallOf(next, timeZone), chosen);
  return new Date(today ? now.getTime() : next).toISOString();
}

export function withDay(picked: Date, at: string, now: Date, timeZone: string | undefined): string {
  const current = wallOf(Date.parse(at), timeZone);
  const day = { year: picked.getUTCFullYear(), month: picked.getUTCMonth(), day: picked.getUTCDate() };
  if (sameDay(current, { ...day, hour: 0, minute: 0 })) return notBefore(Date.parse(at), now, timeZone);
  return notBefore(instantOf({ ...day, hour: current.hour, minute: current.minute }, timeZone), now, timeZone);
}

export function withClock(picked: Date, at: string, now: Date, timeZone: string | undefined): string {
  const current = wallOf(Date.parse(at), timeZone);
  if (picked.getHours() === current.hour && picked.getMinutes() === current.minute) return notBefore(Date.parse(at), now, timeZone);
  return notBefore(instantOf({ ...current, hour: picked.getHours(), minute: picked.getMinutes() }, timeZone), now, timeZone);
}
