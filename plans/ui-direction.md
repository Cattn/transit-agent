# UI direction (web + mobile)

**Type:** direction doc for the UI teammate, who is already building. It is *not* a step-by-step
plan. It covers what each screen needs, which data/API backs it, and the interaction rules that
keep the UI consistent with the server and agent design. Treat every item as a proposal. Push
back in review using the IDs (UI-1, UI-2, …).

**Issue**: https://github.com/Cattn/transit-agent/issues/16

> **iOS is parked (@Cattn, 2026-11-14).** Android is the design target; iOS stays functional through existing fallbacks, with design deferred ([plans/README.md](README.md#backlog-deliberately-unplanned)). "Mobile" in this doc means Android for now. iOS design notes here and in the Figma page `iOS — Liquid Glass` stay as the reference for later.

Written 2026-11-13 against commit `c9e33cc`. Sources: issue #4, the feature notes, and the two design threads.

---

<!-- help:start -->
## Who's on it & how to help

- **Status:** Living reference. The screen plans 020–027 are where UI work is specified; when this doc and a plan disagree, the plan wins.
- **Design feedback:** @Cattn (2026-11-14; @Rad1ee is inactive). Builders: @DMFriends (mobile screens), @KrakenTheJaken (map).
- **Up for grabs?** Not a step-by-step plan.

**Open questions:** none. The layout (map as home, mode slider, chat sheet on mobile, side panel on web) is settled; the slice format was replaced by plans 020–027.

<!-- help:end -->

## Navigation (UI-1)

**Decided on #16 (DMFriends):** the **map is the home page / dashboard**, and a **mode slider** switches between transit, drive and fly instead of tabs. **Changed 2026-11-14 (D12):** the slider is Transit / Fly; Drive is a filter chip that can be turned on under either.

| Screen | Shows | Backed by |
|---|---|---|
| **Map home** | Full map with saved / tracked trips drawn on it. Tracked trips also appear as cards (leave-by countdown, live vs scheduled) in a panel (web) or bottom sheet (mobile). Search box + filters to plan a new trip. | `listItineraries()` polled every 30–60 s while visible (plan 008 `watchStatus`); `planTrip()` for new searches |
| **Mode slider** (on the map home) | Transit (bus + bike) / Fly, with Drive as a filter chip (D12). Changes which routes are shown and searched; the Fly position also shows the airport comparison list (plan 011) | sets `draft.modes` from `modeGroups.transit` / `.fly`, with `car` only when the Drive chip is on; passes the same list to the map as `visibleModes` |
| **Settings** | Profile defaults (home/work, sliders, vehicles), time zone, device id, about | `getProfile()` / `putProfile()` (plan 005) |

**AI chat:** on **web, a permanent side panel** next to the map (decided on #16). On **mobile, a floating bubble** that opens a chat sheet.

The mode slider is a **filter over one trip draft**, not a separate data model. Moving it changes
`draft.modes`; everything else (origin, time, limits) carries over (decided on #6).

## The one rule: filters and agent edit the same draft (UI-2)

```
 sliders/filters ──applyDraftPatch(…,'user')──┐
                                              ├──► DraftState { draft, provenance } ──toTripRequest──► api.planTrip
 agent reply ─────applyDraftPatch(…,'agent')──┘
```

- Use `initialDraftState`, `applyDraftPatch`, `toTripRequest`, and `describePatch` from `@transit/shared` (plan 004). Don't create a parallel state shape.
- When the agent changes something, show it as a **chip on the filter it set** ("Agent: max walk 15 min ✎"). `provenance[field] === 'agent'` tells you which. Tapping the chip opens that filter. This is how users correct the agent's interpretation (design-thread requirement).
- The agent's `questions[]` render as quick-reply buttons when `options` is present.

## Filters (UI-3)

Plan 022 owns the layout: From/To, Depart/Arrive time, modes with optional Drive, separate arrival strictness and preference sliders, collapsed Advanced limits. No Budget control or lock icons. Filters and Agent edit the same draft with provenance. Default modes are walk/bus/rail; a saved profile may replace them. Display timezone defaults to origin unless selected.

## Results list (UI-4)

Each `Itinerary` row: `summary`, depart → arrive, duration, `cost.totalUsd` (show a "~" prefix when any cost line has `estimated: true`), and a risk badge (`risk.level`) with `risk.reasons` on expand.

- **Freshness is mandatory.** Mark realtime legs as live (`timeSource === 'realtime'`, with `delayMinutes`) and schedule-only legs as "scheduled". Show "updated Xs ago" from `source.fetchedAt`. The product's core premise is that bus schedules can't be trusted. Never let a scheduled time look live.
- `nearMisses` go in a separate "Almost works" section with their `violations` text.
- `warnings` (e.g. "otp unavailable") appear as a subtle banner.
- **Save** → `saveItinerary({ itinerary, request, watch: true })`. Saved trips appear on Home and on the map library.

## Map (UI-5) — owned by maps teammate, mounted by UI

- Mount `RouteMap` from `@transit/maps/web` (web) or, on mobile, plan 009's Expo DOM wrapper around it. Pass `itineraries`, `selectedItineraryId`, `onRouteSelect`, `visibleModes` (from the mode slider), `styleUrl`, and `padding` (so routes aren't hidden under panels).
- **The map is the saved-route library.** Saved trips are always drawn and search results are drawn on top. Tapping a route selects it and opens its detail. If `candidates.length > 1`, show a small chooser. *(The merged web map has its own overlap chooser and still reports `candidates`. Who owns the chooser is plan 009 decision P1.)*
- Web: map fills the screen with a ~400 px side panel (filters, results, and the permanent chat). Mobile: full-screen map with a bottom sheet (peek = summary, half = results, full = filters).
- Until plan 009 lands, render a placeholder list using `sampleItinerary` from `@transit/shared`.

## Home / tracked trips (UI-6)

Card per watched trip: label, big **"Leave in 6 min"** (from `watchStatus.leaveBy`), `watchStatus.message`, and a state color (`onTrack` / `leaveSoon` / `leaveNow` / `atRisk` / `missed`). On `missed`, the server automatically switches to the next valid trip when available ([roadmap answer](https://github.com/Cattn/transit-agent/issues/17#issuecomment-6873720245)); show the replacement/status message without requiring a confirmation tap. Until plan 008 lands, display the supplied state honestly rather than pretending auto-switching is active. Watch toggle → `updateItinerary(id, { watch })`.

## Settings / profiles (UI-7)

One profile per device (decision 005-Q1): home, work, default sliders/constraints, vehicles. Saved values become `initialDraftState(profile.defaults)` with provenance `'profile'`.

**Device identity (D4):** on first launch, `createDeviceId()` and persist it (web: `localStorage`; mobile: `expo-secure-store` or AsyncStorage). Pass it to `createApiClient(url, { deviceId })`.

## Platform notes (UI-8)

- **Android = Material 3 for real** (@Cattn, [PR #60 review](https://github.com/Cattn/transit-agent/pull/60#pullrequestreview-5904509484)): Expo UI Jetpack Compose (`@expo/ui/jetpack-compose`), Material Symbols icons, theme colors, Roboto, connected button group for modes, extended FAB for Ask agent, draggable sheet. Details in plan 020's Current state.
- **iOS is parked** (@Cattn, 2026-11-14). Each mobile plan keeps its iOS design in a "Backlog: iOS" section. Compose code still lives only in `.android.tsx` files, because `@expo/ui/jetpack-compose` crashes on iOS and the iOS export still runs in `npm run build:mobile`.

- **Mobile testing stays in Expo Go once maps land.** Plan 009 renders the web map in an Expo DOM component (decided 2026-11-14), so the map needs no dev client or EAS build.
- **Client env vars are public.** Only `VITE_API_URL` / `EXPO_PUBLIC_API_URL` and the basemap `styleUrl` key (if the provider issues browser-safe keys) belong in clients. The Gemini key never does.
- Keep `@transit/shared` framework-free. Hooks live in the merged `@transit/client-react` package.

## Current delivery boundary

UI slices are historical; do not execute them. Numbered plans and README own delivery. Completed screens stay DONE; continuity is 037, chat polish 035, Android progress wiring 029, Settings 025. Finish Android transit before flights; preserve functional iOS fallbacks while deferring iOS design.

## Map consumer notes

The web map is merged (`@transit/maps/web`, PR #35); the mobile map (the same web renderer in an Expo DOM component) is plan 009's remaining work. Open map behavior questions (overlap chooser P1, mode filtering P2, colors P4) and the color-sharing rule live once in `plans/009-maps-package-contract.md`. Do not restate them here.
