# Plan 008: Auto-watch saved trips and tell the user when to leave, using live arrivals

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If a STOP condition occurs, stop and report — do
> not improvise. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9ccf722..HEAD -- apps/server/src/store apps/server/src/providers packages/shared/src/domain/itinerary.ts`
> Reconciled 2026-11-14: an empty diff is expected. If this prints anything, compare Current state before proceeding.
> Expected: plans 005 and 031 landed. Confirm `SqliteItineraryStore.listWatched` exists; if not, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/013 (`computeWatchStatus`), plans/005 (store + `listWatched`), plans/031 (real realtime data; can be developed against fixture synthetic delays)
- **Category**: direction
- **State**: PR #100 open (`server/watches`); decisions recorded by Cattn 2026-11-14 under "Decisions".
- **Planned at**: commit `9ccf722`, 2026-11-14 (refreshed; steps unchanged)
- **Issue**: https://github.com/Cattn/transit-agent/issues/12

<!-- help:start -->
## Who's on it & how to help

- **Status:** **Later:** real watch integration waits on #57. Storage (#9) and pure leave-by logic (#21) are merged; reuse them.
- **Owner:** @Cattn (assigned 2026-11-14 from the build timeline)
- **Up for grabs?** No. Talk to @Cattn before starting related work.
- **Waiting on:** #57 for real realtime data; transit watch defaults are recorded below, with detailed scheduling/preferences still to resolve.

**Open questions** (answer by number in a comment on #12) — **@Cattn answers these.**

**Decided:** automatically switch missed trips ([roadmap answer](https://github.com/Cattn/transit-agent/issues/17#issuecomment-6873720245)); do not require a confirmation tap.

1. Implement the transit direction recorded by Cattn in the plan 007 research thread: one or two checks before the two-hour mark unless overridden, then more frequent checks nearer departure; subway around 1 h, 30, 20 and 10 min with further quick checks/adaptation for issues; commuter rail broadly similar with some earlier checking. Exact early-check times, final ramp, intercity classification and preference storage still need resolution. Flights retain their separate 3/2/1-day and final-24-hour direction; do not apply it to transit.

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

**In scope:** `apps/server/src/watch/watch-job.ts`, `apps/server/src/providers/types.ts` (optional `refresh` method), `apps/server/src/providers/fixture.ts` + real provider from 031 (implement `refresh`), `apps/server/src/store/*` (persist status), `apps/server/src/index.ts` (start/stop job), `.env.example`, tests.
**Out of scope:** push notifications (D7-C), client UI.

## Steps

### Steps 1–2: done by plan 013

*Moved 2026-11-14.* The `watchStatus` schema and the pure `computeWatchStatus(it, req, now)` now
live in `@transit/shared` (plan 013), so they could be built and tested before this plan's
dependencies landed, and so apps can tick countdowns locally. Check they're exported from
`@transit/shared`; if not, STOP. This plan's server job imports them; **don't write a second copy.**

### Step 3: Provider `refresh`

`RouteProvider` gains optional `refresh?(it: Itinerary, req: TripRequest, signal?: AbortSignal): Promise<Itinerary | undefined>`. The real provider (031) re-queries live data for the same trip. If it can't match the same vehicle trip, it returns `undefined`. Fixture: applies `FIXTURE_DELAY_MINUTES` (env, default 0) to bus/rail legs, sets `timeSource: 'realtime'`, and shifts subsequent legs.

### Step 4: Watch job (`watch/watch-job.ts`)

```ts
export async function runWatchCycle(deps: { store; providers; now: () => Date; log }): Promise<{ checked: number; updated: number }>
export function startWatchJob(deps, intervalSeconds): { stop(): void }
```
- **Watch horizon depends on mode** (owner direction on [#12](https://github.com/Cattn/transit-agent/issues/12#issuecomment-6872020176)). Put it in one config table, `watch/horizons.ts`, keyed by the itinerary's anchor leg mode (the first scheduled leg, same as plan 013):
  - bus/default transit (Cattn, plan 007 research thread, 2026-11-14): **one or two checks before the two-hour mark**, unless the user specifies otherwise, then more frequent checks as departure approaches. Early-check times and the exact final ramp were not specified;
  - flight: checks **3, 2, and 1 days** before departure, then a ramp within the last 24 h; inside 24 h, continuous or every few hours by user preference ([owner direction](https://github.com/Cattn/transit-agent/issues/12#issuecomment-6873902169)). These are stages, not polling intervals.
  - subway: begin nearer departure, around **1 h**, then roughly **30, 20 and 10 min** before departure, with further quick checks and adjustments if issues occur. These are owner-supplied approximate checkpoints, not a fixed continuous-polling interval.
  - commuter rail: some earlier checking, but broadly close to the subway pattern. No distinct exact timetable was selected.
  - intercity rail: not specified by this transit clarification. The contract still has a single `rail` mode; use provider route type/agency metadata to distinguish services rather than assuming commuter rail and Amtrak share a policy.
  - **Remaining details (008-Q3):** exact early/final check times, issue-driven adjustments, intercity classification and preference selection/storage. Transit direction above is selected; do not reopen it or invent a new fixed interval or contract field. Fetch horizon must include the pre-two-hour checks, not exclude them with a two-hour-only lookup.
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
- 008-Q3 (partly answered by Cattn, 2026-11-14): transit defaults are recorded in Step 4 and plan 007. Exact early/final check times, adaptation rules, intercity treatment and preference storage remain implementation details to resolve; flight policy is separate.

## Decisions (Cattn, 2026-11-14) — supersede the open items above

These replace the "Required refresh" outline and settle 008-Q3 for this PR.

- **Cadence** (`watch/horizons.ts`, keyed by the anchor leg): bus T-4h, T-2h, then T-60/30/20/10 min, then every 2 min to departure. Subway/light rail (`rail` with an MBTA subway/tram route) T-60/30/20/10, then every 2 min. Commuter rail (unused today: Transitous rail is SUBWAY,TRAM only) = bus plus T-3h. Issue rule: if a check finds `atRisk` or a delay, check every 2 min from T-30. Job ticks every 60 s and only refreshes due trips.
- **Flights**: left out of this PR; the job skips flight-anchored trips. No user cadence preference yet (defaults only, no contract change).
- **Retention**: stop checking a little after arrival (arrival + 15 min → `done`, then skipped). Nothing is deleted.
- **Live data**: Transitous is primary. `refresh` re-queries Transitous for the same trip IDs. Where Transitous marks a leg `realTime: true` but that is uncertain, MBTA V3 predictions qualify it: departure uncertainty < 300 → `realtime` with `delayMinutes`; otherwise stays `estimated`. No match → `undefined`, status recomputed on the stored itinerary. Optional `MBTA_API_KEY`.
- **Model**: rule-based checks; the planner model runs only when a check finds an issue (delay, `atRisk`, `missed`) to write the status message and pick the replacement among valid options. Thinking HIGH more than 2 h out, MEDIUM 2 h–30 min, LOW under 30 min. Falls back to the rule message/top valid result when no model is configured or it fails.
- **Quiet messages**: when all is fine the message is just "Leave by 8:12 AM." (no schedule/live suffix; `usedRealtime` still tells the UI). Push notifications stay a follow-up (D7-C).
- **Storage**: internal `listWatched` returns `{ deviceId, item }` including departed-but-unfinished trips; internal `applyWatch` atomically writes refreshed/replacement itinerary, request, `watchStatus` and `leaveBy`, keeping saved id, label, color and savedAt. Memory and SQLite match; HTTP stays per device.
- **Tests**: no new files. Store cases in `routes/itineraries.test.ts`, watch job cases in `planning/plan-trip.test.ts`.
- **Live acceptance**: a run on Cattn's server that shows `scheduled`/`estimated` when no fresh prediction exists is acceptable, recorded as untested-live.
- **Missed vs boarded** (Cattn, 2026-11-14): the server can't tell from times alone whether a departed trip was missed. Server side now: optional `POST /api/itineraries/:id/location` (`WatchLocationReport`, in-memory, last 30 min, owner only). After departure, a point along the anchor leg away from the stop = boarded (no switch, "On Bus 1, you'll arrive around …"); still at the stop or off the route = missed (auto-switch). Without location, fall back: switch only if no check saw the leave-by time pass before departure; otherwise "has left. If you're on it, …" and stop after 10 min. Mobile reporting is a follow-up for the UI team.
- **Scope additions**: `packages/shared/src/domain/watch.ts` (quiet message), `apps/server/src/agent/models.ts` (`watch` task), `apps/server/src/watch/*`, `apps/server/.env.example`. Branch `server/watches`.
