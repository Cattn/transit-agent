// Shared display text: one place for the wording every screen, map popup and agent reply uses.
// Pure functions, no `node:` imports (runs on Hermes). New wording for the same concept changes here.

import type { Itinerary } from '../domain/itinerary.js';
import { scheduledModes, type TravelMode } from '../domain/modes.js';

type Leg = Itinerary['legs'][number];
type WatchStateName = 'scheduled' | 'onTrack' | 'leaveSoon' | 'leaveNow' | 'atRisk' | 'missed' | 'done';

/** A colour role, not a colour. Plan 017 maps tones to theme colours. */
export type Tone = 'neutral' | 'info' | 'ok' | 'warn' | 'danger';
export interface Badge { label: string; tone: Tone }

const DAY_MS = 86_400_000;
const RANGE_SEP = ' – ';

/**
 * Newer ICU (e.g. Node 22) puts a narrow no-break space (U+202F) before AM/PM; others use a plain
 * space. \s matches both (and U+00A0), so output is identical on Node, browsers and Hermes.
 */
const plainSpaces = (s: string) => s.replace(/\s/g, ' ');

function clockFormatter(timeZone: string | undefined): Intl.DateTimeFormat {
  const opts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
  if (timeZone !== undefined) opts.timeZone = timeZone;
  return new Intl.DateTimeFormat('en-US', opts);
}

/** Calendar day number of `ms` in `timeZone` (or the runtime's zone), for comparing dates. */
function dayNumber(ms: number, timeZone: string | undefined): number {
  const opts: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'numeric', day: 'numeric' };
  if (timeZone !== undefined) opts.timeZone = timeZone;
  const parts = new Intl.DateTimeFormat('en-US', opts).formatToParts(ms);
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return Date.UTC(part('year'), part('month') - 1, part('day')) / DAY_MS;
}

/** "8:12 AM" */
export function formatClock(iso: string, timeZone?: string): string {
  return plainSpaces(clockFormatter(timeZone).format(Date.parse(iso)));
}

export function formatClockOnDay(iso: string, now: Date, timeZone?: string): string {
  const clock = formatClock(iso, timeZone);
  const days = dayNumber(Date.parse(iso), timeZone) - dayNumber(now.getTime(), timeZone);
  if (days === 0) return clock;
  if (days === 1) return `${clock} tomorrow`;
  return `${clock} on ${formatDay(iso, timeZone)}`;
}

export function formatDay(iso: string, timeZone?: string): string {
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  if (timeZone !== undefined) opts.timeZone = timeZone;
  return plainSpaces(new Intl.DateTimeFormat('en-US', opts).format(Date.parse(iso)));
}

/** "8:00 – 8:42 AM"; "11:40 AM – 12:15 PM"; "11:40 PM – 12:15 AM (+1 day)" when the date changes. */
export function formatTimeRange(fromIso: string, toIso: string, timeZone?: string): string {
  const from = formatClock(fromIso, timeZone);
  const to = formatClock(toIso, timeZone);
  const days = dayNumber(Date.parse(toIso), timeZone) - dayNumber(Date.parse(fromIso), timeZone);
  if (days > 0) return `${from}${RANGE_SEP}${to} (+${days} ${days === 1 ? 'day' : 'days'})`;

  // Same day and same AM/PM: say it once, at the end.
  const period = / (AM|PM)$/;
  const fromPeriod = period.exec(from)?.[1];
  if (fromPeriod !== undefined && fromPeriod === period.exec(to)?.[1]) {
    return `${from.replace(period, '')}${RANGE_SEP}${to}`;
  }
  return `${from}${RANGE_SEP}${to}`;
}

/** 0 → "0 min", 45 → "45 min", 65 → "1 h 5 min", 120 → "2 h". Rounds to whole minutes. */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** How old data is: "just now" (< 10 s), "40 s ago", "3 min ago", "2 h ago". */
export function formatAge(iso: string, now: Date): string {
  const seconds = Math.floor((now.getTime() - Date.parse(iso)) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds} s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} h ago`;
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** 0 → "Free", 4.1 → "$4.10"; "~$4.10" when any line is an estimate. */
export function formatCost(cost: Itinerary['cost']): string {
  if (cost.totalUsd === 0) return 'Free';
  const approx = cost.lines.some((l) => l.estimated) ? '~' : '';
  return `${approx}${usd.format(cost.totalUsd)}`;
}

const MODE_LABELS: Record<TravelMode, string> = {
  walk: 'Walk',
  bike: 'Bike',
  bikeshare: 'Bikeshare',
  bus: 'Bus',
  rail: 'Train',
  ferry: 'Ferry',
  car: 'Drive',
  flight: 'Flight'
};

export function modeLabel(mode: TravelMode): string {
  return MODE_LABELS[mode];
}

/** Timetabled legs show their line ("Bus 1", "Red Line"); walk/bike/bikeshare/car show the time ("Walk 5 min"). */
export function legLabel(leg: Leg): string {
  if (scheduledModes.includes(leg.mode)) return leg.routeName ?? modeLabel(leg.mode);
  return `${modeLabel(leg.mode)} ${formatDuration(leg.durationMinutes)}`;
}

/** Where a leg's times come from. Schedule-only times are never presented as live. */
export function legFreshness(leg: Leg): Badge {
  if (leg.timeSource === 'realtime') {
    const delay = leg.delayMinutes ?? 0;
    if (delay > 0) return { label: `Live · ${delay} min late`, tone: 'warn' };
    if (delay < 0) return { label: `Live · ${-delay} min early`, tone: 'info' };
    return { label: 'Live · on time', tone: 'ok' };
  }
  if (leg.timeSource === 'scheduled') return { label: 'Scheduled', tone: 'neutral' };
  return { label: 'Estimated', tone: 'neutral' };
}

/** One badge for a whole option: Live if any leg is live; otherwise say when transit times are schedule-only. */
export function itineraryFreshness(it: Itinerary): Badge {
  if (it.legs.some((l) => l.timeSource === 'realtime')) return { label: 'Live', tone: 'ok' };
  if (it.legs.some((l) => l.timeSource === 'scheduled' && scheduledModes.includes(l.mode))) {
    return { label: 'Scheduled', tone: 'neutral' };
  }
  return { label: 'Estimated', tone: 'neutral' };
}

const RISK_BADGES: Record<Itinerary['risk']['level'], Badge> = {
  low: { label: 'Safe', tone: 'ok' },
  medium: { label: 'Some risk', tone: 'warn' },
  high: { label: 'Tight', tone: 'danger' }
};

export function riskBadge(risk: Itinerary['risk']): Badge {
  return { ...RISK_BADGES[risk.level] };
}

const WATCH_BADGES: Record<WatchStateName, Badge> = {
  scheduled: { label: 'Later', tone: 'neutral' },
  onTrack: { label: 'On track', tone: 'ok' },
  leaveSoon: { label: 'Leave soon', tone: 'warn' },
  leaveNow: { label: 'Leave now', tone: 'danger' },
  atRisk: { label: 'Might be late', tone: 'danger' },
  missed: { label: 'Missed', tone: 'danger' },
  done: { label: 'Done', tone: 'neutral' }
};

/** Badge for a watched trip's state (plan 013's states, taken as literals so this has no dependency on 013). */
export function watchStateBadge(state: WatchStateName): Badge {
  return { ...WATCH_BADGES[state] };
}
