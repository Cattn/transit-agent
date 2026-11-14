# Plan 007: Replace fixture routes with real transit, walk, bike, and drive routing plus live arrivals for the launch metro

> **Executor instructions**: This plan starts with a **time-boxed spike** (step 1) whose written output
> must be reviewed by the plan owner before steps 2+. Do not start step 2 until the owner records
> the D2 decision in `plans/README.md`. Honor STOP conditions. Update the status row when done.
>
> **Drift check (run first)**: `git diff --stat 9ccf722..HEAD -- apps/server/src/providers apps/server/src/planning`
> Reconciled 2026-11-14: plan 003 is on this commit. If this prints anything, compare Current state before proceeding. Read `providers/types.ts` — if `RouteProvider` differs from the excerpt below, STOP.

## Status

- **Priority**: P1
- **Effort**: L (spike S, integration M–L depending on D2)
- **Risk**: HIGH (external services, quotas, keys, data quality)
- **Depends on**: plans/003-planning-api-fixture-provider.md
- **Category**: direction
- **Blocked by decisions**: D1 (metro, default Boston), D2 (routing engine; decided by this spike)
- **Planned at**: commit `9ccf722`, 2026-11-14 (refreshed)
- **Issue**: https://github.com/Cattn/transit-agent/issues/11

<!-- help:start -->
## Who's on it & how to help

- **Status:** 🟢 **Research is up for grabs now.** Building waits for the research result.
- **Owner:** Nobody yet
- **Up for grabs?** Yes. The first step is research only (about a day): compare routing options and write up a recommendation. Good fit for the maps person or anyone curious. (Decided: the routing server would run on Cattn's machine; sample routes stay the default for UI work.)
- **Waiting on:** Research: nothing. Building: #7 and the research result.

**How to help**
- **Take it:** comment "taking this" and assign yourself, so two people don't build the same thing.
- **With a coding agent** (Claude Code, Codex, Cursor, ...): pull `main`, then tell your agent:
  > Read `plans/007-transit-provider-spike-and-integration.md` and follow it step by step. Run every verification command and check the output matches. Only change files listed under Scope. If a STOP condition happens, stop and tell me instead of working around it. Don't push. When done, show me the diff and the check results.

  Review what it did, then open a PR that says `Closes #11`.
- **Just feedback:** answer the open questions above by number in a comment.

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
- `apps/server/src/places/` does **not** exist. Plan 006 creates `gazetteer.ts`. Do not create that file in this plan.

## Step 1 (spike, ≤ 1 day): evaluate options and write `plans/research/007-provider-spike.md`

Evaluate these against the table below. Verify **current** pricing/terms from official docs. Don't rely on memory; these change.

| Candidate | What it would provide | Things to check |
|---|---|---|
| **A. OpenTripPlanner 2.x self-hosted** with MBTA GTFS + GTFS-Realtime + Bluebikes GBFS | Transit + walk + bike + bikeshare in one engine, incl. bike-on-transit and realtime updates | RAM/CPU to build a Boston graph; hosting cost; GraphQL API shape (`planConnection`); how long a graph build takes; does it run on a teammate's machine for the demo? |
| **B. Google Routes API** (`computeRoutes`, `travelMode: TRANSIT`) | Transit/drive/walk/bike routes with polylines, no hosting | Price per request and free credit; whether transit results carry realtime; **cannot** mix bike+transit in one route; terms on caching/displaying on non-Google maps (MapLibre) |
| **C. B (or OTP) + MBTA V3 API** for predictions | Live arrival predictions per stop/route for the watch engine (plan 008) | API key requirement and rate limits; mapping stop IDs between routing results and MBTA stops |
| **Geocoding**: MapTiler Geocoding, Nominatim (public instance policy), Google Places, Photon | Search box + agent `find_place` | Usage policy (Nominatim forbids heavy/autocomplete use on the public server), key requirement, cost |

The spike doc must include: a recommendation for D2 with reasons; for the chosen option, one **real** sample request/response saved to `apps/server/src/providers/__fixtures__/` (strip any keys); a field-mapping table from the provider response to `Leg`/`Itinerary`; the env vars needed; and the expected monthly cost at 1k plans/day.
**Verify**: the doc exists and the plan owner has written `D2: <choice>` in `plans/README.md`.

## Steps 2–7 (after D2 is decided)

Instructions are written for D2 = A (OTP) with C-style realtime coming from OTP itself. If D2 = B/C, apply the same steps with the provider names swapped. Interfaces and tests stay the same.

### Step 2: Provider config

`apps/server/src/providers/registry.ts`: `ROUTE_PROVIDERS` env (comma list, default `fixture`), e.g. `otp,fixture`. Builds the provider list for `createServer`. Unknown name → startup error. Add to `.env.example`: `ROUTE_PROVIDERS=fixture`, `OTP_URL=`, plus any keys **as empty placeholders**.

### Step 3: `OtpProvider implements RouteProvider` (`providers/otp.ts`)

- `supports`: request has any of walk/bike/bikeshare/bus/rail/ferry and the origin/destination are inside the configured metro bounding box (`METRO_BBOX` env, lng/lat min/max).
- `search`: one GraphQL call mapping `TripRequest` → OTP modes (incl. bike-with-transit when `vehicles.ownsBike` and `bike` allowed; rental when `bikeshare` allowed), `time` → date/time + `arriveBy`, `constraints.maxWalkMinutes` → walk distance/limits where supported. Request 5 itineraries.
- Mapping (put it in `providers/otp-mapping.ts`, a pure function tested against the saved sample): decode leg polylines into [lng, lat] (OTP uses encoded polylines in lat,lng order, so **swap**); `timeSource = leg.realTime ? 'realtime' : (transit ? 'scheduled' : 'estimated')`; `delayMinutes` from the realtime vs scheduled fields; `transferBufferMinutes` = this leg's departure − previous transit leg's arrival; costs from fare fields when present, else the same estimated fare table the fixture uses (move that table to `planning/fares.ts` and import it in both).
- Timeout 10 s via `AbortSignal.any([signal, AbortSignal.timeout(10_000)])`.

### Step 4: Drive leg provider

Driving needs no realtime. Use OTP's `CAR` mode if the chosen deployment supports it, else Google/MapTiler directions per the spike. Cost = miles ÷ mpg × gas price (constant `GAS_USD_PER_GALLON` env, default 3.20; plan 011 adds a live source) + parking estimate.

### Step 5: Geocoder

`apps/server/src/places/geocoder.ts`: `Geocoder { search(query, near?: LngLat): Promise<Place[]> }` with the spike's chosen service + the gazetteer as fallback. New route `GET /api/places?q=&near=lng,lat` (cache results in-memory 24 h; min query length 3; debounce is the client's job). The response shape (`PlaceSearchResponseSchema`) and client method `searchPlaces(q, near?)` already exist (plan 004 Step 2b); just implement the route to match. The agent's `find_place` tool switches to the geocoder. If `apps/server/src/places/gazetteer.ts` does not exist, do not create it (plan 006 owns that list). Ship the geocoder without that fallback and say so in the PR.

