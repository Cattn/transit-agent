# Plan 008: Auto-watch saved trips and tell the user when to leave, using live arrivals

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If a STOP condition occurs, stop and report — do
> not improvise. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat c9e33cc..HEAD -- apps/server/src/store apps/server/src/providers packages/shared/src/domain/itinerary.ts`
> Expected: plans 005 and 007 landed. Confirm `SqliteItineraryStore.listWatched` exists; if not, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/005 (store + `listWatched`), plans/007 (real realtime data; can be developed against fixture synthetic delays)
- **Category**: direction
- **Blocked by decisions**: D7 (client polling first; push later)
- **Planned at**: commit `c9e33cc`, 2026-11-13

## Why this matters

Issue #2: *"Refreshes real time buses for you, as bus schedules are NOT reliable. Helps you know
when you should leave."* The map thread adds: *"when they're done, they're saved & will be
auto-watched."* Without this, saved trips are static screenshots of a schedule. This plan adds a
server job that refreshes watched trips. It recomputes a **leave-by time** and a simple status, so
the home screen ("current travel plans", issue #4) can show "Leave in 6 min — bus 1 running 4
min late".

## Current state

- `SavedItinerary` (shared) has `watch: boolean`, `leaveBy?: string`, `request: TripRequest`.
- `SqliteItineraryStore.listWatched(nowIso, horizonIso)` (plan 005) returns watched itineraries departing within the horizon.
- `RouteProvider` (plan 003) has `search` only. Legs carry `timeSource` and `delayMinutes`.
- `preferences.lateTolerance: 'strict' | 'some' | 'flexible'`.

## Scope

**In scope:** `packages/shared/src/domain/itinerary.ts` (additive `watchStatus` field), `apps/server/src/watch/leave-by.ts`, `apps/server/src/watch/watch-job.ts`, `apps/server/src/providers/types.ts` (optional `refresh` method), `apps/server/src/providers/fixture.ts` + real provider from 007 (implement `refresh`), `apps/server/src/store/*` (persist status), `apps/server/src/index.ts` (start/stop job), `.env.example`, tests.
**Out of scope:** push notifications (D7-C), client UI.

## Steps

### Step 1: Shared `watchStatus` (additive)

Add to `SavedItinerarySchema`:
```ts
watchStatus: z.object({
  state: z.enum(['scheduled', 'onTrack', 'leaveSoon', 'leaveNow', 'atRisk', 'missed', 'done']),
  leaveBy: IsoDateTime.optional(),
  message: z.string(),               // "Leave by 8:12 AM — Bus 1 is 4 min late (live)"
  checkedAt: IsoDateTime,
  usedRealtime: z.boolean()
}).optional()
```

### Step 2: Pure leave-by logic (`watch/leave-by.ts`) + tests

```ts
export function computeWatchStatus(it: Itinerary, req: TripRequest, now: Date): NonNullable<SavedItinerary['watchStatus']>
```
- `anchor` = first leg whose mode is in `scheduledModes`. Predicted departure = `departAt` (already includes `delayMinutes` if the provider applied it; if not, add `delayMinutes`). If there is no scheduled leg, the anchor is the first leg.
- `leaveBy` = predicted anchor departure − sum(durations of legs before the anchor) − safety buffer `{ strict: 5, some: 2, flexible: 0 }[lateTolerance]` minutes.
- State: `now > final arriveAt` → `done`; anchor departed (`now > anchor departure`) and user hasn't confirmed boarding → `missed`; `constraints.arriveBy` and predicted arrival > arriveBy → `atRisk`; `leaveBy − now ≤ 0` → `leaveNow`; `≤ 10 min` → `leaveSoon`; else `onTrack`. More than 3 h before `leaveBy` → `scheduled`.
- `message` is deterministic, mentions live vs scheduled ("(live)" / "(schedule only, not live)").

Tests: table-driven over `now` values around a fixture itinerary for each state; buffer differs by `lateTolerance`; a 4-min delay shifts `leaveBy` by 4 min.

### Step 3: Provider `refresh`

`RouteProvider` gains optional `refresh?(it: Itinerary, req: TripRequest, signal?: AbortSignal): Promise<Itinerary | undefined>`. The real provider (007) re-queries live data for the same trip. If it can't match the same vehicle trip, it returns `undefined`. Fixture: applies `FIXTURE_DELAY_MINUTES` (env, default 0) to bus/rail legs, sets `timeSource: 'realtime'`, and shifts subsequent legs.

### Step 4: Watch job (`watch/watch-job.ts`)

```ts
export async function runWatchCycle(deps: { store; providers; now: () => Date; log }): Promise<{ checked: number; updated: number }>
export function startWatchJob(deps, intervalSeconds): { stop(): void }
```
- `listWatched(now, now + 3h)`. For each itinerary, find the provider by `source.provider` and call `refresh` (catch errors per item). Compute the status and persist `watchStatus` and `leaveBy`.
- When the state becomes `missed`, run `planTrip({ ...request, time: { type: 'departAt', at: now } })`. Store the top result's summary in the message ("Missed it — next: Bus 1 at 8:31"). Don't auto-replace the saved itinerary.
- Never overlap cycles (skip a tick if the previous is still running). `timer.unref()`.
- `index.ts`: start when `WATCH_ENABLED !== 'false'`, interval `WATCH_INTERVAL_SECONDS` (default 60). Stop on shutdown. `createServer()` without deps never starts it (tests stay hermetic).

### Step 5: Freshness for clients

Saved-itinerary GET responses now include `watchStatus`. Document in the PR: clients poll `GET /api/itineraries` every 30–60 s while the home screen is visible (D7-A).

### Step 6: Tests

`runWatchCycle` with memory store + fixture provider + fake clock: status persisted; provider throwing for one itinerary doesn't stop others; `missed` triggers one `planTrip`; overlapping start is skipped.

**Verify**: `npm run check` → exit 0. Manual: `FIXTURE_DELAY_MINUTES=4 WATCH_INTERVAL_SECONDS=10 npm run dev:server`, save a fixture itinerary departing in ~30 min, wait 10 s, `GET /api/itineraries` → `watchStatus.message` mentions a 4 min delay.

## Done criteria

- [ ] `npm run check` exits 0
- [ ] Manual delay check passes
- [ ] `leave-by.ts` has ≥ 8 table cases

## STOP conditions

- The real provider can't re-identify the same vehicle trip on refresh (no stable trip IDs) → report; design alternative needed.
- Provider quota makes 60 s polling unaffordable (from 007 spike numbers) → report with numbers.

## Maintenance notes

- Push notifications (D7-C) later: on state transitions into `leaveSoon` / `atRisk` / `missed`, enqueue an Expo push. The transition detection belongs in `runWatchCycle`, which compares the old state to the new one.
- Multi-instance deploy would run duplicate jobs; add a DB lease row before scaling out.

## Open questions for review

- 008-Q1: Safety buffers (5/2/0 min by lateTolerance) — sensible?
- 008-Q2: Should "missed" auto-save the next-best trip as the new watched trip? Proposed: no — suggest it, the user taps to switch.
- 008-Q3: Watch horizon of 3 h — longer for flights (plan 011)?
