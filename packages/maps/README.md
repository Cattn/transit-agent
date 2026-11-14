# @transit/maps

Draws trips on a map. Give it `Itinerary[]` (from `@transit/shared`) and it shows each trip in its own
colour, styles each leg by how you travel, and tells the app which trip the user clicked.
Works on the web today; mobile is next.

- Plan: [`plans/009-maps-package-contract.md`](../../plans/009-maps-package-contract.md)
- Issue: #13 · Owner: @KrakenTheJaken

---

## Run the demo

From the repo root:

```sh
npm install
npm run demo:maps
```

Open **http://localhost:5180**. No server, no API key and no build step needed.

What you can try:

- **Transit / drive**: one trip (MIT → South Station) by Red Line, bus and car.
- **Flying**: MIT → Orlando, flying from Boston, Providence (into Sanford) or Manchester.
- Click a route, or a card on the left, to select a trip. The others fade.
- Click where routes overlap: a ring of coloured circles lets you choose. Hover a circle to preview.

The demo's code is small: [`demo/App.tsx`](demo/App.tsx) is the whole page.

---

## Put a route on the map

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
        onRouteSelect={(id) => setSelected(id)}   // called once the user picks a trip
        styleUrl="https://tiles.openfreemap.org/styles/positron"
        fitKey={trips.map((t) => t.id).join()}    // change it to zoom to the routes
      />
    </div>
  );
}
```

**3. Showing result cards too?** Give them the same colours as the map: compute the colours once and pass the
same map to both.

```tsx
import { assignRouteColors } from '@transit/maps';

const routeColors = useMemo(() => assignRouteColors(trips.map((t) => t.id)), [trips]);
// <RouteMap ... routeColors={routeColors} />   and in a card:   routeColors.get(trip.id)
```

**4. No data yet?** Use the example routes: `import { commuteOptions, flightOptions } from '@transit/maps/samples'`.

Each leg needs a `geometry`: a GeoJSON `LineString` with at least 2 points in **`[longitude, latitude]`** order.
A flight is just a leg with `mode: 'flight'`; the server sends its curved path (plan 011).

---

## Status and what's next

| Done | |
| --- | --- |
| ✅ Map logic (`@transit/maps`) | Colours, line styles, side-by-side lanes, map data, drawing rules, zoom box. 46 tests |
| ✅ Web map (`@transit/maps/web`) | `RouteMap` + the overlap picker |
| ✅ Example routes (`@transit/maps/samples`) | Real street geometry, sample flights |
| ✅ Demo | `npm run demo:maps` |

**Next:**

- [ ] **Mobile map** (plan 009 step 7): MapLibre React Native. Needs an Expo dev build; it can't run in Expo Go.
- [ ] **Use it in the app screens** (UI team, #16): add the MapLibre setup above to `apps/web`, then mount `<RouteMap>`.
- [ ] **Shared colours** (#25): move the palette and `assignRouteColors` to `@transit/shared`. For saved trips to keep a colour across sessions, store it with the trip.
- [ ] **Real routes** (#11): server results replace the example routes. No map changes needed.
- [ ] **Bike-share docks on the map** (#14): an optional `docks` prop and a pin layer.

**Ideas for later:**

- Highlight a route when its result card is hovered or tapped (apps can already do this through `selectedItineraryId`).
- Time labels on each route, like "15 min" bubbles.
- Shift only the parts of routes that overlap, instead of whole routes.
- Move the start/end dots with their lane.

**Open decisions:** basemap provider (D8; OpenFreeMap proposed: free, no key). The package is pre-built to `dist/` like `@transit/shared`.

---

## Rules (people and coding agents)

1. **The map only draws.** It never fetches data, saves anything or decides the selection. Trips go in, clicks come out.
2. **Coordinates are `[longitude, latitude]`.** Convert other formats on the server, never in map code.
3. **`@transit/maps` stays pure.** No React or MapLibre imports there; the server imports it. UI code lives in `/web`.
4. **One colour scheme.** Compute `assignRouteColors(ids)` once for everything on screen and pass that same map to
   `<RouteMap routeColors>` and the result cards. Don't recompute it for a filtered subset.
5. **Changing the props or feature data?** Say so on #13 first; the UI team builds on them.
6. **Plan 009 is claimed** (#13). Don't re-implement it; comment on the issue instead.

---

## How it works

```
Itinerary[] ──▶ itinerariesToFeatures() ──▶ routeLayers() ──▶ <RouteMap>
                itineraryPoints()            drawing rules     react-map-gl + MapLibre
                (lines, dots, colour,
                 dash, lane, selection)
    ▲                                                              │ click
    └─ app updates selectedItineraryId ◀─ onRouteSelect ◀─ picker if several routes
```

Everything before `<RouteMap>` is plain, tested TypeScript. Only `src/web/` knows about MapLibre.

### How the map behaves

| Behaviour | How |
| --- | --- |
| A colour per trip | A hash of the trip id picks one of 8 colours; `assignRouteColors` moves clashes to a free colour. Re-ordering the trips never changes their colours |
| Line style per mode | Walk dotted · bike, bikeshare, flight dashed · bus, rail, ferry, car solid |
| Tap selects the whole trip | Every leg carries its trip id |
| Overlapping routes | Each trip gets a lane 10 px to the side, ordered so lanes push routes apart. Works for trips going opposite ways too (e.g. a commute and its return) |
| Readable when zoomed out | Lines are 3 px wide zoomed out, 5 px at city zoom |
| Easy to click | An invisible 14 px line catches clicks |
| Several routes under a click | The ring picker appears at the click; the app gets one `onRouteSelect` |
| Tabs (`visibleModes`) | A trip shows only if every leg's mode is allowed |

### `<RouteMap>` props

| Prop | What it does |
| --- | --- |
| `itineraries` | Trips to draw |
| `selectedItineraryId` | The highlighted trip (the app owns it) |
| `onRouteSelect(id, candidates)` | The user picked a trip; `candidates` = all trips under the click |
| `styleUrl` | Basemap style URL |
| `visibleModes` | Optional mode filter for tabs |
| `fitKey` | Change it to zoom to the visible trips (selecting doesn't move the camera) |
| `userLocation` | Optional `[lng, lat]` for a "you are here" dot |
| `padding` | Optional space to keep routes clear of panels |
| `routeColors` | Optional colour per trip id. Pass the same map your result cards use; without it the map uses `assignRouteColors` itself |

---

## Development

```sh
npm run demo:maps                    # the demo, http://localhost:5180
npm run test:unit -w @transit/maps   # 46 tests
npm run build -w @transit/maps       # build to dist/ (the root build:shared does this too)
node packages/maps/scripts/gen-samples.mjs packages/maps/src/samples.ts   # refetch example routes (needs internet)
```

```
src/              the package; tests sit next to each file
  web/            RouteMap, RoutePicker  →  @transit/maps/web
  samples.ts      example routes         →  @transit/maps/samples (generated, don't edit)
demo/             the demo page
scripts/          gen-samples.mjs
```

### Gotchas

- **Blank map:** the MapLibre setup from step 1 is missing, or the map's box has no height.
- **Imports inside `src/`** need `.js` endings (`'./colors.js'`), because of the repo's NodeNext setting.
- **`react-dom` is pinned to 19.3.0** here: newer versions clash with the repo's React.
- **Mobile:** MapLibre React Native needs the Expo dev client (`npm run build:android`, then `npm run dev:client` in `apps/mobile`).
