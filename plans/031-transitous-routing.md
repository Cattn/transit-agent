# Plan 031: Real Boston routing on Transitous (plan 007 steps 2–7)

> **Executor instructions**: Research and the D2 decision are done in [plan 007](007-transit-provider-spike-and-integration.md) (#11). Read its "Research findings" and [the spike report](research/007-provider-spike.md) first; they override the OTP wording in the steps below. Honor STOP conditions. Update the status row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 9ccf722..HEAD -- apps/server/src/providers apps/server/src/planning`
> If this prints anything, compare Current state before proceeding. Read `providers/types.ts` — if `RouteProvider` differs from the excerpt below, STOP.

## Status

- **Priority**: P1 (after the MVP)
- **Effort**: M–L
- **Risk**: HIGH (external services, quotas, data quality)
- **Depends on**: plan 007 (research, done), plan 003 (merged)
- **Category**: direction
- **Planned at**: split from plan 007 at commit `c40efd3`, 2026-11-14
- **Issue**: https://github.com/Cattn/transit-agent/issues/57

<!-- help:start -->
## Who's on it & how to help

- **Owner:** @Cattn
- **Up for grabs?** No. Talk to @Cattn before starting related work.
- **Waiting on:** nothing (D2 is decided). Full app work after the fixture-based MVP.

**Owner decisions**
1. **D2 selected by Cattn (2026-11-14): Transitous-first** for the hackathon prototype. Public-service eligibility/automation conditions remain applicable; local OTP remains a later alternative, not a second selected engine.
2. **Watch defaults selected by Cattn (2026-11-14):** unless the user asks otherwise, check once or twice before the two-hour mark, then increasingly often near departure. Subway checks start closer in, around 1 hour, then roughly 30, 20 and 10 minutes before departure, with further quick checks and adjustments when issues arise. Commuter rail gets some earlier checking but broadly follows the subway pattern. Exact early-check times, the final ramp, intercity treatment and preference storage are not specified; do not turn these examples into an invented fixed polling interval. Flight timing is unchanged.
3. **Return behavior selected by Cattn (2026-11-14):** include first morning service, not a hard 3 AM cutoff. Clearly show the wait duration and actual departure/arrival dates, calling out a long wait or next-day trip. Search only for trips leaving after the user’s requested return time.

**How to help**
- **With a coding agent** (Claude Code, Codex, Cursor, ...): pull `main`, then tell your agent:
  > Read `plans/031-transitous-routing.md` and follow it step by step. Run every verification command and check the output matches. Only change files the steps name. If a STOP condition happens, stop and tell me instead of working around it. Don't push. When done, show me the diff and the check results.

  Review what it did, then open a PR that says `Closes #57`.

<!-- help:end -->

## Why this matters

Issue #2's core problem is that *"bus future schedules can't be trusted"*. The app is only useful
if it shows **live** arrival predictions and recomputes "when do I need to leave". Issue #3 and
"modeMix" need bike+transit combinations. Geocoding (turning "Kendall" into coordinates) is
also needed by the UI's search box and the agent's `find_place` tool. This plan picks real data
sources and implements them behind the existing `RouteProvider` interface. Clients don't change.

## Current state

- `apps/server/src/providers/types.ts` (plan 003), still the only provider interface on main:
  ```ts
  export interface RouteProvider {
    readonly name: string;
    supports(request: TripRequest): boolean;
    search(request: TripRequest, signal?: AbortSignal): Promise<Itinerary[]>;
  }
  ```
- `FixtureProvider` is the only provider; `createServer` in `apps/server/src/app.ts` defaults to `[new FixtureProvider()]`.
- Contract rules (from `packages/shared/src/domain/itinerary.ts`): coordinates are **[lng, lat]**; each leg has `timeSource: 'realtime' | 'scheduled' | 'estimated'`, optional `delayMinutes`, a LineString `geometry`, and `transferBufferMinutes` on legs after a transfer. Risk and violations are computed by `planTrip`, not by providers.
- `apps/server/src/places/gazetteer.ts` exists (plan 006): a ~30-entry Boston/Northeast list behind `searchPlaces(query)`, used by the agent's `find_place` tool. Plan 028 serves it as `GET /api/places`. Keep it as the geocoder fallback.

## Current state

See plan 007's Current state (`RouteProvider` interface, `FixtureProvider` as the only provider, [lng, lat] contract rules, gazetteer behind `/api/places`).

## Steps (numbered as in plan 007)

D2 is Transitous-first. The OTP-specific outline below must be adapted to MOTIS/Transitous request/mapping/refresh behavior before implementation; swapping provider names alone is insufficient.

### Step 2: Provider config

`apps/server/src/providers/registry.ts`: `ROUTE_PROVIDERS` env (comma list, default `fixture`), e.g. `otp,fixture`. Builds the provider list for `createServer`. Unknown name → startup error. Add to `.env.example`: `ROUTE_PROVIDERS=fixture`, `OTP_URL=`, plus any keys **as empty placeholders**.

### Step 3: `OtpProvider implements RouteProvider` (`providers/otp.ts`)

- `supports`: request has any of walk/bike/bikeshare/bus/rail/ferry and the origin/destination are inside the configured metro bounding box (`METRO_BBOX` env, lng/lat min/max).
- `search`: one GraphQL call mapping `TripRequest` → OTP modes (incl. bike-with-transit when `vehicles.ownsBike` and `bike` allowed; rental when `bikeshare` allowed), `time` → date/time + `arriveBy`, `constraints.maxWalkMinutes` → walk distance/limits where supported. Request 5 itineraries.
- Mapping (put it in `providers/otp-mapping.ts` during integration): pin the selected engine release/schema; decode polylines using the response's precision and swap decoded lat/lng to **[lng, lat]**. Use `realtime` only for genuine fresh predictions, `scheduled` for timetable times and `estimated` for street or schedule-adjusted non-live estimates; the old router `realTime` shortcut is insufficient for MBTA. Populate departure `delayMinutes` only for realtime legs; timestamps already include that delay. Transfer slack must subtract transfer movement from the time between transit legs; reconcile existing risk logic for intervening walk legs. Preserve durable provider trip/service-date/stop identity for refresh. Use validated fare products or clearly estimated cost lines, never assume missing fare means free; reuse the existing fare logic where applicable. See the report's complete mapping example.
- Timeout 10 s via `AbortSignal.any([signal, AbortSignal.timeout(10_000)])`.

### Step 4: Drive leg provider

Use direct car routing from the selected engine where supported. Transitous returned separate car/bike shapes; OTP supports direct street routing. If a complementary road router is needed, select an option with suitable map/retention rights from the spike; Google is blocked under the standard terms. Street duration remains an estimate unless traffic freshness is established. Cost = miles ÷ mpg × gas price (constant `GAS_USD_PER_GALLON` env, default 3.20; plan 011 adds a live source) + parking estimate.

### Step 5: Geocoder

Moved to [#53](https://github.com/Cattn/transit-agent/issues/53) (pulled forward for the MVP). Skip it here.

### Step 6: Return-trip check ("can I make it back?")

When `request.returnTime` is set, search destination → origin for returns departing no earlier than that time. Include first morning service when applicable; 03:00 is not a hard cutoff (Cattn, 2026-11-14). Preserve usable overnight options and surface the first feasible morning option, rather than treating an all-night wait as an ordinary immediate return. The UI must clearly display the wait duration and actual departure/arrival dates, with an explicit long-wait/next-day indication where applicable. Expand/page as needed, preserve America/New_York GTFS service-day/DST handling, and distinguish transit from direct street-only options. Reconcile the proposed `PlanResponse.lastReturn?: Itinerary` with overnight and morning alternatives before integration; the response must not hide the morning option behind a “latest departure” result. If no valid overnight or morning service exists, warn `"No transit back after <returnTime>"`. (Issue #2: *"if you can make it back (late night trips)"*.)

### Step 7: Tests

- `otp-mapping.test.ts` against the saved real sample: legs count, coordinates swapped correctly (first point near origin), `timeSource` mapping, transfer buffers, `ItinerarySchema.parse` passes.
- `registry.test.ts`: env parsing, unknown provider error.
- `plan-trip` verification during integration: a live provider failure is reported, any fixture fallback is explicitly a demo, and fixtures are not blended into successful live results as though they were real routes. Reuse/modify existing coverage where appropriate.
- No network calls in CI. Live check script `scripts/provider-check.mjs` runs one Boston request against the real provider when `OTP_URL` is set.

## Done criteria

- [ ] `npm run check` exits 0 offline
- [ ] With provider env set: `POST /api/plan` with `fixture-request.json` returns ≥ 1 itinerary whose `source.provider` ≠ `fixture` and at least one leg with `timeSource: 'realtime'` during service hours
- [ ] No API keys in git (`git grep -nI "key=" -- apps/server/src` shows no literal values)

## STOP conditions

- The chosen provider's terms forbid showing its routes on a non-provider basemap (MapLibre) → report; affects D2/D8.
- Graph build or hosting is infeasible on available machines → report and return to the owner for a viable alternative; do not automatically select Google/old D2-C while its map restriction remains.
- Realtime data isn't available for the metro → report (it undermines issue #2's core feature).

## Maintenance notes

- Provider responses vary; all mapping lives in `*-mapping.ts` pure functions with real recorded samples as fixtures. When the provider changes format, update the sample and fix the mapper.
- The fixture provider stays the **default** for UI work and unrelated PRs (decided on #11, to avoid needing or stressing the routing laptop). Real routing is opt-in via `ROUTE_PROVIDERS`. CI must never need the real provider.

## Open questions for review

Plan 007's help box records Cattn’s D2, transit-watch defaults and morning-return decisions. Remaining watch scheduling/contract details belong to plan 008; do not ask the owner to reselect the recorded direction.

- ~~007-Q1~~ **Decided:** Boston (D1).
- ~~007-Q2~~ **Decided on #11:** the routing server (OTP, if chosen) runs on **Cattn's machine** for the demo and real-routing tests. The spike should say how much RAM/disk a Boston graph needs so Cattn can confirm it fits.
- ~~007-Q3~~ **Decided on #11:** keep the **fixture provider as the default** (`ROUTE_PROVIDERS=fixture`) for UI work and PRs that don't touch routing, so nobody needs the routing server running. Use the real provider (`ROUTE_PROVIDERS=otp`, optionally `otp,fixture`) only when working on or testing routing itself.
