# UI slices (superseded)

> **Superseded (2026-11-14):** the screen plans 020–027 replaced these slices. Use the plans; this file is kept as the record of how the UI was first split.

> **iOS is parked (@Cattn, 2026-11-14).** "Mobile" in these slices means Android until iOS comes back out of the backlog ([plans/README.md](README.md#backlog-deliberately-unplanned)). iOS design stays in [`ui-direction.md`](ui-direction.md), the Figma page `iOS — Liquid Glass`, and each mobile plan's "Backlog: iOS" section.

**What this is:** the UI split into 8 pieces that different people (or the same person on web and
on mobile) can build at the same time. Each card says **what** the piece must do and **what data it
uses**, not how it should look. Layout, components, styling and libraries stay the UI team's call.

**How to use a card:** comment "taking slice N (web)" or "(mobile)" on #16. Build against the mock
client (plan 012) so you don't wait for the server. A slice is done when every box under "Must
have" is true with the mock **and** with the real server once it's up.

**Shared building blocks** (so slices don't each reinvent them):

| Need | Use | Plan |
|---|---|---|
| Data without a server | `createMockApiClient()`, switch scenarios: `normal`, `empty`, `nearMissOnly`, `offline` | 012 |
| State + data hooks | `useTripDraft`, `usePlanTrip`, `useSavedItineraries`, `useAgentChat`, `usePlaceSearch`, `useNow` | 015 |
| Text (times, costs, "live"/"scheduled", risk) | `formatClock`, `formatCost`, `legFreshness`, `riskBadge`, … | 016 |
| Leave-by countdown | `leaveByLabel`, `watchStatus` on saved trips | 013 |
| Colors that match the map | `routeColor(id)`, `toneColors`, `freshnessColors` | 017 |
| Phone-only helpers | location, device ID storage, foreground, trip links | 018 |
| The map itself | `<RouteMap>` from `@transit/maps` | 009 (maps team) |

Until a building block lands, use a stub with the same name and swap it later. The interfaces are
written in each plan.

Rules that apply to every slice are in [`ui-direction.md`](ui-direction.md) (UI-2 one shared
draft, UI-4 freshness is mandatory).

---

## Slice 1: App shell (map home)

- **Goal:** the frame every other slice plugs into. Map fills the screen; web has a ~400 px side panel (filters / results / chat); mobile has a bottom sheet (peek / half / full) and a chat bubble. Mode slider: transit / drive / fly.
- **Data:** `useTripDraft()` lives here and is passed down. Mode slider calls `apply({ modes: [...modeGroups[group]] }, 'user')`.
- **Must have:**
  - [ ] Map area renders `<RouteMap>` or, until plan 009 lands, a placeholder showing `sampleItinerary` as a list.
  - [ ] Panel / sheet has slots for slices 2, 3, 4, 5 (empty placeholders are fine).
  - [ ] Moving the mode slider keeps from, to and time (decided on #16).
  - [ ] `padding` is passed to the map so routes aren't hidden under the panel or sheet.
  - [ ] Works at phone width on web too (the panel becomes a sheet or a drawer).
- **Unblocked by:** nothing. Start now.

## Slice 2: Filters with "agent set this" chips

- **Goal:** edit every `TripDraft` field; show which ones the agent filled in so the user can correct them.
- **Data:** `useTripDraft` (`state.draft`, `state.provenance`, `apply`). Field list and grouping: UI-3 in `ui-direction.md`.
- **Must have:**
  - [ ] Every field in UI-3 is editable; edits call `apply(patch, 'user')`.
  - [ ] Fields where `provenance[path] === 'agent'` show a chip ("Agent: max walk 15 min ✎"); editing the field removes the chip.
  - [ ] Hard limits (constraints) look different from preferences (sliders), e.g. a lock icon.
  - [ ] "Must be on time / a little late is OK / flexible" and the "tight transfers" slider are separate controls (decided on #6).
  - [ ] Clearing an optional limit sends `null` (removes it), not `0`.
- **Unblocked by:** plan 004 for `applyDraftPatch` (or a local stub).

## Slice 3: Results list and trip detail

- **Goal:** show the options for the current search; tap one to see its legs and save it.
- **Data:** `usePlanTrip` (or `useAgentChat().lastPlan`), formatters (016), `routeColor` (017).
- **Must have:**
  - [ ] Row: summary, time range, duration, cost (with `~` when estimated), risk badge, color swatch matching the map line (if plan 009 proposal P4 is accepted, reuse the full-trip-set `assignRouteColors` assignment passed to `RouteMap.routeColors`).
  - [ ] **Every transit time shows whether it's live or scheduled** (`legFreshness`). A scheduled time never looks live.
  - [ ] "Updated 40 s ago" from `source.fetchedAt`.
  - [ ] Near-misses in a separate "Almost works" section with their `violations` text.
  - [ ] `warnings` appear as a quiet banner.
  - [ ] Tapping a row selects it on the map (`selectedItineraryId`) and vice versa (`onRouteSelect`).
  - [ ] Detail view lists legs; Save calls `saveItinerary({ itinerary, request, watch: true })`.
  - [ ] Loading, empty, error and offline states (try each mock scenario).
- **Unblocked by:** mock client (012).

## Slice 4: Chat (web side panel / mobile bubble)

- **Goal:** type a request in plain language; the agent fills in filters and may ask a question.
- **Data:** `useAgentChat(trip.state, trip.apply)`.
- **Must have:**
  - [ ] Messages list, input, sending state.
  - [ ] Agent `questions` with `options` show as tap-to-answer buttons.
  - [ ] After a reply, the filters it changed show agent chips (slice 2) and the results (slice 3) update from `lastPlan`.
  - [ ] Web: permanent side panel. Mobile: floating bubble opening a sheet (decided on #16).
  - [ ] Clear error message when the agent is unavailable (503 until Gemini is set up).
- **Unblocked by:** mock client (012). The mock agent understands e.g. "cheap, walk at most 10 min, to Harvard".

## Slice 5: Tracked trips (home cards)

- **Goal:** "current travel plans": saved trips with a live leave-by countdown.
- **Data:** `useSavedItineraries({ enabled: isForeground })`, `useNow()`, `leaveByLabel`, `watchStateBadge`.
- **Must have:**
  - [ ] Card: label, big countdown ("Leave in 6 min"), `watchStatus.message`, state badge.
  - [ ] Countdown ticks between polls (via `useNow`); polling pauses in the background.
  - [ ] Shows whether the times are live (`usedRealtime`).
  - [ ] When plan 008 provides an automatic replacement after a missed trip, show the updated trip and explanation; no confirmation tap ([roadmap answer](https://github.com/Cattn/transit-agent/issues/17#issuecomment-6873720245)). Until then, do not claim automatic switching is active.
  - [ ] Watch on/off toggle, rename, delete.
  - [ ] Saved trips are drawn on the map in their colors (`routeColor`).
- **Unblocked by:** mock client (012) seeds two saved trips; countdowns need plan 013.

## Slice 6: Settings and profile

- **Goal:** set home, work, default sliders and limits, vehicles (own bike / car, car mpg), time zone.
- **Data:** `getProfile` / `putProfile` (plan 005), `useDeviceId`.
- **Must have:**
  - [ ] Saved defaults become the starting draft for new trips (`initialDraftState(profile.defaults)`, provenance `'profile'`).
  - [ ] Time zone picker (decided on #6).
  - [ ] Shows the device ID (small, for debugging) and an "about" line.
  - [ ] One profile per device for now (005-Q1).
- **Unblocked by:** plan 005 for saving. The form can be built now against local state.

## Slice 7: Place search

- **Goal:** type "harv" → pick Harvard Square; "use my location" on mobile.
- **Data:** `usePlaceSearch(query)`, `getCurrentPlace()` (018, mobile).
- **Must have:**
  - [ ] Debounced suggestions; nothing sent under 3 characters.
  - [ ] Choosing a place calls `apply({ origin | destination }, 'user')`.
  - [ ] "Use my location" handles a denied permission with a message, not a crash.
  - [ ] Optional: pick a point by tapping the map (needs the maps team's `onMapPress`, if they add it).
- **Unblocked by:** mock client (012) has ~15 Boston places. Real geocoding comes with plan 007.

## Slice 8: Fly mode: airport comparison

- **Goal:** when the mode slider is on Fly, compare leaving from different airports door-to-door ("PVD is $57 cheaper including gas and parking, but 40 min longer").
- **Data:** `planTrip` results with `flight` legs (plan 011); cost lines (`Gas`, `Parking`, `Fare`).
- **Must have:**
  - [ ] One row per origin airport: total door-to-door cost, total time, and the breakdown on expand.
  - [ ] Layover risk shown with `riskBadge` (a 45 min layover is not "Safe").
  - [ ] Clearly labels sample fares as samples until a real fare source exists (D10).
- **Unblocked by:** design and layout can start now; real data needs plans 014 + 011.

---

## Open question for the UI team (on #16)

Is this format useful, or would you rather have (a) full step-by-step plans like the server ones,
or (b) nothing this detailed (just `ui-direction.md`)? Change, merge or split any slice.

## Map consumer notes

The web map is merged (`@transit/maps/web`, PR #35); the mobile map (the same web renderer in an Expo DOM component) is plan 009's remaining work. Open map behavior questions (overlap chooser P1, mode filtering P2, colors P4) and the color-sharing rule live once in `plans/009-maps-package-contract.md`. Do not restate them here.
