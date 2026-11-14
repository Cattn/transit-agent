# Transit Agent — Implementation Plans

First generated 2026-11-13 against `c9e33cc`. **Last reconciled 2026-11-14 at `1e8328a`.**
Roadmap and open decisions: [#17](https://github.com/Cattn/transit-agent/issues/17). One plan per issue; the issue's "Who's on it & how to help" box mirrors the plan's.

---

## MVP: where we are and what's next

**MVP goal (#17):** type a trip request, see and edit the interpreted filters, see routes on the map, save one. Fixture routes are enough.

**Done on main:** contract, planning API (fixture routes), client + mock, SQLite saves/profiles, Gemini agent endpoint, React hooks, formatters, leave-by logic, mobile platform helpers, and the **web** route map. **Both app screens are still the scaffold** (`apps/web/src/App.tsx`, `apps/mobile/App.tsx`). The UI is the critical path.

**Critical path (web first, because its map already works):**

1. **026** web map home → **027** web results + agent. 027 Step 3 is the MVP check against the real server.
2. **028** `GET /api/places` (S, server). Needed so the search box works against the real server. Can run in parallel.
3. Mobile in parallel: **020** home → **021** results, **023** chat, **022** filters. The mobile map stays a placeholder until **009** ships `@transit/maps/native` (@KrakenTheJaken).
4. **Right after the MVP:** **029** (agent reports each step as it happens) + **030** (the map animates: pins, camera, searching line, routes drawing in). This is the owner's "watch the map build the trip" direction, and it makes the ~16 s agent turns (#54) feel live.
5. **017** badge/mode colors and saved trip colors are done (#61). Screens use `toneColors` / `modeColors` from `@transit/shared`.

**After the MVP (full app):** 031 real Boston transit and live arrivals (research done in 007) → 008 auto-watch, 010 bike + transit. Flights: 011 door-to-door on sample fares, then 019 real fares. Then 024 Fly and 025 Settings screens. Later: booking, Europe/Eurail, streaming replies, push notifications.

---

## Status

| Plan | Title | Who | Pri | Effort | Depends on | Status |
|------|-------|-----|-----|--------|------------|--------|
| 001 | [Unit-test baseline](001-test-baseline.md) ([#5](https://github.com/Cattn/transit-agent/issues/5)) | Cattn | P1 | S | — | DONE (#18) |
| 002 | [Shared trip contract](002-shared-domain-contract.md) ([#6](https://github.com/Cattn/transit-agent/issues/6)) | Cattn | P1 | M | 001 | DONE (#19) |
| 003 | [Planning API + fixture provider](003-planning-api-fixture-provider.md) ([#7](https://github.com/Cattn/transit-agent/issues/7)) | Cattn | P1 | M | 002 | DONE (#27) |
| 004 | [Typed client + TripDraft state](004-client-sdk-and-trip-draft.md) ([#8](https://github.com/Cattn/transit-agent/issues/8)) | Cattn | P1 | S | 002 | DONE (#29) |
| 005 | [SQLite saves + profiles](005-persistence-profiles-itineraries.md) ([#9](https://github.com/Cattn/transit-agent/issues/9)) | Cattn | P1 | M | 003, 004 | DONE (#31) |
| 006 | [Gemini planner agent (ADK)](006-agent-planner-adk.md) ([#10](https://github.com/Cattn/transit-agent/issues/10)) | Cattn | P1 | L | 003–005 | DONE (#38). Live check passed (#51) |
| 007 | [Real transit routing + live arrivals](007-transit-provider-spike-and-integration.md) ([#11](https://github.com/Cattn/transit-agent/issues/11)) | Cattn | P1 | S | 003 | DONE (research; D2 Transitous-first). Implementation → 031 |
| 008 | [Auto-watch + "when do I leave"](008-watches-and-leave-by.md) ([#12](https://github.com/Cattn/transit-agent/issues/12)) | Cattn | P2 | M | 031, 013, 005 | TODO (transit defaults selected; 008-Q3 details remain) |
| 009 | [Route map: native renderer](009-maps-package-contract.md) ([#13](https://github.com/Cattn/transit-agent/issues/13)) | KrakenTheJaken | P1 | M | 002 | IN PROGRESS (pure + web merged in #35; native next) |
| 010 | [Bike + transit](010-bike-transit-modemix.md) ([#14](https://github.com/Cattn/transit-agent/issues/14)) | Cattn | P2 | M | 031 | TODO (step 1 research can start) |
| 011 | [Flight door-to-door comparator](011-flight-door-to-door.md) ([#15](https://github.com/Cattn/transit-agent/issues/15)) | DMFriends | P2 | L | 003, 014 | TODO (fixture steps executable) |
| 012 | [Mock API client](012-mock-api-client.md) ([#20](https://github.com/Cattn/transit-agent/issues/20)) | Cattn | P1 | M | 004 | DONE (#32) |
| 013 | ["When do I leave" logic](013-watch-status-logic.md) ([#21](https://github.com/Cattn/transit-agent/issues/21)) | DMFriends | P1 | S | 002 | DONE (#34) |
| 014 | [Airports, drive cost, sample fares](014-flight-ground-cost-model.md) ([#22](https://github.com/Cattn/transit-agent/issues/22)) | DMFriends | P2 | S | 002 | DONE (#30) |
| 015 | [React hooks (`@transit/client-react`)](015-client-react-hooks.md) ([#23](https://github.com/Cattn/transit-agent/issues/23)) | Cattn | P1 | M | 004, 012 | DONE (#47) |
| 016 | [Display formatters](016-display-formatters.md) ([#24](https://github.com/Cattn/transit-agent/issues/24)) | DMFriends | P1 | S | 002 | DONE (#36) |
| 017 | [Badge + mode colors, saved trip colors](017-shared-theme-tokens.md) ([#25](https://github.com/Cattn/transit-agent/issues/25)) | DMFriends | P1 | S–M | 016 | DONE (#61) |
| 018 | [Mobile platform helpers](018-mobile-platform-setup.md) ([#26](https://github.com/Cattn/transit-agent/issues/26)) | DMFriends | P1 | M | — | DONE (#37). Device checks remain |
| 019 | [Real flight prices (Clovis)](019-clovis-fare-provider.md) ([#28](https://github.com/Cattn/transit-agent/issues/28)) | Cattn | P2 | L | 014 | TODO |
| 020 | [Mobile map home](020-mobile-map-home.md) ([#39](https://github.com/Cattn/transit-agent/issues/39)) | DMFriends | P1 | L | — | TODO (MVP) |
| 021 | [Mobile results sheet](021-mobile-results.md) ([#40](https://github.com/Cattn/transit-agent/issues/40)) | DMFriends | P1 | M | 020 | TODO (MVP) |
| 022 | [Mobile filters](022-mobile-filters.md) ([#46](https://github.com/Cattn/transit-agent/issues/46)) | Rad1ee | P1 | L | 020 | TODO (MVP) |
| 023 | [Mobile agent chat](023-mobile-agent-chat.md) ([#43](https://github.com/Cattn/transit-agent/issues/43)) | Cattn | P1 | M | 020 | TODO (MVP) |
| 024 | [Mobile Fly](024-mobile-fly.md) ([#44](https://github.com/Cattn/transit-agent/issues/44)) | DMFriends | P2 | M | 020 | TODO |
| 025 | [Mobile settings](025-mobile-settings.md) ([#41](https://github.com/Cattn/transit-agent/issues/41)) | Rad1ee | P2 | L | 020 | TODO |
| 026 | [Web map home](026-web-map-home.md) ([#42](https://github.com/Cattn/transit-agent/issues/42)) | Rad1ee | P1 | L | — | TODO (**MVP, start here**) |
| 027 | [Web results + agent](027-web-planning.md) ([#45](https://github.com/Cattn/transit-agent/issues/45)) | KrakenTheJaken | P1 | M | 026 | TODO (MVP check) |
| 028 | [`GET /api/places` from the built-in list](028-places-search-route.md) ([#49](https://github.com/Cattn/transit-agent/issues/49)) | Cattn | P1 | S | — | DONE (#50) |
| 029 | [Stream the agent's progress](029-agent-progress-stream.md) ([#55](https://github.com/Cattn/transit-agent/issues/55)) | Cattn | P1 | M | #52 | TODO (right after MVP) |
| 030 | [Animate the map while the agent builds a trip](030-map-build-animation.md) ([#56](https://github.com/Cattn/transit-agent/issues/56)) | KrakenTheJaken | P1 | M | 029 (live), 009 (native) | TODO (right after MVP) |
| 031 | [Real Boston routing on Transitous](031-transitous-routing.md) ([#57](https://github.com/Cattn/transit-agent/issues/57)) | Cattn | P1 | M–L | 007 | TODO (after MVP) |
| 032 | [Faster check and test](032-check-speed.md) ([#62](https://github.com/Cattn/transit-agent/issues/62)) | Cattn | P2 | S | — | IN PROGRESS (approved incl. merge) |
| — | Live agent check: Hydrogen on real prompts ([#51](https://github.com/Cattn/transit-agent/issues/51)) | Cattn | P1 | S | — | DONE (results on #51; fixes in #52) |
| — | Real place search: geocoder behind `/api/places` + `find_place` (plan 007 step 5, pulled forward) ([#53](https://github.com/Cattn/transit-agent/issues/53)) | Cattn | P1 | S–M | 028 | TODO (MVP; pick a service) |
| — | Planner turn speed (median 16 s, timeout 40 s) ([#54](https://github.com/Cattn/transit-agent/issues/54)) | Cattn | P2 | S | — | TODO |
| — | [UI direction](ui-direction.md) ([#16](https://github.com/Cattn/transit-agent/issues/16)) | Rad1ee, DMFriends | — | — | — | Living doc |
| — | [UI slices](ui-slices.md) | UI team | — | — | — | Draft |

Status values: TODO | IN PROGRESS | DONE | BLOCKED (reason) | REJECTED (reason). DONE plan files are kept as the record; do not re-execute them.

## Questions by person

Answer on the linked issue by question number. Each plan uses the proposed default until then.

- **@Cattn:** 008-Q3 watch cadence, rail types, where the preference lives ([#12](https://github.com/Cattn/transit-agent/issues/12)) · 019-Q1 Clovis completeness ([#28](https://github.com/Cattn/transit-agent/issues/28)) · 011-Q3 Europe stays backlog ([#15](https://github.com/Cattn/transit-agent/issues/15)) · 023-Q1–Q2 agent chat behavior ([#43](https://github.com/Cattn/transit-agent/issues/43)) · geocoding service for real place search ([#53](https://github.com/Cattn/transit-agent/issues/53)) · 029-Q1–Q2 progress stream format and JSON fallback ([#55](https://github.com/Cattn/transit-agent/issues/55))
- **@KrakenTheJaken:** P1 overlap chooser, P2 mode filtering, 009-Q5 one style URL for web + native, iOS device access ([#13](https://github.com/Cattn/transit-agent/issues/13)) · 027-Q1, Q3–Q5 web results ([#45](https://github.com/Cattn/transit-agent/issues/45)) · 030-Q1–Q3 map build animation ([#56](https://github.com/Cattn/transit-agent/issues/56); Rad1ee reviews the look) · 017-Q1 move the route palette into shared ([#13](https://github.com/Cattn/transit-agent/issues/13); #25 is closed)
- **@DMFriends:** 020-Q1–Q4 ([#39](https://github.com/Cattn/transit-agent/issues/39)) · 021-Q2–Q4 ([#40](https://github.com/Cattn/transit-agent/issues/40)) · 024-Q1–Q4 ([#44](https://github.com/Cattn/transit-agent/issues/44))
- **@Rad1ee:** 026-Q1–Q5 ([#42](https://github.com/Cattn/transit-agent/issues/42)) · 022-Q1–Q4 ([#46](https://github.com/Cattn/transit-agent/issues/46)) · 025-Q1–Q5 ([#41](https://github.com/Cattn/transit-agent/issues/41)) · 023-Q3 chat sheet design ([#43](https://github.com/Cattn/transit-agent/issues/43))

## How to contribute

- **Assignments (2026-11-14):** every open plan issue is assigned per the build timeline; the Who column in Status shows the assignee. To help on someone else's issue, ask the assignee first.
- **With a coding agent:** pull `main`, then: *"Read `plans/NNN-name.md` and follow it step by step. Run every verification command, only change files listed under Scope, stop and tell me on any STOP condition, don't push."* Open a PR that says `Closes #N`.
- **Answer questions** on the issue by number (`020-Q2: search first`). The answer is recorded in that same plan; never open a second plan for the same screen.
- Use the strongest model for 007, 009, 010, 019.
- **Labels and milestones:** each issue has one `area: …` label (server, web, mobile, maps, shared), plus at most `help wanted` (up for grabs), `blocked` (waiting on another issue or decision), `research` (starts with a spike), or `bug`. Open questions live in each issue's help box, not a label. Milestones: **MVP** and **Full app**. #16 and #17 are `tracking`.
- **UI plans and issues need visual proof:** a UI PR shows each primary feature working, as screenshots or a video, ideally about 4 pieces of media (more is fine). Upload with `gh ... --attach` (gh 2.104+); the `ship-plan` skill has the Android-over-USB capture recipe. The PR template and the `review-pr` skill enforce it.
- **Android is Material 3 (@Cattn, [PR #60 review](https://github.com/Cattn/transit-agent/pull/60#pullrequestreview-5904509484)):** Expo UI Jetpack Compose (`@expo/ui/jetpack-compose`, real Material 3 components; chosen over `react-native-paper`), Material Symbols icons, theme colors, Roboto. The full list is in plan 020's Current state and applies to 021–025. iOS keeps the glass design.
- **UI plans (020–027) are a first Figma pass** (`Transit-Agent-Design-Mockups`: `iOS — Liquid Glass`, `Android — Material 3`, `Web — Desktop`). When a frame changes, update that plan's Current state. Web has only home and planning frames; no plan invents web settings, filters, or Fly.
- **Mock first:** UI plans default to the mock client. `VITE_API_MODE=server` (web) or `EXPO_PUBLIC_API_MODE=server` (mobile) switches to a real server. Only Cattn's server holds the Gemini key.

## Plan format

Every executable plan has: Status, Why this matters, Current state (with excerpts), Commands, Scope (in/out), Git workflow, Steps (each with **Verify**), Done criteria, STOP conditions, Maintenance notes. Issue-facing plans also carry a `<!-- help:start -->` box; **open questions live only in that box** (the bottom section points to it). Plan 009 is a continuation brief for an active owner and keeps a goal-first layout. Post-MVP plans 031, 008, 010, and 011 still lack the Commands and Git workflow sections; add them when the plan is picked up.

**Keep plans closable.** One plan is one deliverable that can be finished and its issue closed. Research or decision work is its own plan. When a plan finishes but leaves later work, close it and open a new plan for the rest instead of keeping the old one open.

## Architecture

```
 apps/web (Vite)  ─┐                       ┌─ apps/mobile (Expo)
 @transit/maps/web │  @transit/client-react │  @transit/maps/native (plan 009)
                   └── @transit/shared: zod contract, API client, mock, TripDraft, formatters
                                      │
 apps/server (Fastify): routes/ · planning/ (rank, constraints) · providers/ (fixture → real, 007)
                        agent/ (ADK + Gemini) · store/ (node:sqlite) · flights/ · places/
```

**Design rules every plan follows:**

- **One preference system, two inputs.** Filters and the agent both edit the same `TripDraft`. The agent never invents a route; the server searches, checks constraints, and ranks.
- **Requirements vs preferences.** Hard constraints exclude options (shown only as explained "almost works"). Preferences only rank.
- **Freshness is part of the data.** Every leg says `scheduled` / `realtime` / `estimated`. Never show a scheduled time as live.
- **The map renders, the app decides.** Maps take itineraries, selection, and colors, and never fetch or save.
- **No booking yet.** Booking links at most.

## Dependency notes

- **Mobile map needs a dev client.** MapLibre React Native does not run in Expo Go. Once 009 lands: `npm run build:android` + `npm run dev:client` in `apps/mobile`.
- **Route colors:** compute `assignRouteColors(ids, savedColors)` (from `@transit/maps`) once over every trip on screen, where `savedColors` comes from `SavedItinerary.color`, and pass the same map to `RouteMap.routeColors` and the cards. Save sends the trip's current color. `SavedItinerary.color` is on main (#61); until 009 step 5 lands, use the one-argument call.
- **008 needs 031** for real live data; its pure logic is already in 013.
- **011 round trips:** Clovis round-trip search is preferred (optionally compare two one-way searches). Reconcile 019's one-way `FareSearch`/`FareQuote` before building round trips.
- **Node ≥ 24.13 / npm ≥ 11.8** for everyone (ADK requirement, on main).

---

## Decisions

| ID | Decision | Outcome | Affects |
|----|----------|---------|---------|
| D1 | Launch metro | **Boston** (MBTA + Bluebikes) | 007, 010 |
| D2 | Transit routing engine | **Transitous-first**, selected by Cattn in the research thread on 2026-11-14. Laptop API proxies hosted MOTIS; direct MBTA data qualifies predictions. Public-service eligibility/automation conditions remain; local OTP is a later alternative. | 007, 008, 010 |
| D3 | LLM framework | **ADK TypeScript + Gemini**; main model Hydrogen (`gemini-4-hydrogen`), configured with `GEMINI_MODEL` on the server; kept after the live check (#51). Runs with `GEMINI_API_KEY` or Vertex AI + Application Default Credentials (location `global`, #52) | 006 |
| D4 | Identity | **Anonymous device ID** (`x-device-id`) | 003–005 |
| D5 | Agent reply shape | **JSON**, plus a progress stream (newline-delimited JSON over POST) in plan 029; token-by-token text later | 006, 029 |
| D6 | Database | **`node:sqlite` file** | 005 |
| D7 | Watch updates to clients | **Poll now**, push later (working default) | 008 |
| D8 | Basemap | **OpenFreeMap**; one style URL for web + native is open (009-Q5) | 009 |
| D9 | Map package | **`packages/maps`** with `/web` and `/native` | 009 |
| D10 | Flight prices | **Sample fares for tests + adapted Clovis (all flights)** (plan 019) | 011, 019 |
| D11 | Flight scope | **US domestic + nearby airports** first; Europe later (working default) | 011 |

Other settled answers (#17, #6): hosting on Cattn's laptop for the demo; agent auto-searches once from/to/time are known and can read but not edit saved trips; missed trips switch automatically; flights checked 3/2/1 days out then more often in the last 24 h (exact cadence open, 008-Q3); bikeshare dock pins and "bike saves X min" both approved; rideshare removed for now; separate transfer-risk and lateness controls; optional display time zone; USD only; no payment screen.

Transit defaults (Cattn, plan 007 research thread, 2026-11-14): one or two checks before two hours unless overridden, then ramp nearer departure; subway around 1 h/30/20/10 min with issue-driven adjustments; commuter rail broadly similar with some earlier checking. Include first morning returns and clearly show long waits/next-day dates. Exact early/final scheduling, intercity treatment and preference storage remain with 008-Q3.

Theme and route colors (Cattn on [#25](https://github.com/Cattn/transit-agent/issues/25#issuecomment-6877423429), 2026-11-14): dark + light with a Settings toggle ship now (017-Q3). Route colors are permanent per trip, not reassigned per screen (017-Q2, settles 009 P4's color policy). Planned before the MVP: storage in 017 step 4, `assignRouteColors(ids, savedColors)` in 009 step 5, screens in 021 / 026 / 027.

**Open:** map behavior P1/P2 and 009-Q5 (#13); palette move 017-Q1 (#13); watch cadence 008-Q3 (#12); Clovis completeness 019-Q1 (#28); UI first-pass questions on #39–#46; iOS tester availability (@KrakenTheJaken).

## Backlog (deliberately unplanned)

- Booking (needs app-owned confirmation + idempotency).
- Europe / Eurail "cheapest place to land".
- Probabilistic transfer risk (needs historical delay data; never show made-up percentages).
- Tracking where a car or bike was left (`TripDraft.vehicles` leaves room).
- Token-by-token agent reply text (the rest of D5-B; plan 029 streams progress only), push notifications (D7-C).

## Findings considered and rejected

- *`fastify-type-provider-zod`*: manual `parse(schema, …)` per route is simpler and avoids zod-version coupling with ADK.
- *React hooks inside `@transit/shared`*: shared stays framework-free; hooks live in `@transit/client-react`.
- *More CI work now*: `ci.yml` already runs lint, typecheck, unit tests, build, and smoke.
- *Moving the route palette into shared before P4 is decided* (2026-11-14): apps can import `assignRouteColors` from `@transit/maps` today; plan 017 no longer blocks on it.

## Reconcile log

- **2026-11-14:** Plan 028 re-check passed at `09b8a33` in #50 (COMMENT, not formal approval). Awaiting owner merge.
- **2026-11-14 at `1e8328a`:** 015 marked DONE (#47). 013/014/016/018 plan files updated to DONE. UI plans 020–027 refreshed: use merged hooks; web mounts the real `@transit/maps/web`; mock/server switch added; 027 gains the MVP end-to-end check. 017 rescoped to badge/mode colors (unblocked). 007/008/010 stale facts fixed (gazetteer and agent tools exist; obsolete done criterion removed). Duplicate open-question lists and repeated map-handoff appendices removed (009 is the single source). New plan 028: `/api/places` was called by the client but never served.
