# Transit Agent — Implementation Plans

First generated 2026-11-13 against `c9e33cc`. **Last reconciled 2026-11-14; audit baseline `0b37886`, publication base `91778d3`.**
Roadmap and open decisions: [#17](https://github.com/Cattn/transit-agent/issues/17). GitHub issues mirror the reconciled roadmap. Plan 036 is #78; plan 037 is #77. Milestones: fixture MVP, Android transit, then Later expansion.

---

## Product focus and execution order

**Confirmed by Cattn, 2026-11-14: complete Android transit first; flights follow.** iOS remains functional; iOS-specific design is deferred. Web is low priority. Build one coherent loop: search or ask → inspect/edit the same draft → choose a route → save → reopen/manage it, with truthful loading, freshness and error states.

1. Finish existing PRs: 009/#76 (Kraken), 022/#74 (DMFriends), agent #72 (Cattn). 034/#69 is merged. #75 link removal remains open.
2. Run **036** fixture MVP acceptance. **035** retains chat best-option polish and issue #73; only the duplicate verification plan was renumbered. Measure #72 against #54 before starting another speed fix.
3. **DMFriends: 037** Home search, saved-trip actions and visible failures. **Cattn: 035 → 029**, including Android progress wiring. **Kraken: map interaction proof → 030**, with Android integration coordinated through 029. Animation must not block functional fixes.
4. **Kraken: supported Settings (025)** after 037, coordinating Home changes with DMFriends. Cattn decides how unsupported rows should appear before they ship.
5. **Cattn: refine 031 → real Boston routing → 008 watches**, after its cadence/storage contract is resolved. Repeat Android acceptance with genuine scheduled/live/degraded data. Fixture MVP acceptance does not prove usable live travel advice.
6. After Android transit acceptance: **DMFriends 011 fixture comparator → 024 Fly**, Cattn 019 live fares. Bike/transit 010 follows validated engine capabilities; web 026/027 and iOS design stay deferred.

Design ownership: Cattn decides, DMFriends ties screens together, Kraken owns map behavior. Use Material 3 Compose controls and shared cards/type/icons. Search cards get no extra color dots; saved-trip colors remain permanent. Review the full journey in light/dark, including empty/loading/error/retry states. No enabled-looking control may silently discard changes.

Full findings, issue inventory and limitations: [reconciliation report](reconciliation-2026-11-14.md).

---

## Status

| Plan | Title | Who | Pri | Effort | Depends on | Status |
|------|-------|-----|-----|--------|------------|--------|
| 009 | [Route map: mobile via Expo DOM](009-maps-package-contract.md) ([#13](https://github.com/Cattn/transit-agent/issues/13)) | KrakenTheJaken | P1 | M | 002 | IN PROGRESS (#76 open; device proof required). **MVP** |
| 021 | [Mobile results sheet](021-mobile-results.md) ([#40](https://github.com/Cattn/transit-agent/issues/40)) | DMFriends | P1 | M | 020 | DONE (#66) |
| 022 | [Mobile filters](022-mobile-filters.md) ([#46](https://github.com/Cattn/transit-agent/issues/46)) | DMFriends | P1 | L | 020, 021, 023 | IN PROGRESS (#74 open; D12 included). **MVP** |
| 034 | [Keep the mobile agent chat for the app session](034-mobile-chat-session.md) ([#68](https://github.com/Cattn/transit-agent/issues/68)) | Cattn | P1 | S | 023 | DONE (#69) |
| 035 | [Agent chat matches frame 04 (best-option card, chip icons)](035-mobile-chat-best-option.md) ([#73](https://github.com/Cattn/transit-agent/issues/73)) | Cattn | P1 | S | 023, 021, 034, #72 | IN PROGRESS (PR #80 open; #69/#72 merged) |
| 036 | [Android MVP check against the real server](036-android-mvp-check.md) ([#78](https://github.com/Cattn/transit-agent/issues/78)) | Cattn | P1 | S | 009, 022, 034 | BLOCKED (#13/#46 pending merge). **MVP milestone** |
| 037 | [Android trip continuity](037-android-trip-continuity.md) ([#77](https://github.com/Cattn/transit-agent/issues/77)) | DMFriends | P1 | M | 009, 022, 034 | PR #79 open |
| 038 | [Location-preset chips with matching route colours](038-location-presets.md) ([#85](https://github.com/Cattn/transit-agent/issues/85)) | KrakenTheJaken | P1 | M | 009, 020 | IN PROGRESS (chip colours pending Cattn on #85) |
| 029 | [Stream the agent's progress](029-agent-progress-stream.md) ([#55](https://github.com/Cattn/transit-agent/issues/55)) | KrakenTheJaken | P1 | M | #72, 035; 030 for animation | PR [#86](https://github.com/Cattn/transit-agent/pull/86) open (live Vertex check after deploy) |
| 030 | [Animate the map while the agent builds a trip](030-map-build-animation.md) ([#56](https://github.com/Cattn/transit-agent/issues/56)) | KrakenTheJaken | P1 | M | 029 (live), 009 (Android) | PR [#83](https://github.com/Cattn/transit-agent/pull/83) open (renderer + scripted demo; live wiring via #55) |
| — | Planner turn speed (median 16 s, timeout 40 s) ([#54](https://github.com/Cattn/transit-agent/issues/54)) | Cattn | P2 | S | — | IN PROGRESS (#72 candidate; remeasure before another fix) |
| 031 | [Real Boston routing on Transitous](031-transitous-routing.md) ([#57](https://github.com/Cattn/transit-agent/issues/57)) | Cattn | P1 | M–L | 007 | PR #88 open (fresh-prediction acceptance moved to 008) |
| 008 | [Auto-watch + "when do I leave"](008-watches-and-leave-by.md) ([#12](https://github.com/Cattn/transit-agent/issues/12)) | Cattn | P2 | M | 031, 013, 005 | PR #100 open |
| 039 | [Reliable watch and journey controls](039-watch-reliability.md) ([#107](https://github.com/Cattn/transit-agent/issues/107)) | Cattn | P1 | M | 008 | [PR #113](https://github.com/Cattn/transit-agent/pull/113) open (stacked on #100) |
| 010 | [Bike + transit](010-bike-transit-modemix.md) ([#14](https://github.com/Cattn/transit-agent/issues/14)) | Cattn | P2 | M | 031 | TODO (step 1 research can start) |
| 024 | [Mobile Fly](024-mobile-fly.md) ([#44](https://github.com/Cattn/transit-agent/issues/44)) | DMFriends | P2 | M | 020, 021 | TODO (after Android transit; 011 response first) |
| 011 | [Flight door-to-door comparator](011-flight-door-to-door.md) ([#15](https://github.com/Cattn/transit-agent/issues/15)) | DMFriends | P2 | L | 003, 014 | TODO (deferred; fixture scope/response refresh required) |
| 019 | [Real flight prices (Clovis)](019-clovis-fare-provider.md) ([#28](https://github.com/Cattn/transit-agent/issues/28)) | Cattn | P2 | L | 014 | TODO |
| 025 | [Mobile settings](025-mobile-settings.md) ([#41](https://github.com/Cattn/transit-agent/issues/41)) | DMFriends | P2 | L | 020 | PR #87 open (unsupported rows shown disabled, "Coming soon") |
| 026 | [Web map home](026-web-map-home.md) ([#42](https://github.com/Cattn/transit-agent/issues/42)) | unassigned | P3 | L | — | TODO (web, low priority) |
| 027 | [Web results + agent](027-web-planning.md) ([#45](https://github.com/Cattn/transit-agent/issues/45)) | up for grabs | P3 | M | 026 | TODO (web, low priority) |
| 001 | [Unit-test baseline](001-test-baseline.md) ([#5](https://github.com/Cattn/transit-agent/issues/5)) | Cattn | P1 | S | — | DONE (#18) |
| 002 | [Shared trip contract](002-shared-domain-contract.md) ([#6](https://github.com/Cattn/transit-agent/issues/6)) | Cattn | P1 | M | 001 | DONE (#19) |
| 003 | [Planning API + fixture provider](003-planning-api-fixture-provider.md) ([#7](https://github.com/Cattn/transit-agent/issues/7)) | Cattn | P1 | M | 002 | DONE (#27) |
| 004 | [Typed client + TripDraft state](004-client-sdk-and-trip-draft.md) ([#8](https://github.com/Cattn/transit-agent/issues/8)) | Cattn | P1 | S | 002 | DONE (#29) |
| 005 | [SQLite saves + profiles](005-persistence-profiles-itineraries.md) ([#9](https://github.com/Cattn/transit-agent/issues/9)) | Cattn | P1 | M | 003, 004 | DONE (#31) |
| 006 | [Gemini planner agent (ADK)](006-agent-planner-adk.md) ([#10](https://github.com/Cattn/transit-agent/issues/10)) | Cattn | P1 | L | 003–005 | DONE (#38). Live check passed (#51) |
| 007 | [Real transit routing research](007-transit-provider-spike-and-integration.md) ([#11](https://github.com/Cattn/transit-agent/issues/11)) | Cattn | P1 | S | 003 | DONE (research; D2 Transitous-first). Build → 031 |
| 012 | [Mock API client](012-mock-api-client.md) ([#20](https://github.com/Cattn/transit-agent/issues/20)) | Cattn | P1 | M | 004 | DONE (#32) |
| 013 | ["When do I leave" logic](013-watch-status-logic.md) ([#21](https://github.com/Cattn/transit-agent/issues/21)) | DMFriends | P1 | S | 002 | DONE (#34) |
| 014 | [Airports, drive cost, sample fares](014-flight-ground-cost-model.md) ([#22](https://github.com/Cattn/transit-agent/issues/22)) | DMFriends | P2 | S | 002 | DONE (#30) |
| 015 | [React hooks (`@transit/client-react`)](015-client-react-hooks.md) ([#23](https://github.com/Cattn/transit-agent/issues/23)) | Cattn | P1 | M | 004, 012 | DONE (#47) |
| 016 | [Display formatters](016-display-formatters.md) ([#24](https://github.com/Cattn/transit-agent/issues/24)) | DMFriends | P1 | S | 002 | DONE (#36) |
| 017 | [Badge + mode colors, saved trip colors](017-shared-theme-tokens.md) ([#25](https://github.com/Cattn/transit-agent/issues/25)) | DMFriends | P1 | S–M | 016 | DONE (#61) |
| 018 | [Mobile platform helpers](018-mobile-platform-setup.md) ([#26](https://github.com/Cattn/transit-agent/issues/26)) | DMFriends | P1 | M | — | DONE (#37). Launch-time foreground location permission allowed (018-Q1). Link removal is open #75 |
| 020 | [Mobile map home](020-mobile-map-home.md) ([#39](https://github.com/Cattn/transit-agent/issues/39)) | DMFriends | P1 | L | — | DONE (#60); chip speed and resume-location fix in review (#111) |
| 023 | [Mobile agent chat](023-mobile-agent-chat.md) ([#43](https://github.com/Cattn/transit-agent/issues/43)) | Cattn | P1 | M | 020 | DONE (#67) |
| 028 | [`GET /api/places` from the built-in list](028-places-search-route.md) ([#49](https://github.com/Cattn/transit-agent/issues/49)) | Cattn | P1 | S | — | DONE (#50) |
| 032 | [Faster check and test](032-check-speed.md) ([#62](https://github.com/Cattn/transit-agent/issues/62)) | Cattn | P2 | S | — | DONE (#63) |
| 033 | [Real place search with Photon](033-photon-place-search.md) ([#53](https://github.com/Cattn/transit-agent/issues/53)) | Cattn | P1 | S–M | 028 | DONE (#64) |
| — | Live agent check: Hydrogen on real prompts ([#51](https://github.com/Cattn/transit-agent/issues/51)) | Cattn | P1 | S | — | DONE (results on #51; fixes in #52) |
| — | [UI direction](ui-direction.md) ([#16](https://github.com/Cattn/transit-agent/issues/16)) | Cattn (design), DMFriends | — | — | — | Reference; plans 020–027 win |
| — | [UI slices](ui-slices.md) | — | — | — | — | Superseded by plans 020–027 |

Execution order above is authoritative; the table retains existing plan groupings. Status values: TODO | IN PROGRESS | DONE | BLOCKED (reason) | REJECTED (reason). DONE plan files are kept as the record; do not re-execute them. P3 = low priority (web).

## Remaining decisions

- Cattn: 025 unsupported reminder/Add-place rows (omit, mark unavailable, or separately scope persistence).
- Cattn + Kraken: 009 overlap-picker/mode-filter behavior; 030 animation look. Preserve existing compatible behavior until agreed.
- Flight/web questions stay in their deferred plans; they do not block Android transit.

## How to contribute

- **Assignments (reconciled 2026-11-14):** the Who column shows the assignee. @Rad1ee is inactive: his MVP filters plan (022) moved to DMFriends (via Cattn), Settings (025) to KrakenTheJaken, and his design questions to Cattn. Web home (026) is unassigned and deferred; inactive owners are not left assigned. To help on someone else's issue, ask the assignee first.
- **With a coding agent:** pull `main`, then: *"Read `plans/NNN-name.md` and follow it step by step. Run every verification command, only change files listed under Scope, stop and tell me on any STOP condition, don't push."* Open a PR that says `Closes #N`.
- **Answer questions** on the issue by number (`020-Q2: search first`). The answer is recorded in that same plan; never open a second plan for the same screen.
- Use the strongest model for 007, 009, 010, 019.
- **Labels and milestones:** each issue has one `area: …` label (server, web, mobile, maps, shared), plus at most `help wanted` (up for grabs), `blocked` (waiting on another issue or decision), `research` (starts with a spike), or `bug`. Open questions live in each issue's help box, not a label. Milestones: **MVP**, **Android transit**, **Later expansion**. #16 and #17 are `tracking`.
- **UI plans and issues need visual proof:** a UI PR shows each primary feature working, as screenshots or a video, ideally about 4 pieces of media (more is fine). Upload with `gh ... --attach` (gh 2.104+); the `ship-plan` skill has the Android-over-USB capture recipe. The PR template and the `review-pr` skill enforce it.
- **Android is Material 3 (@Cattn, [PR #60 review](https://github.com/Cattn/transit-agent/pull/60#pullrequestreview-5904509484)):** Expo UI Jetpack Compose (`@expo/ui/jetpack-compose`, real Material 3 components; chosen over `react-native-paper`), Material Symbols icons, theme colors, Roboto. The full list is in plan 020's Current state and applies to 021–025. iOS is parked in the backlog (see Backlog).
- **UI plans (020–027) are a first Figma pass** (`Transit-Agent-Design-Mockups`: `Android — Material 3`, `Web — Desktop`; `iOS — Liquid Glass` is kept as the reference for the parked iOS app). When a frame changes, update that plan's Current state. Web has only home and planning frames; no plan invents web settings, filters, or Fly.
- **Mock first:** UI plans default to the mock client. `VITE_API_MODE=server` (web) or `EXPO_PUBLIC_API_MODE=server` (mobile) switches to a real server. Only Cattn's server holds the Gemini key.

## Plan format

Every executable plan has: Status, Why this matters, Current state (with excerpts), Commands, Scope (in/out), Git workflow, Steps (each with **Verify**), Done criteria, STOP conditions, Maintenance notes. Issue-facing plans also carry a `<!-- help:start -->` box; **open questions live only in that box** (the bottom section points to it). Plan 009 is a continuation brief for an active owner and keeps a goal-first layout. 008, 010 and 011 require scope/contract refinement before build work. Historical DONE excerpts are records, not execution instructions.

**Keep plans closable.** One plan is one deliverable that can be finished and its issue closed. Research or decision work is its own plan. When a plan finishes but leaves later work, close it and open a new plan for the rest instead of keeping the old one open.

## Architecture

```
 apps/web (Vite)  ─┐                       ┌─ apps/mobile (Expo)
 @transit/maps/web │  @transit/client-react │  @transit/maps/web in a 'use dom' component (009)
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

- **Mobile map runs in Expo Go.** Plan 009 renders `@transit/maps/web` in an Expo DOM component (`'use dom'`), so the map needs no dev build, EAS build, or config plugin. The web renderer is also the mobile one: map changes for web (026, 027, 030) show up on Android too.
- **Route colors are for saved trips only** (@Cattn, PR #66, 2026-11-14). Each saved trip has one permanent color (`SavedItinerary.color`) on Home, Tracked trips and the map; compute it with `assignRouteColors(ids, savedColors)` from `@transit/maps` when the trip is saved. Search results and their cards look exactly like the Figma frames, with no added color dots. `SavedItinerary.color` (#61) and the two-argument `assignRouteColors` (#65) are on main.
- **008 needs 031** for real live data; its pure logic is already in 013.
- **011 round trips:** Clovis round-trip search is preferred (optionally compare two one-way searches). Reconcile 019's one-way `FareSearch`/`FareQuote` before building round trips.
- **Node ≥ 24.13 / npm ≥ 11.8** for everyone (ADK requirement, on main).

---

## Decisions

| ID | Decision | Outcome | Affects |
|----|----------|---------|---------|
| D1 | Launch metro | **Boston** (MBTA + Bluebikes) | 007, 010 |
| D2 | Transit routing engine | **Transitous-first**, selected by Cattn in the research thread on 2026-11-14. Laptop API proxies hosted MOTIS; direct MBTA data qualifies predictions. Public-service eligibility/automation conditions remain; local OTP is a later alternative. | 007, 008, 010 |
| D3 | LLM framework | **ADK TypeScript + Gemini**; main model `gemini-3.8-flash` at LOW thinking (#72; was Hydrogen, `gemini-4-hydrogen`, kept after the live check #51), configured with `GEMINI_MODEL` / `AGENT_MODEL_<TASK>` and `AGENT_THINKING_<TASK>` on the server, so background AI tasks can use a stronger model or higher thinking. Runs with `GEMINI_API_KEY` or Vertex AI + Application Default Credentials (location `global`, #52) | 006 |
| D4 | Identity | **Anonymous device ID** (`x-device-id`) | 003–005 |
| D5 | Agent reply shape | **JSON**, plus a progress stream (newline-delimited JSON over POST) in plan 029; token-by-token text later | 006, 029 |
| D6 | Database | **`node:sqlite` file** | 005 |
| D7 | Watch updates to clients | **Poll now**, push later (working default) | 008 |
| D8 | Basemap | **OpenFreeMap**; the same style URL on web and mobile (009-Q5 answered, 2026-11-14) | 009 |
| D9 | Map package | **`packages/maps`** with `/web`; mobile renders `/web` in an Expo DOM component (no `/native`) | 009 |
| D10 | Flight prices | **Sample fares for tests + adapted Clovis (all flights)** (plan 019) | 011, 019 |
| D11 | Flight scope | **US domestic + nearby airports** first; Europe later (working default) | 011 |
| D12 | Home mode control | **Transit / Fly** (@Cattn, 2026-11-14). Drive is no longer a tab: it is a Drive filter chip (`car` in `draft.modes`), off by default, under Transit and Fly, so a trip can include driving part of the way. `modeGroups.drive` stays in shared but the app stops using it. Built in plan 022 Step 4 | 011, 020, 022, 024–027, 036 |

Other settled answers (#17, #6): hosting on Cattn's laptop for the demo; agent auto-searches once from/to/time are known and can read but not edit saved trips; missed trips switch automatically; flights checked 3/2/1 days out then more often in the last 24 h (exact cadence open, 008-Q3); bikeshare dock pins and "bike saves X min" both approved; rideshare removed for now; separate transfer-risk and lateness controls; optional display time zone; USD only; no payment screen.

Transit defaults (Cattn, plan 007 research thread, 2026-11-14): one or two checks before two hours unless overridden, then ramp nearer departure; subway around 1 h/30/20/10 min with issue-driven adjustments; commuter rail broadly similar with some earlier checking. Include first morning returns and clearly show long waits/next-day dates. Exact early/final scheduling, intercity treatment and preference storage remain with 008-Q3.

Theme and route colors (Cattn on [#25](https://github.com/Cattn/transit-agent/issues/25#issuecomment-6877423429), 2026-11-14): dark + light with a Settings toggle ship now (017-Q3). Route colors are permanent per **saved** trip, not reassigned per screen (017-Q2, settles 009 P4's color policy). Clarified on PR #66: "routes" meant saved trips; search results get no color dots and follow the mockup exactly. Planned before the MVP: storage in 017 step 4, `assignRouteColors(ids, savedColors)` in 009 step 5, screens in 021 / 026 / 027.

iOS parked (Cattn, 2026-11-14): Android is the design target; iOS parts of plans live in each plan's Backlog: iOS section. iOS still runs (Cattn, 2026-11-14): Android-only Compose screens keep a plain fallback file so the app works on iOS without iOS-specific design.

Android-first MVP (Cattn, 2026-11-14): the MVP is checked on Android (plan 036); web (026, 027) is low priority. Design feedback comes from Cattn; @Rad1ee is inactive and his MVP work was reassigned.

Mobile map via Expo DOM (Cattn, 2026-11-14): mobile renders `@transit/maps/web` in a `'use dom'` component; native MapLibre dropped; `maps/native` branch kept unmerged for reference.

**Open:** see Questions by person.

## Backlog (deliberately unplanned)

- iOS-specific design (all mobile plans' iOS parts; parked by @Cattn 2026-11-14). The app still runs on iOS through plain fallback files. Each mobile plan keeps its iOS steps and design in a "Backlog: iOS" section; the iOS design reference is the Figma page `iOS — Liquid Glass` and [`ui-direction.md`](ui-direction.md). Existing iOS code on main stays as is.
- Booking (needs app-owned confirmation + idempotency).
- Europe / Eurail "cheapest place to land".
- Probabilistic transfer risk (needs historical delay data; never show made-up percentages).
- Tracking where a car or bike was left (`TripDraft.vehicles` leaves room).
- Token-by-token agent reply text (the rest of D5-B; plan 029 streams progress only), push notifications (D7-C).

## Findings considered and rejected

- *`fastify-type-provider-zod`*: manual `parse(schema, …)` per route is simpler and avoids zod-version coupling with ADK.
- *React hooks inside `@transit/shared`*: shared stays framework-free; hooks live in `@transit/client-react`.
- *More CI work now*: `ci.yml` already runs lint, typecheck, unit tests, build, and smoke.
- *Moving the route palette into shared* (2026-11-14; 017-Q1 retired 2026-11-14 at `db8b72c`): apps import `assignRouteColors` from `@transit/maps`, and P4 is settled (permanent per-trip colors).
- *A separate web MVP check* (2026-11-14): the MVP is Android (plan 036); plan 027 Step 3 is the web version, done when web is picked up.

## Reconcile log

- **2026-11-14:** D12: Home is Transit / Fly; Drive becomes a filter chip. Added to plan 022 (Step 4, PR #74 in review) instead of a new plan; notes in 011, 020, 024–027, 035 and ui-direction.

- **2026-11-14:** 022-Q1–Q4 answered by @Cattn on #46: full sheet, keep wording, search in the sheet; no car chip, Advanced limits collapsed, Agent mark on every agent-set field, no Budget control.

- **2026-11-14 at `3a55b10`:** 021 merged (#66). 022 → DMFriends, refreshed: Expo UI Compose components instead of RN `Switch` and the community slider, open on the tapped field (Home drops it today), footer from Home's `plan`. 024 after 022. 034 started in a worker thread. 009 notes that search results follow Figma frame 02 and only saved trips get distinct colors. 035 no longer waits on 021.

- **2026-11-14 at `db8b72c`:** Android-first MVP. New plan 035 (Android MVP check, tracked on #17 to avoid another issue) replaces 027 Step 3 as the milestone. Web 026/027 → P3, Full app. @Rad1ee inactive: 022 → Cattn, 025 → KrakenTheJaken, design questions (021–026, 030) → Cattn, 027 → up for grabs. 021 marked IN PROGRESS (PR #66). Status table reordered: open plans first, in working order. Answered questions removed from Questions by person (geocoding #53, 023-Q1–Q2, 009-Q5, 017-Q1). `ui-slices.md` marked superseded; `ui-direction.md` has no open questions. DONE plans spot-checked: files from 023 (`screens/chat`), 033/028 (`apps/server/src/places`) and 015 (`packages/client-react`) are on main.

- **2026-11-14:** Plan 028 re-check passed at `09b8a33` in #50 (COMMENT, not formal approval). Awaiting owner merge.
- **2026-11-14 at `1e8328a`:** 015 marked DONE (#47). 013/014/016/018 plan files updated to DONE. UI plans 020–027 refreshed: use merged hooks; web mounts the real `@transit/maps/web`; mock/server switch added; 027 gains the MVP end-to-end check. 017 rescoped to badge/mode colors (unblocked). 007/008/010 stale facts fixed (gazetteer and agent tools exist; obsolete done criterion removed). Duplicate open-question lists and repeated map-handoff appendices removed (009 is the single source). New plan 028: `/api/places` was called by the client but never served.

## Current execution guardrails

All active plans: no new source comments or test files; preserve logging; match style; keep changes small. Historical instructions requesting new comments/test files are superseded. Extend existing tests where meaningful. Run `npm run check` before pushing; merging requires authorization. Re-read changed prerequisites before implementation. DONE confirms merged implementation, not fresh runtime/device certification.

## Reconcile log — latest

- **2026-11-14 at `0b37886`:** reviewed all 36 numbered plans, UI references/research, 43 issues (17 open/26 closed) and PR states. Confirmed Android transit before flights. Kept 035/#73; renumbered duplicate MVP check to 036. Added 037 for uncovered continuity gaps under #17, without a new issue. Corrected statuses, iOS wording, palette ownership, Settings platform scope and Android progress ownership. No source changes, commits, pushes or GitHub mutations. See report for evidence and limits.

## GitHub publication

2026-11-14: synchronized issue bodies, owners, blockers and milestones on explicit owner instruction. Created #77 (037, DMFriends) and #78 (036, Cattn). Completed issues remain closed; incomplete features remain open. Web is unassigned/deferred. No implementation PRs merged.
