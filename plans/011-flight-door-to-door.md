# Plan 011: Compare flights door-to-door, including other airports, getting there by car or train, and total cost

> **Executor instructions**: Steps 1–5 work entirely on fixture fare data and are fully specified.
> Step 6 (real fare provider) must wait for decision D10 recorded in `plans/README.md`. Honor STOP
> conditions; update the status row when done.
>
> **Drift check (run first)**: `git diff --stat 9ccf722..HEAD -- apps/server/src/providers apps/server/src/planning packages/shared/src/domain`
> Reconciled 2026-11-14: an empty diff is expected. If this prints anything, compare Current state before proceeding.
> Expected: plans 003 (and ideally 007) landed. Read `providers/types.ts` and `planning/plan-trip.ts`.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED (fare data access is the hard part; the comparison logic is not)
- **Depends on**: plans/003, plans/014, plans/019 (real prices; sample fares work without it); uses 007's ground routing when available (falls back to fixture)
- **Category**: direction
- **Blocked by decisions**: D10 (fare source), D11 (scope: US domestic + nearby airports first)
- **Planned at**: commit `9ccf722`, 2026-11-14 (refreshed; steps unchanged)
- **Issue**: https://github.com/Cattn/transit-agent/issues/15

<!-- help:start -->
## Who's on it & how to help

- **Status:** 🟢 **Up for grabs (fixture integration).** #7 and #22 are merged. Reuse the existing airports, drive costs, and sample fares; real ground routing remains plan 007.
- **Owner:** Nobody yet
- **Up for grabs?** Yes, for fixture integration. Real fare integration follows plan 019.
- **Waiting on:** Nothing for fixture integration. Real prices: #28; real ground routing: #11.

**How to help**
- **Take it:** comment "taking this" and assign yourself, so two people don't build the same thing.
- **With a coding agent** (Claude Code, Codex, Cursor, ...): pull `main`, then tell your agent:
  > Read `plans/011-flight-door-to-door.md` and follow it step by step. Run every verification command and check the output matches. Only change files listed under Scope. If a STOP condition happens, stop and tell me instead of working around it. Don't push. When done, show me the diff and the check results.

  Review what it did, then open a PR that says `Closes #15`.
- **Just feedback:** answer the open questions above by number in a comment.

<!-- help:end -->

## Why this matters

Issue #1 asks: *"Is it faster/cheaper to go to a different airport, to drive, etc."*, *"Might have
a cheaper flight driving to New York, but what about those gas prices"*, and *"How much is one
willing to go out of the way (is the train to Washington from Boston crazy?)"*. The value is the
**door-to-door** comparison. Fare search engines show the airfare. They leave out the $40 of gas,
$60 of parking, and 3 hours of driving needed to get the cheaper fare. This plan builds that
comparison as tested server logic with fixture fares first. The comparison is the differentiator.
Fare data is a replaceable input.

## Current state

- Contract supports `flight` legs, `Place.kind: 'airport'` with IATA `code`, cost lines with `estimated` flags, and `vehicles.carMpg` (`packages/shared/src/domain/`).
- `planTrip` in `apps/server/src/planning/plan-trip.ts` merges results from every provider whose `supports()` is true. `rank.ts` trades cost against comfort via `comfortVsCost`.
- `apps/server/src/flights/` is on main. Plan 014 (airports, drive cost, sample fares) merged in PR #30. Reuse those modules. Steps 1–3 still say STOP if those files are missing.

## Steps

### Steps 1–3: done by plan 014

*Moved 2026-11-14.* The airport list (`flights/airports.ts`), the drive cost model
(`flights/ground-cost.ts`) and the fare interface with sample fares (`flights/fares.ts`) are
plan 014, which can start before plan 003 lands. Check they exist; if not, STOP.

### Step 4: Door-to-door composer — `providers/flight-door-to-door.ts` (a `RouteProvider`)

