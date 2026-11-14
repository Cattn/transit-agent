# Plan 030: Animate the map while the agent builds a trip

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If a STOP condition occurs, stop and report. Do
> not improvise. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 043cbe6..HEAD -- packages/maps/src`
> If this prints anything (for example plan 009's touch-sized hit area), compare Current state with the live code before editing.

## Status

- **Priority**: P1 (right after the MVP check)
- **Effort**: M (web renderer only; mobile gets it through plan 009's DOM map)
- **Risk**: MED (animation performance; keeping the map's existing selection/fit behavior intact)
- **Depends on**: none to start the pure layer and the web renderer (they use `@transit/maps/samples` and a scripted demo). Live use needs plan 029's `progress` state. Mobile needs plan 009's DOM map (`@transit/maps/web` in an Expo `'use dom'` component), which runs this same web renderer on Android.
- **Category**: direction
- **Planned at**: commit `043cbe6`, 2026-11-14
- **Issue**: https://github.com/Cattn/transit-agent/issues/56

<!-- help:start -->
## Who's on it & how to help

- **Owner:** @KrakenTheJaken (maps)
- **Up for grabs?** No. Talk to @KrakenTheJaken before starting related work.
- **Waiting on:** nothing for the pure layer and web demo. Plan 029 (@Cattn) provides the live events.
- **Order for Kraken:** 009 DOM map → 027 web results → this plan (web renderer only; mobile gets it through the DOM map).

**Open questions** (answer by number in a comment on #56) — **@KrakenTheJaken answers these; @Rad1ee reviews the look.**

- 030-Q1: total time to draw all routes once they arrive? *(proposed: about 1.2 s; each route takes 600 ms, starting 150 ms apart)*
- 030-Q2: while searching, show a moving dashed line from origin to destination? *(proposed: yes; it disappears when real routes start drawing)*
- 030-Q3: show `find_place` candidate pins (several "Union Square" results) before the agent picks one? *(proposed: yes, small and faded; they disappear once origin and destination are set)*

<!-- help:end -->

## Why this matters

The owner's direction: while the AI drafts a trip, the map should show it being built in real time. Plan 029 reports each agent step as it happens (places found, origin/destination set, searching, routes ready). This plan turns those steps into motion on the map: pins drop in, the camera moves to the trip, a "searching" line runs between the two places, and the found routes draw themselves leg by leg. It also makes a 15-second agent turn feel alive instead of frozen. When the agent is not working, the map behaves exactly as it does today.

## Current state

- `packages/maps/src/contract.ts` — `RouteMapProps` (excerpt):
  ```ts
  export interface RouteMapProps {
    itineraries: Itinerary[];
    selectedItineraryId?: string;
    onRouteSelect: (itineraryId: string, candidates: string[]) => void;
    visibleModes?: readonly TravelMode[];
    styleUrl: string;
    userLocation?: LngLat;
    fitKey?: string | number;
    padding?: { top: number; right: number; bottom: number; left: number };
    routeColors?: ReadonlyMap<string, string>;
  }
  ```
  Contract changes are announced on #13 first.
- `packages/maps/src/web/RouteMap.tsx` — builds `lines = itinerariesToFeatures(...)` and `points = itineraryPoints(...)` with `useMemo`, renders them into `<Source id={ROUTE_SOURCE_ID}>` and `<Source id={POINT_SOURCE_ID}>` with layers from `routeLayers()`. The camera fits with `fitBounds(bounds, { padding, maxZoom: 16, duration: 600 })` only when `fitKey` changes, never on selection.
- `packages/maps/src/to-geojson.ts` — pure conversion; every leg is a LineString feature with `itineraryId`, `color`, `dash`, `lane`, `direction`.
- `packages/maps/src/samples.ts` — commute and flight sample itineraries; `demo/App.tsx` is the demo page (`npm run demo:maps`).
- Plan 029 (in progress, @Cattn) adds to `@transit/shared`:
  ```ts
  type AgentProgress = {
    phase: 'idle' | 'thinking' | 'locating' | 'searching' | 'routes' | 'done' | 'error';
    candidates: Place[]; origin?: Place; destination?: Place; plan?: PlanResponse;
  };
  ```
  and `useAgentChat(...).progress`. **Do not import it into the maps package.** The map takes its own small prop (Step 1), and the app maps one to the other.
- Conventions: coordinates are `[lng, lat]`; the pure entry imports no React or MapLibre; tests are Vitest (`to-geojson.test.ts` is the pattern).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Maps tests | `npm run test:unit -w @transit/maps` | all pass |
| Maps typecheck (incl. demo) | `npm run typecheck -w @transit/maps` | exit 0 |
| Demo | `npm run demo:maps` → http://localhost:5180 | page loads |
| Full | `npm test` | exit 0 |

## Scope

**In scope:** `packages/maps/src/contract.ts` (one optional prop), `packages/maps/src/build-preview.ts` (create), `packages/maps/src/build-preview.test.ts` (create), `packages/maps/src/web/RouteMap.tsx`, `packages/maps/src/index.ts`, `packages/maps/demo/*` (a scripted "agent building" scenario), `packages/maps/README.md`. No native files: mobile shows the web renderer through plan 009's DOM map.
**Out of scope:** `packages/shared/**` and `packages/client-react/**` (plan 029), app screens (027 and 023 wire it in), server code, `line-gradient` styling (incompatible with the dashed walk/bike/flight lines).

## Git workflow

Branch `plan/030-map-build-animation`. Commit per step, e.g. `maps: add build preview prop and line slicing (plan 030 step 1)`. Do not push unless told.

## Steps

### Step 1: Prop + pure helpers

Add to `RouteMapProps`:
```ts
/** While the agent is building a trip. Omit (or phase 'idle') for normal behavior. */
buildPreview?: {
  phase: 'idle' | 'locating' | 'searching' | 'drawing';
  origin?: LngLat;
  destination?: LngLat;
  candidates?: LngLat[];
};
```
In `build-preview.ts` (pure, no React or MapLibre):
- `sliceLine(coords, fraction)` → the first `fraction` (0–1) of a LineString by length, interpolating the last point.
- `revealFeatures(lines, startedAt, now, { perRouteMs = 600, staggerMs = 150 })` → a copy of the route FeatureCollection where each itinerary's legs are cut with `sliceLine` in leg order, itineraries staggered in their input order. Returns `{ data, finished }`.
- `previewFeatures(buildPreview, now)` → Points for candidates/origin/destination, plus, in phase `searching`, a straight "searching" LineString origin → destination with a `dashOffset` property that cycles with `now`.

Tests: `sliceLine` at 0, 0.5, 1, and on a 3-point line; `revealFeatures` reaches `finished` at `staggerMs * (n - 1) + perRouteMs`; previewFeatures has no searching line outside phase `searching`.

**Verify**: `npm run test:unit -w @transit/maps` → all pass

### Step 2: Web renderer

In `web/RouteMap.tsx`:
- **Phases `locating` / `searching`:** render `previewFeatures` in a new source drawn above the routes. Candidates are small, faded circles; origin and destination use the existing start/end point styling. The searching line is dashed and animated by `requestAnimationFrame`, updating only that small source.
- **Camera:** when origin and destination are first both known (or either changes), `fitBounds` to those two points with `padding` and `duration: 800`. Never move the camera on selection, as today.
- **Drawing:** when `itineraries` change while `buildPreview.phase === 'drawing'`, run `revealFeatures` on each animation frame until `finished`, then hand the normal `lines` data back. After the reveal, fit to the routes once (the same as a `fitKey` change).
- **Reduced motion:** if `matchMedia('(prefers-reduced-motion: reduce)').matches`, skip every animation and show the final state.
- **Idle / omitted:** behaves exactly as before. Clicking, the picker, colors, and `fitKey` are unchanged.

**Verify**: `npm run typecheck -w @transit/maps` → exit 0

### Step 3: Demo scenario

Add an "Agent building" scenario to `demo/App.tsx`: a timer steps `buildPreview` through `locating` (two candidate pins) → `searching` (origin MIT, destination South Station) → `drawing` with `commuteOptions`, about 1 s per step, with a Replay button.

**Verify**: `npm run demo:maps`, open http://localhost:5180, choose "Agent building": pins appear, the camera moves to MIT–South Station, the dashed line moves, then routes draw in one after another. Clicking a route afterwards still selects it.

### Step 4: Handoff notes

In `packages/maps/README.md`, add a short "Animating while the agent works" section with this mapping, which apps copy:

| `useAgentChat().progress.phase` (plan 029) | `buildPreview` |
|---|---|
| `thinking`, `locating` | `{ phase: 'locating', candidates, origin?, destination? }` (coordinates of the Places) |
| `searching` | `{ phase: 'searching', origin, destination }` |
| `routes`, `done` (with a plan) | `{ phase: 'drawing' }` and `itineraries = progress.plan.itineraries` |
| `idle`, `error` | omit |

**Verify**: `npm test` → exit 0

### Step 5 (after plan 009's DOM map is on main): check on Android

No mobile code: the DOM map runs this web renderer, and `buildPreview` is plain JSON, so it crosses the DOM boundary as is. With a temporary consumer (not committed) passing the Step 3 script to the mobile `RouteMap`, check the draw-in in Expo Go on an Android phone. If it stutters on a mid-range Android device, fall back in the web renderer to drawing one whole leg at a time (no partial legs), and say so in the PR.

**Verify**: in Expo Go on Android, the demo trip draws in. Record the device and result in the PR. iOS is in the backlog.

## Done criteria

- [ ] `npm test` exits 0; new `build-preview` tests pass
- [ ] Demo "Agent building" scenario plays as described in Step 3
- [ ] Without `buildPreview`, existing maps tests and the demo's other scenarios behave exactly as before
- [ ] README mapping table added
- [ ] Only in-scope files changed

## STOP conditions

- Updating the route source every frame drops the demo below ~30 fps on a normal laptop. Report it before trying another technique.
- The animation needs the map to fetch data or own selection. That breaks the map's contract; report it.
- Plan 029's progress shape differs from the excerpt in Current state. Adjust only the README mapping, not the prop.

## Maintenance notes

- Apps wire it in: plan 027 (web results, @KrakenTheJaken) and plan 023 (mobile chat, @Cattn) pass `buildPreview` built from `useAgentChat().progress`.
- Saved trips already on the map are not re-animated; only the new search results draw in.
- Real routing (plan 007) changes only the geometry, not this animation.
- The web renderer is also the mobile map (plan 009's Expo DOM component), so this animation and any later change to it show up on Android too.

## Backlog: iOS

iOS is parked in the backlog (@Cattn, 2026-11-14): the mobile app is Android-only until it comes back out. Nothing here is scheduled.

- When iOS is picked up, check the draw-in in Expo Go on an iPhone (plan 009's DOM map already runs there).
