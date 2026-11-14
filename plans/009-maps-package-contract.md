# Plan 009: Finish the shared route map on web, Android, and iOS

## Goal

The map is the user's saved-route library and the visual view of current search results. A user can see complete trips, distinguish their legs and overlapping routes, tap a route, and see the same trip selected in the results list. Saved routes and new results use the same rendering contract on web and mobile.

The app supplies trips, selection, colors, location, and layout padding. The map renders them and reports route choices. It does not search for routes, call the API, save trips, request location permission, or own the app's selected trip. Real routing is plan 007; the map must work now with existing sample/mock itineraries.

**Next deliverable for Kraken:** add the missing `@transit/maps/native` renderer to the existing package and verify it in rebuilt Android/iOS dev clients. Do not rebuild the shared layer or web renderer.

## Status

- **Priority:** P1
- **Owner:** @KrakenTheJaken
- **Issue:** #13
- **Status:** PARTIAL. Shared logic, web renderer, samples, and demo merged in [PR #35](https://github.com/Cattn/transit-agent/pull/35) as `619fc44`.
- **Remaining:** native renderer/export/setup, native parity and device verification, and an integration handoff to the UI team.
- **Ready to continue:** yes. No native export or native MapLibre dependency exists on main at this planning pass.
- **Related owners:** @DMFriends owns shared colors (#25); @Rad1ee / @DMFriends own app screens (#16, #39, #42).
- **iOS tester:** @Cattn nominated @KrakenTheJaken in [the roadmap answer](https://github.com/Cattn/transit-agent/issues/17#issuecomment-6873720245). Availability is unconfirmed; no completed device check is implied.

<!-- help:start -->
## Who's on it & how to help

- **Owner:** @KrakenTheJaken. Continue plan 009; do not start a second map package.
- **Done:** pure map layer and web renderer, merged in #35.
- **Next:** native renderer, Android/iOS setup and verification, then UI handoff.
- **UI team:** mount the map in mobile #39 and web #42; keep screen/navigation work in those plans.
- **Color work:** coordinate with @DMFriends on #25 rather than creating another palette.
- **Feedback:** answer the open decisions below on #13 using `P1`, `P2`, `P4`, or `009-Q5`.
- **Coding-agent handoff:** “Read plan 009 and the current maps package. Implement only its remaining native work. Preserve the merged pure/web behavior and app-owned state. No new comments or tests; preserve existing logging. Report compatibility or contract blockers before expanding scope.”

<!-- help:end -->

## Already complete — reuse it

PR #35 added:

- `@transit/maps`: pure GeoJSON conversion, route colors, line/dash styles, side-by-side lanes, bounds, mode visibility, and route-hit helpers. The pure entry imports no React or MapLibre.
- `@transit/maps/web`: `RouteMap`, location marker, camera fitting/padding, and overlap picker.
- `@transit/maps/samples`: commute and flight examples; `npm run demo:maps` runs the web demo.
- Root build/watch/lint wiring. Preserve the shared → maps → client-react build order now on main.
- Fixes verified at `082892f`: direction-aware lane offsets, selected layers above all unselected dash styles, and order-independent color allocation with caller-owned overrides. The reviewer passed 55 maps tests and CI; that was static/pure review, not native/device validation.

Start by reading `packages/maps/README.md`, `src/contract.ts`, `src/to-geojson.ts`, `src/layers.ts`, `src/bounds.ts`, and the web renderer. Check current main and open PRs before editing; coordinate if native work has appeared.

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
- Reuse `itinerariesToFeatures`, `itineraryPoints`, `routeLayers`, `boundsOf`, `uniqueItineraryIds`, and `isItineraryVisible`; do not duplicate those algorithms in native.
- Preserve `RouteFeatureProps.direction` and `lane`. **Every** line offset uses `lane × direction × LANE_SPACING`, including visible lines, selected casing, and invisible hit targets. Opposite-direction trips must remain physically separated.
- Preserve layer order: unselected solid/dashed/dotted → selected casing → selected solid/dashed/dotted → hit targets → points. A sort key within one layer cannot replace ordering across layers.
- Walk is dotted; bike/bikeshare/flight dashed; bus/rail/ferry/car solid. Selection highlights the whole itinerary and dims others.
- Compute `assignRouteColors(fullTripIds)` once over the full relevant trip set and reuse the same assignment for cards, map, picker, and filtered subsets through `routeColors`. Do not recompute each subset. List-order stability is fixed; permanent colors across different trip sets/sessions are not promised by that alone.
- The merged web implementation currently has an internal picker, still emits `candidates`, and hides a whole trip when any leg is excluded by `visibleModes`. **These are current code behaviors, not newly settled product decisions.** Preserve compatibility during native work; resolve changes through P1/P2/P4 below. Do not silently remove `candidates` or create conflicting list/map filters.
- `fitKey` triggers fitting to visible trips with supplied padding. Merely selecting a route must not move the camera.
- `userLocation` is supplied by the app. Reuse plan 018's tap-triggered location helper in the consumer; do not add another permission flow.

## Remaining work, in order

### 1. Confirm native setup against the installed SDK

Use the current [MapLibre Expo setup](https://maplibre.org/maplibre-react-native/docs/setup/expo/) and [getting-started guide](https://maplibre.org/maplibre-react-native/docs/setup/getting-started/), then inspect installed exports/types. Do not copy the old plan's assumed component names: current native APIs can differ from older `MapView` / `ShapeSource` examples.

- Install a compatible `@maplibre/maplibre-react-native` as a **direct dependency of `apps/mobile`** and add `@transit/maps` there. Preserve existing Expo, React, and React Native versions.
- Add the native peer to the map package with optional peer metadata so the server/web do not import or require native runtime code.
- Register the MapLibre Expo config plugin alongside existing plugins. Preserve cleartext/LAN configuration, SecureStore, and foreground-only location settings.
- MapLibre requires a rebuilt development client; it does not run in Expo Go. Do not run prebuild over someone else's native project as an incidental setup step.
- Keep package/root/EAS builds in shared → maps → client-react order. Mobile's current EAS post-install builds shared/client-react only; include maps without dropping either.
- If compatibility requires a framework upgrade or a different map library, stop and report the actual incompatibility on #13.

### 2. Implement the native adapter and export

Create `packages/maps/src/native/RouteMap.tsx` and `src/native/index.ts`; add the `./native` package export to built JS and declarations.

- Accept the existing `RouteMapProps`; use the same shared feature collections and draw order.
- Translate shared layer paint/layout/filter expressions into the installed native API without losing direction offsets, selected layering, dash patterns, hit-target widths, or point styling. Keep translation small; report unsupported expressions instead of silently omitting behavior.
- Wire camera fitting/padding, optional location marker, route hits, and selection callbacks. Keep selection app-owned.
- Port current overlap/visibility semantics compatibly. Announce any required prop/behavior difference on #13 before changing the contract; do not independently settle P1/P2.
- Keep native imports behind `@transit/maps/native`. The pure package entry and `/web` must stay usable without loading native modules.

### 3. Verify rendering and interaction

Use existing samples/mock trips and a temporary minimal consumer if the UI shell is not ready. Do not rewrite app screens merely to demonstrate the adapter.

Check in a rebuilt Android dev client and on iOS when the nominated tester is available:

- Commute and flight samples render; empty trips/filter results do not crash.
- All dash styles and start/end/transfer points appear.
- Selecting a solid route crossing unselected dashed/dotted routes leaves the selected route on top.
- Outbound/return routes with reversed geometry occupy distinct lanes; touch targets follow the shifted lines.
- Map taps select the same itinerary as its card; overlaps offer the compatible chooser behavior.
- Card/map/picker colors match, including after result reordering and mode filtering.
- `fitKey` fits routes clear of the bottom sheet; selection alone does not refit.
- The supplied location marker works without the map itself requesting permission.
- Test the existing OpenFreeMap Positron style on native. Record whether web/native can share that URL (009-Q5); keep `styleUrl` configurable regardless.

Record device/OS, build, result, and any untested platform in the PR. A JS export or pure test pass is not a device rendering result. iOS availability must be confirmed rather than assumed.

### 4. Give UI a concrete integration handoff

Document the native import, required app dependency/plugin, style URL(s), rebuilt-dev-client commands, and one minimal props example in `packages/maps/README.md`.

- Mobile plan 020 / #39 owns the home screen, selection state, bottom-sheet padding, and calling plan 018 helpers. Until `./native` exists it may use its documented placeholder.
- Web plan 026 / #42 owns mounting `/web`, the MapLibre CSS/worker setup, and panel padding. The package does not own those screens.
- Result screens #40/#45 reuse selection and the same color assignment.
- Plan 017 / #25 owns moving colors into shared. Once its tokens are exported and palette/P4 decisions are settled, switch maps to re-export/use them while retaining exact palette order and public APIs. Do not invent a second palette or add saved-trip color persistence in this PR.

## Scope for the next PR

**In scope:** native files/export in `packages/maps`, minimal layer-adapter changes needed for parity, existing maps tests when useful, package peer/dependency/lock changes, `apps/mobile/package.json` and `app.json` native setup, EAS build wiring, and maps/mobile setup documentation.

**Out of scope:** rebuilding the pure/web package; designing app screens/navigation; server routing or live arrivals; shared-theme implementation owned by DMFriends; new tests/test files; new source comments; changing existing logging.

Keep the native continuation in one focused PR from current main. Do not reopen/reimplement merged #35. Preserve unrelated changes and show deviations/remaining platform limits in the PR.

## Checks and completion

Run existing checks appropriate to the adapter:

```sh
npm run test:unit -w @transit/maps
npm run typecheck -w @transit/mobile
npm run build -w @transit/maps
npm run build:mobile
npm run check
```

Also verify the pure package imports from server code and the existing web demo still builds. **Do not create new tests**; extend existing tests only where meaningful. Keep all existing logging and add no source comments.

Core plan 009 is complete when:

- [x] Shared/pure package, web renderer, samples, and demo are merged (#35).
- [ ] `@transit/maps/native` exports a working adapter with built declarations.
- [ ] Native dependency/plugin/EAS wiring is documented and buildable.
- [ ] Shared geometry, colors, filtering/selection callbacks, layer order, offsets, bounds, and padding work across renderers.
- [ ] Android rendering/interaction is verified in a rebuilt dev client.
- [ ] iOS rendering/interaction is verified, or explicitly remains an open blocker with tester availability recorded.
- [ ] UI has a usable mounting handoff; no app/data responsibilities moved into maps.
- [ ] Required contract decisions are resolved or explicitly tracked with compatible behavior retained.

Do not close #13 or mark all of 009 done just because the native JS bundle builds. Keep actual app-screen mounting tracked in its UI issue.

## Open product decisions — not prior code-review blockers

- **P1 — picker ownership, maps + UI:** keep the map-owned overlap picker or return choosing entirely to the app? Current web code has a picker and still passes `candidates`; do not drop that argument without agreement.
- **P2 — mode filtering, maps + UI:** confirm whole-trip filtering rather than per-leg filtering. Current web code uses `isItineraryVisible`; any results-list integration must use the same rule.
- **P4 / #25 — color policy, maps + UI:** colors decided: **permanent per-trip colors** (@Cattn, 017-Q2 on #25, 2026-11-14). Palette ownership in shared is still open (017-Q1). Order-independent allocation and caller overrides are implemented; these do not settle persistence policy.
- **009-Q5 — style compatibility, Kraken:** same OpenFreeMap style URL on web/native, or platform-specific URLs? Establish during native verification.
- **iOS availability:** Kraken is nominated; confirm device/simulator access. Nomination is not completed verification.

## Follow-ups after native parity

Bikeshare dock pins are **approved**, along with bike-savings summaries, by [Cattn's roadmap answer](https://github.com/Cattn/transit-agent/issues/17#issuecomment-6873720245) and chat clarification. Under plan 010 / #14, agree a separate caller-supplied dock-data prop and Point layer with the server/UI owner. Maps renders the supplied dock data; GBFS fetching and “bike saves X min” calculations stay outside maps. Do not make that later data integration a blocker for the native MVP.

Extra labels, fancier lane layouts, or persistent saved-trip colors are separate follow-ups, not prerequisites for this continuation.
