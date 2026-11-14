# Plan 018: Mobile platform plumbing (device ID storage, "use my location", app foreground, trip links, API URL on a real phone)

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If a STOP condition occurs, stop and report. Do
> not improvise. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 45f5379..HEAD -- apps/mobile`
> The UI team edits `apps/mobile/App.tsx` and screen files often; that's expected and this plan
> doesn't touch them. If `apps/mobile/src/platform/` already exists, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MEDIUM (adds native Expo modules; needs a new dev-client build to try on a phone)
- **Depends on**: nothing to start. Step 2 implements the `DeviceIdStorage` interface from plan 015; if 015 hasn't landed, define the same interface locally (shown in Step 2) and note it.
- **Category**: direction (parallel work)
- **Planned at**: commit `45f5379`, 2026-11-14

<!-- help:start -->
## Who's on it & how to help

- **Status:** ✅ **Done.** Merged in #37. Remaining: UI screens call these helpers (plan 020) and Android/iOS device checks of location and deep links.
- **Owner:** @DMFriends

**Open questions** (answer by number in a comment on #26):

1. @KrakenTheJaken was nominated for iOS device verification ([roadmap answer](https://github.com/Cattn/transit-agent/issues/17#issuecomment-6873720245)). Confirm availability; location/deep-link checks are not completed. Location remains tap-only.

<!-- help:end -->

## Why this matters

These are the phone-only pieces every mobile screen needs but no screen owns:

- **Device ID** (decision D4: anonymous ID instead of accounts) must survive app restarts.
- **"Use my location"** as the starting point: the commute features (issue #2) start from where you are.
- **Foreground detection**: stop polling saved trips when the app is in the background (battery), resume when it comes back.
- **Trip links**: `transit-agent://trip/<id>` opens a saved trip (for sharing and, later, notifications).
- **API URL on a real phone**: `10.0.2.2` only works in the Android emulator. On a physical phone the app must use the laptop's LAN IP, which Expo already knows.

Doing them once, as small tested helpers, lets the UI team build screens without each person
working out Expo permissions and storage.

## Current state

- `apps/mobile/package.json`: Expo SDK `~58.0.25`, React Native `0.88.1`, `expo-dev-client`, `expo-build-properties`. No `expo-secure-store`, `expo-location`, `expo-linking` or `expo-constants` installed. Scripts include `typecheck`, `build` (`expo export`), `dev:client`, `build:android` (EAS dev build).
- `apps/mobile/app.json`: `"scheme": "transit-agent"` (already set), plugins: `expo-build-properties` with `usesCleartextTraffic: true`.
- `apps/mobile/App.tsx` lines 7–9 build the API URL: `process.env.EXPO_PUBLIC_API_URL ?? (Platform.OS === 'android' ? 'http://10.0.2.2:3001' : 'http://localhost:3001')`. **Do not edit App.tsx** (UI team owns it); the PR description tells them which helper to swap in.
- `apps/mobile/.env.example`: `EXPO_PUBLIC_API_URL=http://10.0.2.2:3001`.
- `apps/mobile/tsconfig.json`: `strict`, `noUncheckedIndexedAccess`. Mobile has no unit-test runner today.
- Native modules require the EAS dev client, not Expo Go (see plan 009 and `plans/README.md` dependency notes).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Install Expo modules | `npx expo install expo-secure-store expo-location expo-linking expo-constants` (run inside `apps/mobile`) | versions matching SDK 58 added |
| Typecheck | `npm run typecheck -w @transit/mobile` | exit 0 |
| Unit tests | `npm run test:unit -w @transit/mobile` | all pass (added in Step 1) |
| Doctor | `npm run mobile:doctor` | no new failures compared with before your change (run it first and save the output) |
| Bundle | `npm run build:mobile` | exit 0 |
| Full | `npm run check` | exit 0 |

## Scope

