# Plan 026: Build the web map home (left panel, permanent agent, light and dark)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If a STOP condition occurs, stop and report. When done, update
> this plan's row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 1e8328a..HEAD -- apps/web packages/maps/src/web packages/client-react/src`
> The web page in Figma has two frames, not the six mobile ones. If a third web frame appears, do not invent a plan for it here. Add a question on this issue and wait for this file to be updated.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: LOW
- **Depends on**: none. Uses merged plans 004, 012, 013, 015 (`@transit/client-react`), 016, and the merged web map from 009 (`@transit/maps/web`).
- **Category**: implementation (first-pass UI)
- **Planned at**: commit `bd41542`, 2026-11-14; refreshed at `1e8328a` (hooks and web map are merged; mount the real map)
- **Issue**: https://github.com/Cattn/transit-agent/issues/42

<!-- help:start -->
## Who's on it & how to help

- **Status:** 📝 **First draft.** Feedback welcome. The web file is two screens (home, and planning in plan 027) plus the same two in dark. Settings, filters, and fly are not drawn on web yet.
- **Owner:** Nobody yet. Suggested: @Rad1ee @DMFriends
- **Up for grabs?** Yes, for UI. Map drawing stays with @KrakenTheJaken.
- **Waiting on:** Nothing. The web map (`@transit/maps/web`) and the React hooks (`@transit/client-react`) are on main. **This is the first MVP screen** (see `plans/README.md`).

**Open questions** — @Rad1ee @DMFriends: reply as `026-Q1: ...`. Use the proposed defaults until answered.

- 026-Q1: two panels, as drawn, rather than one combined side panel? *(proposed: yes)*
- 026-Q2: settings button does not navigate yet? *(proposed: yes)*
- 026-Q3: drop the sample recent rows, "2 tickets", "Weekend: Seaport", and "Live vehicles"? *(proposed: yes)*
- 026-Q4: the three suggestion strings are the ones to send? *(proposed: yes, until the frame changes)*
- 026-Q5: what should change before a first web build?

**How to help**
- **Take it:** comment "taking this" and assign yourself.
- **With a coding agent:** pull `main`, then:
  > Read `plans/026-web-map-home.md` and follow it step by step. Only change files under Scope. Stop on a STOP condition. Don't push. When an answered question changes a step, update this same plan before building.
- **Just feedback:** answer by question number. The mockup is a first pass.

<!-- help:end -->

## This plan will change

First Figma pass of page `Web — Desktop` (`2025:2`), read 2026-11-14. Web has fewer screens than mobile, and that set will grow. Re-read the issue before building. If a panel width or section disappears, replace **Current state**. Keep one `TripDraft` shared by the left panel and the agent.

## Why this matters

