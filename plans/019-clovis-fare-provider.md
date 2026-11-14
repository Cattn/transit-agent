# Plan 019: Real flight prices from an adapted copy of Clovis (all flights, not just the cheapest)

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If a STOP condition occurs, stop and report. Do
> not improvise. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 31d639b..HEAD -- apps/server/src/flights`
> Plan 014 must have landed (`apps/server/src/flights/fares.ts` exports `FlightFareProvider`,
> `FareQuote`, `FareSearch`, `FixtureFareProvider`; `airports.ts` has `timeZone` per airport).
> If not, STOP. Also check Clovis hasn't moved on: `gh api repos/Cattn/clovis/commits/main --jq .sha`
> (planned against `c891ca8`). If it changed, read the diff of `src/utils/` before copying.

## Status

- **Priority**: P2
- **Effort**: L (spike + build)
- **Risk**: MEDIUM (unofficial data source; Google can change its page or show a captcha)
- **Depends on**: plans/014-flight-ground-cost-model.md (interface + airport time zones). Decision D10 (decided 2026-11-14: sample fares for testing, adapted Clovis for real prices).
- **Category**: direction
- **Planned at**: commit `31d639b`, 2026-11-14; Clovis at `c891ca8`
- **Executor**: needs judgment and live network access; use the strongest coding model (Opus).

<!-- help:start -->
## Who's on it & how to help

- **Status:** **Assigned to @Cattn.** #22 / PR #30 is merged. Round-trip preference and optional two-one-way comparison are decided; reconcile round-trip interfaces before implementing.
- **Owner:** @Cattn (assigned 2026-11-14 from the build timeline)
- **Up for grabs?** No. Talk to @Cattn before starting related work.
- **Waiting on:** nothing for the existing research; round-trip provider/composer contract reconciliation before round-trip implementation.

**Open questions** (answer by number in a comment on #28) — **@Cattn answers these.**

1. @Cattn: do you know whether Clovis's page HTML includes all flights, or only Google's top group? (Step 1 finds out either way.)
**Decided ([roadmap answer](https://github.com/Cattn/transit-agent/issues/17#issuecomment-6873720245), clarified by @Cattn in chat on 2026-11-14):** prefer Clovis round-trip search. Optionally compare two one-way searches; do not substitute those for the preferred round-trip search.

**How to help**
- **Take it:** comment "taking this" and assign yourself, so two people don't build the same thing.
- **With a coding agent** (Claude Code, Codex, Cursor, ...): pull `main`, then tell your agent:
  > Read `plans/019-clovis-fare-provider.md` and follow it step by step. Run every verification command and check the output matches. Only change files listed under Scope. If a STOP condition happens, stop and tell me instead of working around it. Don't push. When done, show me the diff and the check results.

  Review what it did, then open a PR that says `Closes #28`.
- **Just feedback:** answer the open questions above by number in a comment.

<!-- help:end -->

## Why this matters

Issue #1 (flights) needs real prices: "is it cheaper to fly from Providence, or drive to New
York?" Cattn's own project, [Clovis](https://github.com/Cattn/clovis), already gets Google
Flights results with plain `fetch` and can search **several origin airports at once**.

But Clovis was built to find *the* cheapest flight. This app's agent needs more than that. To
answer "leave from PVD at 6 am or BOS at 9 am?", "is a 45 min layover too tight for me?" or "which
Europe city is cheapest to land in?", the agent and the airport comparison (plan 011) need
**every** flight found, with clean times, durations, layovers and stop counts. So we copy Clovis's
search code in and **change it for our needs** instead of calling Clovis as it is.

Decided (D10, @Cattn): **sample fares stay** for tests and as the demo fallback; Clovis is copied
in and adapted. "Copied in" means this repo owns the code from now on. It will drift from Clovis.

## Current state

**Clovis** (`Cattn/clovis`, public, no license file; Cattn owns it, so copying is fine; credit it
in the appropriate license/notice file; add no source comments). Relevant files, all in `src/utils/`:

