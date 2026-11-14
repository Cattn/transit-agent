# Plan 011: Compare flights door-to-door, including other airports, getting there by car or train, and total cost

> **Executor instructions**: Steps 1–5 work entirely on fixture fare data and are fully specified.
> Step 6 (real fare provider) must wait for decision D10 recorded in `plans/README.md`. Honor STOP
> conditions; update the status row when done.
>
> **Drift check (run first)**: `git diff --stat c9e33cc..HEAD -- apps/server/src/providers apps/server/src/planning packages/shared/src/domain`
> Expected: plans 003 (and ideally 007) landed. Read `providers/types.ts` and `planning/plan-trip.ts`.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED (fare data access is the hard part; the comparison logic is not)
- **Depends on**: plans/003; uses 007's ground routing when available (falls back to fixture)
- **Category**: direction
- **Blocked by decisions**: D10 (fare source), D11 (scope: US domestic + nearby airports first)
- **Planned at**: commit `c9e33cc`, 2026-11-13

## Why this matters

Issue #1 asks: *"Is it faster/cheaper to go to a different airport, to drive, etc."*, *"Might have
a cheaper flight driving to New York, but what about those gas prices"*, and *"How much is one
willing to go out of the way (is the train to Washington from Boston crazy?)"*. The value is the
**door-to-door** comparison. Fare search engines show the airfare. They leave out the $40 of gas,
$60 of parking, and 3 hours of driving needed to get the cheaper fare. This plan builds that
comparison as tested server logic with fixture fares first. The comparison is the differentiator.
Fare data is a replaceable input.

## Current state

- Contract supports `flight` legs, `Place.kind: 'airport'` with IATA `code`, cost lines with `estimated` flags, and `vehicles.carMpg`.
- `planTrip` merges results from every provider whose `supports()` is true. `rank.ts` already trades cost against comfort via `comfortVsCost`.
- No airport data, fare data, or gas price source yet.

## Steps

### Step 1: Airport data

`apps/server/src/flights/airports.ts`: a static list of commercial airports (IATA, name, [lng,lat], metro tag) for the Northeast corridor + major US hubs (≈ 40 entries is enough for v1; e.g. BOS, PVD, MHT, BDL, HVN, JFK, LGA, EWR, PHL, BWI, DCA, IAD, ORD, ATL, DFW, DEN, LAX, SFO, SEA, MIA, MCO). `airportsNear(point, radiusKm)` returns them sorted by distance. If the list grows, source it from OurAirports' public dataset and record the license in the file header.

### Step 2: Ground-access cost model (pure) — `flights/ground-cost.ts`

```ts
export function driveCost(miles: number, days: number, opts: { mpg: number; gasUsdPerGallon: number; parkingUsdPerDay: number; tollsUsd?: number }): CostLine[]
```
Plus per-airport parking defaults in `airports.ts` (`parkingUsdPerDay`, nullable → use a default of 25 and `estimated: true`). Gas price comes from `GAS_USD_PER_GALLON` env (default 3.20) for now. A live source (EIA weekly regional averages) is a follow-up; note the API in the PR if the spike finds it usable.

### Step 3: `FlightFareProvider` interface + fixture

```ts
interface FareQuote { from: string; to: string; departAt: string; arriveAt: string; stops: number; layovers: { airport: string; minutes: number }[]; carrier: string; priceUsd: number; bagsIncluded: number; bookingUrl?: string; fetchedAt: string }
interface FlightFareProvider { name: string; search(q: { from: string[]; to: string[]; date: string; flexibleDays?: number }): Promise<FareQuote[]> }
```
Fixture fares are deterministic and make the comparison interesting: BOS→X baseline, PVD −$70, MHT −$40, JFK −$120 (but 3.5 h drive), plus 1-stop options with 45 min vs 2 h layovers, which exercise "how tight of connections are you okay with".

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

Implement the chosen `FlightFareProvider` (`DUFFEL_API_KEY` or `SERPAPI_KEY` server env). Respect rate limits, cache identical queries for 15 min, and record one real sample for mapper tests. Keep fixture fares selectable via `FLIGHT_FARES=fixture`.

### Step 7: Agent

Add tools `compare_airports` (runs this provider for the current draft) and an instruction section: ask about budget ("how rich are you"), tolerance for going out of the way (max drive/train minutes), and connection tightness when they're missing. **No booking.** If a quote has `bookingUrl`, the agent may share it.

## Done criteria

- [ ] `npm run check` exits 0 offline
- [ ] `POST /api/plan` for Boston→Chicago with `modes` incl. `flight` and `car` returns itineraries from ≥ 2 origin airports with gas/parking cost lines
- [ ] No fare is ever shown without `source.provider` and `fetchedAt`

## STOP conditions

- D10's provider terms forbid displaying prices outside their UI, or require booking through them. Report before integrating.
- Fare searches across 5×3 airport pairs exceed quota/cost estimates. Report the numbers. A fallback is to search only the top 3 origin airports.

## Open questions for review

- 011-Q1: Default search radius: 250 km for origin airports (Boston → includes PVD, MHT, BDL, not JFK)? JFK is ~300 km. Should NYC be included by default given the issue's example?
- 011-Q2: Add `bags` and `travelers` to `TripDraft` now (contract change)?
- 011-Q3: Europe / Eurail (D11-B) goes in the backlog. Agreed?
- 011-Q4: Show the "Amtrak instead of flying" option (Boston → DC) as a ground-only competitor in the flight tab? Proposed: yes. It's just the transit provider run on the same request.
