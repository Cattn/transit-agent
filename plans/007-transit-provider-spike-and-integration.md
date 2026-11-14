# Plan 007: Replace fixture routes with real transit, walk, bike, and drive routing plus live arrivals for the launch metro

> **DONE (research).** The spike report is in `plans/research/007-provider-spike.md` and D2 is decided.
> Implementation is [plan 031](031-transitous-routing.md); do not execute anything here.

## Status

- **Priority**: P1
- **Effort**: L (spike S, integration M–L depending on D2)
- **Risk**: HIGH (external services, quotas, keys, data quality)
- **Depends on**: plans/003-planning-api-fixture-provider.md
- **Category**: direction
- **Blocked by decisions**: D1 Boston, D2 Transitous-first, transit watch direction and morning-return behavior are selected; detailed watch implementation remains with plan 008
- **Planned at**: commit `9ccf722`, 2026-11-14 (refreshed)
- **Issue**: https://github.com/Cattn/transit-agent/issues/11

<!-- help:start -->
## Who's on it & how to help

- **Status:** **DONE.** Research report delivered and D2 selected (Transitous-first) by @Cattn on 2026-11-14. Implementation is [plan 031](031-transitous-routing.md) ([#57](https://github.com/Cattn/transit-agent/issues/57)).
- **Owner:** @Cattn
- **Up for grabs?** No. Coordinate any contribution with @Cattn; do not start a competing research or implementation worker.
- **Waiting on:** nothing.

**Owner decisions**
1. **D2 selected by Cattn (2026-11-14): Transitous-first** for the hackathon prototype. Public-service eligibility/automation conditions remain applicable; local OTP remains a later alternative, not a second selected engine.
2. **Watch defaults selected by Cattn (2026-11-14):** unless the user asks otherwise, check once or twice before the two-hour mark, then increasingly often near departure. Subway checks start closer in, around 1 hour, then roughly 30, 20 and 10 minutes before departure, with further quick checks and adjustments when issues arise. Commuter rail gets some earlier checking but broadly follows the subway pattern. Exact early-check times, the final ramp, intercity treatment and preference storage are not specified; do not turn these examples into an invented fixed polling interval. Flight timing is unchanged.
3. **Return behavior selected by Cattn (2026-11-14):** include first morning service, not a hard 3 AM cutoff. Clearly show the wait duration and actual departure/arrival dates, calling out a long wait or next-day trip. Search only for trips leaving after the user’s requested return time.

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

## Step 1 (spike, ≤ 1 day): evaluate options and write `plans/research/007-provider-spike.md`

Evaluate these against the table below. Verify **current** pricing/terms from official docs. Don't rely on memory; these change.

| Candidate | What it would provide | Things to check |
|---|---|---|
| **A. OpenTripPlanner 2.x self-hosted** with MBTA GTFS + GTFS-Realtime + Bluebikes GBFS | Transit + walk + bike + bikeshare in one engine, incl. bike-on-transit and realtime updates | RAM/CPU to build a Boston graph; hosting cost; GraphQL API shape (`planConnection`); how long a graph build takes; does it run on a teammate's machine for the demo? |
| **B. Google Routes API** (`computeRoutes`, `travelMode: TRANSIT`) | Transit/drive/walk/bike routes with polylines, no hosting | Price per request and free credit; whether transit results carry realtime; **cannot** mix bike+transit in one route; terms on caching/displaying on non-Google maps (MapLibre) |
| **C. B (or OTP) + MBTA V3 API** for predictions | Live arrival predictions per stop/route for the watch engine (plan 008) | API key requirement and rate limits; mapping stop IDs between routing results and MBTA stops |
| **Geocoding**: MapTiler Geocoding, Nominatim (public instance policy), Google Places, Photon | Search box + agent `find_place` | Usage policy (Nominatim forbids heavy/autocomplete use on the public server), key requirement, cost |

The spike doc must include: a recommendation for D2 with reasons; a **real**, sanitized sample request/response when publicly accessible without new credentials/payment; field mapping from the provider response to `Leg`/`Itinerary`; proposed env vars; and monthly cost scenarios at 1k plans/day with per-plan routing/geocoding/watch assumptions. Keep research-only samples under `plans/research/samples/`; move selected samples into application fixtures only during later authorized integration.
**Verify research**: the report and samples exist, distinguish verified facts from estimates/unknowns, and are delivered for owner review. **Separate implementation gate**: the owner selects D2 in the thread and records it in `plans/README.md`; a recommendation does not satisfy that gate.

### Research findings (2026-11-14; Transitous-first subsequently selected)

Detailed evidence, mapping example, resource/cost assumptions and sanitized responses are in [the spike report](research/007-provider-spike.md), delivered in the research thread. The report and these plan amendments are currently in the isolated research worktree, not committed or published on main. Rechecked against main at `1062e71`, including `5a80535` and `611d354`. No source/config/test changes or graph deployment were made.

- **Selected prototype (D2):** Transitous-hosted MOTIS for occasional on-demand Boston routing, direct MBTA data for prediction provenance and later watches, existing gazetteer plus occasional Photon search, and direct Bluebikes GBFS for docks. This remains conditional: the repository is private, Transitous permits light prototype testing before publication but otherwise requires open-source/noncommercial use, and automated replanning needs policy clarification or a local engine. The user clarified hackathon usage will be low; 1k plans/day is future sizing, not expected demo traffic. [Transitous policy](https://transitous.org/api/)
- **Local/full-mode alternative:** OTP + MBTA GTFS/GTFS-RT + Bluebikes GBFS; local MOTIS is also credible. OTP has the strongest documented complete bike/parking composition here. No Boston graph was built or benchmarked. The execution machine reported 15.3 GiB usable RAM and 2.8 GiB free at the check; the report's build/runtime budgets are estimates, not measured requirements. Neither local deployment is an immediate ready fallback.
- **Other hosted option:** Transitland covers Boston schedules with geometry, but its documented routing realtime currently covers Bay Area operators, so Boston needs an MBTA overlay and connection revalidation. HERE/Navitia/geOps were investigated; unresolved Boston coverage, terms or deployment details prevent recommending them over the verified prototype. [Transitland coverage](https://www.transit.land/documentation/routing-platform/transit-otp/)
- **Google STOP condition:** standard Routes terms prohibit use with non-Google maps; an MBTA overlay does not clear it. Do not use Google as the default fallback under the settled MapLibre/OpenFreeMap stack. Google Places also restricts map display. [Routes terms §19](https://cloud.google.com/maps-platform/terms/maps-service-terms), [Places policy](https://developers.google.com/maps/documentation/places/web-service/policies)
- **Observed mapping/freshness:** Transitous returned Boston walk/transit, separate car/bike geometry and late-return results. Its polyline precision was 6. A bus marked `realTime: true` matched MBTA uncertainty 300, which MBTA defines as schedule-based; the router flag alone must not produce a live claim. Preserve feed/trip/service-date/stop identity durably for watches, rather than joining by route name or stop name. Genuine in-service vehicle predictions remain to be demonstrated. [MBTA uncertainty semantics](https://github.com/mbta/gtfs-documentation/blob/master/reference/gtfs-realtime.md)
- **Proposed server-only env names:** `TRANSITOUS_URL`, `ROUTING_USER_AGENT`, `MBTA_API_URL`, optional `MBTA_API_KEY`, `BLUEBIKES_GBFS_URL`, `PHOTON_URL`; alternatively `OTP_URL` or `MOTIS_URL`. D2 is Transitous-first; these variable names remain proposals, not implemented config. Keep fixture as the default, and reuse plan 028's `/api/places` route and gazetteer fallback.
- **Fallback and retention:** `planTrip` currently combines every supporting provider, so `live,fixture` is not ordered failover. Later integration must make fixture fallback explicitly a demo, label schedule/stale data honestly, and never auto-switch to a hard-constraint near-miss. Shared 24-hour geocoding caching and durable saved outputs require provider-specific permission; map-display permission alone is insufficient. Transitous does not establish Bluebikes routing coverage in the saved rental probe.

Cattn selected Transitous-first after reviewing the recommendation. These findings amend the assumptions below; that selection does not request steps 2+ in this research-only thread. Reuse the merged Gemini agent, React hooks, maps, watch calculations and mobile helpers.

## Implementation

Steps 2–7 moved to [plan 031](031-transitous-routing.md) ([#57](https://github.com/Cattn/transit-agent/issues/57)).

## Done criteria

- [x] Spike doc delivered and reviewed by Cattn
- [x] D2 recorded: Transitous-first, selected by Cattn on 2026-11-14

## Open questions for review

The help box above records Cattn’s D2, transit-watch defaults and morning-return decisions. Remaining watch scheduling/contract details belong to plan 008; do not ask the owner to reselect the recorded direction.

- ~~007-Q1~~ **Decided:** Boston (D1).
- ~~007-Q2~~ **Decided on #11:** the routing server (OTP, if chosen) runs on **Cattn's machine** for the demo and real-routing tests. The spike should say how much RAM/disk a Boston graph needs so Cattn can confirm it fits.
- ~~007-Q3~~ **Decided on #11:** keep the **fixture provider as the default** (`ROUTE_PROVIDERS=fixture`) for UI work and PRs that don't touch routing, so nobody needs the routing server running. Use the real provider (`ROUTE_PROVIDERS=otp`, optionally `otp,fixture`) only when working on or testing routing itself.