| File | What it does | Keep / change |
|---|---|---|
| `tfs.ts` | Encodes a Google Flights search as the `tfs` protobuf URL param. `legSearch({ date, origins[], destinations[] })` already supports several destinations; `buildTfsOneWaySearch({ date, origins, dest })` only exposes one. | Keep; expose multiple destinations |
| `shopping.ts` | `fetchSearchHtml(url)` (25 s timeout, desktop headers, detects captcha/consent pages); `filterFlights()` keeps only flights matching the requested origins, destination and date; `searchFlightsFromUrl()` = fetch + parse + filter | Keep fetch + captcha check; change filtering |
| `parser.ts` | `parseFlightResponse(html)`: regex-scans the page for flight records. Builds `FlightResult` (price, airline, flight numbers, `"YYYY-MM-DD HH:MM"` local times, `"5h 30m"` duration strings, stops, segments, layovers). Flights without a price get `price: 0`. **Sorts by price** at the end. | Keep parsing; return structured numbers; no sorting |
| `token.ts` | Gets `sid` / `bl` tokens from the Flights home page; defines `RPC_ENDPOINT` (`…/GetShoppingResults`) | Only needed if Step 1 finds the page HTML is incomplete |
| `format.ts` | Date / duration formatting helpers | Replace with numeric minutes |

Clovis's `src/index.ts` also throttles cheapest-flight requests through a queue with a 350 ms gap
(`FLIGHT_REQUEST_DELAY_MS`). Keep that idea.

**Why it "only shows the cheapest":** the `/flights/cheapest*` routes pick a single result, and
the parser sorts by price. Also, the first HTML page Google returns may contain only the top group
of results ("best flights"), with the rest loaded later. **Step 1 finds out which.**

**This repo** (after plan 014): `apps/server/src/flights/fares.ts` has
```ts
FareQuote { id, from, to, departAt /*ISO+offset*/, arriveAt, durationMinutes, stops, layovers: { airport, minutes }[],
            carrier, flightNumbers: string[], priceUsd: number | null, bagsIncluded, bookingUrl?, source, fetchedAt }
FareSearch { from: string[]; to: string[]; date: string }
FlightFareProvider { name; search(q: FareSearch, signal?): Promise<FareQuote[]> }   // returns ALL quotes
```
and `airports.ts` with an IANA `timeZone` per airport. Server style: Fastify app, NodeNext (`.js`
import extensions), Vitest tests next to code, 2-space, single quotes.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Server tests | `npm run test:unit -w @transit/server` | all pass |
| Full | `npm run check` | exit 0 |
| Live probe (Step 1, manual) | `npx tsx apps/server/src/flights/clovis/probe.ts BOS,PVD ORD 2026-12-10` | prints counts, see Step 1 |

## Scope

**In scope (create unless noted):**
```
apps/server/src/flights/clovis/README.md          provenance (Clovis commit), what was changed and why
apps/server/src/flights/clovis/tfs.ts             copied; multi-destination one-way builder
apps/server/src/flights/clovis/fetch-page.ts      copied from shopping.ts fetchSearchHtml (+ captcha check)
apps/server/src/flights/clovis/parser.ts          copied; returns raw records, no sorting, no price-0 dropping
apps/server/src/flights/clovis/to-quote.ts        raw record → FareQuote (ISO times via airport time zones, minutes)
apps/server/src/flights/clovis/throttle.ts        one-at-a-time queue, ≥ 350 ms between requests
apps/server/src/flights/clovis/provider.ts        ClovisFareProvider implements FlightFareProvider
apps/server/src/flights/clovis/probe.ts           manual live probe script (not run in CI)
apps/server/src/flights/clovis/__fixtures__/      one recorded, trimmed search page (see Step 2)
apps/server/src/flights/fare-summary.ts           summarizeFares() for the agent
apps/server/src/flights/select-provider.ts        FLIGHT_FARES env → provider, with fixture fallback
apps/server/src/flights/**/*.test.ts
apps/server/.env.example                          (modify: FLIGHT_FARES=fixture)
```
**Out of scope:** Clovis's Elysia routes, its Tauri app and its UI; booking; the door-to-door composer (011 step 4); the agent tool itself (011 step 7 / plan 006). Don't add new npm dependencies without a STOP.

