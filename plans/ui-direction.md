# UI direction (web + mobile)

**Type:** direction doc for the UI teammate, who is already building. It is *not* a step-by-step
plan. It covers what each screen needs, which data/API backs it, and the interaction rules that
keep the UI consistent with the server and agent design. Treat every item as a proposal. Push
back in review using the IDs (UI-1, UI-2, …).

**Issue**: https://github.com/Cattn/transit-agent/issues/16

> **iOS is parked (@Cattn, 2026-11-14).** The mobile app is Android-only until iOS comes back out of the backlog ([plans/README.md](README.md#backlog-deliberately-unplanned)). "Mobile" in this doc means Android for now. iOS design notes here and in the Figma page `iOS — Liquid Glass` stay as the reference for later.

Written 2026-11-13 against commit `c9e33cc`. Sources: issue #4, the feature notes, and the two design threads.

---

<!-- help:start -->
## Who's on it & how to help

- **Status:** 🔄 **In progress** by the UI team.
- **Owner:** @Rad1ee @DMFriends
- **Up for grabs?** Owned by the UI team. Not a step-by-step plan.

**Open questions** (answer by number in a comment on #16):

1. @Rad1ee: anything you'd change in the layout DMFriends chose (map as home, mode slider, chat side panel on web)?
2. @Rad1ee @DMFriends: is the slice format in `plans/ui-slices.md` useful? (See the comment below for what it is.)

<!-- help:end -->

## Navigation (UI-1)

**Decided on #16 (DMFriends):** the **map is the home page / dashboard**, and a **mode slider** switches between transit, drive and fly instead of tabs.

| Screen | Shows | Backed by |
|---|---|---|
| **Map home** | Full map with saved / tracked trips drawn on it. Tracked trips also appear as cards (leave-by countdown, live vs scheduled) in a panel (web) or bottom sheet (mobile). Search box + filters to plan a new trip. | `listItineraries()` polled every 30–60 s while visible (plan 008 `watchStatus`); `planTrip()` for new searches |
| **Mode slider** (on the map home) | Transit (bus + bike) / Drive / Fly. Changes which routes are shown and searched; the Fly position also shows the airport comparison list (plan 011) | sets `draft.modes` from `modeGroups.transit` / `.drive` / `.fly`; passes the same list to the map as `visibleModes` |
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

Map 1:1 to `TripDraft` (plan 002). Suggested grouping:

- **Always visible:** From, To (place search → `searchPlaces()`, plan 007), Depart at / Arrive by, mode toggles.
- **"How strict?"** `lateTolerance` (3-way: *Must be on time* / *A little late is OK* / *Flexible*), optional hard deadline. This stays a **separate control** from the tight-transfers slider (decided on #6).
- **Sliders:** *Cheaper ↔ Comfier* (`comfortVsCost`), *Safe ↔ Tight transfers* (`transferRisk`), *Less ↔ More walking/biking* (`activeTravel`).
- **Advanced (collapsed):** max walk min, max bike min, max transfers, min transfer buffer, budget, max drive min, accessibility, own bike/car, car mpg.

Requirements (hard) vs preferences (soft) should look different. For example, use a lock icon on hard limits.

- **Default modes:** a fresh trip starts with walk + bus + train switched on (car, bike, flight off). A saved profile replaces that.
- **Time zone:** times show in the trip's starting-point time zone by default. Users can pick another (`draft.timeZone`, e.g. in Settings or on the trip).
- **More filters later** are expected (#6). They're added as new optional fields, so nothing already built breaks.

## Results list (UI-4)

Each `Itinerary` row: `summary`, depart → arrive, duration, `cost.totalUsd` (show a "~" prefix when any cost line has `estimated: true`), and a risk badge (`risk.level`) with `risk.reasons` on expand.

- **Freshness is mandatory.** Mark realtime legs as live (`timeSource === 'realtime'`, with `delayMinutes`) and schedule-only legs as "scheduled". Show "updated Xs ago" from `source.fetchedAt`. The product's core premise is that bus schedules can't be trusted. Never let a scheduled time look live.
- `nearMisses` go in a separate "Almost works" section with their `violations` text.
- `warnings` (e.g. "otp unavailable") appear as a subtle banner.
- **Save** → `saveItinerary({ itinerary, request, watch: true })`. Saved trips appear on Home and on the map library.

## Map (UI-5) — owned by maps teammate, mounted by UI

- Mount `RouteMap` from `@transit/maps/web` or `/native` (plan 009). Pass `itineraries`, `selectedItineraryId`, `onRouteSelect`, `visibleModes` (from the mode slider), `styleUrl`, and `padding` (so routes aren't hidden under panels).
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

- **Mobile testing changes once maps land.** MapLibre needs the EAS dev client (`npm run build:android`, then `npm run dev:client` in `apps/mobile`). Expo Go stops working.
- **Client env vars are public.** Only `VITE_API_URL` / `EXPO_PUBLIC_API_URL` and the basemap `styleUrl` key (if the provider issues browser-safe keys) belong in clients. The Gemini key never does.
- Keep `@transit/shared` framework-free. Hooks such as `useTripDraft` and `useSavedItineraries` live in each app (or a future `packages/ui-hooks` if duplication hurts).

## Building blocks and slices (added 2026-11-14)

[`ui-slices.md`](ui-slices.md) splits the UI into 8 pieces that can be built in parallel, each
with "must have" checks and the data it uses. Shared non-visual helpers now have their own plans:
mock client (012), React hooks (015), display text (016), colors (017), mobile plumbing (018).
Use them instead of writing the same logic in each app.

## What the UI can build today, before the server lands

1. Map-home shell + mode slider + chat side panel (web) / bubble (mobile) placeholder.
2. Filters bound to `DraftState` (plan 004's reducer is pure, so it works offline).
3. Results list + detail rendering from `sampleItinerary`.
4. Home cards from a hand-written `SavedItinerary` mock with each `watchStatus.state`.

## Open questions for the UI teammate

(Resolved on #6: risk is two separate controls; users can choose the time zone; default modes explained above. Resolved on #16: map is home, mode slider instead of tabs, permanent chat side panel on web.)


## Map consumer notes

The web map is merged (`@transit/maps/web`, PR #35); the native map is plan 009's remaining work. Open map behavior questions (overlap chooser P1, mode filtering P2, colors P4, style 009-Q5) and the color-sharing rule live once in `plans/009-maps-package-contract.md`. Do not restate them here.
