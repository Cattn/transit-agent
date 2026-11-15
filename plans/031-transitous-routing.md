# Plan 031: Real Boston routing on Transitous

## Status

- Owner: Cattn; issue: https://github.com/Cattn/transit-agent/issues/57.
- State: PR #88 open (server/transitous-routing). Step 1 contract approved by Cattn 2026-11-14 (see "Approved contract"). Step 5 live acceptance of fresh MBTA predictions remains open by design.
- Priority P1 (Android transit milestone); effort M–L; risk HIGH (external data and provider semantics).
- Depends on: 003 and 007 (DONE). Geocoding 028/033 is DONE; do not rebuild it.
- Planned at: `0b37886`, reconciled 2026-11-14.

## Why this matters

Fixture acceptance proves UI integration. Real Boston routing supplies actual geometry and times; genuine MBTA prediction evidence is required before claiming live arrivals. D2 is Transitous-first, not OTP GraphQL. Laptop API hosting and fixture-default development remain settled. iOS design and flight expansion do not block this work.

## Current state and drift check

Run `git diff --stat 0b37886..HEAD -- apps/server/src/providers apps/server/src/planning apps/server/src/app.ts packages/shared/src/domain` and compare changed files before proceeding.

`apps/server/src/providers/types.ts` exposes `RouteProvider` with name, `supports(request)` and `search(request, signal?): Promise<Itinerary[]>`. `createServer` defaults to FixtureProvider. `planTrip` owns constraints/ranking/risk. Do not move those into the adapter.

Research recorded GET `/api/v6/plan` at `https://api.transitous.org`, using `fromPlace=lat,lon`, `toPlace=lat,lon`, ISO time and numItineraries. The return sample uses arriveBy=true; the street sample uses empty transitModes and directModes=CAR,BIKE. This is evidence of the captured API, not a guarantee its current schema is unchanged. Domain coordinates are [lng,lat]; convert only at the boundary.

Recorded envelopes in `plans/research/samples/007-transitous*.json` contain verification metadata and a response object; map response, not the envelope. Leg polylines in the sample use precision 6; decode supplied precision. The mapping example and MBTA samples document schedules, prediction qualification and identity crosswalk limitations. Read `plans/research/007-provider-spike.md` before refining the contract. No credentials are needed for recorded-data verification.

## Approved contract (Cattn, 2026-11-14)