### Step 6: Return-trip check ("can I make it back?")

When `request.returnTime` is set, `planTrip` also asks the provider for the **latest** itinerary back (destination → origin, `arriveBy` = next day 03:00 local, take the itinerary with the latest departure). Add `PlanResponse.lastReturn?: Itinerary` (additive change to the shared schema). If none: warning `"No transit back after <returnTime>"`. (Issue #2: *"if you can make it back (late night trips)"*.)

### Step 7: Tests

- `otp-mapping.test.ts` against the saved real sample: legs count, coordinates swapped correctly (first point near origin), `timeSource` mapping, transfer buffers, `ItinerarySchema.parse` passes.
- `registry.test.ts`: env parsing, unknown provider error.
- `plan-trip` test: OTP provider failing (mock throws) + fixture present → still 200 with `warnings: ['otp unavailable']`.
- No network calls in CI. Live check script `scripts/provider-check.mjs` runs one Boston request against the real provider when `OTP_URL` is set.

## Done criteria

- [ ] Spike doc reviewed, D2 recorded
- [ ] `npm run check` exits 0 offline
- [ ] With provider env set: `POST /api/plan` with `fixture-request.json` returns ≥ 1 itinerary whose `source.provider` ≠ `fixture` and at least one leg with `timeSource: 'realtime'` during service hours
- [ ] No API keys in git (`git grep -nI "key=" -- apps/server/src` shows no literal values)

## STOP conditions

- The chosen provider's terms forbid showing its routes on a non-provider basemap (MapLibre) → report; affects D2/D8.
- Graph build or hosting is infeasible on available machines → report; fall back to D2-C.
- Realtime data isn't available for the metro → report (it undermines issue #2's core feature).
- You are about to create `apps/server/src/places/gazetteer.ts`. Stop. That file belongs to plan 006.

## Maintenance notes

- Provider responses vary; all mapping lives in `*-mapping.ts` pure functions with real recorded samples as fixtures. When the provider changes format, update the sample and fix the mapper.
- The fixture provider stays the **default** for UI work and unrelated PRs (decided on #11, to avoid needing or stressing the routing laptop). Real routing is opt-in via `ROUTE_PROVIDERS`. CI must never need the real provider.

## Open questions for review

- ~~007-Q1~~ **Decided:** Boston (D1).
- ~~007-Q2~~ **Decided on #11:** the routing server (OTP, if chosen) runs on **Cattn's machine** for the demo and real-routing tests. The spike should say how much RAM/disk a Boston graph needs so Cattn can confirm it fits.
- ~~007-Q3~~ **Decided on #11:** keep the **fixture provider as the default** (`ROUTE_PROVIDERS=fixture`) for UI work and PRs that don't touch routing, so nobody needs the routing server running. Use the real provider (`ROUTE_PROVIDERS=otp`, optionally `otp,fixture`) only when working on or testing routing itself.