**In scope:**
```
apps/mobile/package.json                         (modify: deps via `npx expo install`; add vitest + test:unit script)
apps/mobile/app.json                             (modify: expo-location + expo-secure-store plugins, permission text)
apps/mobile/.env.example                         (modify: comment explaining the LAN fallback)
apps/mobile/vitest.config.ts                     (create; node environment; include src/**/*.test.ts)
apps/mobile/src/platform/api-url.ts              resolveApiUrl() — pure
apps/mobile/src/platform/api-url.native.ts       getApiUrl() — reads env + expo-constants, calls resolveApiUrl
apps/mobile/src/platform/device-id-storage.ts    secureStoreDeviceIdStorage
apps/mobile/src/platform/location.ts             getCurrentPlace()
apps/mobile/src/platform/use-app-foreground.ts   useAppForeground()
apps/mobile/src/platform/links.ts                tripLink(), parseTripLink() — pure
apps/mobile/src/platform/links.native.ts         useIncomingTripLink()
apps/mobile/src/platform/index.ts
apps/mobile/src/platform/*.test.ts               tests for the pure files only
apps/mobile/README.md or the root README mobile section (modify: one paragraph on the new helpers and permissions)
package-lock.json
```
**Out of scope:** `App.tsx`, any screen, navigation library choice, push notifications (D7-C, later), maps (plan 009), web.

## Git workflow

Branch `plan/018-mobile-platform`. One commit per step. Do not push unless told.

## Steps

### Step 1: Dependencies and a test runner

Save the current `npm run mobile:doctor` output. In `apps/mobile`: `npx expo install expo-secure-store expo-location expo-linking expo-constants`. Add `vitest` (same version as `packages/shared`) as a devDependency, `vitest.config.ts` with `environment: 'node'`, and `"test:unit": "vitest run"`. Root `npm run test:unit` uses `--workspaces --if-present`, so it will pick this up.
**Verify**: `npm run typecheck -w @transit/mobile` → exit 0; `npm run mobile:doctor` → no new failures.

### Step 2: API URL that works on a real phone

`api-url.ts` (pure, **no imports from react-native or expo**, so Vitest can load it):
```ts
export function resolveApiUrl(input: { envUrl?: string; hostUri?: string | null; os: 'android' | 'ios' | 'web' | string; port?: number }): string
```
Order: `envUrl` if set and non-empty → if `hostUri` (Expo's `"192.168.1.20:8081"` form) has a host that isn't `localhost`/`127.0.0.1`, use `http://<host>:<port ?? 3001>` → Android `http://10.0.2.2:3001` → otherwise `http://localhost:3001`.
`api-url.native.ts`: `getApiUrl()` = `resolveApiUrl({ envUrl: process.env.EXPO_PUBLIC_API_URL, hostUri: Constants.expoConfig?.hostUri, os: Platform.OS })`.
Tests: each branch of the order, including `hostUri` with `localhost` falling through.

### Step 3: Device ID storage

```ts
// If @transit/client-react (plan 015) exports DeviceIdStorage, import it. Otherwise define:
export interface DeviceIdStorage { get(): Promise<string | null>; set(id: string): Promise<void> }
export const secureStoreDeviceIdStorage: DeviceIdStorage   // key 'transit.deviceId', expo-secure-store getItemAsync / setItemAsync
```
Add `expo-secure-store` to `app.json` plugins if its docs for SDK 58 require it.

### Step 4: "Use my location"

```ts
export type LocationResult = { ok: true; place: Place } | { ok: false; reason: 'denied' | 'unavailable' }
export async function getCurrentPlace(): Promise<LocationResult>
```
`requestForegroundPermissionsAsync()` → not granted → `{ ok: false, reason: 'denied' }`. Then `getCurrentPositionAsync({ accuracy: Balanced })` (catch → `unavailable`). Return `{ name: 'Current location', coordinates: [lng, lat], kind: 'address' }`. **Note the order: `[longitude, latitude]`** (GeoJSON, as in `LngLatSchema`). Add the `expo-location` plugin to `app.json` with `locationWhenInUsePermission: "Transit Agent uses your location to plan trips from where you are."`. Foreground ("when in use") only; no background location. Call it **only from a user tap** (018-Q1); never at app launch.

### Step 5: Foreground hook

`useAppForeground(): boolean` using `AppState.currentState === 'active'` initially and an `AppState.addEventListener('change', …)` subscription (remove it on unmount). Pass the result to `useSavedItineraries({ enabled })` (plan 015).

### Step 6: Trip links

`links.ts` (pure): `tripLink(id: string): string` → `transit-agent://trip/${encodeURIComponent(id)}`; `parseTripLink(url: string): { tripId: string } | null` accepts `transit-agent://trip/<id>` and `exp+transit-agent://…` dev-client forms, rejects anything else.
`links.native.ts`: `useIncomingTripLink(onTrip: (id: string) => void)` using `Linking.getInitialURL()` once and `Linking.addEventListener('url', …)`.
Tests: round-trip `parseTripLink(tripLink('mock-fast-1a2b'))`; ids with `/` and spaces; foreign URLs → `null`.

### Step 7: Export, document, verify

`src/platform/index.ts` re-exports everything. Add one README paragraph: what each helper is for, that location is foreground-only, and that adding these native modules means **rebuilding the dev client** (`npm run build:android`).
**Verify**: `npm run check` → exit 0; `npm run build:mobile` → exit 0.

## Handoff to the UI team (put this in the PR description)

```ts
import { getApiUrl, secureStoreDeviceIdStorage, getCurrentPlace, useAppForeground, useIncomingTripLink } from './src/platform';
const api = createApiClient(getApiUrl(), { deviceId: () => deviceId });   // replaces the inline URL in App.tsx
```
After merging, someone must run `npm run build:android` once (new native modules) and share the dev-client build.

## Done criteria

- [ ] `npm run check` exits 0; `npm run test:unit -w @transit/mobile` runs ≥ 8 tests
- [ ] `npm run build:mobile` exits 0
- [ ] `npm run mobile:doctor` has no new failures
- [ ] `git diff --stat` shows no change to `apps/mobile/App.tsx`
- [ ] `grep -n "Background\|background" apps/mobile/src/platform/location.ts` → no background-location calls

## STOP conditions

- `npx expo install` wants to change `expo`, `react` or `react-native` versions. Report; don't accept a framework upgrade here.
- `expo-doctor` reports a new incompatibility you can't resolve by using the versions `npx expo install` chose.
- Typecheck can't resolve `.native.ts` files (TypeScript doesn't know about platform extensions). If so, rename `*.native.ts` to plain `.ts` (the pure files are already separate) and note it.