- Response: additive `PlanResponse.returnPlan?` = `{ requestedDepartAt, request, status: ok|no_routes|unavailable|unsupported, options: [{ itinerary, waitMinutes }], firstMorningOptionId?, nearMisses, warnings }`. Omitted when no `returnTime`. `request` is the reversed trip (destination → origin, departAt `returnTime`, no outbound `arriveBy`, no `returnTime`) so saving a return saves the right direction. Outbound fields unchanged.
- Return search: departs no earlier than `returnTime`. When the next 05:00 local (trip zone, default America/New_York) is within 12 h, keep overnight options and add the earliest feasible option at/after 05:00 as `firstMorningOptionId` (one extra search starting at 05:00 if the first page doesn't reach it). No 03:00 cutoff. Waits rank as part of duration. Long-wait warning at ≥ 60 min. Upstream failure → `unavailable` (outbound kept); no service → `no_routes`.
- Identity: optional `Leg.trip` `{ provider, tripId, feed?, agencyTripId?, serviceDate?, routeId?, directionId?, boardStopId?, alightStopId?, boardStopSequence? }`, parsed from MOTIS `tripId` (`YYYYMMDD_HH:MM_feed_agencyTripId`; GTFS times past 24:00 keep the prior service date). Raw provider stop IDs kept; `Place.code` gets the feed-stripped agency stop ID.
- Freshness: 031 never labels a leg `realtime`. Transitous `realTime: true` → `estimated` (adjusted, unqualified); otherwise transit is `scheduled`; street legs `estimated`. No `delayMinutes`. MBTA V3 qualification moves to 008.
- Modes: transit `BUS`, `SUBWAY`, `TRAM`; direct `WALK`, plus `BIKE`/`CAR` when owned and allowed. Commuter rail and ferry are not requested (fares unknown); other leg modes, cancelled trips and missing geometry skip the itinerary with a logged reason.
- Fares/costs: estimated MBTA lines (bus $1.70, subway/tram $2.40) per boarding; car = estimated gas via `driveCost`; never an implicit free transit fare.
- Consumers: Android results get a "Return" section (date, wait, first-morning label, warnings) and save the reversed request; agent `search_routes` passes a compact `returnPlan`. Web unchanged.

## Scope

In scope: server providers (new transitous adapter, pure mapping and registry), `apps/server/src/app.ts`, planning aggregation/risk transfer handling, server `.env.example`, existing provider/planning/route test files; shared domain/client response files only for the explicitly approved additive return/identity representation. No new test files/comments; preserve logging.

Out of scope: local graph builds, choosing another engine, geocoding, map/UI redesign, watch scheduler (008), bike mode-mix (010), flight provider and silent fixture fallback.

## Commands and workflow

Branch `server/transitous-routing`. Node >=24.13, npm >=11.8. Run `npm run test:unit -w @transit/server` after each mapping/aggregation change; expected all pass offline. Run `npm run check` before push; expected exit 0. No CI network calls. No merge without authorization.

## Steps

1. Refine contracts before coding. Pin the currently verified Transitous request/response schema against the captured `/api/v6/plan` samples. Specify supported modes, abort/timeout handling, namespace crosswalk, durable trip/service-date/stop identity, realtime freshness qualification, unknown fares, and additive return-response representation. Cattn must approve how overnight and first-morning options are represented; do not invent a `lastReturn` field that hides the morning option. Record exact scope changes and acceptance cases here, then change BLOCKED to TODO.
   Verify: each captured sample has an explicit field mapping, every contract change has an owner decision, and no OTP GraphQL/OTP_URL implementation is prescribed.
2. Registry and transport. Default ROUTE_PROVIDERS to fixture; opt-in transitous with server-only TRANSITOUS_URL and identifying ROUTING_USER_AGENT placeholders. Unknown names fail startup. Preserve cancellation and a bounded 10 s timeout. If live routing fails, warn/fail honestly; never blend fixture routes into successful real results or present a demo fallback as live.
   Verify: existing server tests cover defaults, unknown names, cancellation, upstream failure and isolation of fixture/live results; server test command passes offline.
3. Pure mapping. Map itinerary and leg times, geometry, supported modes and source timestamps. Validate against ItinerarySchema. Street legs are estimated, schedules scheduled, fresh confirmed predictions realtime; omit delay unless genuine boarding-departure delay is established. Subtract transfer movement when computing boarding slack, including intervening walks; reuse central risk/constraints/ranking. Missing geometry/fare/prediction must not become fabricated paths/free fares/live labels.
   Verify: extend existing provider/planning tests with recorded response objects, precision/coordinate assertions, transfer-walk cases, degraded provenance and schema validation; server test command passes.
4. Direct options and returns. Use validated engine street options for allowed car/bike modes. Car cost uses existing ground-cost logic and explicit estimates. For returnTime search reversed endpoints departing no earlier than requested, including overnight/first-morning service. Preserve real dates, waiting duration and long-wait warning in the approved response. Return query must not impose 03:00 as a hard cutoff. Reject unsupported compositions honestly.
   Verify: existing planning/route tests cover midnight/DST, morning wait, empty return, hard constraints and allowed modes; server test command passes.
5. Live acceptance on Cattn's server. Run a small in-service Boston search with provider opt-in, retaining sanitized request/result evidence. Confirm at least one real route, geometry, timestamps and source; qualify genuine MBTA live predictions separately. If no fresh prediction exists, record scheduled/degraded result and keep live acceptance incomplete. Never fake realtime to pass. Honor service eligibility/automation conditions from research; no automated watch traffic here.
   Verify: `npm run check` passes offline; record tested SHA/config and Android rendered result, plus actual fresh-prediction evidence or explicit remaining blocker on #57.

## Done criteria

- Approved schema/return/identity mapping replaces the blocked refinement gate.
- Offline validation passes, recorded mapping and error/provenance cases pass in existing tests.
- Opt-in API results are real and failure behavior is explicit; fixture remains default.
- Android displays real geometry, correct dates/wait and scheduled/live provenance.
- Fresh prediction acceptance is evidenced separately; no claim that scheduled service is live.

## STOP conditions and maintenance

Stop if the live schema differs, usage conditions prevent the selected deployment, identity cannot be mapped safely, or response work requires unapproved public-contract changes. Do not switch engines or fabricate fallback data. Reverify provider schema before implementation; the November 14 research is a snapshot. 008 must consume durable identity and refresh semantics from this adapter, and must not run full routing searches on every client poll.
