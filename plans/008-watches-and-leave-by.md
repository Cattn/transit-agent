# Plan 008: Auto-watch saved trips and tell the user when to leave, using live arrivals

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If a STOP condition occurs, stop and report — do
> not improvise. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9ccf722..HEAD -- apps/server/src/store apps/server/src/providers packages/shared/src/domain/itinerary.ts`
> Reconciled 2026-11-14: an empty diff is expected. If this prints anything, compare Current state before proceeding.
> Expected: plans 005 and 007 landed. Confirm `SqliteItineraryStore.listWatched` exists; if not, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/013 (`computeWatchStatus`), plans/005 (store + `listWatched`), plans/007 (real realtime data; can be developed against fixture synthetic delays)
- **Category**: direction
- **Blocked by decisions**: D7 (client polling first; push later)
- **Planned at**: commit `9ccf722`, 2026-11-14 (refreshed; steps unchanged)
- **Issue**: https://github.com/Cattn/transit-agent/issues/12

<!-- help:start -->
## Who's on it & how to help

- **Status:** **Later:** real watch integration waits on #11. Storage (#9) and pure leave-by logic (#21) are merged; reuse them.
- **Owner:** Nobody yet
- **Up for grabs?** Yes, once its dependencies land.
- **Waiting on:** #11 for real realtime data; mode horizon/ramp details remain open.

**Open questions** (answer by number in a comment on #12):

**Decided:** automatically switch missed trips ([roadmap answer](https://github.com/Cattn/transit-agent/issues/17#issuecomment-6873720245)); do not require a confirmation tap.

1. Confirm exact cadence/ramp and preference behavior. Flights: checks 3, 2, and 1 days before departure, then ramp within 24 h ([owner direction](https://github.com/Cattn/transit-agent/issues/12#issuecomment-6873902169)); bus ~2 h and rail classification remain separate open details.

**How to help**
- **Take it:** comment "taking this" and assign yourself, so two people don't build the same thing.
- **With a coding agent** (Claude Code, Codex, Cursor, ...): pull `main`, then tell your agent:
  > Read `plans/008-watches-and-leave-by.md` and follow it step by step. Run every verification command and check the output matches. Only change files listed under Scope. If a STOP condition happens, stop and tell me instead of working around it. Don't push. When done, show me the diff and the check results.

  Review what it did, then open a PR that says `Closes #12`.
- **Just feedback:** answer the open questions above by number in a comment.

<!-- help:end -->

## Why this matters

