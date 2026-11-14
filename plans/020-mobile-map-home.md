# Plan 020: Build the mobile map home (tracked trips, Transit/Drive/Fly, light and dark)

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 1e8328a..HEAD -- apps/mobile packages/client-react/src packages/maps/package.json`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: none to start. Uses merged plans 004, 012, 013, 015, 016, 018. Mounts the native map from 009 when `@transit/maps/native` exists; until then a placeholder.
- **Category**: implementation (first-pass UI)
- **Planned at**: commit `bd41542`, 2026-11-14; refreshed at `1e8328a` (015 hooks merged)
- **Issue**: https://github.com/Cattn/transit-agent/issues/39

<!-- help:start -->
## Who's on it & how to help

- **Status:** 📝 **First draft.** Feedback welcome before or during the build. Reuse merged 015 (hooks) and 018 (platform helpers); the native map is @KrakenTheJaken's plan 009.
- **Owner:** @DMFriends (assigned 2026-11-14 from the build timeline)
- **Up for grabs?** No. Talk to @DMFriends before starting related work.
- **Waiting on:** Nothing. If `@transit/maps/native` is not installed, show the placeholder in Step 4. Do not block on the map package.

**Open questions** — **@DMFriends answers these.** Reply as `020-Q1: ...`. Use the proposed defaults until answered.

- 020-Q1: follow this Figma pass (separate home sheet) rather than UI-5's one three-detent sheet? *(proposed: yes)*
- 020-Q2: tracked trips first, or the search field? *(proposed: tracked trips, as drawn)*
- 020-Q3: mic does nothing for now? *(proposed: yes)*
- 020-Q4: light and dark, default System? *(proposed: yes)*

**How to help**
- **Take it:** comment "taking this" and assign yourself, so two people don't build the same thing.
- **With a coding agent:** pull `main`, then tell your agent:
  > Read `plans/020-mobile-map-home.md` and follow it step by step. Run every verification command and check the output matches. Only change files listed under Scope. If a STOP condition happens, stop and tell me instead of working around it. Don't push. When done, show me the diff and the check results.

  Review what it did, then open a PR that says `Closes #39`.
- **Just feedback:** you do not have to take the plan. Comment `020-Q2: ...` on the issue, or say which frame feels wrong. This file gets edited when the mockups move. Do not open a second plan for the same screen.

<!-- help:end -->

## This plan will change

