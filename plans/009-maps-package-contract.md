# Plan 009: Create `packages/maps` with a shared `RouteMap` contract, pure GeoJSON/style layer, and thin web/native renderers

> **Executor instructions**: Steps 1–5 (package, contract, pure layer, tests) are fully specified.
> Steps 6–7 (renderers) are **owned by the maps teammate**. The executor implements them only if the
> plan owner says so; otherwise stop after step 5 and hand off. Honor STOP conditions; update the status row.
>
> **Drift check (run first)**: `git diff --stat c9e33cc..HEAD -- packages apps/web/package.json apps/mobile/package.json apps/mobile/app.json`
> If a `packages/maps` folder already exists (maps team started), STOP and reconcile with its owner. Don't overwrite.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (native module → Expo Go no longer works for mobile testing)
- **Depends on**: plans/002-shared-domain-contract.md (`Itinerary`, `Leg`, `sampleItinerary`)
- **Category**: direction
- **Decisions**: D8 tile provider = **OpenFreeMap** (decided by @KrakenTheJaken, [#13](https://github.com/Cattn/transit-agent/issues/13#issuecomment-6871834941)); still hidden behind the `styleUrl` prop. Package is **pre-built** with `tsc` to `dist` (009-Q4, decided). D9 (package location) still defaults to `packages/maps`. **Still open:** whether one style URL works on both web and mobile (009-Q5).
- **Planned at**: commit `c9e33cc`, 2026-11-13
- **Issue**: https://github.com/Cattn/transit-agent/issues/13

<!-- help:start -->
## Who's on it & how to help

- **Status:** 🟢 **Shared logic is up for grabs now.** Map drawing (web + mobile) is @KrakenTheJaken's.
- **Owner:** @KrakenTheJaken (map drawing). Shared logic (steps 1–5): anyone.
- **Up for grabs?** Steps 1–5 (colors, line styles, route data conversion, tests) need no map experience and suit a coding agent. Steps 6–7 (the actual maps) are KrakenTheJaken's.

**Open questions** (answer by number in a comment on #13):

1. @KrakenTheJaken: does one OpenFreeMap style URL work on both web and mobile, or does each platform need its own?

*Decided:* tiles from **OpenFreeMap**; the package is **pre-built** (`tsc` to `dist`).

**How to help**
- **Take it:** comment "taking this" and assign yourself, so two people don't build the same thing.
- **With a coding agent** (Claude Code, Codex, Cursor, ...): pull `main`, then tell your agent:
  > Read `plans/009-maps-package-contract.md` and follow it step by step. Run every verification command and check the output matches. Only change files listed under Scope. If a STOP condition happens, stop and tell me instead of working around it. Don't push. When done, show me the diff and the check results.

  Review what it did, then open a PR that says `Closes #13`.
- **Just feedback:** answer the open questions above by number in a comment.

<!-- help:end -->

## Why this matters

From the map-architecture thread: *"the map is the user's library/saved routes … each route like
Google Maps' blue line, but a different color per route … re-opened by clicking the visual route
on the map."* The chosen stack is **MapLibre** on both platforms: `react-map-gl` with MapLibre GL
JS on web, and `@maplibre/maplibre-react-native` on iOS/Android. The SDKs differ, so the
shared value is (1) **one props contract**, (2) **one pure data layer** (itineraries → GeoJSON
features with color/dash/selection properties, bounds, overlap handling), and (3) **one set of
MapLibre layer style definitions**. Each renderer is then a thin adapter of about 100 lines.
Map interactions stay identical across platforms, and the pure layer is unit-testable without a
GPU.

## Current state

- No `packages/maps`. Workspaces glob `packages/*` (root `package.json`) picks it up automatically.
- `packages/shared` pattern to copy: `package.json` with `"type": "module"`, `exports` → `dist`, `tsc` build, NodeNext. Read `packages/shared/package.json` and `tsconfig.json`.
- `apps/mobile/package.json` `start` script is `expo start --go` (Expo Go). MapLibre RN **cannot run in Expo Go**. It needs the dev client: `npm run build:android` (EAS development profile) then `npm run dev:client`, both already defined in `apps/mobile/package.json`.
- Shared `Leg.geometry` is a GeoJSON LineString in **[lng, lat]**. `Itinerary.id` is stable. Each leg has `mode`.

## Scope

**In scope:** `packages/maps/**` (new), root `eslint.config.mjs` (add `packages/maps/src/**/*.tsx` to the react-hooks file glob), README "Workspace" list.
**Out of scope:** `apps/web/src/**` and `apps/mobile/**` screens (UI team mounts the component), server.

## Steps

### Step 1: Package skeleton

```
packages/maps/
  package.json      name @transit/maps; exports: "." (pure layer), "./web", "./native" → dist; deps: @transit/shared
                    peerDependencies: react, maplibre-gl, react-map-gl, @maplibre/maplibre-react-native (all marked optional in peerDependenciesMeta)
  tsconfig.json     extends base; "jsx": "react-jsx"; NodeNext; rootDir src; outDir dist; declaration
  src/index.ts      pure exports only (no React, no MapLibre imports)
  src/contract.ts
  src/colors.ts
  src/to-geojson.ts
  src/layers.ts
  src/bounds.ts
  src/web/RouteMap.tsx       (step 6)
  src/native/RouteMap.tsx    (step 7)
```
Root scripts: `build:shared` should also build maps. Change it to `npm run build -w @transit/shared && npm run build -w @transit/maps`, or add `build:maps` and call it from `dev`/`typecheck`/`test:unit`. Pick the smallest change and note it in the PR.

### Step 2: Contract (`src/contract.ts`)

```ts
export interface RouteMapProps {
  itineraries: Itinerary[];                 // saved library and/or current search results
  selectedItineraryId?: string;
  /** Tap/click on a route. `candidates` lists every itinerary under the pointer (overlaps); app shows a chooser when > 1. */
  onRouteSelect: (itineraryId: string, candidates: string[]) => void;
  /** Mode filter from the mode slider (transit+bike / drive / fly, decided on #16). Legs whose mode is excluded are hidden. */
  visibleModes?: readonly TravelMode[];
  styleUrl: string;                         // basemap (D8) — app passes it, map never reads env
  userLocation?: LngLat;
  /** Change this value to re-fit the camera to the visible itineraries. */
  fitKey?: string | number;
  /** Extra padding when panels cover part of the map (web side panel, mobile bottom sheet). */
  padding?: { top: number; right: number; bottom: number; left: number };
}
```
The map never fetches, saves, or owns selection state. The app owns all three.

### Step 3: Pure layer

- `colors.ts`: **if plan 017 has landed**, re-export `routeColor`, `routePalette` and `routeLine` from `@transit/shared` (so result cards and map lines share one palette) and add nothing else. Otherwise: `routeColor(itineraryId)` → color from a fixed 8-color palette chosen by a stable string hash (the same saved trip always gets the same color), legible on a light basemap, plus `selectedWidth` / `dimmedOpacity` constants; plan 017 then moves the palette into shared, keeping these exact colors in this order.
- `to-geojson.ts`: `itinerariesToFeatures(itineraries, { selectedItineraryId, visibleModes })` → `FeatureCollection<LineString, RouteFeatureProps>`:
  ```ts
  interface RouteFeatureProps { itineraryId: string; legId: string; mode: TravelMode; color: string;
    dash: 'solid' | 'dashed' | 'dotted'; selected: boolean; dimmed: boolean; sortKey: number }
  ```
  Dash by mode: walk → dotted; bike/bikeshare → dashed; bus/rail/ferry/car → solid; flight → dashed. `dimmed` = a selection exists and this isn't it. `sortKey` puts the selected route on top. Also emit Point features for transfer points (`kind: 'transfer'`) and the endpoints.
- `layers.ts`: MapLibre style-spec layer objects shared by both renderers: one line layer **per dash style** (`filter: ['==', ['get','dash'], 'dashed']`) using `line-color: ['get','color']` and `line-opacity` from `dimmed`. Separate layers avoid data-driven `line-dasharray`, which renderers don't support uniformly. Add a casing layer under the selected route.
- `bounds.ts`: `boundsOf(itineraries, visibleModes?)` → `[[minLng,minLat],[maxLng,maxLat]] | undefined`. `uniqueItineraryIds(features)` dedupes the overlap list in sort order.

### Step 4: Tests (`src/*.test.ts`, Vitest, mirror plan 001 setup)

`routeColor` is stable across calls and differs for at least 6 of 8 sample ids. `sampleItinerary` (from shared) produces one line feature per leg with the right dash per mode. `visibleModes: ['car']` hides walk legs. Selection sets `selected` / `dimmed` correctly. Bounds contain every coordinate. Overlap dedupe works. Layer filters reference only properties that exist in `RouteFeatureProps` (assert by scanning the `['get', …]` expressions).

### Step 5: Build + lint

**Verify**: `npm run build -w @transit/maps` → `dist/index.js`, `dist/web/RouteMap.js`, and `dist/native/RouteMap.js` exist once steps 6 and 7 are done; until then, only the index. `npm test` → exit 0.

### Step 6 (maps team): Web renderer `src/web/RouteMap.tsx`

`react-map-gl/maplibre` `<Map mapStyle={styleUrl}>` + `<Source type="geojson" data={features}>` + the shared layers. `interactiveLayerIds` = line layer ids; `onClick` → `uniqueItineraryIds(e.features)` → `onRouteSelect(first, all)`. `fitKey` change → `map.fitBounds(boundsOf(...), { padding })`. Import `maplibre-gl/dist/maplibre-gl.css` from the app, not the package, so Vite handles CSS. Note this in the README.

### Step 7 (maps team): Native renderer `src/native/RouteMap.tsx`

`@maplibre/maplibre-react-native` `MapView` + `ShapeSource` (`onPress` → feature list → same callback) + `LineLayer`s from `layers.ts` (convert style-spec `paint` keys to the RN style-prop names, e.g. `line-color` → `lineColor`; write a small `toRnStyle()` helper and test it). The native module must also be a **direct dependency of `apps/mobile`** for autolinking. Add its Expo config plugin to `app.json` if its docs require one. Switch the mobile README section to the dev-client flow.

## Done criteria

- [ ] `npm test` exits 0 with ≥ 10 maps tests
- [ ] `import { itinerariesToFeatures } from '@transit/maps'` works from `apps/server` (proves no React/MapLibre in the pure entry)
- [ ] (after 6/7) web dev server renders `sampleItinerary` with 3 colored, styled legs, and clicking one calls `onRouteSelect`
- [ ] (after 7) dev-client build on Android renders the same

## STOP conditions

- Metro can't resolve the `@transit/maps/native` subpath export → report (fallback: separate `react-native` field or a `packages/maps-native` package).
- The maps team has already chosen a different library. That re-opens D9/D-library; report rather than override.

## Maintenance notes

- The map draws whatever `itineraries` it gets. "Show saved library" vs "show search results" is an app decision. Show both with search results un-dimmed.
- Flight legs need curved geometry. The server (plan 011) emits great-circle LineStrings split at the antimeridian, so the map stays dumb.

## Open questions for review (maps teammate)

- ~~009-Q1~~ **Confirmed on #6:** colour per itinerary, dash per mode. Also confirmed: one LineString per leg, tap selects the whole trip, Place fields are enough, server sends flight arcs.
- ~~009-Q2~~ **Confirmed on #6:** chooser when a tap hits several routes.
- ~~009-Q3~~ **Decided (@KrakenTheJaken, 2026-11-14, [#13](https://github.com/Cattn/transit-agent/issues/13#issuecomment-6871834941)):** tile provider (D8) = **OpenFreeMap** (no API key).
- 009-Q5 (split out of Q3, **still open**): does one OpenFreeMap style URL work on both web (MapLibre GL JS) and mobile (MapLibre React Native), or does each platform need its own? Check when building steps 6 and 7; until answered, keep `styleUrl` a prop each app passes.
- ~~009-Q4~~ **Decided (@KrakenTheJaken, 2026-11-14, [#13](https://github.com/Cattn/transit-agent/issues/13#issuecomment-6871834941)):** pre-built, `tsc` to `dist`, like `@transit/shared`.
