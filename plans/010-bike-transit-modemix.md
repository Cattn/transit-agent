# Plan 010: Make bikes a first-class part of transit trips (personal bike + bikeshare, "modeMix")

> **Executor instructions**: Step 1 is a short spike; record its findings before continuing.
> Honor STOP conditions; update the status row when done.
>
> **Drift check (run first)**: `git diff --stat c9e33cc..HEAD -- apps/server/src/providers apps/server/src/agent/tools.ts`
> Expected: plan 007 landed with a real provider. If D2 ≠ OTP, read the step notes marked "(non-OTP)".

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/007-transit-provider-spike-and-integration.md
- **Category**: direction
- **Planned at**: commit `c9e33cc`, 2026-11-13

## Why this matters

Issue #3: *"Same thing as commutes but adding a bike onto transit, looking at where city bikes can
be parked / personal bikes."* The section summary: *"How bikes interface with transit, how they can
make it faster (see modeMix)."* Three distinct trip shapes matter:

1. **Bike → park → transit → walk** (personal bike locked at the station; return trip must come back to it).
2. **Bikeshare → transit → bikeshare** (needs dock availability at **both** ends, live).
3. **Bike on board** (agency rules: some lines disallow bikes at rush hour).

## Current state

- Contract has modes `bike` and `bikeshare`, `vehicles.ownsBike`, `constraints.maxBikeMinutes`, `preferences.activeTravel`, and `Place.kind: 'bikeDock'`.
- Fixture provider emits a `bike-rail` option. The real provider (007) may or may not mix bikes (OTP does natively; Google Routes does not).

## Steps

### Step 1 (spike, ≤ ½ day)

Find the launch-metro (D1) bikeshare **GBFS** feed (`gbfs.json` auto-discovery → `station_information`, `station_status`). Find the agency's published bike-on-board rules. Record both URLs, refresh intervals, and the rules in `plans/research/010-bike-spike.md`.

### Step 2: GBFS client (`apps/server/src/providers/gbfs.ts`)

Fetch and cache `station_information` (1 h) and `station_status` (respect the feed's `ttl`, minimum 30 s). `nearestDocks(point, { needBikes?: boolean, needDocks?: boolean, limit })` returns Places with `kind: 'bikeDock'`, plus `bikesAvailable` / `docksAvailable` in a side map. Tests use a recorded sample feed.

### Step 3: Bike rules as data (`apps/server/src/planning/bike-rules.ts`)

A typed table: `{ agency, routePattern, allowed: 'always' | 'offPeak' | 'never' | 'foldingOnly', peakWindows }`. `checkBikeOnBoard(itinerary)` → violations (e.g. "Bikes not allowed on Red Line 7–10 AM") added in `checkConstraints` when a leg is preceded *and* followed by `bike` without a parking step.

### Step 4: Mode-mix generation

- **(OTP)** Request the extra OTP mode combinations: bike-to-transit (park & ride), rental, and bike-with-transit. Map the results via the 007 mapper.
- **(non-OTP)** Post-process: for each transit itinerary, try replacing the first and/or last walk leg longer than 8 min with a bike leg (bike speed 250 m/min, with a geometry request to the bike router). Keep the result if it saves ≥ 4 min. Add bikeshare cost and dock checks.
- Either way: bikeshare legs must have a dock with bikes at the start and a dock with free docks at the end. Otherwise add a risk reason ("Only 1 bike left at Kendall dock (live)").

### Step 5: Personal-bike continuity

When `returnTime` is set and the outbound leaves a personal bike at a station, the return search's origin side must include a bike leg from that station. Add a warning if the return itinerary ignores the bike. (This is the first step toward the backlog item "track where the car/bike is left".)

### Step 6: Agent tool

Add `find_bike_docks({ near: string, need: 'bikes' | 'docks' })` to `agent/tools.ts` and add one instruction line about it.

## Done criteria

- [ ] `npm run check` exits 0 offline (recorded GBFS sample)
- [ ] Live: a Boston request with `modes` including `bikeshare` and `rail` returns ≥ 1 itinerary with a bikeshare leg whose docks show live availability in `risk.reasons` or summary
- [ ] Bike-rule violations appear for a peak-hour bike-on-board itinerary (unit test)

## STOP conditions

- No public GBFS feed for the launch metro.
- Real provider can't produce bike geometry and no bike router is available → report.

## Open questions for review

- 010-Q1: Show dock availability on the map (dock pins)? It's a maps-team decision. If yes, `@transit/maps` adds a Point layer fed by a separate prop.
- 010-Q2: Should "bike saves X min" be a headline explanation in results? Proposed: yes, in `summary`.