**Round-trip direction ([roadmap answer](https://github.com/Cattn/transit-agent/issues/17#issuecomment-6873720245)):** prefer Clovis's round-trip search. This supersedes the two-one-way recommendation, but the existing one-way builder, `FareSearch` / `FareQuote`, and steps below do not define round-trip dates, paired results, or combined pricing. Reconcile those interfaces and plan 011 before implementing round trips; do not silently pair one-way prices as a substitute. @Cattn clarified that the optional comparison means **two one-way searches**; the preferred source remains Clovis round-trip search. Existing research may proceed; it does not settle that comparison.

## Git workflow

Branch `plan/019-clovis-fares`. One commit per step. Do not push unless told.

## Steps

### Step 1 (spike, time-box 2 h): How complete is the page?

Copy `tfs.ts`, `shopping.ts`'s `fetchSearchHtml`, and `parser.ts` into `clovis/` as they are (plus
whatever `format.ts` helpers the parser needs). Write `probe.ts`, which runs one one-way search and prints:
- the total number of flight records parsed; how many have `price === 0`;
- the number per origin airport; the number of nonstops;
- min / max price; earliest and latest departure.

Run it for `BOS ORD`, `BOS,PVD,MHT ORD` and `BOS LHR` on a date 3–4 weeks out. Compare with the
same search on google.com/travel/flights in a browser (count "Other departing flights" too).

Write the findings in `clovis/README.md`:
- **A:** the page HTML contains (nearly) every flight the browser shows → continue with HTML parsing.
- **B:** the page only has the top group → find out whether `RPC_ENDPOINT` from Clovis's `token.ts` returns the rest, and how (request shape, paging). If it does, add Step 3b to fetch it. If it can't be made to work within the time box, **continue with A's data and record the gap**. Fewer flights is acceptable for v1; inventing them is not.

**STOP** if no search returns any flights (captcha / consent page every time). Report: the source may be unusable from this machine.

### Step 2: Record a test fixture

Save one real page from Step 1 (`BOS,PVD ORD`) to `__fixtures__/bos-pvd-ord.html`. If it's over
~500 KB, trim it to the part the parser reads and check the parser still finds the same records.
Remove any cookies or tokens from the file. All parser tests use this file; no test touches the network.

### Step 3: Parser changes ("all flights")

- **No sorting** in `parser.ts`. Callers sort.
- Keep flights with no price; they become `priceUsd: null`.
- Replace `filterFlights` with `matchesSearch(record, search)`: origin in `search.from`, destination in `search.to` (several allowed), departure date equals `search.date` **in the origin airport's time zone**.
- Dedupe identical itineraries (same flight numbers and departure time); keep the lower price.
- Multi-destination: add `buildOneWaySearchUrl({ date, origins, destinations })` using the existing `legSearch` (it already accepts several destinations).

### Step 4: Records → `FareQuote` (`to-quote.ts`)

- Local `"YYYY-MM-DD HH:MM"` + airport `timeZone` (from `airports.ts`) → ISO with offset. Use `Intl.DateTimeFormat(…, { timeZone, timeZoneName: 'longOffset' })` to get the offset for that date; no date library. If an airport isn't in `AIRPORTS`, drop the record and count it in a `skipped` number that the provider logs.
- `"5h 30m"` → `330`; layover durations → minutes.
- `id` = `` `clovis-${flightNumbers.join('-')}-${departAt}` ``; `source: 'clovis'`; `bagsIncluded: 0` (Google's page doesn't say reliably; document this in the README); `bookingUrl`: a Google Flights URL for the same search (built with `tfs.ts`).

### Step 5: Provider, throttle, cache, fallback

- `throttle.ts`: a promise queue, one request at a time, ≥ 350 ms gap (same as Clovis).
- `ClovisFareProvider.search(q)`: one page request per `FareSearch` (all origins and destinations in one URL), parse, map, return **all** quotes. Cache results in memory for 15 minutes keyed by `JSON.stringify(q)`.
- Errors: captcha/consent → `FareSourceBlockedError`; timeouts/HTTP errors → `FareSourceError`.
- `select-provider.ts`: `FLIGHT_FARES` = `fixture` (default) | `clovis`. With `clovis`, wrap it so any `FareSource*Error` falls back to `FixtureFareProvider` and adds a warning string `"Live flight prices unavailable; showing sample fares"`. The caller (plan 011's composer) puts that string in `PlanResponse.warnings`. Sample fares must always be labelled as samples.

### Step 6: A summary for the agent (`fare-summary.ts`)

The agent should see all options without reading 150 raw rows.
```ts
export interface FareSummary {
  total: number;
  byRoute: Array<{ from: string; to: string; count: number; nonstops: number;
    cheapest?: FareQuote; fastest?: FareQuote; earliest?: FareQuote; latest?: FareQuote; cheapestNonstop?: FareQuote }>;
  priceRange: { min: number; max: number } | null;
  unpriced: number;
}
export function summarizeFares(quotes: FareQuote[]): FareSummary
export function filterFares(quotes: FareQuote[], f: { maxStops?: number; minLayoverMinutes?: number; departAfter?: string; departBefore?: string; maxPriceUsd?: number }): FareQuote[]
```
Plan 011 step 7 (agent tool `search_flights`) returns the summary plus the ids, and lets the
agent call `filterFares` through a second tool to drill in ("only nonstops after 8 am").

### Step 7: Tests

All offline, using the recorded fixture:
- parser finds ≥ N records (N = the number Step 2 found), including at least one with `price === 0` if the fixture has any; the result is **not** sorted by price (or, if the page happens to be sorted, assert the parser does no sorting by checking the source has no `.sort(`);
- `to-quote`: a `"2026-12-10 06:05"` BOS departure → `2026-12-10T06:05:00-05:00`; a July date → `-04:00`; `"1h 5m"` → 65;
- dedupe keeps the cheaper duplicate;
- `select-provider`: default is fixture; `clovis` + a fake that throws `FareSourceBlockedError` → fixture results + the warning;
- `summarizeFares` / `filterFares` on hand-made quotes;
- throttle: two calls are ≥ 350 ms apart (fake timers).

**Verify**: `npm run check` → exit 0. Then manually: `FLIGHT_FARES=clovis npx tsx apps/server/src/flights/clovis/probe.ts BOS,PVD,MHT ORD <date>` prints quotes from all three origins.

## Done criteria

- [ ] `npm run check` exits 0; no test makes a network request (`grep -rn "fetch(" apps/server/src/flights --include=*.test.ts` → none)
- [ ] `clovis/README.md` records the Clovis commit, Step 1's findings (A or B, with counts), and every behaviour change from upstream
- [ ] Default `FLIGHT_FARES` is `fixture`; `.env.example` documents `clovis`
- [ ] The probe returns more than one flight per origin for `BOS,PVD,MHT ORD` (paste the output in the PR)

## STOP conditions

- Every live request gets a captcha/consent page (Step 1).
- Getting more results needs a headless browser (Playwright etc.). Report; that's a new dependency and a hosting decision.
- Time zone conversion can't be done with `Intl` on the installed Node version.

## Maintenance notes

- This code **will break** when Google changes its page. The recorded fixture keeps tests green, so also run the probe before demos. The fallback to sample fares (with a visible warning) is what keeps the demo working.
- Don't sort or trim in the provider. Ranking belongs to plan 011 (door-to-door, with the user's preferences) and choosing what to look at belongs to the agent.
- If Clovis itself improves its parser later, port the change by hand and note it in `clovis/README.md`.

## Open questions for review

- 019-Q1 (@Cattn): Do you know offhand whether Clovis's page HTML includes all flights, or only Google's top group? (Step 1 answers it either way.)
- ~~019-Q2~~ **Decided ([roadmap answer](https://github.com/Cattn/transit-agent/issues/17#issuecomment-6873720245), clarified by @Cattn in chat on 2026-11-14):** prefer Clovis round-trip search and optionally compare two one-way searches. The “2 round trips” wording is clarified, not a request for two separate round-trip alternatives. Reconcile return dates, paired results, and combined-price contracts before round-trip implementation.

## Readiness (`0b37886`)

Deferred until Android transit completion. Integrate the 011 fixture composer response before 024 calls live fares. Round trips need paired legs, dates and combined price; two one-way prices do not substitute for the selected round-trip source. Historical header-comment/test-file instructions are superseded: preserve required license attribution in appropriate notice files, extend existing tests only, add no source comments, and preserve logging.
