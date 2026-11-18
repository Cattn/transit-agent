# Plan 010: Make bikes a first-class part of transit trips (personal bike + bikeshare, "modeMix")

> Start with the short spike in Step 1 and record the findings before implementation.
> The plan is reconciled against `main` at `3462ce2` on 2026-11-17. At kickoff, compare `git diff --stat 3462ce2..HEAD -- apps/server/src packages/shared/src apps/mobile/src packages/maps` with Current state.

## Status

- **Priority** P2 · **Effort** M · **Risk** MED · **Category** direction
- **Routing prerequisite** Plan 031 merged in [PR #88](https://github.com/Cattn/transit-agent/pull/88) (`847758d`). [Issue #57](https://github.com/Cattn/transit-agent/issues/57) is closed.
- **Issue** [#14](https://github.com/Cattn/transit-agent/issues/14)

<!-- help:start -->
## Who's on it & how to help

- **Status** Later. The research step can start. Build work follows Android real-transit acceptance and the readiness checks below.
- **Owner** @Cattn. Coordinate with the owner before starting related work.
- **Research help** Confirm supported Boston bike/transit combinations and identify a reliable source for station bike parking. Share findings on [#14](https://github.com/Cattn/transit-agent/issues/14).

<!-- help:end -->

## Trip options

Help riders see where a personal bike or bikeshare can make a transit trip faster. [Original request](https://github.com/Cattn/transit-agent/issues/3)

1. **Personal bike parked at a station.** Ride to a station, lock the bike there, take transit, and walk the last leg. A return through the same station should include picking up the bike and riding onward.
2. **Bluebikes before and after transit.** Each rental leg needs a bike at pickup and a free dock at drop-off.
3. **Personal bike on board.** Check whether the agency allows the bike on that service at the planned boarding time.

### Opt in to station parking

- **Off by default.** Existing profiles and trips without a parking preference default to off. Bike ownership and the Bike mode alone leave parking off. Bluebikes and bike-on-board eligibility are independent of this setting.
- **Settings.** “Include bike-to-station options by default” persists through the existing travel-profile defaults. It gives the planner permission to offer those routes when personal bike and transit are available for the trip.
- **This trip.** “Bike to station and park” in trip options can turn parking on or off for the current trip, overriding the saved default in either direction. The agent can do the same when the rider explicitly asks, for example “I’m happy to bike to the station and lock it there.” Make bike availability and allowed modes clear when needed. Keep regular transit options available and leave the saved default as it was.
- **In results.** Name the station where the rider would leave the bike. Offer the option where parking is documented, and show a specific rack only if the data identifies it. Treat documented parking as a location, with current space availability unknown unless the source supplies it.

## Current state

- Plan 031 implemented opt-in Boston routing with Transitous/MOTIS. The adapter requests personal bike as a direct street mode when allowed and owned. The fixture has a demo `bike-rail` option. The live adapter still needs the mixed-mode queries and mapping in this plan. [Transitous adapter](../apps/server/src/providers/transitous.ts) · [Fixture provider](../apps/server/src/providers/fixture.ts)
- The shared draft already supports `bike`, `bikeshare`, `vehicles.ownsBike`, `constraints.maxBikeMinutes`, `preferences.activeTravel`, and the `bikeDock` place kind. Settings writes profile defaults. Trip filters and the agent patch the current draft. Station-parking permission and parked-bike metadata are new fields for this plan. [Trip draft](../packages/shared/src/domain/trip-draft.ts) · [Travel profile](../packages/shared/src/domain/profile.ts) · [Draft patches](../packages/shared/src/client/trip-draft-state.ts)
- The planner currently returns a single independent `returnPlan` for reversed trip endpoints. That search has no link to where a particular outbound itinerary leaves a bike. There is also no GBFS client or bike-carriage rules table. [Plan aggregation](../apps/server/src/planning/plan-trip.ts) · [Response schema](../packages/shared/src/domain/api.ts)
- Plan 007 verified the public Bluebikes feed and captured a sample. The recorded hosted Transitous rental probe left Boston Bluebikes routing coverage unconfirmed. Direct GBFS dock data and mixed-mode routing need separate verification. [Provider research](research/007-provider-spike.md)

## Scope and readiness

Research can proceed now. Before starting build work, confirm Android real-transit acceptance under the [roadmap](README.md), then record the supported MOTIS queries and compositions, parking data source, shared request and result fields, exact file list, and area branch on [#14](https://github.com/Cattn/transit-agent/issues/14). The [Android fixture MVP check](036-android-mvp-check.md) covers a separate acceptance step.

- **Server.** Transitous provider, GBFS client, planning constraints and itinerary composition, return search, agent tools and instructions, and recorded feed data.
- **Shared and mobile.** Additive draft, profile-default, and itinerary/result fields; Android Settings, trip filters, and results. Reuse the existing profile and draft paths, including agent updates. Keep existing saved trips and API clients compatible.
- **Maps.** Agree on a caller-supplied dock-data prop and Point layer with the maps owner, who owns rendering. [Maps handoff](009-maps-package-contract.md)
- Station rack occupancy tracking, a general vehicle-location tracker, and a routing engine migration are outside this plan.

Run `npm run test:unit -w @transit/server` during server changes and `npm run check` before delivery. Extend existing tests, preserve logging, and add no source comments. Capture Android device evidence for changed controls and results, including light/dark and failure/retry where relevant. Update the status row after acceptance.

## Steps

### Step 1 — Research spike (up to half a day)

Use the [official Bluebikes discovery feed](https://gbfs.bluebikes.com/gbfs/gbfs.json) and the [recorded sample](research/samples/007-bluebikes-stations-excerpt.json) as starting points. Recheck discovery of `station_information` and `station_status` and record the current format and refresh intervals. Find published MBTA bike-on-board rules and a source of station parking locations. Probe which Boston bike access, egress, rental, and carriage combinations hosted MOTIS can actually return. Record URLs, coverage, and capability gaps in `plans/research/010-bike-spike.md`.

**Verify** The write-up distinguishes live dock data, hosted routing support, and documented personal-bike parking. Each proposed trip shape has evidence or a recorded gap.

### Step 2 — GBFS client

Add `apps/server/src/providers/gbfs.ts`. Cache `station_information` for one hour and `station_status` for its feed TTL, with a 30-second minimum. Join stations by GBFS station ID. Implement `nearestDocks(point, { needBikes?, needDocks?, limit })` returning `bikeDock` places with `bikesAvailable` and `docksAvailable` in a separate availability map. Use counts, station operating flags, and feed age to determine pickup and return availability.

**Verify** Existing tests use recorded data to cover bikes available, free docks, empty/full stations, and stale or unavailable status.

### Step 3 — Bike-on-board rules

Add `apps/server/src/planning/bike-rules.ts` with typed rules by agency and route pattern. Represent always, off-peak, never, and folding-only cases, with local-time peak windows where applicable. Use `checkBikeOnBoard(itinerary)` from `checkConstraints` to report violations with the affected service and rule. Use explicit carriage information where available. A transit leg surrounded by personal-bike legs without a parking step is also a carriage case under this plan.

**Verify** A peak-hour restriction appears in the violation text. Cycling to a parking location or returning a rental before boarding leaves the carriage rule inapplicable.

### Step 4 — Generate viable mixed routes

Use validated Transitous/MOTIS access and egress where supported. If the server composes legs, use routed bike geometry and retime the whole itinerary against scheduled boardings and transfers, including time to reach docks, park, and board. Apply parking permission and the existing trip constraints. Exclude unsupported compositions and explain capability gaps.

For each rental leg, require a confirmed bike at pickup and a confirmed free dock at drop-off. Surface low counts as risks, such as “Only 1 bike left at Kendall dock (live).” Explain when unavailable or stale data prevents validating a rental option. Treat fresh counts as current inventory at the time of the search.

**Verify** A missed connection, unavailable pickup or drop-off, and parking permission set to off each prevent the affected route from qualifying. Regular transit options remain eligible.

### Step 5 — Return to the parked bike

Record the parking station's stable identity and location on each parking itinerary. When `returnTime` is set, find returns for that outbound option that reach its parking station before the onward bike leg. Tie the pickup to the outbound option and match the station on both legs of the round trip. Preserve the existing general return search for ordinary itineraries. If no feasible pickup is available or a return option skips it, name the station where the bike would remain.

**Verify** Compare two outbound options that park at different stations. Each pickup returns to the correct station. With no feasible pickup, the result names the station and shows the warning.

### Step 6 — Connect settings, the trip draft, agent, and results

Wire the parking controls through the existing profile and trip-draft patch paths. In `apps/server/src/agent/tools.ts`, add `find_bike_docks({ near: string, need: 'bikes' | 'docks' })` and add instructions for dock lookup and explicit station-parking requests. Show the parking and pickup station in the results. Supply dock points through the agreed map prop. Show “Bike saves X min” only when a comparable route for the same trip was actually computed, using the full itinerary duration. [Dock pins and comparison decision](https://github.com/Cattn/transit-agent/issues/17#issuecomment-6873720245)

**Verify** An older profile starts off. A saved default survives restart, and the rider can override it on or off for a single trip through filters or an explicit request to the agent. Confirm dock lookup for both kinds of availability and time savings from actual route results.

## Done criteria

- [ ] `npm run check` exits 0 offline with recorded GBFS data. Existing tests cover opt-in and overrides, station-specific returns, and peak-hour carriage violations.
- [ ] A live Boston request with `bikeshare` and `rail` returns at least one itinerary with a bikeshare leg and shows live availability for its pickup and drop-off in the summary or `risk.reasons`.
- [ ] Android evidence shows the Settings default, trip override, parking and pickup results, and the warning for a return that skips pickup. Report any routing capability gaps against the affected trip shape.

## Stop conditions

- Stop and report if the launch metro has no public GBFS feed.
- Stop and report if the provider cannot supply bike geometry and no bike router is available.
- If a particular composition or its parking data cannot be validated, report the gap and omit that option.