The frames below are a first pass in [Transit Agent Design Mockups](https://www.figma.com/design/noG2YImxFJKauBOvC1TLjb/Transit-Agent-Design-Mockups), read 2026-11-14. Copy, spacing, and which controls exist will move. This file is where those changes land.

- Re-read this plan and the issue comments before building. When an answered question changes a step, update this same plan before building.
- If a frame is renamed or redrawn, replace the **Current state** excerpt. Do not leave the old strings in place.
- Spacing and colors are a guide for this pass. What should survive a redraw is the binding to `TripDraft`, freshness, and `createMockApiClient`.
- When a question is answered, strike it and keep the decision in this file.

## Why this matters

The phone opens on a map of saved trips, not a menu of "Coming soon" cards. Figma pages `iOS — Liquid Glass` (`12:3`) and `Android — Material 3` (`12:2`) both start with frame **01 Map home**. The mode control only changes `draft.modes`. From, to, and time stay. Light and dark are the same layout (Figma's dark row is the same frames in the dark variable mode). Plan 017's owner wants both themes, with the Settings toggle built in plan 025.

## Current state

- `apps/mobile/App.tsx` is the scaffold. It calls `createApiClient` and renders `sections` from `@transit/shared` as "Coming soon" cards. Replace that UI. The file's API URL lines are:

```ts
const api = createApiClient(
  process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001')
);
```

  Plan 018 merged in #37. Reuse `getApiUrl` from `apps/mobile/src/platform/api-url-native.ts` for real-client configuration. Do not create `src/platform/`.
- `apps/mobile/package.json`: Expo SDK `~58.0.25`, React Native `0.88.1`, `react-native-safe-area-context`. No navigation library, no `expo-blur`, no `@transit/maps`.
- `apps/mobile/app.json` has `"scheme": "transit-agent"` and `"userInterfaceStyle": "light"`. Change `userInterfaceStyle` to `"automatic"` so the dark frames can show. Do not add location or secure-store plugins (plan 018).
- `@transit/shared` exports `createApiClient`, `createMockApiClient`, `initialDraftState`, `applyDraftPatch`, `modeGroups`, `leaveByLabel`, `computeWatchStatus`, and the plan 016 formatters. `SavedItinerary.watchStatus` is optional.
- `@transit/client-react` (merged in #47) exports `ApiProvider`, `useTripDraft`, `useSavedItineraries`, `usePlanTrip`, `useAgentChat`, `usePlaceSearch`, `useDeviceId`, `useNow`. `apps/mobile/package.json` does not depend on it yet; add it in Step 1.
- `apps/mobile/src/platform/index.ts` (plan 018) exports `getApiUrl`, `secureStoreDeviceIdStorage`, `getCurrentPlace`, `useAppForeground`, `parseTripLink`, `useIncomingTripLink`.
- `@transit/maps` has no `./native` export yet (plan 009, in progress). Do not add `@transit/maps` in this plan.
- `modeGroups` in `packages/shared/src/domain/modes.ts`:

```ts
export const modeGroups = {
  transit: ['walk', 'bike', 'bikeshare', 'bus', 'rail', 'ferry'],
  drive: ['walk', 'car'],
  fly: ['walk', 'car', 'rail', 'bus', 'flight']
} as const satisfies Record<string, readonly TravelMode[]>;
```

- A new trip's default modes are `['walk', 'bus', 'rail']` (`TripDraftSchema` in `packages/shared/src/domain/trip-draft.ts`). A saved profile replaces that via `initialDraftState(profile.defaults)`.
- Style with `StyleSheet`. The apps do not use Tailwind. iOS text uses the system font (do not set `fontFamily`). Android text uses the system font (Roboto). Match `apps/mobile/App.tsx`'s `StyleSheet.create` shape.
- Figma frames this plan implements, light and the matching dark frame (same layout):
  - `iOS · 01 Map home` (`2010:51`) and `iOS · Dark · 01 Map home` (`2019:926`)
  - `Android · 01 Map home` (`15:2131`) and `Android · Dark · 01 Map home` (`2018:1074`)
- iOS vs Android on this frame (use a `.ios` / `.android` file only for these):

| Piece | iOS (`2010:51`) | Android (`15:2131`) |
|---|---|---|
| Search | Glass bar: magnifying glass, "Where to?", mic, person circle. Mic is visual only. Person circle navigates to Settings (plan 025). | Material search bar, 56 pt, "Where to?". No person circle. |
| Mode control | Glass segmented control: Transit, Drive, Fly, with SF symbols bus / car / airplane | Material segmented button, same three labels |
| Map buttons | Two circular glass buttons stacked (location, layers). Location calls plan 018 only on tap. | One FAB (location) and one extended FAB labeled "Ask agent" |
| Ask agent | Tinted glass pill "Ask agent" with sparkles, above the sheet | The extended FAB. Plan 023 owns the sheet it opens. |
| Sheet | Inset glass sheet, grabber, "Tracked Trips", bell + "2 watching", two cards, chips Home / Office / Gym, a filter icon | Edge-to-edge Material sheet, drag handle, "Tracked trips", bell + "2 watching", two cards, assistive chips Home / Office / Gym / Recent |
| Chrome | Status bar + home indicator. `SafeAreaView` edges. | Status bar + gesture bar. `SafeAreaView` edges. |
| Blur | `expo-blur` `BlurView` behind the search, mode control, and sheet | No blur. Surface color from the theme. |

- Tracked trip card (Figma symbol `14:120`, description on the component): title "Commute to Office", message "Bus 1 is 1 min late — leave by 8:04", freshness pill "Live" only when the data is realtime, meta "Bus 1 · arrive 8:27", countdown tile "Leaves in / 6 / minutes" (not "Departs"; @Cattn, [PR #60 review](https://github.com/Cattn/transit-agent/pull/60#pullrequestreview-5904509484)). The tile color encodes `watchStatus.state`: onTrack = secondary container, leaveSoon = tertiary container, leaveNow and atRisk = error container. `SavedItinerary.watchStatus` is optional. Use its message and state when present, and `leaveByLabel(leaveBy, new Date())` when a leave-by time exists. Otherwise use `formatClock` and `itineraryFreshness` from plan 016. Do not invent a watch status. Never paint a scheduled time with the Live pill.
- **Android Material 3 rules (@Cattn, [PR #60 review](https://github.com/Cattn/transit-agent/pull/60#pullrequestreview-5904509484), 2026-11-14).** These apply to every Android screen (plans 020–025); iOS keeps the glass design above.
  - Use **Expo UI Jetpack Compose** (`@expo/ui/jetpack-compose`, `npx expo install @expo/ui`): Expo's library that renders Google's real Material 3 Compose components (@Cattn chose it over `react-native-paper`, 2026-11-14; docs: https://docs.expo.dev/versions/latest/sdk/ui/jetpack-compose/index.md). It is beta and works in Expo Go. Every Compose component sits inside a `Host` imported from the `@expo/ui` root, not the sub-package. `@expo/ui/jetpack-compose` crashes on iOS, so Compose code lives only in `.android.tsx` files (or behind `Platform.OS`). Inside a `Host`, lay out with Compose `Row` / `Column`, not flexbox. Don't put `matchContents` on the same axis as a scrolling list.
  - Material icons everywhere on Android (search, location, modes, Live, filters): Compose `Icon` with Material Symbols from `@expo/material-symbols`. Roboto is the Android system font; do not override it.
  - Colors come from the Material theme: `Host` `colorScheme` follows `useAppColors()` (light / dark / system) with one `seedColor`, and `useMaterialColors()` gives the same palette to any non-Compose view. Do not hand-pick chip or surface colors.
  - Mode control: `SingleChoiceSegmentedButtonRow` with icons for Transit, Drive, Fly.
  - Search bar: `DockedSearchBar` (or `SearchBar`) with Material icons.
  - Bottom chips (Home / Office / Gym / Recent): `AssistChip`s in theme colors. These were the worst offenders.
  - Sheet: a Material surface color, draggable up and down (collapsed and expanded). Try Expo UI's universal `BottomSheet` (from `@expo/ui`, SDK 56+) first; Expo's `expo-ui` skill prefers it over `@gorhom/bottom-sheet`. If it can't stay open over the map and be dragged between collapsed and expanded, use `@gorhom/bottom-sheet` (needs `react-native-reanimated` and `react-native-gesture-handler`, installed with `npx expo install`) with Compose content in a `Host` inside it, and say why in the PR.
  - Tracked trip cards: clearly separated containers (Compose `Card`, elevated or filled) that stand out from the sheet surface, not faint borders.
  - Countdown tile: "Leaves in / # / minutes" in a Material accent container (the watch-state colors above).
  - "Live": an M3 Expressive-style pill with a Material icon, only for realtime data.
  - "Ask agent": `ExtendedFloatingActionButton`.
  - Settings placeholder (until plan 025): Material background, colors and Roboto, matching the mockup's look even while empty.
- Saved routes drawn on the home map in the file are named "Saved · Commute (Bus 1)" and "Saved · Gym (Orange Line)", with pins Office and Gym. The app does not draw those vectors itself.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run typecheck -w @transit/mobile` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Full check | `npm test` | exit 0 |

`npm test` is the root script: lint, then typecheck, then unit tests. Plan 018 already provides mobile platform tests. Do not add tests or another Vitest config.

## Scope

**In scope:**
- `apps/mobile/App.tsx`
- `apps/mobile/app.json` (`userInterfaceStyle` only)
- `apps/mobile/package.json` and `package-lock.json` (only `@transit/client-react`, `expo-blur`, the React Navigation packages in Step 1, and the Android Material 3 packages: `@expo/ui`, `@expo/material-symbols`, `@gorhom/bottom-sheet`, `react-native-reanimated`, `react-native-gesture-handler`)
- `apps/mobile/babel.config.js` (only if `react-native-reanimated` needs its plugin on this Expo SDK)
- `apps/mobile/.env.example` (add `EXPO_PUBLIC_API_MODE=mock`)
- `apps/mobile/src/theme/appearance.tsx`
- `apps/mobile/src/theme/colors.ts`
- `apps/mobile/src/data/client.ts`
- `apps/mobile/src/navigation/types.ts`
- `apps/mobile/src/navigation/Root.tsx`
- `apps/mobile/src/screens/home/HomeScreen.tsx`
- `apps/mobile/src/screens/home/HomeChrome.ios.tsx`
- `apps/mobile/src/screens/home/HomeChrome.android.tsx`
- `apps/mobile/src/screens/home/TrackedTripCard.tsx`
- `apps/mobile/src/screens/home/ModeSlider.tsx` (shared labels and `modeGroups` mapping; each chrome file renders the control)
- `apps/mobile/src/screens/settings/SettingsScreen.tsx` (placeholder title "Settings" until plan 025)
- `apps/mobile/src/screens/results/ResultsScreen.tsx` (placeholder until plan 021)
- `apps/mobile/src/screens/filters/FiltersScreen.tsx` (placeholder until plan 022)
- `apps/mobile/src/screens/chat/ChatScreen.tsx` (placeholder until plan 023)
- `apps/mobile/src/screens/fly/FlyScreen.tsx` (placeholder until plan 024)

**Out of scope:**
- `apps/mobile/src/platform/**` and any Expo permission plugin (plan 018, merged in #37)
- `packages/client-react/**` (merged; use it, do not edit it)
- `packages/shared/**` (plans 016 and 017)
- `packages/maps/**` and adding `@transit/maps` (plan 009 adds the native renderer and the dependency)
- `apps/web/**`, `apps/server/**`
- `plans/ui-direction.md` and `plans/ui-slices.md`
- Booking, payments, a web layout

## Git workflow

- Branch: `plan/020-mobile-map-home`
- Commit per step. Match recent messages such as `shared: add TripDraftPatchSchema and TripDraft state reducer (plan 004 step 4)`. Example: `mobile: add map-home shell (plan 020 step 2)`.
- Do not push or open a PR unless the operator instructed it.

## Steps

### Step 1: Navigation and blur

In `apps/mobile`, `npx expo install expo-blur @react-navigation/native @react-navigation/native-stack react-native-screens`, and add `"@transit/client-react": "*"` to `dependencies` (then `npm install` at the root). Do not add `@react-navigation/bottom-tabs`. The home screen is not a tab bar.

`src/navigation/types.ts`:

```ts
export type RootStackParamList = {
  Home: undefined;
  Settings: undefined;
};
```

Results, filters, chat, and fly are presented by Home (sheets), not by extra stack routes, except Settings.

**Verify**: `npm run typecheck -w @transit/mobile` → exit 0

### Step 2: Theme that can show both Figma rows

`src/theme/colors.ts` exports `light` and `dark` objects with `background`, `surface`, `onSurface`, `primary`, `outline`. Use Material-style hex values that stay readable in both schemes. If `@transit/shared` already exports theme tokens (plan 017), re-export those and do not invent a second palette.

`src/theme/appearance.tsx`: React context, default `"system"`. `useAppColors()` reads the override, else `useColorScheme()`. Plan 025's Settings row writes the override. Do not request location here.

`app.json`: `"userInterfaceStyle": "automatic"`.

**Verify**: `npm run typecheck -w @transit/mobile` → exit 0

### Step 3: One client (mock or server) and one draft

`src/data/client.ts` exports one client. When `process.env.EXPO_PUBLIC_API_MODE === 'server'`, use `createApiClient(getApiUrl(), { deviceId })` with the id from `useDeviceId(secureStoreDeviceIdStorage)`. Otherwise use `createMockApiClient({ latencyMs: 0 })`, which seeds two watched trips (plan 012). Mock is the default. `App.tsx` wraps everything in `ApiProvider`.

Home holds the draft with `useTripDraft()`. Do not hand-roll `applyDraftPatch` state.

The mode control calls `apply({ modes: [...modeGroups[group]] }, 'user')` for `transit` | `drive` | `fly`. It must not clear origin, destination, or time. When the group is `fly`, Home presents the fly sheet (plan 024's screen). Transit and drive stay on the home sheet.

**Verify**: `npm run typecheck -w @transit/mobile` → exit 0

### Step 4: Map slot and padding

`HomeScreen` measures the sheet's visible height and passes it as `padding.bottom` to the map. The other padding sides are 16.

Only when `apps/mobile/package.json` depends on `@transit/maps` and that package exports `./native`, render `RouteMap` from `@transit/maps/native` with `itineraries` from the mock saved list, `selectedItineraryId`, `onRouteSelect`, `visibleModes` equal to the current `draft.modes`, a `styleUrl` constant for OpenFreeMap (the same string plan 009 documents; do not read a secret), and `padding`. The map must not fetch or save.

Until then (native export absent), render a `View` that fills the screen, `accessibilityLabel="Map"`. Do not add `@transit/maps` or `maplibre` here.

**Verify**: `npm run typecheck -w @transit/mobile` → exit 0

### Step 5: Platform chrome and the tracked-trip sheet

`HomeChrome.ios.tsx` and `HomeChrome.android.tsx` implement the table in Current state. Shared card UI lives in `TrackedTripCard.tsx`.

Data: `useSavedItineraries({ pollMs: 30_000, enabled })`, where `enabled` is true only while the app is active. Use the existing `useAppForeground` from `apps/mobile/src/platform`. Do not add a second foreground listener.

The "2 watching" count is the number of saved trips with `watch === true`, not a hard-coded 2.

Chips Home, Office, and Gym set origin or destination only when the profile has that place. The mock profile may be empty. Tapping a chip with no place opens Filters (plan 022's screen) instead of inventing an address. "Recent" on Android is the most recently saved trip's destination, or hidden when there is none.

The location button calls the existing `getCurrentPlace` only on tap (decided on #26). On `{ ok: true, place }`, apply `{ origin: place }` with source `'user'`. On denied or unavailable, keep the draft and show a short message. Do not add `expo-location`.

"Ask agent" and the Android extended FAB set local state `chatOpen`. Plan 023 replaces the placeholder. This plan shows `ChatScreen` when that flag is true.

The person circle (iOS only) calls `navigation.navigate('Settings')`.

**Verify**: `npm run typecheck -w @transit/mobile` → exit 0

### Step 6: Wire `App.tsx`

`App.tsx` renders `SafeAreaProvider`, `AppearanceProvider`, `NavigationContainer`, and the native stack with Home and Settings. Delete the "Coming soon" section list. Preserve existing API status logging and show connection status without covering the map controls.

**Verify**: `npm run lint` → exit 0. `npm run typecheck -w @transit/mobile` → exit 0.

## Test plan

Plan 018 already provides the mobile unit-test runner. Do not add tests or another runner. Run the typecheck and lint commands above.

## Done criteria

- [ ] `npm run typecheck -w @transit/mobile` exits 0
- [ ] `npm run lint` exits 0
- [ ] `apps/mobile/App.tsx` no longer renders the "Coming soon" cards
- [ ] `HomeChrome.ios.tsx` and `HomeChrome.android.tsx` both exist
- [ ] No file under `apps/mobile/src/platform`, `packages/shared`, `packages/maps`, or `apps/web` is modified
- [ ] `plans/README.md` status row updated

## STOP conditions

- `apps/mobile/src/platform/` exists and a step tells you to recreate `getApiUrl` or `getCurrentPlace`. Use the existing function.
- You are about to add `expo-location`, `expo-secure-store`, or `@transit/maps`.
- `applyDraftPatch` or `modeGroups` is not exported from `@transit/shared`.
- The home frame in Figma is no longer named `iOS · 01 Map home` or `Android · 01 Map home`.
- Implementing the sheet seems to require editing `plans/ui-direction.md`.

## Maintenance notes

When a question is answered or a frame changes, update this same plan and its issue. Strike answered questions and keep the decision and source link. Do not open a second plan for the same screen.

- Plans 021–025 replace the placeholder screens. They should import `useAppColors`, the Material theme setup (`Host` seed color) and the navigation types from this plan, and follow the Android Material 3 rules in Current state.
- Reviewers should check that a scheduled trip never gets the "Live" pill, and that moving Transit / Drive / Fly does not clear the draft's places.
- The UI-5 peek/half/full wording is intentionally not implemented. See open question 1.

## Open questions for review

See the help box at the top (020-Q1 to 020-Q4). It is the single list; answers are recorded there.

Map behavior (overlap chooser, mode filtering, colors) is tracked once in plan 009 under "Open product decisions". When colors are needed, follow plan 009's rule: compute `assignRouteColors` once over all trips on screen and reuse it for cards and map.