The site still opens on three "Coming soon" cards. The draft replaces that with a map, a trip list, and a permanent agent panel. Chat on web stays on screen (decided on #16). It is not the mobile sheet.

## Current state

- `apps/web/src/App.tsx` renders `sections` from `@transit/shared` as "Coming soon" cards and calls `createApiClient(import.meta.env.VITE_API_URL ?? '')`. Replace the cards. Keep using the page's own CSS. `apps/web/src/styles.css` is plain CSS. Do not add Tailwind.
- `apps/web/package.json` depends on `@transit/shared`, `@transit/client-react`, React 19.3, and Vite. No router, no map package yet. Scripts include `typecheck` (`tsc --noEmit`). `vite.config.ts` proxies `/api` to `http://localhost:3001`, so an empty `VITE_API_URL` means "same origin through the proxy".
- `@transit/client-react` (merged in #47) exports `ApiProvider`, `useTripDraft`, `usePlanTrip`, `useSavedItineraries`, `useAgentChat`, `usePlaceSearch`, `useDeviceId`, `useNow`. Use them; do not call the client directly where a hook exists.
- `@transit/maps/web` exports `RouteMap`; `@transit/maps` exports `assignRouteColors`. Setup, quoted from `packages/maps/README.md`: the app needs `maplibre-gl` and `react-map-gl` as dependencies, and once at startup:
  ```ts
  import 'maplibre-gl/dist/maplibre-gl.css';
  import { setWorkerUrl } from 'maplibre-gl';
  import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
  setWorkerUrl(workerUrl);
  ```
  `packages/maps/demo/App.tsx` is a complete working example of `RouteMap` + `assignRouteColors` + cards. Copy its pattern. The style URL is `https://tiles.openfreemap.org/styles/positron` (no key).
- Frames: `Web · 01 Home` (`2026:36`) and `Web · Dark · 01 Home` (`2028:688`). Both are 1440×900. Dark is the same layout.
- Left panel "Side panel · 400" (`2026:190`), 400×868, inset 16:
  - "Transit Agent", a notifications icon, a settings icon.
  - Search bar placeholder "Where to?".
  - A segmented control. Treat it as Transit / Drive / Fly, same as mobile, writing `modeGroups` into `draft.modes` without clearing from, to, or time. The segment labels are inside the Material component instance. If a build finds different words in the file, use those words and update this plan.
  - "Tracked trips" and "2 watching · live". The count is saved trips with `watch === true`, not the number 2. "live" is allowed only when one of those trips has a realtime leg. Otherwise "watching".
  - Two tracked-trip cards. Same binding as plan 020: title from the saved label, leave-by from `watchStatus.leaveBy ?? leaveBy`, formatted with `leaveByLabel(leaveBy, new Date())` when present, and no Live pill on a scheduled trip.
  - "Saved places": Home, Office, Gym, Add place. Home and Office set origin or destination from `profile.home` and `profile.work` when set. Gym and Add place do nothing that writes, until 025-Q2 is answered for mobile and repeated here. The mock profile starts empty.
- Agent panel "Agent panel · permanent" (`2026:371`), 380×868:
  - "Trip agent" / "Edits the same filters you see".
  - Empty state: "Where are you headed?" and "Describe the trip in your own words. I'll set the filters on the left — you can change anything."
  - The three suggestion chips in question 4.
  - Composer placeholder "Ask about a trip…". Mic does nothing (same proposal as 020-Q3). Send calls `sendAgentMessage` with the current `TripDraft`.
- Map chips above the map: "Commute" and "Gym" selected in the sample, plus "Weekend: Seaport" and "Live vehicles". Follow question 3.
- Map controls: zoom +/−, and two FABs. Zoom calls the map if `RouteMap` exposes it. One FAB is location. There is no web location helper. The tap does nothing until a web location plan exists. Do not add a geolocation call in this plan.
- Saved routes drawn on the frame are "Saved · Commute (Bus 1)" and "Saved · Gym (Orange Line)", pins Office and Gym. The app does not draw them. Pass saved itineraries, `selectedItineraryId`, `onRouteSelect`, `visibleModes`, and padding `{ top: 16, right: 420, bottom: 16, left: 432 }` so the panels are not covered. `styleUrl` is the OpenFreeMap URL above. Compute `assignRouteColors` once over every itinerary on screen and pass the same map to `RouteMap.routeColors` and to the card swatches.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run typecheck -w @transit/web` | exit 0 |
| Lint | `npm run lint` | exit 0 |

## Scope

**In scope:**
- `apps/web/src/App.tsx`, `apps/web/src/main.tsx` (MapLibre setup only)
- `apps/web/package.json` and `package-lock.json` (add `@transit/maps`, `maplibre-gl`, `react-map-gl` only)
- `apps/web/.env.example` (add `VITE_API_MODE=mock`)
- `apps/web/src/styles.css`
- `apps/web/src/home/Home.tsx`
- `apps/web/src/home/TripPanel.tsx`
- `apps/web/src/home/AgentPanel.tsx`
- `apps/web/src/data/client.ts`
- `apps/web/src/theme/appearance.ts`

**Out of scope:** `apps/mobile/**`, `packages/**` (use what is exported; ask on #13 if the map needs a change), `apps/server/**`, a settings page, a filters page, Tailwind.

## Git workflow

- Branch: `plan/026-web-map-home`
- One commit: `web: replace the coming-soon page with the map home (plan 026)`.
- Do not push unless told.

## Steps

### Step 1: One client (mock or server) and one draft

`src/data/client.ts` exports one client. When `import.meta.env.VITE_API_MODE === 'server'`, use `createApiClient(import.meta.env.VITE_API_URL ?? '', { deviceId })`, where `deviceId` is read from `localStorage` key `transit-agent.deviceId` or created with `createDeviceId()` and stored there. Otherwise use `createMockApiClient({ latencyMs: 0 })`. Mock is the default, so nobody needs a server to build UI. Wrap the app in `ApiProvider`. The draft comes from `useTripDraft()`.

`src/theme/appearance.ts` reads `prefers-color-scheme` and sets a `data-theme` attribute on `document.documentElement`. Light and dark CSS variables live in `styles.css`. No third theme. A settings toggle can come later, when a web settings frame exists.

**Verify**: `npm run typecheck -w @transit/web` → exit 0

### Step 2: Panels

Build the two panels from Current state. The agent empty state hides once `messages.length > 0`. Applied-change chips are provenance entries whose source is `'agent'`. Plan 027 fills the planning layout in the left panel. This plan shows the home list until a search has run.

**Verify**: `npm run typecheck -w @transit/web` → exit 0

### Step 3: Map

`npm install -w @transit/web @transit/maps maplibre-gl react-map-gl`. Add the MapLibre setup to `main.tsx`. Mount `RouteMap` from `@transit/maps/web` filling the page behind the panels, with the props and padding in Current state. Saved itineraries come from `useSavedItineraries({ enabled: true })`.

**Verify**: `npm run lint` → exit 0, then `npm run build:web` → exit 0. Manual: `npm run dev:web`, open http://localhost:5173, the two mock saved trips are drawn on the map.

## Test plan

Do not add tests or a runner. Run the typecheck and lint commands above.

## Done criteria

- [ ] `npm run typecheck -w @transit/web` exits 0
- [ ] `npm run lint` exits 0
- [ ] `App.tsx` no longer renders "Coming soon"
- [ ] `npm run build:web` exits 0
- [ ] The agent panel is in the document on first paint, not behind a button
- [ ] With `VITE_API_MODE` unset, the page works with no server running
- [ ] No sample row mentions "2 tickets"
- [ ] No files outside Scope are modified

## STOP conditions

- You are about to add a `/settings` or `/filters` route. Those frames do not exist. Ask on the issue instead.
- You are about to add Tailwind, a router, or a second map library.
- `RouteMap` cannot render without a change in `packages/maps`. Report it on #13.
- `createMockApiClient` or `applyDraftPatch` is not exported.
- Page `Web — Desktop` no longer has `Web · 01 Home`. Stop so this plan can be rewritten.

## Maintenance notes

When a question is answered or a frame changes, update this same plan and its issue. Strike answered questions and keep the decision and source link. Do not open a second plan for the same screen.

- Plan 027 replaces the left panel's list with results after a search, and fills the agent thread. It should import the client and the draft from this plan.
- When a web settings or filters frame is added, edit this plan or add one new plan. Do not bury that screen inside a step here after the fact.
- Panel widths (400 and 380) are from this pass. A redraw updates those numbers here.

## Open questions for review

See the help box at the top (026-Q1 to 026-Q5). It is the single list; answers are recorded there.
