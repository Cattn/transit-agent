# Transit Agent — Implementation Plans

First generated 2026-11-13 against `c9e33cc`. **Last reconciled 2026-11-14 at `db8b72c`.**
Roadmap and open decisions: [#17](https://github.com/Cattn/transit-agent/issues/17). One plan per issue; the issue's "Who's on it & how to help" box mirrors the plan's.

---

## MVP: where we are and what's next

**MVP goal (#17):** on **Android**, type a trip request, see and edit the interpreted filters, see routes on the map, save one. Fixture routes are enough. Web is low priority and not part of the MVP (@Cattn, 2026-11-14).

**Done on main:** contract, planning API (fixture routes), client + mock, SQLite saves/profiles, Gemini agent, React hooks, formatters, colors, leave-by logic, mobile platform helpers, real place search (Photon), the web route map, and on Android: map home (020) and agent chat (023).

**MVP critical path (all Android):**

| # | Plan | Who | State |
|---|------|-----|-------|
| 1 | **009** DOM map: `@transit/maps/web` in a `'use dom'` component, mounted in Home's `MapSlot` | KrakenTheJaken | PR [#76](https://github.com/Cattn/transit-agent/pull/76) open |
| 2 | **021** Results sheet + Save | DMFriends | ✅ Merged (#66, `9450fed`) |
| 3 | **022** Filters full sheet | DMFriends | Unblocked. Rebase on 034 before the PR |
| 4 | **034** Keep the chat for the session | Cattn | PR [#69](https://github.com/Cattn/transit-agent/pull/69) open |
| 5 | **035** Android MVP check against the real server | Cattn | After 1–4 |

**Right after the MVP:** **029** (the agent streams each step) + **030** (the map animates while the agent builds the trip; built once on web, shows on Android through the DOM map), with #54 (turn speed). This is the owner's "watch the map build the trip" direction.

**Then (Full app):**
- Transit (Cattn): 031 real Boston routing (Transitous) → 008 auto-watch + "when do I leave" → 010 bike + transit.
- Flights (DMFriends, after 022): 024 Fly screen → 011 door-to-door on sample fares; 019 real fares (Clovis, Cattn).
- 025 Settings (KrakenTheJaken, from Rad1ee).
- Web, low priority, up for grabs: 026 home → 027 results.
- Later: booking, Europe/Eurail, token streaming, push notifications, iOS-specific design.

---

## Status

| Plan | Title | Who | Pri | Effort | Depends on | Status |
|------|-------|-----|-----|--------|------------|--------|
| 009 | [Route map: mobile via Expo DOM](009-maps-package-contract.md) ([#13](https://github.com/Cattn/transit-agent/issues/13)) | KrakenTheJaken | P1 | M | 002 | PR [#76](https://github.com/Cattn/transit-agent/pull/76) open (pure + web #35, saved colors #65, DOM renderer #76). **MVP** |
| 021 | [Mobile results sheet](021-mobile-results.md) ([#40](https://github.com/Cattn/transit-agent/issues/40)) | DMFriends | P1 | M | 020 | DONE (#66) |
| 022 | [Mobile filters](022-mobile-filters.md) ([#46](https://github.com/Cattn/transit-agent/issues/46)) | DMFriends | P1 | L | 020, 021, 023 | TODO (refreshed 2026-11-14: Material components, open on the tapped field). **MVP** |
| 034 | [Keep the mobile agent chat for the app session](034-mobile-chat-session.md) ([#68](https://github.com/Cattn/transit-agent/issues/68)) | Cattn | P1 | S | 023 | DONE (#69) |
| 035 | [Agent chat matches frame 04 (best-option card, chip icons)](035-mobile-chat-best-option.md) ([#73](https://github.com/Cattn/transit-agent/issues/73)) | Cattn | P1 | S | 023, 021, 034, #72 | TODO (after #69 and #72 merge) |
| 035 | [Android MVP check against the real server](035-android-mvp-check.md) (tracked on [#17](https://github.com/Cattn/transit-agent/issues/17), no separate issue) | Cattn | P1 | S | 009, 022, 034 | TODO. **MVP milestone** |
| 029 | [Stream the agent's progress](029-agent-progress-stream.md) ([#55](https://github.com/Cattn/transit-agent/issues/55)) | Cattn | P1 | M | — | TODO (right after MVP) |
| 030 | [Animate the map while the agent builds a trip](030-map-build-animation.md) ([#56](https://github.com/Cattn/transit-agent/issues/56)) | KrakenTheJaken | P1 | M | 029 (live), 009 (Android) | TODO (right after MVP; pure layer + web demo can start any time) |
| — | Planner turn speed (median 16 s, timeout 40 s) ([#54](https://github.com/Cattn/transit-agent/issues/54)) | Cattn | P2 | S | — | TODO (with 029) |
| 031 | [Real Boston routing on Transitous](031-transitous-routing.md) ([#57](https://github.com/Cattn/transit-agent/issues/57)) | Cattn | P1 | M–L | 007 | TODO (after MVP) |
| 008 | [Auto-watch + "when do I leave"](008-watches-and-leave-by.md) ([#12](https://github.com/Cattn/transit-agent/issues/12)) | Cattn | P2 | M | 031, 013, 005 | TODO (008-Q3 details remain) |
| 010 | [Bike + transit](010-bike-transit-modemix.md) ([#14](https://github.com/Cattn/transit-agent/issues/14)) | Cattn | P2 | M | 031 | TODO (step 1 research can start) |
| 024 | [Mobile Fly](024-mobile-fly.md) ([#44](https://github.com/Cattn/transit-agent/issues/44)) | DMFriends | P2 | M | 020, 021 | TODO (after 022) |
| 011 | [Flight door-to-door comparator](011-flight-door-to-door.md) ([#15](https://github.com/Cattn/transit-agent/issues/15)) | DMFriends | P2 | L | 003, 014 | TODO (fixture steps executable) |
| 019 | [Real flight prices (Clovis)](019-clovis-fare-provider.md) ([#28](https://github.com/Cattn/transit-agent/issues/28)) | Cattn | P2 | L | 014 | TODO |
| 025 | [Mobile settings](025-mobile-settings.md) ([#41](https://github.com/Cattn/transit-agent/issues/41)) | KrakenTheJaken | P2 | L | 020 | TODO (reassigned from Rad1ee; after 030) |
| 026 | [Web map home](026-web-map-home.md) ([#42](https://github.com/Cattn/transit-agent/issues/42)) | Rad1ee or up for grabs | P3 | L | — | TODO (web, low priority) |
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
| 018 | [Mobile platform helpers](018-mobile-platform-setup.md) ([#26](https://github.com/Cattn/transit-agent/issues/26)) | DMFriends | P1 | M | — | DONE (#37). Trip links removed (Cattn, 2026-11-14) |
| 020 | [Mobile map home](020-mobile-map-home.md) ([#39](https://github.com/Cattn/transit-agent/issues/39)) | DMFriends | P1 | L | — | DONE (#60) |
| 023 | [Mobile agent chat](023-mobile-agent-chat.md) ([#43](https://github.com/Cattn/transit-agent/issues/43)) | Cattn | P1 | M | 020 | DONE (#67) |
| 028 | [`GET /api/places` from the built-in list](028-places-search-route.md) ([#49](https://github.com/Cattn/transit-agent/issues/49)) | Cattn | P1 | S | — | DONE (#50) |
| 032 | [Faster check and test](032-check-speed.md) ([#62](https://github.com/Cattn/transit-agent/issues/62)) | Cattn | P2 | S | — | DONE (#63) |
| 033 | [Real place search with Photon](033-photon-place-search.md) ([#53](https://github.com/Cattn/transit-agent/issues/53)) | Cattn | P1 | S–M | 028 | DONE (#64) |
| — | Live agent check: Hydrogen on real prompts ([#51](https://github.com/Cattn/transit-agent/issues/51)) | Cattn | P1 | S | — | DONE (results on #51; fixes in #52) |
| — | [UI direction](ui-direction.md) ([#16](https://github.com/Cattn/transit-agent/issues/16)) | Cattn (design), DMFriends | — | — | — | Reference; plans 020–027 win |
| — | [UI slices](ui-slices.md) | — | — | — | — | Superseded by plans 020–027 |

Open plans come first, in working order; DONE plans follow by number. Status values: TODO | IN PROGRESS | DONE | BLOCKED (reason) | REJECTED (reason). DONE plan files are kept as the record; do not re-execute them. P3 = low priority (web).

## Questions by person

Answer on the linked issue by question number. Each plan uses the proposed default until then.

- **@Cattn, decisions blocking work now:**
  1. ~~#66 route-color dot~~ **Decided:** no dot; result cards match the Figma exactly, and colors are for saved trips.
  2. ~~iOS in `npm run check`~~ **Decided:** keep exporting the iOS bundle as it is now.
  3. ~~018 Android location / deep-link checks~~ **Decided:** location works in Expo Go; trip links were unused and are removed.
- **@Cattn, design (taken over from @Rad1ee):** 021-Q2–Q4 ([#40](https://github.com/Cattn/transit-agent/issues/40)) · 023-Q3 ([#43](https://github.com/Cattn/transit-agent/issues/43)) · 024-Q1–Q4 ([#44](https://github.com/Cattn/transit-agent/issues/44)) · 025-Q1–Q5 ([#41](https://github.com/Cattn/transit-agent/issues/41)) · the 030 look ([#56](https://github.com/Cattn/transit-agent/issues/56)) · 026/027 when someone picks web up.
- **@Cattn, server:** 029-Q1–Q2 stream format and JSON fallback ([#55](https://github.com/Cattn/transit-agent/issues/55)) · 008-Q3 watch cadence ([#12](https://github.com/Cattn/transit-agent/issues/12)) · 019-Q1 Clovis completeness ([#28](https://github.com/Cattn/transit-agent/issues/28)) · 011-Q3 Europe stays backlog ([#15](https://github.com/Cattn/transit-agent/issues/15)).
- **@KrakenTheJaken:** P1 overlap chooser, P2 mode filtering ([#13](https://github.com/Cattn/transit-agent/issues/13)) · 030-Q1–Q3 ([#56](https://github.com/Cattn/transit-agent/issues/56)).
- **@DMFriends:** none blocking; may propose answers on #40 and #44.

## How to contribute

- **Assignments (reconciled 2026-11-14):** the Who column shows the assignee. @Rad1ee is inactive: his MVP filters plan (022) moved to DMFriends (via Cattn), Settings (025) to KrakenTheJaken, and his design questions to Cattn. He keeps web home (026) if he comes back; otherwise it's up for grabs. To help on someone else's issue, ask the assignee first.
- **With a coding agent:** pull `main`, then: *"Read `plans/NNN-name.md` and follow it step by step. Run every verification command, only change files listed under Scope, stop and tell me on any STOP condition, don't push."* Open a PR that says `Closes #N`.
- **Answer questions** on the issue by number (`020-Q2: search first`). The answer is recorded in that same plan; never open a second plan for the same screen.
- Use the strongest model for 007, 009, 010, 019.
- **Labels and milestones:** each issue has one `area: …` label (server, web, mobile, maps, shared), plus at most `help wanted` (up for grabs), `blocked` (waiting on another issue or decision), `research` (starts with a spike), or `bug`. Open questions live in each issue's help box, not a label. Milestones: **MVP** and **Full app**. #16 and #17 are `tracking`.
- **UI plans and issues need visual proof:** a UI PR shows each primary feature working, as screenshots or a video, ideally about 4 pieces of media (more is fine). Upload with `gh ... --attach` (gh 2.104+); the `ship-plan` skill has the Android-over-USB capture recipe. The PR template and the `review-pr` skill enforce it.
- **Android is Material 3 (@Cattn, [PR #60 review](https://github.com/Cattn/transit-agent/pull/60#pullrequestreview-5904509484)):** Expo UI Jetpack Compose (`@expo/ui/jetpack-compose`, real Material 3 components; chosen over `react-native-paper`), Material Symbols icons, theme colors, Roboto. The full list is in plan 020's Current state and applies to 021–025. iOS is parked in the backlog (see Backlog).
- **UI plans (020–027) are a first Figma pass** (`Transit-Agent-Design-Mockups`: `Android — Material 3`, `Web — Desktop`; `iOS — Liquid Glass` is kept as the reference for the parked iOS app). When a frame changes, update that plan's Current state. Web has only home and planning frames; no plan invents web settings, filters, or Fly.
- **Mock first:** UI plans default to the mock client. `VITE_API_MODE=server` (web) or `EXPO_PUBLIC_API_MODE=server` (mobile) switches to a real server. Only Cattn's server holds the Gemini key.

## Plan format

Every executable plan has: Status, Why this matters, Current state (with excerpts), Commands, Scope (in/out), Git workflow, Steps (each with **Verify**), Done criteria, STOP conditions, Maintenance notes. Issue-facing plans also carry a `<!-- help:start -->` box; **open questions live only in that box** (the bottom section points to it). Plan 009 is a continuation brief for an active owner and keeps a goal-first layout. Post-MVP plans 031, 008, 010, and 011 still lack the Commands and Git workflow sections; add them when the plan is picked up.

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
| D3 | LLM framework | **ADK TypeScript + Gemini**; main model Hydrogen (`gemini-4-hydrogen`), configured with `GEMINI_MODEL` on the server; kept after the live check (#51). Runs with `GEMINI_API_KEY` or Vertex AI + Application Default Credentials (location `global`, #52) | 006 |
| D4 | Identity | **Anonymous device ID** (`x-device-id`) | 003–005 |
| D5 | Agent reply shape | **JSON**, plus a progress stream (newline-delimited JSON over POST) in plan 029; token-by-token text later | 006, 029 |
| D6 | Database | **`node:sqlite` file** | 005 |
| D7 | Watch updates to clients | **Poll now**, push later (working default) | 008 |
| D8 | Basemap | **OpenFreeMap**; the same style URL on web and mobile (009-Q5 answered, 2026-11-14) | 009 |
| D9 | Map package | **`packages/maps`** with `/web`; mobile renders `/web` in an Expo DOM component (no `/native`) | 009 |
| D10 | Flight prices | **Sample fares for tests + adapted Clovis (all flights)** (plan 019) | 011, 019 |
| D11 | Flight scope | **US domestic + nearby airports** first; Europe later (working default) | 011 |
| D12 | Home mode control | **Transit / Fly** (@Cattn, 2026-11-14). Drive is no longer a tab: it is a Drive filter chip (`car` in `draft.modes`), off by default, under Transit and Fly, so a trip can include driving part of the way. `modeGroups.drive` stays in shared but the app stops using it. Built in plan 022 Step 4 | 011, 020, 022, 024–027, 035 |

Other settled answers (#17, #6): hosting on Cattn's laptop for the demo; agent auto-searches once from/to/time are known and can read but not edit saved trips; missed trips switch automatically; flights checked 3/2/1 days out then more often in the last 24 h (exact cadence open, 008-Q3); bikeshare dock pins and "bike saves X min" both approved; rideshare removed for now; separate transfer-risk and lateness controls; optional display time zone; USD only; no payment screen.

Transit defaults (Cattn, plan 007 research thread, 2026-11-14): one or two checks before two hours unless overridden, then ramp nearer departure; subway around 1 h/30/20/10 min with issue-driven adjustments; commuter rail broadly similar with some earlier checking. Include first morning returns and clearly show long waits/next-day dates. Exact early/final scheduling, intercity treatment and preference storage remain with 008-Q3.

Theme and route colors (Cattn on [#25](https://github.com/Cattn/transit-agent/issues/25#issuecomment-6877423429), 2026-11-14): dark + light with a Settings toggle ship now (017-Q3). Route colors are permanent per **saved** trip, not reassigned per screen (017-Q2, settles 009 P4's color policy). Clarified on PR #66: "routes" meant saved trips; search results get no color dots and follow the mockup exactly. Planned before the MVP: storage in 017 step 4, `assignRouteColors(ids, savedColors)` in 009 step 5, screens in 021 / 026 / 027.

iOS parked (Cattn, 2026-11-14): Android is the design target; iOS parts of plans live in each plan's Backlog: iOS section. iOS still runs (Cattn, 2026-11-14): Android-only Compose screens keep a plain fallback file so the app works on iOS without iOS-specific design.

Android-first MVP (Cattn, 2026-11-14): the MVP is checked on Android (plan 035); web (026, 027) is low priority. Design feedback comes from Cattn; @Rad1ee is inactive and his MVP work was reassigned.

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
- *A separate web MVP check* (2026-11-14): the MVP is Android (plan 035); plan 027 Step 3 is the web version, done when web is picked up.

## Reconcile log

- **2026-11-14:** D12: Home is Transit / Fly; Drive becomes a filter chip. Added to plan 022 (Step 4, PR #74 in review) instead of a new plan; notes in 011, 020, 024–027, 035 and ui-direction.

- **2026-11-14:** 022-Q1–Q4 answered by @Cattn on #46: full sheet, keep wording, search in the sheet; no car chip, Advanced limits collapsed, Agent mark on every agent-set field, no Budget control.

- **2026-11-14 at `3a55b10`:** 021 merged (#66). 022 → DMFriends, refreshed: Expo UI Compose components instead of RN `Switch` and the community slider, open on the tapped field (Home drops it today), footer from Home's `plan`. 024 after 022. 034 started in a worker thread. 009 notes that search results follow Figma frame 02 and only saved trips get distinct colors. 035 no longer waits on 021.

- **2026-11-14 at `db8b72c`:** Android-first MVP. New plan 035 (Android MVP check, tracked on #17 to avoid another issue) replaces 027 Step 3 as the milestone. Web 026/027 → P3, Full app. @Rad1ee inactive: 022 → Cattn, 025 → KrakenTheJaken, design questions (021–026, 030) → Cattn, 027 → up for grabs. 021 marked IN PROGRESS (PR #66). Status table reordered: open plans first, in working order. Answered questions removed from Questions by person (geocoding #53, 023-Q1–Q2, 009-Q5, 017-Q1). `ui-slices.md` marked superseded; `ui-direction.md` has no open questions. DONE plans spot-checked: files from 023 (`screens/chat`), 033/028 (`apps/server/src/places`) and 015 (`packages/client-react`) are on main.

- **2026-11-14:** Plan 028 re-check passed at `09b8a33` in #50 (COMMENT, not formal approval). Awaiting owner merge.
- **2026-11-14 at `1e8328a`:** 015 marked DONE (#47). 013/014/016/018 plan files updated to DONE. UI plans 020–027 refreshed: use merged hooks; web mounts the real `@transit/maps/web`; mock/server switch added; 027 gains the MVP end-to-end check. 017 rescoped to badge/mode colors (unblocked). 007/008/010 stale facts fixed (gazetteer and agent tools exist; obsolete done criterion removed). Duplicate open-question lists and repeated map-handoff appendices removed (009 is the single source). New plan 028: `/api/places` was called by the client but never served.
