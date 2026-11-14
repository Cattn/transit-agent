# UI direction (web + mobile)

**Type:** direction doc for the UI teammate, who is already building. It is *not* a step-by-step
plan. It covers what each screen needs, which data/API backs it, and the interaction rules that
keep the UI consistent with the server and agent design. Treat every item as a proposal. Push
back in review using the IDs (UI-1, UI-2, …).

Written 2026-11-13 against commit `c9e33cc`. Sources: issue #4, the feature notes, and the two design threads.

---

## Navigation (UI-1)

Issue #4 lists: Home, "tabs for car, bus/bike, plane maps", a floating AI bubble, Settings, profiles, and an optional payment screen.

Proposed structure (mobile bottom tabs; web left rail + full-height map):

| Tab | Shows | Backed by |
|---|---|---|
| **Home** | Currently tracked trips with leave-by countdowns and live/scheduled status; "plan a trip" entry | `listItineraries()` polled every 30–60 s while visible (plan 008 `watchStatus`) |
| **Transit** (bus + bike) | Map + filters, `modes` = `modeGroups.transit` | `planTrip()` |
| **Drive** | Map + filters, `modes` = `modeGroups.drive` | `planTrip()` |
| **Fly** | Map + filters + airport comparison list, `modes` = `modeGroups.fly` | `planTrip()` (plan 011) |
| **Settings** | Profile defaults (home/work, sliders, vehicles), device id, about, (optional) payment plan | `getProfile()` / `putProfile()` (plan 005) |

The **AI bubble** floats over every tab and opens a chat sheet (mobile) or side panel (web).

Tabs are **filters over one trip draft**, not separate data models. Switching tabs changes
`draft.modes`. Everything else (origin, time, constraints) carries over. (Decision 004-Q2.)

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
- **"How strict?"** `lateTolerance` (3-way: *Must be on time* / *A little late is OK* / *Flexible*), optional hard deadline.
- **Sliders:** *Cheaper ↔ Comfier* (`comfortVsCost`), *Safe ↔ Tight transfers* (`transferRisk`), *Less ↔ More walking/biking* (`activeTravel`).
- **Advanced (collapsed):** max walk min, max bike min, max transfers, min transfer buffer, budget, max drive min, accessibility, own bike/car, car mpg.

Requirements (hard) vs preferences (soft) should look different. For example, use a lock icon on hard limits.

## Results list (UI-4)

Each `Itinerary` row: `summary`, depart → arrive, duration, `cost.totalUsd` (show a "~" prefix when any cost line has `estimated: true`), and a risk badge (`risk.level`) with `risk.reasons` on expand.

- **Freshness is mandatory.** Mark realtime legs as live (`timeSource === 'realtime'`, with `delayMinutes`) and schedule-only legs as "scheduled". Show "updated Xs ago" from `source.fetchedAt`. The product's core premise is that bus schedules can't be trusted. Never let a scheduled time look live.
- `nearMisses` go in a separate "Almost works" section with their `violations` text.
- `warnings` (e.g. "otp unavailable") appear as a subtle banner.
- **Save** → `saveItinerary({ itinerary, request, watch: true })`. Saved trips appear on Home and on the map library.

## Map (UI-5) — owned by maps teammate, mounted by UI

- Mount `RouteMap` from `@transit/maps/web` or `/native` (plan 009). Pass `itineraries`, `selectedItineraryId`, `onRouteSelect`, `visibleModes` (from the active tab), `styleUrl`, and `padding` (so routes aren't hidden under panels).
- **The map is the saved-route library.** Saved trips are always drawn and search results are drawn on top. Tapping a route selects it and opens its detail. If `candidates.length > 1`, show a small chooser.
- Web: map fills the screen with a ~400 px side panel (filters/results/chat). Mobile: full-screen map with a bottom sheet (peek = summary, half = results, full = filters).
- Until plan 009 lands, render a placeholder list using `sampleItinerary` from `@transit/shared`.

## Home / tracked trips (UI-6)

Card per watched trip: label, big **"Leave in 6 min"** (from `watchStatus.leaveBy`), `watchStatus.message`, and a state color (`onTrack` / `leaveSoon` / `leaveNow` / `atRisk` / `missed`). On `missed`, show the suggested next option with a "switch" action. Watch toggle → `updateItinerary(id, { watch })`.

## Settings / profiles (UI-7)

One profile per device (decision 005-Q1): home, work, default sliders/constraints, vehicles. Saved values become `initialDraftState(profile.defaults)` with provenance `'profile'`.

**Device identity (D4):** on first launch, `createDeviceId()` and persist it (web: `localStorage`; mobile: `expo-secure-store` or AsyncStorage). Pass it to `createApiClient(url, { deviceId })`.

## Payment plan screen (UI-8, optional — D12)

Static mock for the Capital One prize track: plan tiers, no real payment fields. Don't collect card numbers, even fake ones. Use clearly fake placeholder UI.

## Platform notes (UI-9)

- **Mobile testing changes once maps land.** MapLibre needs the EAS dev client (`npm run build:android`, then `npm run dev:client` in `apps/mobile`). Expo Go stops working.
- **Client env vars are public.** Only `VITE_API_URL` / `EXPO_PUBLIC_API_URL` and the basemap `styleUrl` key (if the provider issues browser-safe keys) belong in clients. The Gemini key never does.
- Keep `@transit/shared` framework-free. Hooks such as `useTripDraft` and `useSavedItineraries` live in each app (or a future `packages/ui-hooks` if duplication hurts).

## What the UI can build today, before the server lands

1. Navigation shell + tabs + AI bubble placeholder.
2. Filters bound to `DraftState` (plan 004's reducer is pure, so it works offline).
3. Results list + detail rendering from `sampleItinerary`.
4. Home cards from a hand-written `SavedItinerary` mock with each `watchStatus.state`.

## Open questions for the UI teammate

- UI-Q1: Tabs as proposed (Home / Transit / Drive / Fly / Settings), or is Home merged into the map?
- UI-Q2: Is one "Risk" slider enough (setting both `transferRisk` and `lateTolerance`), or are both exposed?
- UI-Q3: Should the chat bubble be available on web, or does web use a permanent side panel?
