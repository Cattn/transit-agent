# Plan 014: Airport list, drive-to-the-airport cost model and sample fares (moved out of plan 011)

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If a STOP condition occurs, stop and report. Do
> not improvise. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 45f5379..HEAD -- apps/server/src/flights packages/shared/src/domain`
> If `apps/server/src/flights/` already exists, STOP (someone started plan 011).

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW (new, self-contained server modules; nothing imports them yet)
- **Depends on**: plans/002-shared-domain-contract.md (DONE). Nothing else: this is plan 011 steps 1–3, split out so they can start now.
- **Category**: direction (parallel work)
- **Planned at**: commit `45f5379`, 2026-11-14

<!-- help:start -->
## Who's on it & how to help

- **Status:** ✅ **Done.** Merged in #30. Kept as a record; do not re-execute.
- **Owner:** @DMFriends

<!-- help:end -->

## Why this matters

Issue #1 asks: *"Is it cheaper to fly out of a different airport? What about driving to New York,
and those gas prices?"* Answering that needs three things that have nothing to do with the
planning API (plan 003): a list of airports near you, the cost of getting to each one (gas,
parking, tolls), and fares. This plan builds all three as pure, tested modules with **sample
fares**. Plan 011 later wires them into trip search and swaps in a real fare source.

## Current state

- No `apps/server/src/flights/` directory.
- Shared contract (`packages/shared/src/domain/`): `CostLineSchema = { label: string; usd: number; estimated: boolean }` in `itinerary.ts`; `PlaceSchema` with `kind: 'airport'` and `code` (IATA) in `places.ts`; `LngLat = [lng, lat]`.
- Server tests: Vitest, next to code, pattern `apps/server/src/app.test.ts`. NodeNext: relative imports need `.js`.
- Env defaults go in `apps/server/.env.example` (read it for the format).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Server tests | `npm run test:unit -w @transit/server` | all pass |
| Full | `npm run check` | exit 0 |

## Scope

**In scope (create unless noted):**
```
apps/server/src/flights/geo.ts                  haversineKm (local copy; plan 003 may also have one, see Maintenance)
apps/server/src/flights/airports.ts             AIRPORTS list + airportsNear()
apps/server/src/flights/ground-cost.ts          driveCost(), transitCost()
apps/server/src/flights/fares.ts                FareQuote, FlightFareProvider, FixtureFareProvider
apps/server/src/flights/*.test.ts
apps/server/.env.example                        (modify: add GAS_USD_PER_GALLON=3.20)
```
**Out of scope:** `packages/shared/**`, routes, `RouteProvider`, the door-to-door composer (plan 011 step 4), real fare APIs (D10).

## Git workflow

Branch `plan/014-flight-ground-cost`. One commit. Do not push unless told.

## Steps

### Step 1: Airports (`airports.ts`)

```ts
export interface Airport { iata: string; name: string; coordinates: LngLat; metro: string; /** IANA zone, e.g. 'America/New_York'. Needed to turn local flight times into ISO times with offsets (plan 019). */ timeZone: string; parkingUsdPerDay?: number }
export const AIRPORTS: readonly Airport[]
export function airportsNear(point: LngLat, radiusKm: number): Array<Airport & { distanceKm: number }>   // sorted nearest first
export function airportToPlace(a: Airport): Place   // { name, coordinates, kind: 'airport', code: iata }
```
About 27 entries: BOS, PVD, MHT, BDL, HVN, ALB, PWM, JFK, LGA, EWR, HPN, ISP, PHL, BWI, DCA, IAD, ORD, ATL, DFW, DEN, LAX, SFO, SEA, MIA, MCO, plus the two fallback hubs DTW and CLT used by the sample fares. Use real coordinates (look each up; 3 decimals is enough) and each airport's IANA time zone. `parkingUsdPerDay` only where you can cite a public long-term rate; otherwise leave it undefined. Add a header comment saying where the coordinates came from.

**Reference (from @Cattn):** [`Cattn/clovis` `client/src/lib/airports.ts`](https://github.com/Cattn/clovis/blob/main/client/src/lib/airports.ts) has IATA codes, cities and names for every large and scheduled-medium airport (sourced from OurAirports). Use it for codes and names. It has **no coordinates**, so take those from OurAirports' `airports.csv` (`latitude_deg`, `longitude_deg`; mind the `[lng, lat]` order). Keep v1 to the ~25 airports above; the full list can come later with plan 011.

### Step 2: Ground cost (`ground-cost.ts`)

```ts
export interface DriveCostOptions { mpg: number; gasUsdPerGallon: number; parkingUsdPerDay?: number; tollsUsd?: number }
export function driveCost(miles: number, days: number, opts: DriveCostOptions): CostLine[]
export const DEFAULT_PARKING_USD_PER_DAY = 25;
export function gasPriceFromEnv(env = process.env): number   // GAS_USD_PER_GALLON, default 3.20, invalid → default
```
`driveCost` returns lines in this order, all `estimated: true`: `Gas` = round2(miles ÷ mpg × price) (round trip is the caller's job; this is one way), `Parking` = days × (`parkingUsdPerDay ?? DEFAULT`) when `days > 0`, `Tolls` only when `tollsUsd > 0`.

### Step 3: Fares (`fares.ts`)

```ts
export interface FareQuote { id: string; from: string; to: string; /** ISO with offset */ departAt: string; /** ISO with offset */ arriveAt: string; durationMinutes: number; stops: number;
  layovers: { airport: string; minutes: number }[]; carrier: string; flightNumbers: string[];
  /** null when the source listed the flight without a price. Keep these: the agent can still use the schedule. */ priceUsd: number | null;
  bagsIncluded: number; bookingUrl?: string; source: string; fetchedAt: string }
