# @transit/maps

Draws trips on a map, on the web and on the phone. Give it `Itinerary[]` (from `@transit/shared`) and it draws every
leg in the right style, marks the start, end and transfers, labels bus / train / ferry legs, shows where you are, and
tells the app which trip the user tapped.

- Plan: [`plans/009-maps-package-contract.md`](../../plans/009-maps-package-contract.md)
- Issue: #13 · Owner: @KrakenTheJaken
- One renderer everywhere: the **web** map (`@transit/maps/web`, MapLibre GL JS) also runs on mobile, inside an Expo DOM
  component. There is no native map.

This README is the full record of how the map works and **why** it works that way: what was built, what was tried and
dropped, and what is decided but not built yet. Read it before changing the map.

---

## Contents

1. [Try it](#try-it)
2. [Use it on the web](#use-it-on-the-web)
3. [Use it on mobile (Expo DOM)](#use-it-on-mobile-expo-dom)
4. [What the map looks like](#what-the-map-looks-like)
5. [How the map behaves](#how-the-map-behaves)
   - [Animating while the agent works](#animating-while-the-agent-works-plan-030)
6. [`<RouteMap>` props](#routemap-props)
7. [How it works inside](#how-it-works-inside)
8. [Decisions and why](#decisions-and-why)
9. [Tried and dropped](#tried-and-dropped)
10. [Status and what's next](#status-and-whats-next)
11. [Rules (people and coding agents)](#rules-people-and-coding-agents)
12. [Development](#development)
13. [Gotchas](#gotchas)

---

## Try it

### Web demo

From the repo root:

```sh
npm install
npm run demo:maps
```

Open **http://localhost:5180**. No server, no API key and no build step needed.

- **Transit / drive**: one trip (MIT → South Station) by Red Line, bus and car.
- **Flying**: MIT → Orlando, flying from Boston, Providence (into Sanford) or Manchester.
- **Agent building**: the scripted plan 030 preview. MIT and two "South Station" candidates appear, the camera moves to
  the trip, a searching line pulses between them, then the three routes draw in one after another. **Replay** runs it again.
- Click a route, or a card on the left, to select it. Click again where routes overlap to cycle through them.

The demo's code is small: [`demo/App.tsx`](demo/App.tsx) is the whole page. It plays the app's role (it owns the
selection and the colours) and uses the **default look** (no `variant`): every trip in its own colour, the others faded
only while one is selected.

### On a phone (Expo Go)

```sh
npm install                 # also generates the built-in MapLibre worker (postinstall)
npm run build:packages      # the app imports the built packages
npm run mobile:tunnel       # or: npm run dev:mobile on the same Wi-Fi
```

Scan the QR code with Expo Go (Android: the Expo Go app; iPhone: the camera). The map is the Home screen background.
No dev build, no Apple developer account and no Mac are needed, because the map is a web page inside the app.

- Your saved trips draw on Home, faded, each in its own colour, side by side where they share streets. Tap one to
  bring it into focus.
- Search a place to see results: grey routes, the chosen one in purple with line bubbles.
- The location button pans to you; the blue dot has a cone showing which way the phone faces.

---

## Use it on the web

**1. Set up MapLibre once** when your web app starts (otherwise the map stays blank):

```ts
import 'maplibre-gl/dist/maplibre-gl.css';
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
setWorkerUrl(workerUrl);
```

Your app also needs `maplibre-gl` and `react-map-gl` as dependencies.

**2. Pass trips to `<RouteMap>`** inside a box that has a height:

```tsx
import { useState } from 'react';
import { RouteMap } from '@transit/maps/web';
import type { Itinerary } from '@transit/shared';

export function TripMap({ trips }: { trips: Itinerary[] }) {
  const [selected, setSelected] = useState<string>();
  return (
    <div style={{ height: 500 }}>
      <RouteMap
        itineraries={trips}                       // e.g. the response of POST /api/plan
        selectedItineraryId={selected}            // you own the selection
        onRouteSelect={(id) => setSelected(id)}   // the user tapped a trip
        onDeselect={() => setSelected(undefined)} // the user tapped empty map
        styleUrl="https://tiles.openfreemap.org/styles/positron"
        fitKey={trips.map((t) => t.id).join()}    // change it to zoom to the routes
        variant="choosing"                        // optional: results look; 'saved' for Home
      />
    </div>
  );
}
```

**3. Colours.** Which colours you pass depends on the screen (see [What the map looks like](#what-the-map-looks-like)):

```tsx
import { assignRouteColors } from '@transit/maps';

// Stored colours of ALL saved trips (not only the ones on screen).
const savedColors = new Map(saved.filter((t) => t.color).map((t) => [t.id, t.color!]));

// Once, over every trip on screen; pass the same map to the map and the cards.
const routeColors = assignRouteColors(trips.map((t) => t.id), savedColors);

// When saving a trip, store the colour it was given, so it keeps it.
save({ ...trip, color: routeColors.get(trip.id) });
```

`assignRouteColors(ids, saved)` gives each trip a stable palette colour from its id; a saved trip keeps its saved colour
and no other trip borrows a saved colour (while 8 or fewer are in use). See [`src/colors.ts`](src/colors.ts). Plan 009:
distinct colours are for saved trips; search results are drawn the Figma way (`variant="choosing"`), not in palette
colours.

**4. No data yet?** Use the example routes: `import { commuteOptions, flightOptions, testScenarios } from '@transit/maps/samples'`.

Each leg needs a `geometry`: a GeoJSON `LineString` with at least 2 points in **`[longitude, latitude]`** order.
A flight is just a leg with `mode: 'flight'`; the server sends its curved path (plan 011).

---

## Use it on mobile (Expo DOM)

Mobile renders the same web `RouteMap` inside an [Expo DOM component](https://docs.expo.dev/guides/dom-components/):
a file starting with `'use dom'` runs in a web view, and Expo passes its props across from React Native.

```
HomeScreen (React Native)
 └─ MapSlot                      apps/mobile/src/screens/home/HomeScreen.tsx
     └─ RouteMap                 apps/mobile/src/map/RouteMap.tsx      ← same props as the web map (RouteMapProps)
         └─ RouteMapDom          apps/mobile/src/map/RouteMapDom.tsx   ← 'use dom': runs in a web view
             └─ RouteMap         @transit/maps/web                     ← the real map
```

### The files

| File | What it does |
| --- | --- |
| `apps/mobile/src/map/RouteMap.tsx` | The component the app uses. Takes `RouteMapProps` and converts what can't cross into the web view: `Map` → plain object, readonly arrays → arrays, callbacks → `async` functions. Memoised so the web view isn't re-sent props on every render |
| `apps/mobile/src/map/RouteMapDom.tsx` | The `'use dom'` file. Loads MapLibre's CSS, starts MapLibre's worker from the built-in code (a `blob:` URL), makes the page full-size, turns the colour object back into a `Map`, and renders `@transit/maps/web` |
| `apps/mobile/src/map/useLiveLocation.ts` | Watches the position (`watchPositionAsync`, every 5 m) and compass (`watchHeadingAsync`, only re-renders when it turns 5° or more). Only runs after permission was granted, and only while the app is in the foreground |
| `apps/mobile/src/map/css.d.ts` | Lets TypeScript import `.css` files |
| `apps/mobile/src/map/maplibre-gl-worker.js` | **Generated by `postinstall`** (git-ignored): MapLibre's worker code as a string module, so it is bundled into the DOM page itself. No separate file to serve, no CDN. See [Why the worker is built in](#why-the-worker-is-built-in) |

### Why the worker is built in

MapLibre runs its tile work in a web worker loaded from a separate file. The first version copied that file to
`apps/mobile/public/` and loaded it relative to the DOM page. That works in Expo Go (the dev server serves it), but in
an exported build the DOM page lives in `www.bundle/` while Expo puts `public/` files one folder up, so the worker was
never found and **the map stayed blank** (PR #76 review, P1).

Now `postinstall` turns `maplibre-gl/dist/maplibre-gl-worker.mjs` into `src/map/maplibre-gl-worker.js`
(`export default "<worker code>"`), and the DOM component starts the worker from a `Blob`. It works the same in Expo Go,
exported builds and over-the-air updates. Cost: the DOM bundle is about 0.5 MB bigger (local, no download).

Checked by exporting Android, opening the exported page from `file://` (as Android does) in Chromium: before, "Failed to
fetch" and a blank map; after, tiles, routes and bubbles. On the Pixel, the web view's network log shows the workers
starting from `blob:` URLs and no request for a worker file or any CDN.

### The prop boundary (important)

Props going into a DOM component must be JSON. So:

- `routeColors` (a `Map`) is sent as an object and rebuilt on the other side.
- Callbacks (`onRouteSelect`, `onDeselect`) become **async**; the map doesn't wait for them.
- `userLocation` is copied into a plain `[lng, lat]` array.
- `dom={{ scrollEnabled: false, bounces: false, overScrollMode: 'never' }}` stops the web view itself from scrolling.

### How Home uses it

All of this is in `HomeScreen.tsx` (app code, not this package):

| What | How |
| --- | --- |
| Which trips | Results open: the results' itineraries plus near misses. Otherwise: the saved, watched trips |
| Look | Results open: `variant="choosing"`, `unfocusedColors="mode"`. Otherwise: `variant="saved"`, `unfocusedColors="trip"` |
| Colours | `assignRouteColors(shownIds, savedColors)` once over the trips on screen; saved trips keep their stored colour. Saving a result stores the colour it was given. **Location presets (plan 038):** a saved trip whose destination is within 150 m of Home, Office or Gym draws in that preset's colour (`presetTripColors` is merged over the stored colours), so changing a preset's colour recolours its trips at once, and saving a result to a preset stores the preset's colour |
| Accent | `accentColor={light.primary}` (`#6750A4`), always the light theme's purple, because the basemap is always light |
| Basemap | OpenFreeMap Positron |
| Padding | Top: the bottom edge of the search bar + mode tabs (`HomeChrome` reports it with `onTopLayout`) + 16. Right: 16 + 64 for the locate / layers button column. Bottom: the sheet's height. Left: 16 |
| Location | Loads **when the app opens** (`getCurrentPlace`, then live tracking). The locate button also bumps `locateKey`, which pans the map to you |
| Deselect | Tapping empty map clears the selection |
| `fitKey` | The trip ids joined, so the camera re-fits whenever the list of trips changes |

`HomeChrome.ios.tsx` and `HomeChrome.android.tsx` gained an optional `onTopLayout(bottomEdge)` callback: they report
`insets.top + 4 + the height of the top bar`, so routes never fit underneath the search bar.

---

## What the map looks like

The map has three looks, picked with `variant`. With no `variant` it draws the **default look** (unchanged from
before this PR, used by the web and the demo). Home uses `saved`; search results use `choosing` (Figma frame 02).

### Default look (no `variant`)

| Part | Look |
| --- | --- |
| Every trip | In its own `routeColors` colour, selected or not |
| Fading | Other trips fade (35%) only while one is selected |
| Markers | White dots ringed in the trip's colour (start, end and transfers), no end icon |

### `variant="saved"` (Home: your saved trips)

| Part | Look |
| --- | --- |
| Unselected trips | Faded (35% opacity), in their `routeColors` colour (`unfocusedColors="trip"`), so each saved trip shows its own colour |
| Nothing selected | Everything is faded. Only a selected trip is ever in focus |
| Selected trip | Full opacity, a white casing underneath, each leg in **its own mode's colour** (walk grey, bus orange, train purple…) |
| Start dot | Small dot in the trip's colour, white border |
| End dot | Bigger dot in the trip's colour with a white "layers" icon |
| Transfers | Only on the selected trip: a white dot ringed in the colour of the leg **you're switching onto** |

### `variant="choosing"` (search results)

| Part | Look |
| --- | --- |
| Unselected trips | Slate grey `#64748b`, full opacity |
| Selected trip | All legs in the accent colour (`accentColor`, default `#6750A4`), white casing |
| Start dot | **Hollow**: white with a thick accent ring (so it reads as "start") |
| End dot | Accent dot with the white icon |
| Transfers | White dot with an accent ring |
| Line bubbles | One purple bubble per bus / train / ferry leg of the selected trip: icon + line + departure time, e.g. `🚆 Red Line · 8:49`, `🚌 SL1 · 8:58`, `⛴ Charlestown Ferry · 8:45`. Placed halfway along the leg. Walk, bike and car legs get none |

### Mode colours (`MODE_COLORS`)

| Mode | Colour | Line |
| --- | --- | --- |
| Walk | `#6b7280` grey | dotted |
| Car | `#2563eb` blue | solid |
| Bike, bike share | `#2563eb` blue | dashed |
| Bus | `#ea580c` orange | solid |
| Train (rail) | `#7c3aed` purple | solid |
| Ferry | `#0d9488` teal | solid |
| Flight | `#db2777` pink | dashed |

Other colours: unfocused grey `#64748b` (`UNFOCUSED_ROUTE_COLOR`), focus ink `#1f2937` (`FOCUS_INK`, markers in the
grey look), default accent `#6750A4` (`DEFAULT_ACCENT_COLOR`).

`unfocusedColors` picks the colour of unselected trips: `'trip'` (default: their `routeColors` colour), `'grey'`
(slate grey) or `'mode'` (the colour of the mode they use most, by distance). In `choosing`, unselected trips are
always grey.

### Sizes

| Thing | Size |
| --- | --- |
| Line width | 3 px zoomed out (zoom 5) → 5 px at city zoom (14) → 7 px at street zoom (17) |
| Selected line | 5 → 7 → 10 px, plus a white casing 4 px wider |
| Start / end / transfer dots | radius 6 / 9 / 4 px, 2 px white border (hollow start ring: 3 px) |
| End icon | 12 px white "layers" icon, drawn on a canvas at 2× ([`src/web/end-icon.ts`](src/web/end-icon.ts)) |
| Tap area | An invisible line 14 px wide with a mouse, **34 px on touch screens** |
| Line bubble | 12 px semibold white text, 14 px icon, 8 px rounded corners, soft shadow |

Lines get thicker as you zoom in so they're easier to tap; they do not scale with the map like a road would.

---

## How the map behaves

| Behaviour | How |
| --- | --- |
| Tap a route | Selects the whole trip (every leg carries its trip id). `onRouteSelect(id, candidates)` |
| Tap again where routes overlap | **Cycles** to the next trip under your finger, in list order (`nextRouteToSelect`). No picker |
| Tap empty map | Calls `onDeselect` (only when something is selected) |
| Double-tap zoom | Paused for 600 ms after a route tap, so tapping a route twice to cycle doesn't zoom in |
| Selecting | Never moves the camera (so the route doesn't slide out from under your finger) |
| `fitKey` changes | The camera zooms to the visible trips, inside `padding`. In `choosing`, 48 px more on the left and right so bubbles fit |
| `locateKey` changes | The camera eases to `userLocation`, zooming in to at least 15 |
| Location dot | Blue dot, white border; with `userHeading`, a cone pointing where the phone faces (turns with the map) |
| Bubbles | Don't block taps (`pointer-events: none`); you tap the route under them |
| Tabs (`visibleModes`) | A trip shows only if every leg's mode is allowed; otherwise the whole trip hides |
| Overlapping trips | **Drawn on top of each other** along shared streets (no sideways lanes). The selected one is always on top, and tapping the same spot again cycles to the next trip underneath |

### Animating while the agent works (plan 030)

While the agent builds a trip, the app passes `buildPreview` and the map shows the trip being built. Omit it (or pass
`phase: 'idle'`) and the map behaves exactly as before.

```ts
buildPreview?: {
  phase: 'idle' | 'locating' | 'searching' | 'drawing';
  origin?: LngLat;        // [lng, lat]
  destination?: LngLat;
  candidates?: LngLat[];  // place matches the agent is choosing between
};
```

| `phase` | What the map shows |
| --- | --- |
| `locating` | Small faded grey pins for `candidates`, plus accent dots for `origin` / `destination` once known |
| `searching` | The two ends, a faint dashed line between them and a bright segment travelling along it (loops every 1.2 s) |
| `drawing` | Trips in `itineraries` that are **new** draw themselves leg by leg: each takes 600 ms, starting 150 ms apart (3 trips ≈ 0.9 s). Their markers and bubbles appear when they finish. Trips already on the map (saved trips) are not re-animated |
| `idle` / omitted | Nothing extra |

- **Camera:** when origin and destination are both known (or one changes) during `locating` / `searching`, the camera
  fits to them (800 ms). When the routes arrive, the app's `fitKey` changes as usual and the camera fits to the routes
  **once, as they start drawing**, so they draw into view. Selecting never moves the camera.
- **Selection, colours and looks** work during the draw: tapping a half-drawn route selects it, and the drawing
  uses the same features as the finished routes.
- **Reduced motion:** with the system's "reduce motion" setting (`prefers-reduced-motion: reduce`), nothing animates.
  Routes appear complete, the searching line holds still and the camera jumps to the trip.
- **Mobile:** `buildPreview` is plain JSON, so it crosses into the DOM map unchanged (`RouteMapDom` accepts it).
- **How:** the pure helpers in [`src/build-preview.ts`](src/build-preview.ts) (`sliceLine`, `revealFeatures`,
  `previewFeatures`) compute each frame; the renderer only calls `setData` on two small sources per frame. Both loops
  run in `useLayoutEffect`, so a frame can never land after React has replaced the data (that left a stale searching line).

**Wiring it to the agent (plan 029, #55).** Build `buildPreview` from `useAgentChat().progress` (Place → its
`coordinates`):

| `progress.phase` (plan 029) | `buildPreview` | `itineraries` |
| --- | --- | --- |
| `thinking`, `locating` | `{ phase: 'locating', candidates, origin?, destination? }` | unchanged |
| `searching` | `{ phase: 'searching', origin, destination }` | unchanged |
| `routes`, `done` (with a plan) | `{ phase: 'drawing', origin, destination }` | `progress.plan.itineraries` (and change `fitKey`) |
| `idle`, `error` | omit | unchanged |

Pass the itineraries and `phase: 'drawing'` **in the same render**: only trips that are new while the phase is
`drawing` draw in. Clear the preview on a new turn, cancel or error.

### How legs join up

Real Transitous data has small gaps (9 to 48 m) between legs: a walk ends on the pavement, the bus starts at the stop
in the road. `drawnLegLines()` closes every gap of **100 m or less**:

- Walk / bike into a bus, train or ferry: the **walk is extended to the stop**, so the transit line isn't bent.
- Anything else: the next leg starts from where the previous one ended.

Start, end and transfer markers sit on these joined ends. Gaps over 100 m stay as they are (they mean real data
trouble, which shouldn't be hidden).

---

## `<RouteMap>` props

The contract is [`src/contract.ts`](src/contract.ts) (`RouteMapProps`). Mobile's `RouteMap` takes exactly the same props.

| Prop | Required | What it does |
| --- | --- | --- |
| `itineraries` | yes | Trips to draw |
| `styleUrl` | yes | Basemap style URL (the app passes it; the map never reads env) |
| `onRouteSelect(id, candidates)` | yes | The user tapped a trip. `candidates` = every trip under the tap, topmost first |
| `selectedItineraryId` | | The highlighted trip. The app owns it |
| `onDeselect()` | | The user tapped empty map while something was selected |
| `visibleModes` | | Mode filter for tabs |
| `fitKey` | | Change it to zoom to the visible trips |
| `padding` | | `{ top, right, bottom, left }` px to keep routes clear of panels and buttons |
| `routeColors` | | Colour per trip id. Without it the map uses `assignRouteColors` |
| `unfocusedColors` | | `'trip'` (default) · `'grey'` · `'mode'`: colour of unselected trips |
| `variant` | | none (default look) · `'saved'` · `'choosing'`: see [What the map looks like](#what-the-map-looks-like) |
| `accentColor` | | The `choosing` colour. Default `#6750A4` |
| `userLocation` | | `[lng, lat]` for the "you are here" dot |
| `userHeading` | | Compass heading in degrees (0 = north) for the cone. The map never asks for permission |
| `locateKey` | | Change it to pan to `userLocation` (e.g. a counter bumped by the locate button) |
| `buildPreview` | | While the agent builds a trip: `{ phase, origin?, destination?, candidates? }`. See [Animating while the agent works](#animating-while-the-agent-works-plan-030) |

`onDeselect`, `userHeading`, `locateKey`, `unfocusedColors`, `variant` and `accentColor` are new in this PR and all
optional, and leaving them out keeps the original look, so existing callers (web, demo) look exactly as before.

### What the pure package exports (`@transit/maps`)

| Export | Use |
| --- | --- |
| `MODE_COLORS`, `UNFOCUSED_ROUTE_COLOR`, `FOCUS_INK`, `PALETTE` | Colours |
| `mainMode(itinerary)` | The mode the trip covers the most distance with |
| `assignRouteColors(ids, saved?)`, `routeColor(id)` | Stable per-trip palette colours |
| `drawnLegLines(itinerary)` | Each leg's line with the small gaps joined |
| `transitLegLabels(itinerary, timeZone?)` | `{ legId, mode, text, coordinates }` for each bus / train / ferry leg |
| `itinerariesToFeatures`, `itineraryPoints` | GeoJSON for lines and markers |
| `routeLayers({ hitLineWidth, unfocused, variant, accentColor })` | The MapLibre style layers |
| `boundsOf`, `uniqueItineraryIds`, `nextRouteToSelect` | Camera box, tap handling, cycling |
| `sliceLine`, `revealFeatures`, `previewFeatures` | The build animation's frames (plan 030) |
| `previewLayers(accentColor?)`, `PREVIEW_SOURCE_ID` | The pins / searching-line layers |
| `metersBetween(a, b)` | Distance in metres between two `[lng, lat]` points |
| `presetColor`, `presetIcon`, `presetPlace(key, profile)` | A location preset's colour / icon / place, with defaults (plan 038) |
| `presetForPlace(place, profile)`, `presetTripColors(trips, profile)` | Which preset a place belongs to (closest within `PRESET_MATCH_METERS`, 150 m); saved-trip id → preset colour |
| `DEFAULT_PRESET_COLORS`, `DEFAULT_PRESET_ICONS` | Home purple, Office blue, Gym green (all from `PALETTE`); `home`, `work`, `fitness` |
| `DEFAULT_ACCENT_COLOR`, `END_ICON_ID`, size constants | Shared constants |

---

## How it works inside

```
Itinerary[] ──▶ itinerariesToFeatures() ──▶ routeLayers() ──▶ <RouteMap> (react-map-gl + MapLibre)
                itineraryPoints()            drawing rules        + <Marker> location dot
                drawnLegLines()              (style-spec JSON)    + <Marker> line bubbles
                transitLegLabels()
    ▲                                                                   │ tap
    └── app updates selectedItineraryId ◀── onRouteSelect / onDeselect ◀┘  (nextRouteToSelect picks the trip)
```

Everything before `<RouteMap>` is plain, tested TypeScript with no React or MapLibre. Only `src/web/` knows about them.

| File | What's in it |
| --- | --- |
| [`src/contract.ts`](src/contract.ts) | `RouteMapProps` |
| [`src/colors.ts`](src/colors.ts) | Palette, mode colours, widths, `assignRouteColors` |
| [`src/to-geojson.ts`](src/to-geojson.ts) | Features (each leg: colour, mode colour, main mode colour, dash, selected, sort key), markers, leg joining, main mode, bubble labels |
| [`src/layers.ts`](src/layers.ts) | Line, casing, hit, marker and end-icon layers; the three looks (`look()`) |
| [`src/bounds.ts`](src/bounds.ts) | Camera bounds, ids under a tap, tap cycling |
| [`src/build-preview.ts`](src/build-preview.ts) | The build animation: line slicing, route reveal, pins and searching line |
| [`src/web/RouteMap.tsx`](src/web/RouteMap.tsx) | The React component: sources, layers, taps, camera, location dot, bubbles |
| [`src/web/LegBubble.tsx`](src/web/LegBubble.tsx) | One line bubble (Material bus / train / ferry icons) |
| [`src/web/end-icon.ts`](src/web/end-icon.ts) | Draws the end icon into the map's image store |
| [`src/samples.ts`](src/samples.ts) | Generated example routes (don't edit) |
| [`src/test-helpers/style-expressions.ts`](src/test-helpers/style-expressions.ts) | Evaluates style expressions in tests, so tests check what MapLibre would actually draw |

Notes:

- **Markers are circle layers**, not HTML, so thousands stay cheap and they sort with the lines (`circle-sort-key`).
  The end icon is a symbol layer on top of the end dot. If the style loses the icon (style reload), a
  `styleimagemissing` listener adds it back.
- **Bubbles and the location dot are HTML** (`<Marker>`), because they need text, an SVG icon and rotation.
- **Lane data is still computed** (`lane`, `direction` on each feature, `laneOrder`), but no layer uses it: routes
  overlap 100% (see Decisions). Bringing lanes back would be one `line-offset` paint property.
- Touch screens are detected with the `(pointer: coarse)` media query (`useSyncExternalStore`), which picks the wider
  tap area.

---

## Decisions and why

Decided with @KrakenTheJaken, mostly on 2026-11-14 while testing on an iPhone in Expo Go.

| Decision | Why |
| --- | --- |
| **Expo DOM, not native MapLibre** (plan 009 rewrite) | One renderer for web and mobile; works in **Expo Go**, so iPhones can test without a Mac, a paid Apple account or a dev build. Native MapLibre needs a custom dev build |
| **Tap again to cycle** (P1), no picker | The ring picker was fiddly on a phone (tiny targets, an extra tap). Cycling needs no extra UI |
| **Tap empty map to deselect** | The expected way to "go back" on a map |
| **Routes overlap 100%, no lanes** (team decision, 2026-11-15; replaces the PR #76 lanes rule) | Comparing the same route at different times drew identical paths as parallel lines, which looked like different routes. Overlapping is honest, and tapping the same spot again already cycles through every route underneath |
| **Home: each saved trip in its own colour, the selected one in mode colours** | Faded trips are told apart by colour; the trip you tap shows how you travel (walk grey, bus orange, train purple) |
| **Results follow Figma frame 02** | Grey options, one purple chosen route, hollow start, bubbles. Choosing is a different task from browsing saved trips |
| **Main mode = by distance** | A 2-minute walk shouldn't make a bus trip grey. Distance matches what you see on the map |
| **Saving stores the `assignRouteColors` colour** (PR #76 review) | Plan 009's colour rule; every saved trip gets a distinct colour. Storing the main mode colour instead made two saved bus trips both orange |
| **Default look unchanged** (PR #76 review) | The web map and demo pass no `variant`; they must look the same as before. The new looks are opt-in |
| **Worker built into the DOM bundle** (PR #76 review) | A separate worker file isn't found in exported builds; see [Why the worker is built in](#why-the-worker-is-built-in) |
| **Transfer ring = the colour of the leg you switch onto** | It tells you what you're about to board |
| **End marker has the icon, start is a plain dot** | The destination is what you look for; the start is usually "here" |
| **Everything faded until selected** (saved look) | With several saved trips, nothing should shout until you pick one |
| **Lines grow as you zoom in** | Easier to tap when you're close; they still don't scale like roads |
| **Wider tap area on touch** (34 px) | Fingers aren't mice |
| **Location loads when the app opens** | The team decided against tap-only (**overrides 018-Q1**). The locate button now pans to you |
| **Compass cone on the location dot** | Shows which way you're facing, like other map apps |
| **Results accent is always `#6750A4`** (option A) | The dark theme's purple (`#D0BCFF`) was too pale on the light basemap. Revisit with a dark basemap |
| **Basemap: Positron** light default | Clean and quiet under coloured routes. **Liberty** is a colourful alternative (teammates liked it, the owner doesn't), **Fiord** for dark. A UI switch comes later |
| **Bubbles only in results** | Figma frame 02 has them; on Home they'd clutter several saved trips |
| **Bubble text drops "Bus" and AM/PM** | `SL1 · 8:58` fits; the icon already says it's a bus |
| **Material icons in bubbles** | Hand-drawn 14 px icons made the train look like a bus |
| **Keep the right 80 px clear** | The ferry bubble was cut off and routes ran under the locate / layers buttons |
| **030-Q1: routes draw in about 1.2 s** (600 ms each, 150 ms apart) | Fast enough not to delay the result, slow enough to see the trip being built |
| **030-Q2: a moving searching line** | Shows the agent is working on *this* trip; it disappears when routes start drawing. A travelling segment, because MapLibre can't animate a dash pattern from data |
| **030-Q3: faded candidate pins** | Shows the agent comparing places; they disappear once both ends are set |
| **Fit when routes arrive, not after they draw** | Home already re-fits on new trips; fitting again after the draw would move the camera twice |
| **Location presets own their colour** (plan 038, #85) | "The green line is my gym trip". The colour lives with the place (`profile.presets`), so every saved trip there matches and follows changes live. Colours come from `PALETTE`; other trips never borrow a preset colour because fixed colours count as taken in `assignRouteColors` |
| **150 m to match a trip to a preset** | Close enough for "the same place" (a station entrance vs the building), far enough apart that Home and a nearby café don't clash; the closest preset wins |
| **Gym's place lives in `presets.gym.place`; Home / Office stay `profile.home` / `profile.work`** | Settings (#87) already edits Home and Work; the preset sheet links there instead of duplicating it |
| **An "Edit" chip opens the preset menu, not long-press** (plan 038 STOP condition) | Long-press needs the `combinedClickable` modifier, which Expo Go 58 rejects on Android ("Cannot set prop 'modifiers'"). The Edit chip sits after Gym in the chip row and opens a menu (Home / Office / Gym, icons in their colours); tapping a preset chip still plans the trip |
| **The Gym place search is drawn in Compose inside the sheet** | The shared `PlaceField` hosted in the sheet (`RNHostView`) got no keyboard input. The sheet copies its field + results in Compose, and uses `imePadding()` + `verticalScroll()` so Save and Cancel stay above the keyboard |
| **Route lines simplified per zoom** (`tolerance: 4` on the route source) | Real legs end in tiny kinks (a bus's last 9 m turning into the stop, an 11 m walk between stops). With lanes, a kink only ~2 px long stuck out as a visible "hook". MapLibre now drops kinks too small to see at the current zoom; kept after lanes were removed because it also keeps lines tidy into stops. Whole routes look the same |

---

## Tried and dropped

So nobody repeats them:

- **Native MapLibre React Native** (`@maplibre/maplibre-react-native`). Worked on Android with a dev build, but needs
  a custom build for every native change and can't run on an iPhone without a Mac / paid account. Replaced by the DOM
  approach.
- **The ring picker** for overlapping routes. Replaced by tap-to-cycle.
- **Side-by-side lanes** (`line-offset`, 10 px apart). Tried twice: broken corners and floating markers the first time;
  the second time (after the PR #76 review) they made the same route at different times look like different routes.
  Routes now overlap; tap again to cycle.
- **Saving the main mode colour.** Two saved bus trips were both orange; saving now stores the `assignRouteColors` colour.
- **The worker as a file in `apps/mobile/public/`.** Fine in Expo Go, blank map in exported builds.
- **Grey / mode colours as the default look.** Changed how the web map and demo looked; the default is back to the
  original look.
- **Hybrid colours** (trip colour when faded, mode colours when selected) everywhere. Confusing; split into the
  two looks above.
- **The dark theme accent** `#D0BCFF` on the light basemap. Too pale.
- **`React.memo` around the DOM component.** Caused a red box ("Object is not a function") during Fast Refresh.
- **Long-press on the preset chips** (`combinedClickable`). Unsupported in Expo Go on Android; replaced by the Edit chip.
- **`PlaceField` inside the preset sheet via `RNHostView`.** The keyboard never reached it and the buttons went off-screen;
  replaced by a Compose search field in the sheet.
- **Joining gaps by bending the transit line** to the walk's end. Left a "T" stub at stops; now the walk is extended.

The example routes come from **Transitous** (MOTIS v5, transit) and **OSRM** (driving), fetched by
`scripts/gen-samples.mjs`:

- Lines are simplified (Douglas–Peucker, 2 m), so files stay small without visible change.
- MBTA routes are preferred. A non-MBTA coach looped through bus terminal ramps and drew a "Z" spike.
- A leg with an empty path (e.g. a walk inside a station) falls back to a straight line between its stops.

---

## Status and what's next

Plan 009 (#13): mobile shows the web map in an Expo DOM component. Android is the target for the MVP; iOS works in Expo
Go and is otherwise parked.

| Done | |
| --- | --- |
| ✅ Map logic (`@transit/maps`) | Colours, line styles, features, leg joining, main mode, bubble labels, layers, bounds, tap cycling |
| ✅ Web map (`@transit/maps/web`) | `RouteMap`, two looks, markers + end icon, bubbles, location dot + cone, pan to location, deselect |
| ✅ Mobile map | DOM component in Home's `MapSlot`; worker built into the bundle (no CDN, works in exported builds); live location + compass; top padding from `HomeChrome` |
| ✅ Example routes + demo | `@transit/maps/samples` (incl. `testScenarios`), `npm run demo:maps` |
| ✅ Tests | 127 unit tests in `@transit/maps` |
| ✅ Android proof | Pixel 10, Android 17 (beta), Expo Go 58.0.5, light and dark; see [Android proof](#android-proof-pr-76) |

### Android proof (PR #76)

Plan 009 step 6, in Expo Go on a Pixel 10 (Android 17 beta, Expo Go 58.0.5), dark and light mode:

| Check | Result |
| --- | --- |
| Saved trips on Home | ✅ side by side, each in its own colour |
| Tap selects, tap again cycles | ✅ |
| Selecting doesn't move the camera | ✅ identical framing before and after |
| Sheet vs map gestures | ✅ dragging the sheet doesn't pan the map; panning the map doesn't move the sheet |
| Results | ✅ grey options; chosen route purple with bubbles; the same card highlights |
| Saved colour | ✅ a saved result keeps its own colour on Home |
| Worker, no CDN | ✅ workers start from `blob:` URLs; only the app's own code and `tiles.openfreemap.org` are requested |
| Commute and flight samples, empty list | ✅ render; empty list doesn't crash |
| Fit / padding | ✅ below the search bar, above the sheet (tight to the results sheet's edge) |
| Light and dark mode | ✅ |

Not tested: a low-end Android phone; iOS beyond Expo Go on an iPhone (iOS is parked).

**Plan 030 (#56, in progress):** renderer, pure helpers, tests and the demo scenario are built. Live wiring is
@Cattn's #55 (plan 029); #56 closes with Android proof of the real agent flow.

Scripted Android check (temporary consumer, not committed), Pixel 10, Android 17 beta, Expo Go 58.0.5:

| Check | Result |
| --- | --- |
| Pins → camera to the trip → searching line → routes draw in | ✅ dark and light |
| Smoothness while drawing (measured in the map's web view) | ✅ 182 frames in 1.5 s (≈120 fps), longest gap 8 ms |
| Tap a route mid-draw | ✅ it is selected while drawing; bubbles appear when it finishes |
| Reduced motion (Android "Remove animations") | ✅ the web view reports it; no pulse, routes appear complete |
| Saved trips | ✅ unchanged before the build starts |

Found on the way (not map code): with "Remove animations" on, Home's Android sheet reports 80 px instead of its real
~376 px, so every fit (normal or animated) puts routes under the sheet. Reported for `HomeChrome.android.tsx`.

**Later (decided to wait):**

- [ ] **Basemap switch** in the UI: Positron (light default), Liberty (colourful), Fiord (dark). Keep `styleUrl` app-supplied.
- [ ] **Results accent in dark mode**: switch to the dark theme's purple together with a dark basemap.
- [ ] **Colours**: final review of mode colours against the mockup.
- [ ] **Sizes**: line widths, marker sizes, end icon and bubble / bubble icon size from the final mockup.
- [ ] **Bubbles over markers**: a bubble can cover a marker of another route; consider hiding overlapping bubbles.
- [ ] **Results fit**: a little gap between the routes and the top of the results sheet (`bottom: sheetHeight + 16`).
- [ ] **Faded line ends**: where two faded legs meet, their see-through round ends overlap into a darker dot; fade
  with lighter solid colours instead of transparency.
- [ ] **Mode tabs filter the home map** (P2): pass the Transit / Drive / Fly tab's modes as `visibleModes`.
- [ ] **Flights** on the map (plans 011 / 024).
- [ ] **Startup "DomWebView" red box** ("Unable to find the 'DomWebView' view with tag"): an Expo DOM glitch on first
  mount in dev; harmless.
- [ ] **Low-end Android** performance check.
- [ ] **Palette in shared** (017-Q1): move `PALETTE` / `routeColor` / `assignRouteColors` to `@transit/shared`.
- [ ] **Bike-share docks** (#14): an optional `docks` prop and a pin layer.
- [ ] **Demo**: show the `choosing` look and bubbles in `demo/App.tsx`.

**Next plans for maps:** 027 web results (#45: card ↔ map selection, the selected-route card), then 030 map build
animation (#56: a `buildPreview` prop; mobile gets it through the DOM map for free). Their open questions (027-Q1,
Q3–Q5; 030-Q1–Q3) are answered by @KrakenTheJaken.

---

## Rules (people and coding agents)

1. **The map only draws.** It never fetches data, saves anything, asks for permissions or decides the selection.
   Trips go in, taps come out.
2. **Coordinates are `[longitude, latitude]`.** Convert other formats on the server, never in map code.
3. **`@transit/maps` stays pure.** No React or MapLibre imports there; the server imports it. UI code lives in `/web`.
4. **One colour scheme per screen.** Compute the colours once and pass the same map to `<RouteMap routeColors>` and
   the cards. The map never stores colours; saved colours come from the app.
5. **Mobile uses the web map.** Change `src/web/`, not a native copy. Props crossing into the DOM component must be JSON.
6. **Changing the props or feature data?** Say so on #13 first; the UI team builds on them. New props stay optional.
7. **Repo code rules:** no new code comments, no new test files (add cases to the existing `*.test.ts`), keep logging.
8. **Plan 009 is claimed** (#13). Don't re-implement it; comment on the issue instead.

---

## Development

```sh
npm run demo:maps                    # the demo, http://localhost:5180
npm run test:unit -w @transit/maps   # 127 tests
npm run build -w @transit/maps       # build to dist/ (the root build:shared does this too)
npm run typecheck -w @transit/maps   # package + demo
node packages/maps/scripts/gen-samples.mjs packages/maps/src/samples.ts   # refetch example routes (needs internet)
```

After changing the package, rebuild it (`npm run build -w @transit/maps`, or keep `npm run dev -w @transit/maps`
running) so the mobile app picks it up, then reload Expo Go.

```
src/              the package; tests sit next to each file
  web/            RouteMap, LegBubble, end-icon   →  @transit/maps/web
  samples.ts      example routes                  →  @transit/maps/samples (generated, don't edit)
  test-helpers/   style-expression evaluator for tests
demo/             the demo page
scripts/          gen-samples.mjs
```

**Example routes** (`@transit/maps/samples`): `commuteOptions` (Red Line, bus, car), `flightOptions`, and
`testScenarios` with harder real trips: `airport` (Red Line + SL1 to Logan), `fenway` (Red Line + 47 bus),
`ferry` (Charlestown ferry), `bikeRail` (bike to the train) and `roundTrip` (a trip and its return on the same streets).
Each is also exported on its own (`airport0`, `fenway1`, …).

**Testing on a phone:** to check a change quickly, temporarily point Home's `MapSlot` at `testScenarios` and a fixed
selection, take screenshots, then put it back. Don't commit that.

---

## Gotchas

- **Blank map on the web:** the MapLibre setup from "Use it on the web" is missing, or the map's box has no height.
- **Blank map or "Unable to resolve ./maplibre-gl-worker" on mobile:** `apps/mobile/src/map/maplibre-gl-worker.js` is
  missing. Run `npm install` (its `postinstall` generates it).
- **"Unable to resolve @expo/metro-runtime"** when bundling the DOM component: the DOM dependencies are missing; they
  are `@expo/metro-runtime`, `react-dom`, `react-native-web` (install with `npx expo install`).
- **Red box "Unable to find the 'DomWebView' view with tag"** on first load: known Expo glitch, ignore it.
- **Props that are `Map`s, class instances or functions** don't cross into a DOM component as-is; see
  [The prop boundary](#the-prop-boundary-important).
- **Imports inside `src/`** need `.js` endings (`'./colors.js'`), because of the repo's NodeNext setting.
- **`react-dom` is pinned to 19.3.0**: newer versions clash with the repo's React.
- **EAS builds** run `eas-build-post-install` (builds shared → maps → client-react), because the app imports the
  built packages.
- **Changed the package but the phone shows the old map?** Rebuild `@transit/maps`, then reload Expo Go.
- **Routes on the same street look like one line:** that's intended (no lanes). Tap the same spot again to cycle
  through the trips underneath.
