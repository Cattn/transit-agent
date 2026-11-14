# Plan 016: Shared display text (times, durations, costs, "live" vs "scheduled", risk badges)

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If a STOP condition occurs, stop and report. Do
> not improvise. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 45f5379..HEAD -- packages/shared/src`
> If `packages/shared/src/format/` exists, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (new pure module)
- **Depends on**: plans/002-shared-domain-contract.md (DONE). Nothing else.
- **Category**: direction (parallel work)
- **Planned at**: commit `45f5379`, 2026-11-14
- **Good for**: a cheaper coding agent; it's fully specified and test-driven.

<!-- help:start -->
## Who's on it & how to help

- **Status:** ✅ **Done.** Merged in #36. Kept as a record; do not re-execute.
- **Owner:** @DMFriends

<!-- help:end -->

## Why this matters

Web, mobile, the map popups and the agent's replies all print the same things: "8:12 AM",
"1 h 5 min", "~$4.10", "Live · 4 min late", "Scheduled (not live)". If each place formats them
itself, they'll disagree. The worst case is a scheduled bus time shown without the "not live"
label, which breaks the product's main promise (bus schedules can't be trusted, so we never
present them as live). One tested module fixes the wording once.

## Current state

- `packages/shared/src/domain/itinerary.ts`: `Leg` (`mode`, `departAt`, `arriveAt`, `durationMinutes`, `timeSource`, `routeName?`, `delayMinutes?`), `Itinerary` (`cost: { totalUsd, lines: { label, usd, estimated }[] }`, `risk: { level: 'low' | 'medium' | 'high', reasons }`, `source.fetchedAt`).
- `packages/shared/src/domain/modes.ts`: `travelModes = ['walk', 'bike', 'bikeshare', 'bus', 'rail', 'ferry', 'car', 'flight']`.
- `packages/shared/src/domain/trip-draft.ts` has `isValidTimeZone()`. Times are ISO strings with offsets.
- Tests: Vitest next to code. Style: 2-space, single quotes, `.js` extensions. No `node:` imports (must run on Hermes).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Shared tests | `npm run test:unit -w @transit/shared` | all pass |
| Full | `npm run check` | exit 0 |

## Scope

**In scope (create):** `packages/shared/src/format/format.ts`, `packages/shared/src/format/format.test.ts`; modify `packages/shared/src/index.ts` (exports).
**Out of scope:** everything else. Watch-status text (`leaveByLabel`) belongs to plan 013. Colors belong to plan 017; this plan only returns a `tone` name.

## Git workflow

Branch `plan/016-formatters`. One commit. Do not push unless told.

## Steps

### Step 1: Functions (`format/format.ts`)

```ts
export type Tone = 'neutral' | 'info' | 'ok' | 'warn' | 'danger';
export interface Badge { label: string; tone: Tone }

export function formatClock(iso: string, timeZone?: string): string          // "8:12 AM"
export function formatTimeRange(fromIso: string, toIso: string, timeZone?: string): string   // "8:00 – 8:42 AM"; "11:40 PM – 12:15 AM (+1 day)" when the date changes
export function formatDuration(minutes: number): string                     // 0→"0 min", 45→"45 min", 65→"1 h 5 min", 120→"2 h"
export function formatAge(iso: string, now: Date): string                   // <10 s "just now", <60 s "40 s ago", <60 min "3 min ago", else "2 h ago"
export function formatCost(cost: Itinerary['cost']): string                 // 0→"Free", 4.1→"$4.10", any estimated line→"~$4.10"
export function modeLabel(mode: TravelMode): string                         // walk Walk, bike Bike, bikeshare Bikeshare, bus Bus, rail Train, ferry Ferry, car Drive, flight Flight
export function legLabel(leg: Leg): string                                  // walk/bike/car: "Walk 5 min"; transit: routeName ?? modeLabel
export function legFreshness(leg: Leg): Badge
  // realtime + delay>0: "Live · 4 min late" (warn) · realtime + delay<0: "Live · 2 min early" (info) · realtime, 0/undefined: "Live · on time" (ok)
  // scheduled: "Scheduled (not live)" (neutral) · estimated: "Estimated" (neutral)
export function itineraryFreshness(it: Itinerary): Badge                    // any realtime leg → "Live" (ok); any scheduled transit leg and none live → "Scheduled (not live)" (neutral); else "Estimated" (neutral)
export function riskBadge(risk: Itinerary['risk']): Badge                   // low "Safe" ok · medium "Some risk" warn · high "Tight" danger
export function watchStateBadge(state: 'scheduled' | 'onTrack' | 'leaveSoon' | 'leaveNow' | 'atRisk' | 'missed' | 'done'): Badge
  // scheduled "Later" neutral · onTrack "On track" ok · leaveSoon "Leave soon" warn · leaveNow "Leave now" danger · atRisk "Might be late" danger · missed "Missed" danger · done "Done" neutral
```
Use `Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone })` (omit `timeZone` when undefined). Use `Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })` for money. Accept the state union as a literal type here (don't import plan 013's schema), so this plan has no dependency on 013.

### Step 2: Tests (`format/format.test.ts`)

One `describe` per function, table-driven. Use `timeZone: 'America/New_York'` in time tests so they pass on any machine. Must include: the `(+1 day)` case; 65 min; `~` when only one cost line is estimated; every `travelModes` entry has a non-empty `modeLabel` (loop over `travelModes`); `legFreshness` for a scheduled leg contains `"not live"`; negative delay says "early".

**Verify**: `npm run check` → exit 0.

## Done criteria

- [ ] `npm run check` exits 0; ≥ 20 new test cases
- [ ] All names in Step 1 exported from `@transit/shared`
- [ ] `grep -n "Scheduled (not live)" packages/shared/src/format/format.ts` → at least 1 match

## STOP conditions

- Node's `Intl` in the test environment gives different strings than expected for `en-US` (e.g. a narrow no-break space before "AM"). Normalise with `.replace(/ /g, ' ')` and note it; if output differs in other ways, report.

## Maintenance notes

- New UI wording for the same concept changes here, not in a screen.
- If the app ever supports other languages, these functions become the translation point.

## Open questions for review

- ~~016-Q1~~ **Decided (@DMFriends, 2026-11-14, [#24](https://github.com/Cattn/transit-agent/issues/24#issuecomment-6872458297)):** no changes. Keep "Safe / Some risk / Tight" and "Scheduled (not live)" exactly as written in Step 1.
