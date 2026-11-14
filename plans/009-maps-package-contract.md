# Plan 009: Finish the shared route map on web and Android

## Goal

The map is the user's saved-route library and the visual view of current search results. A user can see complete trips, distinguish their legs and overlapping routes, tap a route, and see the same trip selected in the results list. Saved routes and new results use the same rendering contract on web and mobile.

The app supplies trips, selection, colors, location, and layout padding. The map renders them and reports route choices. It does not search for routes, call the API, save trips, request location permission, or own the app's selected trip. Real routing is plan 007; the map must work now with existing sample/mock itineraries.

**Next deliverable for Kraken:** show the existing web renderer (`@transit/maps/web` `RouteMap`) on Android through an **Expo DOM component** (`'use dom'`), verified in Expo Go. Do not rebuild the shared layer or write a second renderer.

## Status

- **Priority:** P1
- **Owner:** @KrakenTheJaken
- **Issue:** #13
- **Status:** PR #76 open. Shared logic, web renderer, samples, and demo merged in [PR #35](https://github.com/Cattn/transit-agent/pull/35) as `619fc44`. Step 5 (saved trips keep their color) merged in [PR #65](https://github.com/Cattn/transit-agent/pull/65) as `b32424f`. DOM renderer on mobile: [PR #76](https://github.com/Cattn/transit-agent/pull/76) open.
- **Remaining:** the DOM renderer for mobile (steps 1–4), Android verification in Expo Go, and an integration handoff to the UI team.
- **Ready to continue:** yes.
- **Related owners:** @DMFriends owns the mobile Results screen (#40) that mounts this map; @Cattn reviews design. Web screens (#42, #45) are low priority.
- **Platforms:** web and Android. iOS is parked in the backlog (@Cattn, 2026-11-14); see "Backlog: iOS" at the end.

## Decision: mobile map via Expo DOM (@Cattn, 2026-11-14)

Mobile no longer gets a native MapLibre renderer (`@maplibre/maplibre-react-native`, `@transit/maps/native`). It renders the **web** renderer, `@transit/maps/web` (react-map-gl + maplibre-gl), inside an Expo DOM component: a `'use dom'` file that runs in a web view inside the app.

- **Tested 2026-11-14** in Expo Go on a Pixel 10 and an iPhone: renders, fits, lanes/dashes/colors identical to web, smooth pan/zoom, the overlap picker works, and selection reaches the app through the DOM bridge.
- **Why:** one renderer for web and mobile, so parity is automatic and every fix lands on both. The team keeps Expo Go: no dev builds, EAS, or local SDK for the map. Faster iteration. Plans 027 and 030 are built once.
- **Where the DOM component lives:** it starts in `apps/mobile` (works today). Move it into `@transit/maps` (e.g. `@transit/maps/dom`) later only if Metro handles DOM files from a workspace package.
- **Native adapter:** the already-pushed native adapter on the `maps/native` branch is **not merged**. Keep the branch for reference in case native performance is ever needed.
- **Costs and risks:** WebGL in a web view (low-end Android may be slower); pinch/pan gestures vs. the home bottom sheet; bundling the maplibre-gl worker; the JSON prop boundary; slightly less native feel (acceptable for showing and selecting routes).

<!-- help:start -->
## Who's on it & how to help

- **Owner:** @KrakenTheJaken. Continue plan 009; do not start a second map package or a second renderer.
- **Done:** pure map layer and web renderer (#35); saved trip colors (#65).
- **Next:** the `'use dom'` map in `apps/mobile`, worker bundling, a touch-sized hit area in the web renderer, Android verification in Expo Go, then UI handoff.
- **This is the MVP critical path:** Android has no map until this lands. Mount it in Home's `MapSlot` (#39, merged) so Results (#40) draws routes. Web (#42) is low priority.
- **Web changes are mobile changes:** the web renderer is also the mobile one. Any change to `@transit/maps/web` shows up on Android too.
- **Color work:** use `assignRouteColors(ids, savedColors)` (on main); no new palette.
- **Feedback:** answer the open decisions below on #13 using `P1` or `P2`.
- **Coding-agent handoff:** “Read plan 009 and the current maps package. Implement only its remaining DOM-renderer work. Preserve the merged pure/web behavior and app-owned state. No new comments or tests; preserve existing logging. Report compatibility or contract blockers before expanding scope.”

<!-- help:end -->

## Already complete — reuse it

PR #35 added:

- `@transit/maps`: pure GeoJSON conversion, route colors, line/dash styles, side-by-side lanes, bounds, mode visibility, and route-hit helpers. The pure entry imports no React or MapLibre.
- `@transit/maps/web`: `RouteMap`, location marker, camera fitting/padding, and overlap picker.
- `@transit/maps/samples`: commute and flight examples; `npm run demo:maps` runs the web demo.
- Root build/watch/lint wiring. Preserve the shared → maps → client-react build order now on main.
- Fixes verified at `082892f`: direction-aware lane offsets, selected layers above all unselected dash styles, and order-independent color allocation with caller-owned overrides. The reviewer passed 55 maps tests and CI.

PR #65 added `assignRouteColors(ids, fixed?)` (step 5).

Start by reading `packages/maps/README.md`, `src/contract.ts`, `src/to-geojson.ts`, `src/layers.ts`, `src/bounds.ts`, the web renderer, and `apps/mobile/src/screens/home/HomeScreen.tsx` (`MapSlot`). Check current main and open PRs before editing.

## Current contract and invariants

`packages/maps/src/contract.ts` is the actual shared contract. Preserve its existing fields:

```ts
interface RouteMapProps {
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

- Coordinates are `[longitude, latitude]`; every route leg already carries a LineString. Flight arcs come from the server. Do not invent routes or fetch geometry in the map.
- Reuse `itinerariesToFeatures`, `itineraryPoints`, `routeLayers`, `boundsOf`, `uniqueItineraryIds`, and `isItineraryVisible`; do not duplicate those algorithms.
- Preserve `RouteFeatureProps.direction` and `lane`. **Every** line offset uses `lane × direction × LANE_SPACING`, including visible lines, selected casing, and invisible hit targets. Opposite-direction trips must remain physically separated.
- Preserve layer order: unselected solid/dashed/dotted → selected casing → selected solid/dashed/dotted → hit targets → points. A sort key within one layer cannot replace ordering across layers.
- Walk is dotted; bike/bikeshare/flight dashed; bus/rail/ferry/car solid. Selection highlights the whole itinerary and dims others.
- Compute `assignRouteColors(fullTripIds, savedColors)` once over the full relevant trip set and reuse the same assignment for cards, map, picker, and filtered subsets through `routeColors`. Do not recompute each subset.
- **Distinct colors are for saved trips only** (@Cattn on PR #66, 2026-11-14). Saved trips on Home keep their stored color. **Search results** must look exactly like Figma frame 02 Results (Android): draw them the way that frame does, not in per-result palette colors. Today Home passes a palette `routeColors` for results too (`HomeScreen.tsx`, `assignRouteColors(shownIds, savedColors)`); when you mount the map in `MapSlot`, follow the frame for results and keep stored colors for saved trips. If the frame is unclear, ask @Cattn on #13.
- The web renderer has an internal overlap picker, still emits `candidates`, and hides a whole trip when any leg is excluded by `visibleModes`. Mobile gets the same behavior through the DOM map. P1/P2 below are unchanged; do not silently remove `candidates` or create conflicting list/map filters.
- `fitKey` triggers fitting to visible trips with supplied padding. Merely selecting a route must not move the camera.
- `userLocation` is supplied by the app. Reuse plan 018's tap-triggered location helper in the consumer; do not add another permission flow.

**DOM boundary.** Props crossing into a `'use dom'` component must be JSON-serializable, and functions passed in become async callbacks over the bridge. So inside the DOM component `routeColors` arrives as a plain object (`Record<string, string>`) instead of a `Map`, and `onRouteSelect` is async. A small wrapper converts both ways, so app code still passes `RouteMapProps` unchanged.

## Remaining work, in order

### 1. Mobile dependencies

In `apps/mobile`, add with `npx expo install` (so versions match Expo SDK 58): `react-native-web`, `@expo/metro-runtime`, `react-dom`. Add `@transit/maps` plus the web renderer's runtime deps (`maplibre-gl`, `react-map-gl`) at the versions `@transit/maps` already uses. Preserve existing Expo, React, and React Native versions.

- If `@maplibre/maplibre-react-native` or its config plugin is present on the branch you start from, remove them. Nothing native is added for the map.
- Expo Go keeps working; `npm run start` (`expo start --go`) is the way to run it. No dev build, EAS build, or prebuild for the map.
- Keep package/root/EAS builds in shared → maps → client-react order. Mobile's EAS post-install builds shared/client-react only; add maps there without dropping either, since the app now imports it.
- If compatibility requires a framework upgrade, stop and report the actual incompatibility on #13.

### 2. The DOM map component and wrapper

Create the `'use dom'` component in `apps/mobile` (e.g. `apps/mobile/src/map/RouteMapDom.tsx`) that imports `RouteMap` from `@transit/maps/web` and the MapLibre CSS, and a wrapper (e.g. `apps/mobile/src/map/RouteMap.tsx`) that accepts `RouteMapProps`.

- The wrapper turns `routeColors` (`ReadonlyMap`) into a plain object and passes `onRouteSelect` as an async callback; the DOM side turns the object back into a `Map` for the web renderer. Every other prop is already JSON.
- Size the DOM view to fill its parent (`dom={{ style: ... }}` or the documented equivalent for SDK 58) so `MapSlot` controls layout. Turn off web-view scrolling/bounce that fights map gestures.
- Keep the component in `apps/mobile` for now. Move it to `@transit/maps` (e.g. `@transit/maps/dom`) later only if Metro resolves DOM files from a workspace package.

### 3. Bundle the maplibre-gl worker

maplibre-gl v6 loads its worker from a separate file. Ship it with the app as an asset and point `setWorkerUrl` at it inside the DOM component. **No jsDelivr/CDN at runtime.** Mirror how `packages/maps/README.md` and plan 026 set the worker up on web (`maplibre-gl/dist/maplibre-gl-worker.mjs`), using whatever asset import Metro supports for DOM components. Report on #13 if Metro cannot bundle it.

### 4. Touch-sized route hit area (web renderer)

Today the route hit target is a 14 px line (≈ ±7 px), sized for a mouse; the unmerged native adapter used ≈ ±17 dp. Widen the hit-target layer in the **web** renderer for touch, e.g. a wider hit line when the pointer is coarse (`matchMedia('(pointer: coarse)')`) or always, keeping the same lane offset. This also helps touch laptops and tablets on web. Keep layer order and the overlap picker unchanged.

### 5. Honor saved trip colors (P4 / 017-Q2) — done

Merged in #65: `assignRouteColors(itineraryIds, fixed?)` keeps each saved trip's color, counts all fixed colors as taken, and is identical to before without `fixed`.

### 6. Verify on Android in Expo Go

Use existing samples/mock trips, mounted in `MapSlot` on Home (plan 020) or a temporary minimal consumer. Do not rewrite app screens merely to demonstrate the map.

Check in Expo Go on an Android phone (screenshots over adb, per the `ship-plan` skill's recipe):

- Commute and flight samples render; empty trips/filter results do not crash.
- All dash styles and start/end/transfer points appear; lanes and colors match web.
- Selecting a route on the map selects the same itinerary in the app (callback over the DOM bridge); overlaps show the picker.
- Card/map/picker colors match, including after result reordering and mode filtering (`routeColors` crosses as a plain object).
- `fitKey` fits routes clear of the bottom sheet; selection alone does not refit.
- Pinch and pan work with the home bottom sheet: dragging the sheet does not pan the map, and map gestures do not drag the sheet.
- The supplied location marker works without the map itself requesting permission.
- The worker loads from the bundled asset with the network to jsDelivr unavailable (no CDN request).
- If a low-end Android phone is available, one performance check: pan/zoom with all samples on screen. Record the device and result; report noticeable lag on #13.

Record device/OS, Expo Go version, result, and any untested item in the PR. A JS export or pure test pass is not a device rendering result.

### 7. Give UI a concrete integration handoff

Document the mobile import (the wrapper path), the `apps/mobile` dependencies, the style URL, the worker setup, the JSON prop boundary, and one minimal props example in `packages/maps/README.md`.

- Mobile plan 020 / #39 built `MapSlot` in `HomeScreen`; it now renders the DOM map. Plan 021 / #40 reuses it for results. Expo Go keeps working.
- Web plan 026 / #42 owns mounting `/web`, the MapLibre CSS/worker setup, and panel padding.
- Result screens #40/#45 reuse selection and the same color assignment.
- Plan 017 / #25 owns moving colors into shared. Once 017-Q1 is settled, switch maps to re-export/use them while retaining exact palette order and public APIs. Maps never stores colors.

## Scope for the next PR

**In scope:** the `'use dom'` component and wrapper in `apps/mobile`, `apps/mobile/package.json`/`package-lock.json` (step 1 deps; removing native MapLibre if present), worker asset wiring, the touch hit area in `packages/maps/src/web/*` and `src/layers.ts` if the hit width lives there, mounting the map in `MapSlot`, EAS post-install build order, and maps/mobile setup documentation.

**Out of scope:** a native renderer or `@transit/maps/native`; rebuilding the pure/web package; designing app screens/navigation; server routing or live arrivals; shared-theme implementation owned by DMFriends; new tests/test files; new source comments; changing existing logging.

Keep it in one focused PR from current main. Do not reopen/reimplement merged #35, and do not merge the `maps/native` branch. Show deviations/remaining platform limits in the PR.

## Checks and completion

```sh
npm run test:unit -w @transit/maps
npm run typecheck -w @transit/maps
npm run typecheck -w @transit/mobile
npm run build -w @transit/maps
npm run build:mobile
npm run check
```

Also verify the pure package imports from server code and the web demo still builds and shows the wider hit area. **Do not create new tests**; extend existing tests only where meaningful. Keep all existing logging and add no source comments.

Core plan 009 is complete when:

- [x] Shared/pure package, web renderer, samples, and demo are merged (#35).
- [x] `assignRouteColors` honors saved colors (step 5, #65).
- [ ] Mobile renders `@transit/maps/web` through a `'use dom'` component with `RouteMapProps` for app code; `routeColors`/`onRouteSelect` cross the JSON boundary correctly.
- [ ] The maplibre-gl worker is bundled; no CDN at runtime.
- [ ] The web renderer's route hit area is touch-sized.
- [ ] Mobile deps added with `npx expo install`; no native MapLibre dependency or config plugin; Expo Go still runs the app.
- [ ] Android rendering/interaction, including gestures vs. the bottom sheet, is verified in Expo Go.
- [ ] UI has a usable mounting handoff; no app/data responsibilities moved into maps.
- [ ] Required contract decisions are resolved or explicitly tracked with compatible behavior retained.

Do not close #13 or mark all of 009 done just because the bundle builds. Keep actual app-screen mounting tracked in its UI issue.

## Open product decisions — not prior code-review blockers

- **P1 — picker ownership, maps + UI:** keep the map-owned overlap picker or return choosing entirely to the app? Current web code has a picker and still passes `candidates`; mobile gets the same through the DOM map. Do not drop that argument without agreement.
- **P2 — mode filtering, maps + UI:** confirm whole-trip filtering rather than per-leg filtering. Current web code uses `isItineraryVisible`; any results-list integration must use the same rule.
- **P4 / #25 — color policy:** decided: **permanent colors per saved trip** (@Cattn, 017-Q2 on #25, 2026-11-14; clarified on PR #66: search results follow the mockup, no extra colors), done in step 5. Palette ownership in shared is still open (017-Q1).
- ~~009-Q5~~ **Answered (2026-11-14):** the same OpenFreeMap style URL works on web and mobile, since mobile runs the web renderer. Keep `styleUrl` configurable.

## Follow-ups after mobile parity

Bikeshare dock pins are **approved**, along with bike-savings summaries, by [Cattn's roadmap answer](https://github.com/Cattn/transit-agent/issues/17#issuecomment-6873720245) and chat clarification. Under plan 010 / #14, agree a separate caller-supplied dock-data prop and Point layer with the server/UI owner. Maps renders the supplied dock data; GBFS fetching and “bike saves X min” calculations stay outside maps. Do not make that later data integration a blocker for the mobile MVP.

Extra labels and fancier lane layouts are separate follow-ups. A native renderer comes back only if the DOM map's performance is not good enough; start from the `maps/native` branch.

## Backlog: iOS

iOS is parked in the backlog (@Cattn, 2026-11-14): the mobile app is Android-only until it comes back out. Nothing here is scheduled.

- The DOM map already worked in Expo Go on an iPhone (2026-11-14), so iOS is no longer blocked by Xcode or an Apple Developer account for the map. When iOS is picked up, run step 6's checklist in Expo Go on an iPhone and record device/OS and result in the PR.
- Done criterion to restore: iOS rendering/interaction is verified.
- @KrakenTheJaken was nominated as iOS tester in [the roadmap answer](https://github.com/Cattn/transit-agent/issues/17#issuecomment-6873720245); availability was never confirmed.