## Maintenance notes

### Review and remaining integration (2026-11-14)

- Merged in #37. Device verification (rebuilt dev client: LAN API fallback, location prompt on tap, deep links) is still outstanding on Android and iOS.
- Primary reviewer passed 30 mobile tests, mobile typecheck, and Android/iOS Hermes exports with the entire platform barrel imported into a temporary entry point using locked dependencies. Helper bundle coverage is verified; real-device behavior is not.
- UI consumers still need to mount the helpers: use `getApiUrl()`, persistent device ID storage, foreground-controlled saved-trip polling, tap-only location, and incoming trip links. Remove an emulator-only `EXPO_PUBLIC_API_URL` override when exercising Expo's LAN fallback.
- PR #37's local `DeviceIdStorage` already matches plan 015: `get(): Promise<string | null>`, `set(id: string): Promise<void>`. Keep that shape; once 015 lands, import its exported type when wiring the consumer. No worker contract adjustment is needed.
- After merging, rebuild the native dev client and verify location permission/results and cold/warm trip links on Android and iOS. Device validation remains open. Cattn nominated @KrakenTheJaken for iOS checks; availability is unconfirmed.

- Push notifications (D7-C) will add `expo-notifications` next to these helpers and reuse `tripLink` for the notification's target.
- Any new permission needs `app.json` text **and** a dev-client rebuild. Say so in the PR.

## Open questions for review

- ~~018-Q1~~ **Decided (@DMFriends, 2026-11-14, [#26](https://github.com/Cattn/transit-agent/issues/26#issuecomment-6872580875)): only on tap.** `getCurrentPlace()` requests permission only when the user taps "use my location". Never request location at app launch.
- ~~018-Q2~~ **Decided (@Cattn, 2026-11-14): iOS is in scope.** Test the location permission text on iOS too. Running a dev client on a real iPhone needs an EAS iOS build (`npm run build:ios`) and an Apple Developer account for device install; without one, use the iOS Simulator (needs a Mac). @KrakenTheJaken is the nominated iOS tester ([roadmap answer](https://github.com/Cattn/transit-agent/issues/17#issuecomment-6873720245)); confirm availability, then verify Steps 4 and 6. Nomination is not device validation.