`supports`: `modes` includes `flight`. `search`:
1. Origin airports = `airportsNear(origin, 250 km)` (top 5). Destination airports = `airportsNear(destination, 150 km)` (top 3).
2. For each origin airport, compute ground options: drive (if `ownsCar`; cost via step 2, days = trip length or 1), and transit/rail via the existing ground providers (`planTrip` on a sub-request with `modes` minus `flight`). Pick the best ground option by the user's preferences.
3. Fare search for the cross-product (one provider call with arrays).
4. Compose itineraries: ground leg(s) → `flight` leg(s) → ground leg at destination. The airport arrival buffer before departure is 90 min domestic, 150 international (`constants`). Shorten it by 15 min when `transferRisk ≥ 0.7`. Layovers become `transferBufferMinutes` on the next flight leg, so the existing risk rules apply. Flight geometry = great-circle LineString (64 points, split at the antimeridian).
5. Cost lines: fare, gas, parking, tolls, transit fares, bag fees if bags > included (assume 1 checked bag unless the draft says otherwise; add a `bags` field to `TripDraft` only after review, see Q2).
6. Summary format: `"Drive 2h10 to JFK ($38 gas + $60 parking) → JetBlue nonstop → $312 total vs $389 from BOS"`. Compute the "vs" comparison against the cheapest home-airport option.

### Step 5: Tests

`ground-cost` math; composer with fixture fares: PVD beats BOS when `comfortVsCost` = 0; BOS wins when `comfortVsCost` = 1; `maxDriveMinutes: 90` excludes JFK (near-miss with reason); a 45 min layover is `medium`/`high` risk while 2 h is `low`; great-circle split for a trans-Pacific sample; every itinerary passes `ItinerarySchema`.

### Step 6 (after D10): Real fare provider

**Done by plan 019** (D10 decided: sample fares for testing + an adapted copy of Clovis that returns *all* flights). Use `selectFareProvider()` from `flights/select-provider.ts`, and put its fallback warning into `PlanResponse.warnings`. The composer ranks fares; the provider never sorts or trims.

### Step 7: Agent

Add tools `compare_airports` (runs this provider for the current draft) and an instruction section: ask about budget ("how rich are you"), tolerance for going out of the way (max drive/train minutes), and connection tightness when they're missing. **No booking.** If a quote has `bookingUrl`, the agent may share it.


The `search_flights` tool returns `summarizeFares()` (plan 019) plus quote ids, not raw rows. Add a second tool, `filter_flights`, backed by `filterFares()`, so the agent can drill in ("only nonstops after 8 am", "layovers of at least 90 min"). The agent decides which searches to run (other airports, dates ±2 days, several landing cities); the server does the searching.

## Done criteria

- [ ] `npm run check` exits 0 offline
- [ ] `POST /api/plan` for Boston→Chicago with `modes` incl. `flight` and `car` returns itineraries from ≥ 2 origin airports with gas/parking cost lines
- [ ] No fare is ever shown without `source.provider` and `fetchedAt`

## STOP conditions

- D10's provider terms forbid displaying prices outside their UI, or require booking through them. Report before integrating.
- Fare searches across 5×3 airport pairs exceed quota/cost estimates. Report the numbers. A fallback is to search only the top 3 origin airports.

## Open questions for review

- ~~011-Q1~~ Moved to 014-Q1 (airport list now lives in plan 014).
- ~~011-Q2~~ **Decided on #6:** add `bags` and `travelers` to `TripDraft` as part of this plan (additive change), not before.
- 011-Q3: Europe / Eurail (D11-B) goes in the backlog. Agreed?
- ~~011-Q4~~ **Decided (@Cattn, 2026-11-14, [#15](https://github.com/Cattn/transit-agent/issues/15#issuecomment-6872551924)): yes.** Fly mode shows "take Amtrak instead" as a ground-only competitor (the transit provider run on the same request).

## Round-trip handoff

**Owner decision ([roadmap answer](https://github.com/Cattn/transit-agent/issues/17#issuecomment-6873720245), clarified by @Cattn in chat on 2026-11-14):** prefer Clovis's round-trip search; optionally compare two one-way searches. Reconcile plan 019's current one-way `FareSearch` / `FareQuote` contract with return dates, paired itineraries, and combined prices before implementing round trips. Existing one-way fixture comparison can proceed; do not treat two one-way fares as the preferred round-trip source.
