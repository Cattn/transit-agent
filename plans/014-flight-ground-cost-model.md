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

- **Status:** 🟢 **Up for grabs now.** Nothing to wait for.
- **Owner:** Nobody yet
- **Up for grabs?** Yes. Small server-side TypeScript, no APIs or keys needed.

**Open questions** (answer by number in a comment on #22):

1. From Boston, include the NYC airports (~300 km away) by default? *(suggested: yes, the issue's example asks exactly that)*
2. $25/day default parking when an airport's rate is unknown. OK?

**How to help**
- **Take it:** comment "taking this" and assign yourself, so two people don't build the same thing.
- **With a coding agent** (Claude Code, Codex, Cursor, ...): pull `main`, then tell your agent:
  > Read `plans/014-flight-ground-cost-model.md` and follow it step by step. Run every verification command and check the output matches. Only change files listed under Scope. If a STOP condition happens, stop and tell me instead of working around it. Don't push. When done, show me the diff and the check results.

  Review what it did, then open a PR that says `Closes #22`.
- **Just feedback:** answer the open questions above by number in a comment.

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
export interface Airport { iata: string; name: string; coordinates: LngLat; metro: string; parkingUsdPerDay?: number }
export const AIRPORTS: readonly Airport[]
export function airportsNear(point: LngLat, radiusKm: number): Array<Airport & { distanceKm: number }>   // sorted nearest first
export function airportToPlace(a: Airport): Place   // { name, coordinates, kind: 'airport', code: iata }
```
About 25 entries: BOS, PVD, MHT, BDL, HVN, ALB, PWM, JFK, LGA, EWR, HPN, ISP, PHL, BWI, DCA, IAD, ORD, ATL, DFW, DEN, LAX, SFO, SEA, MIA, MCO. Use real coordinates (look each up; 3 decimals is enough). `parkingUsdPerDay` only where you can cite a public long-term rate; otherwise leave it undefined. Add a header comment saying where the coordinates came from.

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
export interface FareQuote { from: string; to: string; departAt: string; arriveAt: string; stops: number;
  layovers: { airport: string; minutes: number }[]; carrier: string; priceUsd: number; bagsIncluded: number; bookingUrl?: string; fetchedAt: string }
export interface FlightFareProvider { readonly name: string; search(q: { from: string[]; to: string[]; date: string }): Promise<FareQuote[]> }
export class FixtureFareProvider implements FlightFareProvider { name = 'fixture-fares' }
```
Fixture fares are deterministic and make the comparison interesting. For any destination `X`, from each requested origin:
- BOS: $240 nonstop. PVD: $150 nonstop. MHT: $200 nonstop. JFK: $130 nonstop. EWR: $135, 1 stop with a **45 min** layover at ORD. BDL: $190, 1 stop with a **2 h** layover at PHL.
- Departure `date` at 09:00 local offset `-05:00`; flight time = great-circle distance ÷ 800 km/h + 30 min (+ layover if any).
- Destination coordinates come from `AIRPORTS`; unknown IATA → skip it.
- `fetchedAt` = `new Date().toISOString()`; `carrier: 'Sample Air'`; no `bookingUrl`.

### Step 4: Tests

- `airportsNear(Boston [-71.0589, 42.3601], 100)` → BOS first, includes PVD and MHT, excludes JFK; radius 350 includes JFK.
- `driveCost(100, 2, { mpg: 25, gasUsdPerGallon: 3.2 })` → Gas 12.80, Parking 50.00 (default), no Tolls line.
- `gasPriceFromEnv({ GAS_USD_PER_GALLON: 'abc' })` → 3.2.
- Fixture: BOS→ORD includes all 6 origins when asked; JFK has the lowest fare; the EWR fare has one 45 min layover; two calls give equal results apart from `fetchedAt`.
- **A worked example as a test**, encoding the product question. From Boston Common (−71.0656, 42.3550), a 1-day trip, `mpg: 25`, gas $3.20, round-trip drive = 2 × straight-line miles (an underestimate; fine for the test):
  - PVD ≈ 150 fare + ~$12 gas + $25 parking ≈ **$187**
  - JFK ≈ 130 fare + ~$47 gas + $25 parking ≈ **$202**
  - BOS ≈ 240 fare + $4.10 transit (two subway fares) ≈ **$244**
  Assert the **order** PVD < JFK < BOS, computing totals from the modules (not hard-coded numbers). The cheapest fare (JFK) is not the cheapest trip: that's the point of issue #1.

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

- 014-Q1: From Boston, include the NYC airports (~300 km away) by default? *(moved from 011-Q1; proposed: yes, because the issue's example asks exactly that)*
- 014-Q2: $25/day default parking when an airport's rate is unknown. OK?
