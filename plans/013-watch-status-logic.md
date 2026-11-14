# Plan 013: Write the "when do I leave" logic as pure, shared code (moved out of plan 008)

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If a STOP condition occurs, stop and report. Do
> not improvise. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 45f5379..HEAD -- packages/shared/src/domain`
> Any change to `itinerary.ts` or `trip-draft.ts` → compare with "Current state". If
> `SavedItinerarySchema` already has a `watchStatus` field, STOP (someone did Step 1 already).

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (additive optional field + new pure module)
- **Depends on**: plans/002-shared-domain-contract.md (DONE). Nothing else: this was split out of plan 008 so it can start now.
- **Category**: direction (parallel work)
- **Planned at**: commit `45f5379`, 2026-11-14

<!-- help:start -->
## Who's on it & how to help

- **Status:** ✅ **Approved:** PR #34 passed review; waiting to be merged.
- **Owner:** @DMFriends

<!-- help:end -->

## Why this matters

"Bus schedules can't be trusted, when do I need to leave?" is the core commute question (issue
#2). Plan 008 builds the server job that refreshes live bus data every minute. But the actual
calculation (leave-by time + "on track / leave soon / missed") is a pure function of an
itinerary, the user's lateness setting and the current time. It doesn't need a server, a
database or live data.

Putting it in `@transit/shared` means:
- it can be written and tested **now**, not after plans 005 and 007;
- the apps can tick the countdown locally every second between server polls ("Leave in 6 min"
  → "Leave in 5 min") using the same rules as the server;
- the mock client (plan 012) can show realistic trip cards.

Plan 008 then only adds the server job that calls this function.

## Current state

- `packages/shared/src/domain/itinerary.ts` (read the whole file): `LegSchema` has `mode`, `departAt`, `arriveAt`, `durationMinutes`, `timeSource: 'realtime' | 'scheduled' | 'estimated'`, `routeName?`, `delayMinutes?`, `transferBufferMinutes?`. `SavedItinerarySchema = ItinerarySchema.extend({ savedAt, label?, watch, leaveBy?, request: TripRequestSchema })`. `IsoDateTime = z.iso.datetime({ offset: true })` is a local const at the top of the file.
- `packages/shared/src/domain/modes.ts`: `scheduledModes = ['bus', 'rail', 'ferry', 'flight']`.
- `packages/shared/src/domain/trip-draft.ts`: `preferences.lateTolerance: 'strict' | 'some' | 'flexible'`; `constraints.arriveBy?: string`.
- `packages/shared/src/domain/fixtures.ts`: `sampleItinerary`. Use it as the test fixture base.
- Tests: Vitest next to code, e.g. `packages/shared/src/domain/itinerary.test.ts`. Style: 2-space, single quotes, `.js` import extensions.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Shared tests | `npm run test:unit -w @transit/shared` | all pass |
| Full | `npm run check` | exit 0 |

## Scope

**In scope:**
```
packages/shared/src/domain/itinerary.ts       (modify: add WatchStatusSchema + optional watchStatus on SavedItinerarySchema)
packages/shared/src/domain/watch.ts           (create: computeWatchStatus, leaveByLabel)
packages/shared/src/domain/watch.test.ts      (create)
packages/shared/src/index.ts                  (modify: export the new names)
```
**Out of scope:** `apps/**`, the server watch job (plan 008), any other schema change.

## Git workflow

Branch `plan/013-watch-status`. One commit. Do not push unless told.

## Steps

### Step 1: `WatchStatusSchema` (additive)

In `itinerary.ts`, before `SavedItinerarySchema`:
```ts
export const WatchStateSchema = z.enum(['scheduled', 'onTrack', 'leaveSoon', 'leaveNow', 'atRisk', 'missed', 'done']);
export const WatchStatusSchema = z.object({
  state: WatchStateSchema,
  leaveBy: IsoDateTime.optional(),
  /** Deterministic sentence, e.g. "Leave by 8:12 AM. Bus 1 is 4 min late (live)." */
  message: z.string(),
  checkedAt: IsoDateTime,
  /** True if any leg used live data. The UI must not present schedule-only times as live. */
  usedRealtime: z.boolean()
});
export type WatchStatus = z.infer<typeof WatchStatusSchema>;
```
Add `watchStatus: WatchStatusSchema.optional()` to `SavedItinerarySchema`.
**Verify**: `npm run test:unit -w @transit/shared` → existing tests still pass.

### Step 2: `computeWatchStatus` (`watch.ts`)

```ts
/** Provisional values (accepted 2026-11-14, expected to be tuned). Keep every threshold in these two constants. */
export const leaveBufferMinutes = { strict: 5, some: 2, flexible: 0 } as const;
export const leaveSoonMinutes = 10;
export function computeWatchStatus(it: Itinerary, req: TripRequest, now: Date): WatchStatus
```
Rules (in this order):
1. **Anchor** = first leg whose `mode` is in `scheduledModes`; if none, the first leg.
2. **Predicted anchor departure** = `anchor.departAt`. Providers already include the delay in `departAt` for realtime legs, so do **not** add `delayMinutes` again. (Write this as a code comment.)
3. **leaveBy** = predicted anchor departure − sum of `durationMinutes` of legs before the anchor − `leaveBufferMinutes[req.preferences.lateTolerance]`.
4. **State**, first match wins:
   - `now > last leg arriveAt` → `done`
   - `now > anchor departure` → `missed`
   - `req.constraints.arriveBy` defined and last leg `arriveAt > arriveBy` → `atRisk`
   - `leaveBy − now > 3 h` → `scheduled`
   - `leaveBy − now ≤ 0` → `leaveNow`
   - `leaveBy − now ≤ leaveSoonMinutes` → `leaveSoon`
   - else `onTrack`
5. **usedRealtime** = any leg has `timeSource === 'realtime'`.
6. **message**: time formatted with `Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: req.timeZone })` (omit `timeZone` when undefined). Examples:
   - onTrack/leaveSoon/leaveNow/scheduled: `"Leave by 8:12 AM."` plus, if the anchor has `delayMinutes > 0`: `" Bus 1 is 4 min late (live)."`; if the anchor is `scheduled`: `" Bus 1 times are from the schedule, not live."` (use `routeName ?? mode`).
   - atRisk: `"You may arrive after 9:00 AM."`
   - missed: `"Bus 1 has left. Check the next option."`
   - done: `"Trip finished."`
7. `checkedAt = now.toISOString()`. Validate with `WatchStatusSchema.parse` before returning.

### Step 3: Countdown label (for UI cards)

```ts
/** "Leave in 6 min", "Leave now", "Leave in 1 h 20 min", "Left 3 min ago". Recompute every few seconds on the client. */
export function leaveByLabel(leaveBy: string, now: Date): string
```
Rounding: whole minutes, rounding **down** (a 6 min 50 s countdown shows "Leave in 6 min": safer to undersell). 0 → "Leave now". Negative → "Left N min ago".

### Step 4: Tests (`watch.test.ts`)

Build a fixture with explicit times: walk 08:00–08:05, bus 08:05–08:20 (`scheduled`, `routeName: 'Bus 1'`), walk 08:20–08:25, all `-05:00`. Table-driven over `now`:

| now | lateTolerance | expected state | expected leaveBy |
|---|---|---|---|
| 04:00 | some | scheduled | 07:58 |
| 07:40 | some | onTrack | 07:58 |
| 07:50 | some | leaveSoon | 07:58 |
| 07:58 | some | leaveNow | 07:58 |
| 07:50 | strict | leaveSoon | 07:55 |
| 08:06 | some | missed | — |
| 08:30 | some | done | — |

Also: `arriveBy` 08:20 → `atRisk`; the same bus as `realtime` with `departAt` 08:09 and `delayMinutes: 4` → leaveBy 08:02 and message contains `"4 min late (live)"`; a schedule-only bus → message contains `"not live"`; `leaveByLabel` for +6m50s → `"Leave in 6 min"`, 0 → `"Leave now"`, −3 min → `"Left 3 min ago"`, +80 min → `"Leave in 1 h 20 min"`.

**Verify**: `npm run check` → exit 0.

## Done criteria

- [ ] `npm run check` exits 0; ≥ 12 new tests
- [ ] `computeWatchStatus`, `leaveByLabel`, `WatchStatusSchema`, `WatchStatus`, `leaveBufferMinutes` exported from `@transit/shared`
- [ ] `git diff --stat` touches only the 4 files in Scope

## STOP conditions

- Adding `watchStatus` breaks an existing test in a way that suggests a schema design problem (not just a fixture update).
- `Intl.DateTimeFormat` with `timeZone` throws in the test environment.

## Maintenance notes

- Plan 008 imports `computeWatchStatus` in its server job. The 3 h `scheduled` threshold here is display-only, not the monitoring start. Plan 008's newer [flight direction](https://github.com/Cattn/transit-agent/issues/12#issuecomment-6873902169) calls for checks 3, 2, and 1 days out, then a preference-dependent ramp within 24 h; exact cadence and preference behavior remain open. Bus/rail policies are separate. When policies are settled, consider passing the display horizon in rather than hard-coding 3 h. Change calculation rules here only, never in a second copy.
- Product rule: **no invented probabilities.** States are deterministic. If historical delay data appears later, change the internals, not the output shape.

## Open questions for review

- ~~013-Q1~~ **Decided (@Cattn, 2026-11-14):** 5 / 2 / 0 min buffers, provisional and expected to change. Keep them in `leaveBufferMinutes`.
- ~~013-Q2~~ **Decided (@Cattn, 2026-11-14):** "leave soon" at 10 min, provisional and expected to change. Keep it in `leaveSoonMinutes`.