Issue #2: *"Refreshes real time buses for you, as bus schedules are NOT reliable. Helps you know
when you should leave."* The map thread adds: *"when they're done, they're saved & will be
auto-watched."* Without this, saved trips are static screenshots of a schedule. This plan adds a
server job that refreshes watched trips. It recomputes a **leave-by time** and a simple status, so
the home screen ("current travel plans", issue #4) can show "Leave in 6 min — bus 1 running 4
min late".

## Current state

- `SavedItinerary` includes `watchStatus` from merged plan 013 (PR #34). Import the shared schema and calculation rather than duplicating them.
- `SqliteItineraryStore.listWatched(nowIso, horizonIso)` in `apps/server/src/store/sqlite.ts` returns watched itineraries departing within the horizon. There is no `apps/server/src/watch/`.
- `RouteProvider` in `apps/server/src/providers/types.ts` has `search` only. Legs carry `timeSource` and `delayMinutes`.
- `preferences.lateTolerance: 'strict' | 'some' | 'flexible'`.

## Scope

**In scope:** `apps/server/src/watch/watch-job.ts`, `apps/server/src/providers/types.ts` (optional `refresh` method), `apps/server/src/providers/fixture.ts` + real provider from 007 (implement `refresh`), `apps/server/src/store/*` (persist status), `apps/server/src/index.ts` (start/stop job), `.env.example`, tests.
**Out of scope:** push notifications (D7-C), client UI.

## Steps

### Steps 1–2: done by plan 013

*Moved 2026-11-14.* The `watchStatus` schema and the pure `computeWatchStatus(it, req, now)` now
live in `@transit/shared` (plan 013), so they could be built and tested before this plan's
dependencies landed, and so apps can tick countdowns locally. Check they're exported from
`@transit/shared`; if not, STOP. This plan's server job imports them; **don't write a second copy.**

### Step 3: Provider `refresh`

`RouteProvider` gains optional `refresh?(it: Itinerary, req: TripRequest, signal?: AbortSignal): Promise<Itinerary | undefined>`. The real provider (007) re-queries live data for the same trip. If it can't match the same vehicle trip, it returns `undefined`. Fixture: applies `FIXTURE_DELAY_MINUTES` (env, default 0) to bus/rail legs, sets `timeSource: 'realtime'`, and shifts subsequent legs.

### Step 4: Watch job (`watch/watch-job.ts`)

```ts
export async function runWatchCycle(deps: { store; providers; now: () => Date; log }): Promise<{ checked: number; updated: number }>
export function startWatchJob(deps, intervalSeconds): { stop(): void }
```
- **Watch horizon depends on mode** (owner direction on [#12](https://github.com/Cattn/transit-agent/issues/12#issuecomment-6872020176)). Put it in one config table, `watch/horizons.ts`, keyed by the itinerary's anchor leg mode (the first scheduled leg, same as plan 013):
  - bus: about **2 h**, with checks that **ramp up** (less often far from departure, more often close to it);
  - flight: checks **3, 2, and 1 days** before departure, then a ramp within the last 24 h; inside 24 h, continuous or every few hours by user preference ([owner direction](https://github.com/Cattn/transit-agent/issues/12#issuecomment-6873902169)). These are stages, not polling intervals.
  - rail: depends on the kind of rail (light rail/subway like the Orange Line vs intercity like Amtrak). The contract has a single `rail` mode, so telling them apart needs a hint such as `agency`/`routeName`; how to do that is open.
  - **Open (008-Q3):** exact intervals, rail classification, and where the monitoring preference is stored. Ask before building this step; do not invent an interval or a contract field.
- `listWatched(now, now + maxHorizon)` must cover the flight pre-departure stages as well as each other mode's horizon. Keep only itineraries due under their own mode/stage/preference policy, and skip ones not yet due. A wider flight lookup window does not mean checking every flight on every job tick. For each itinerary, find the provider by `source.provider` and call `refresh` (catch errors per item). Compute the status and persist `watchStatus` and `leaveBy`.
- When the state becomes `missed`, run `planTrip({ ...request, time: { type: 'departAt', at: now } })` and **automatically switch** the watched trip to the highest-ranked valid result ([roadmap answer](https://github.com/Cattn/transit-agent/issues/17#issuecomment-6873720245)). Persist the replacement itinerary/request and recomputed status together while preserving saved-trip identity, label, and watch setting; the store update must support this without exposing a new client preference. Show what changed in the status message. Do not require a tap. If no valid result exists, keep the missed trip and explain that no replacement is available; never auto-select a near-miss that violates requirements.
- Never overlap cycles (skip a tick if the previous is still running). `timer.unref()`.
- `index.ts`: start when `WATCH_ENABLED !== 'false'`, interval `WATCH_INTERVAL_SECONDS` (default 60). Stop on shutdown. `createServer()` without deps never starts it (tests stay hermetic).

### Step 5: Freshness for clients

Saved-itinerary GET responses now include `watchStatus`. Document in the PR: clients poll `GET /api/itineraries` every 30–60 s while the home screen is visible (D7-A).

### Step 6: Tests

`runWatchCycle` with memory store + fixture provider + fake clock: status persisted; provider throwing for one itinerary doesn't stop others; `missed` triggers one `planTrip` and persists the valid automatic replacement; no valid result preserves the missed trip; overlapping start is skipped.

**Verify**: `npm run check` → exit 0. Manual: `FIXTURE_DELAY_MINUTES=4 WATCH_INTERVAL_SECONDS=10 npm run dev:server`, save a fixture itinerary departing in ~30 min, wait 10 s, `GET /api/itineraries` → `watchStatus.message` mentions a 4 min delay.

## Done criteria

- [ ] `npm run check` exits 0
- [ ] Manual delay check passes
- [ ] `runWatchCycle` tests from Step 6 exist and pass

## STOP conditions

- The real provider can't re-identify the same vehicle trip on refresh (no stable trip IDs) → report; design alternative needed.
- Provider quota makes 60 s polling unaffordable (from 007 spike numbers) → report with numbers.

## Maintenance notes

- Push notifications (D7-C) later: on state transitions into `leaveSoon` / `atRisk` / `missed`, enqueue an Expo push. The transition detection belongs in `runWatchCycle`, which compares the old state to the new one.
- Multi-instance deploy would run duplicate jobs; add a DB lease row before scaling out.

## Open questions for review

- ~~008-Q1~~ Moved to 013-Q1 (the buffers now live in plan 013).
- ~~008-Q2~~ **Decided ([roadmap answer](https://github.com/Cattn/transit-agent/issues/17#issuecomment-6873720245)):** automatically switch missed trips; no confirmation tap.
- 008-Q3 (open, @Cattn): exact check intervals per mode, how to tell subway from intercity rail, and where the user's monitoring preference lives. Direction so far is in Step 4.