export interface FareSearch { from: string[]; to: string[]; date: string }   // several origins AND destinations (plan 019 uses both)
// FlightFareProvider.search takes a FareSearch and returns ALL quotes found, unsorted-by-contract (callers sort).
export interface FlightFareProvider { readonly name: string; search(q: FareSearch, signal?: AbortSignal): Promise<FareQuote[]> }
export class FixtureFareProvider implements FlightFareProvider { name = 'fixture-fares' }
```
Fixture fares are deterministic and make the comparison interesting. For any destination `X`, from each requested origin:
- BOS: $240 nonstop. PVD: $150 nonstop. MHT: $200 nonstop. JFK: $130 nonstop. EWR: $135, 1 stop with a **45 min** layover. BDL: $190, 1 stop with a **2 h** layover.
- **Connecting flights must be real two-leg trips.** The layover hub is the first entry in the origin's hub list that is **neither the origin nor the destination**: EWR → `['ORD', 'DTW']`, BDL → `['PHL', 'CLT']`. So EWR→ORD connects at DTW, and BDL→PHL connects at CLT. A 1-stop quote always has `stops: 1`, exactly one layover (at the hub), and **two** `flightNumbers` (origin→hub, hub→destination). If no hub in the list qualifies (only possible if a list is edited later), return a nonstop quote instead (`stops: 0`, no layovers, one flight number).
- Departure `date` at 09:00 local offset `-05:00`. Each flight leg takes great-circle distance ÷ 800 km/h + 30 min. A nonstop is one leg. A 1-stop is leg 1 (origin→hub) + layover + leg 2 (hub→destination), so `durationMinutes` and `arriveAt` include both legs and the layover.
- **Every returned quote is a fresh object.** Never return or share module-level arrays or objects (e.g. a route table's `layovers`), and don't reuse one `layovers` array for both of an origin's flights. Mutating a returned quote must not affect later searches.
- Destination coordinates come from `AIRPORTS`; unknown IATA → skip it.
- `fetchedAt` = `new Date().toISOString()`; `carrier: 'Sample Air'`; `source: 'fixture-fares'`; no `bookingUrl`.
- Return **two flights per origin** (09:00 and a $40-cheaper 06:00 red-eye-style early flight), so callers see "all flights", not just one. `id` = `` `fx-${from}-${to}-${date}-${hhmm}` ``; `flightNumbers` like `['SA101']`.

### Step 4: Tests

- `airportsNear(Boston [-71.0589, 42.3601], 100)` → BOS first, includes PVD and MHT, excludes JFK; radius 350 includes JFK.
- `driveCost(100, 2, { mpg: 25, gasUsdPerGallon: 3.2 })` → Gas 12.80, Parking 50.00 (default), no Tolls line.
- `gasPriceFromEnv({ GAS_USD_PER_GALLON: 'abc' })` → 3.2.
- Fixture: BOS→ORD includes all 6 origins when asked; JFK has the lowest fare; two calls give equal results apart from `fetchedAt`.
- Fixture connections: for **every** origin in the sample table and every destination in `AIRPORTS`, a quote's layover airport is never its origin or its destination; 1-stop quotes have 2 flight numbers and nonstops have 1. Specifically: EWR→ORD connects at DTW, EWR→LAX at ORD, BDL→PHL at CLT, BDL→ORD at PHL. The EWR quote's layover is 45 min and its duration = leg 1 + 45 + leg 2.
- Fixture isolation: mutate `quotes[0].layovers[0].minutes = 999` from one search, then search again (same and new provider instance). The new results are unchanged.
- **A worked example as a test**, encoding the product question. From Boston Common (−71.0656, 42.3550), a 1-day trip, `mpg: 25`, gas $3.20, round-trip drive = 2 × straight-line miles (an underestimate; fine for the test):
  - PVD ≈ 150 fare + ~$12 gas + $25 parking ≈ **$187**
  - JFK ≈ 130 fare + ~$47 gas + $25 parking ≈ **$202**
  - BOS ≈ 240 fare + $4.10 transit (two subway fares) ≈ **$244**
  (Those use the 09:00 fares; with each origin's cheaper 06:00 flight every fare drops $40 and the order is the same.) Assert the **order** PVD < JFK < BOS, computing totals from the modules (not hard-coded numbers). The cheapest fare (JFK) is not the cheapest trip: that's the point of issue #1.

**Verify**: `npm run check` → exit 0.

## Done criteria

- [ ] `npm run check` exits 0; ≥ 8 new tests, including the worked example
- [ ] Only files in Scope changed
- [ ] `grep -rn "Math.random" apps/server/src/flights` → no matches

## STOP conditions

- The worked example contradicts the expected answer with realistic inputs. Report the numbers; the fixture prices may need retuning, and that's a product call.

## Maintenance notes

- Plan 011 step 4 (door-to-door composer) imports all of this. If plan 003 shipped `apps/server/src/planning/geo.ts` with a `haversineMeters`, plan 011 should switch `flights/geo.ts` to it and delete the local copy.
- A live gas price (e.g. EIA weekly regional averages) replaces `gasPriceFromEnv` later; keep the function signature.

## Open questions for review

- ~~014-Q1~~ **Decided (@Cattn, 2026-11-14):** yes, include the NYC airports. Plan 011 uses a default search radius of **350 km** so JFK, LGA and EWR are in by default from Boston.
- ~~014-Q2~~ **Decided (@DMFriends, 2026-11-14):** $25/day default is OK.
