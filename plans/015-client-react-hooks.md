# Plan 015: One set of React hooks for both apps (`@transit/client-react`)

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If a STOP condition occurs, stop and report. Do
> not improvise. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9ccf722..HEAD -- packages package.json apps/web/package.json apps/mobile/package.json`
> Reconciled 2026-11-14: an empty diff is expected. If this prints anything, compare Current state before proceeding. Plans 004 and 012 are already on this commit.
> Expected: plans 004 and 012 landed in `packages/shared/src/client/`. If a `packages/client-react`
> or `packages/ui-hooks` directory already exists, STOP: the UI team may have started their own.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MEDIUM (new workspace package; touches root build scripts that every app uses)
- **Depends on**: plans/004-client-sdk-and-trip-draft.md, plans/012-mock-api-client.md (tests run against the mock). Uses plan 013's `computeWatchStatus` only through data already on `SavedItinerary`.
- **Category**: direction (parallel work)
- **Planned at**: commit `9ccf722`, 2026-11-14 (refreshed; steps unchanged)

<!-- help:start -->
## Who's on it & how to help

- **Status:** **Technical re-check passed:** [PR #47](https://github.com/Cattn/transit-agent/pull/47) at `3c1f2abf16384b2496dcaa8feabe996f0ee98ea8`. COMMENT review, not formal GitHub approval. Conflicts resolved; mergeable and unmerged. Final CI success is not established.
- **Owner:** @Cattn

**Open questions** (answer by number in a comment on #23):

1. @Rad1ee @DMFriends: plain React hooks (suggested) or TanStack Query from the start?
2. @Rad1ee @DMFriends: have you already written hooks in your branches that should move here instead?

<!-- help:end -->

## Why this matters

Web (React DOM) and mobile (React Native) need the same data logic: keep the trip draft,
run a search, poll saved trips, talk to the agent, debounce place search. Without a shared
package, each UI person writes these separately, and they drift (one app polls every 30 s, the
other every 60 s; one applies agent edits with provenance, the other forgets). Hooks contain
**no UI**, so the same code runs on both platforms. Screens stay entirely the UI team's.

The plans index previously rejected putting hooks inside `@transit/shared`, because the server
imports shared and must not depend on React. A **separate package** keeps that rule.

## Current state

- `packages/shared/package.json` is the pattern for a workspace library: `"type": "module"`, `main: ./dist/index.js`, `types`, `exports`, scripts `build: tsc`, `typecheck: tsc --noEmit`, `test:unit: vitest run`. Its `tsconfig.json` extends `../../tsconfig.base.json` with `module: NodeNext`, `rootDir: src`, `outDir: dist`, `declaration: true`, and excludes `src/**/*.test.ts`. Read both files and copy them.
- Root `package.json` scripts build shared first everywhere: `build:shared`, `build:web`, `build:server`, `build:mobile`, `build`, `typecheck`, `test:unit`, and `dev` (concurrently). `apps/mobile/package.json` has `"eas-build-post-install": "npm run build -w @transit/shared"`.
- React versions: `react` `19.3.0` in both apps; `@types/react` `~19.3.0`.
- On main at `9ccf722`, `@transit/shared` (`packages/shared/src/index.ts`) already exports `ApiClient`, `ApiClientError`, `createDeviceId`, `initialDraftState`, `applyDraftPatch`, `toTripRequest`, `describePatch`, `DraftState`, `TripDraftPatch`, `DraftChangeSource`, `AgentMessageResponse`, `Place`, and `createMockApiClient`. `packages/client-react` does not exist. Root `build:shared` still builds only `@transit/shared`.
- ESLint already applies `react-hooks` rules to `apps/web/src/**` and `apps/mobile/**` (`eslint.config.mjs`). Extend that `files` list to include `packages/client-react/src/**/*.{ts,tsx}`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Package tests | `npm run test:unit -w @transit/client-react` | all pass |
| Full | `npm run check` | exit 0 |
| Mobile bundle | `npm run build:mobile` | exit 0 |
| Web build | `npm run build:web` | exit 0 |

## Scope

**In scope:**
```
packages/client-react/package.json, tsconfig.json, vitest.config.ts
packages/client-react/src/index.ts
packages/client-react/src/api-context.tsx         ApiProvider, useApi
packages/client-react/src/use-trip-draft.ts
packages/client-react/src/use-plan-trip.ts
packages/client-react/src/use-saved-itineraries.ts
packages/client-react/src/use-agent-chat.ts
packages/client-react/src/use-place-search.ts
packages/client-react/src/use-device-id.ts
packages/client-react/src/use-now.ts
packages/client-react/src/*.test.tsx
package.json                   (modify: build scripts, see Step 1)
apps/web/package.json          (modify: add dependency "@transit/client-react": "*")
apps/mobile/package.json       (modify: add the same dependency; update eas-build-post-install)
eslint.config.mjs              (modify: add the package to the react-hooks files list)
package-lock.json              (via npm install)
```
**Out of scope:** any `.tsx` screen or component in `apps/`, styling, navigation, `packages/shared/**`. Do not add TanStack Query, Redux, Zustand or any other state library: plain React only.

## Git workflow

Branch `plan/015-client-react`. One commit per step. Do not push unless told.

## Steps

### Step 1: Package skeleton + build wiring

- `packages/client-react/package.json`: name `@transit/client-react`, same shape as shared. `dependencies: { "@transit/shared": "*" }`. `peerDependencies: { "react": ">=19" }`. `devDependencies`: `react` `19.3.0`, `@types/react` `~19.3.0`, `vitest` (same version as shared), `@testing-library/react` (latest 16.x), `jsdom`.
- `tsconfig.json`: copy shared's; add `"jsx": "react-jsx"`, exclude `src/**/*.test.tsx` too.
- `vitest.config.ts`: `environment: 'jsdom'`.
- Root `package.json`: add `"build:packages": "npm run build -w @transit/shared && npm run build -w @transit/client-react"` and replace every `npm run build:shared` **inside other scripts** (`dev`, `build:web`, `build:server`, `build:mobile`, `build`, `typecheck`, `test:unit`) with `npm run build:packages`. Keep `build:shared` itself as is. In `dev`, add a `client-react` watcher (`npm run dev -w @transit/client-react`, with a `dev: tsc --watch` script).
- `apps/mobile/package.json` `eas-build-post-install` → `npm run build -w @transit/shared && npm run build -w @transit/client-react`.
- `npm install` at the root.
If [PR #35](https://github.com/Cattn/transit-agent/pull/35) (maps) has merged, it changes root scripts too (`build:shared` also builds `@transit/maps`). Include `@transit/maps` in `build:packages` in the same order instead of dropping it.
**Verify**: `npm run build:packages` → exit 0, `packages/client-react/dist/index.js` exists.

### Step 2: `ApiProvider` and `useApi`

```tsx
export function ApiProvider(props: { client: ApiClient; children: ReactNode }): JSX.Element
export function useApi(): ApiClient   // throws "useApi must be used inside <ApiProvider>" outside one
```

### Step 3: `useTripDraft`

```ts
export function useTripDraft(defaults?: TripDraftPatch): {
  state: DraftState;
  apply: (patch: TripDraftPatch, source: DraftChangeSource) => void;
  reset: (defaults?: TripDraftPatch) => void;
  request: ReturnType<typeof toTripRequest>;     // memoised
}
```
`useReducer` over `applyDraftPatch`. If `applyDraftPatch` throws (invalid patch), keep the old state and `console.warn`; don't crash the screen.

### Step 4: `usePlanTrip`

```ts
export function usePlanTrip(): { data?: PlanResponse; error?: ApiClientError; loading: boolean; run: (r: TripRequest) => Promise<void>; clear: () => void }
```
**Only the latest call wins**: keep a counter in a ref; ignore results from older calls. Non-`ApiClientError` errors are wrapped as `new ApiClientError(0, 'unknown', String(e))`.

### Step 5: `useSavedItineraries`

```ts
export function useSavedItineraries(opts?: { pollMs?: number; enabled?: boolean }): {
  items: SavedItinerary[]; loading: boolean; error?: ApiClientError;
  refresh: () => Promise<void>;
  save: (input: SaveItineraryRequest) => Promise<SavedItinerary>;
  update: (id: string, patch: { label?: string; watch?: boolean }) => Promise<void>;
  remove: (id: string) => Promise<void>;
}
```
Default `pollMs` 30 000 (decision D7-A). Poll only while `enabled` (default true). The **app** passes `enabled` from its own visibility signal (web: `document.visibilityState`; mobile: `AppState`, see plan 018), because this package must not import `react-native` or touch `document`. Mutations update `items` optimistically, then refresh; on error, roll back and set `error`.

### Step 6: `useAgentChat`

```ts
export interface ChatMessage { id: string; role: 'user' | 'agent'; text: string; questions?: AgentMessageResponse['questions']; at: string }
export function useAgentChat(draft: DraftState, apply: (p: TripDraftPatch, s: DraftChangeSource) => void): {
  messages: ChatMessage[]; pending: boolean; error?: ApiClientError;
  send: (text: string) => Promise<void>;
  lastPlan?: PlanResponse;      // set when the agent ran a search; show it in the results list
}
```
`send` appends the user message, calls `api.sendAgentMessage({ sessionId, message, draft: draft.draft })`, stores `sessionId`, calls `apply(res.draftPatch, 'agent')`, appends the agent message with `questions`. A quick-reply button is just `send(option)`.

### Step 7: Small hooks

- `usePlaceSearch(query: string, opts?: { debounceMs?: number; near?: LngLat })` → `{ results: Place[]; loading: boolean }`. Default debounce 250 ms; `query.trim().length < 3` → `[]` without calling the API; latest-call-wins like Step 4.
- `useDeviceId(storage: DeviceIdStorage)` → `string | undefined`, where `export interface DeviceIdStorage { get(): Promise<string | null>; set(id: string): Promise<void> }`. First run: no stored id → `createDeviceId()` → `set`. The app supplies storage (web: a `localStorage` wrapper; mobile: plan 018).
- `useNow(intervalMs = 1000): Date`. For countdowns ("Leave in 6 min") between polls.

### Step 8: Tests (`*.test.tsx`, `renderHook` from `@testing-library/react`)

Use `createMockApiClient({ latencyMs: 0, now: () => fixedDate })` inside an `ApiProvider` wrapper. Use `vi.useFakeTimers()` for polling and debounce.
- `useApi` outside a provider throws.
- `useTripDraft`: an agent patch sets provenance `agent`; an invalid patch leaves state unchanged.
- `usePlanTrip`: two quick `run` calls, the first slower (wrap the mock to delay it) → `data` is from the second.
- `useSavedItineraries`: starts with the 2 seeded trips; `update(id, { watch: false })` shows immediately; advancing timers by `pollMs` calls `listItineraries` again; `enabled: false` stops polling.
- `useAgentChat`: sending `"cheap, walk at most 10 min"` calls `apply` with `maxWalkMinutes: 10` and source `'agent'`.
- `usePlaceSearch`: `"ha"` → no call; `"harv"` → after debounce includes Harvard Square.
- `useDeviceId`: empty storage → creates and stores an id; existing id is reused.

**Verify**: `npm run check` → exit 0; `npm run build:mobile` → exit 0; `npm run build:web` → exit 0.

## Handoff to the UI team (put this in the PR description)

```tsx
<ApiProvider client={api}>
  <App />
</ApiProvider>
// in a screen
const trip = useTripDraft(profileDefaults);
const plan = usePlanTrip();
const saved = useSavedItineraries({ enabled: isForeground });
const chat = useAgentChat(trip.state, trip.apply);
```

## Done criteria

- [ ] `npm run check` exits 0; ≥ 12 new tests
- [ ] `npm run build:mobile` and `npm run build:web` exit 0
- [ ] `grep -rn "react-native\|document\.\|window\." packages/client-react/src --include=*.ts --include=*.tsx | grep -v test` → no matches
- [ ] No `.tsx` files changed under `apps/`

## STOP conditions

- Metro (`npm run build:mobile`) cannot resolve `@transit/client-react` the way it resolves `@transit/shared`. Report the error; do not add a `metro.config.js` without review.
- Two copies of React end up in the mobile or web bundle (`Invalid hook call` at runtime, or `npm ls react` shows a second version). Report.
- The root script change breaks CI (`.github/workflows/ci.yml` calls a script you renamed).

## Maintenance notes

- Integration re-check passed at `3c1f2abf16384b2496dcaa8feabe996f0ee98ea8`: reviewer 2 verified the normal two-parent merge, client-react byte-identical to reviewed `73a6d89`, preserved main source/workflows/plans and lock entries (except two app dependencies), and combined shared → maps → client-react build/watch/demo/lint wiring. Independent fresh `npm ci` and full `npm run check` passed 320 existing tests, lint/typechecks, builds, Android/iOS exports and smoke; one React 19.3.0, clean checkout/diff. [Technical-pass COMMENT review](https://github.com/Cattn/transit-agent/pull/47#pullrequestreview-5902357329), not formal GitHub approval. No actionable findings; conflict/integration blocker resolved. GitHub reported mergeable, but CI was in progress at reviewer inspection; final CI success is not established. PR remains unmerged; dependent work must not treat 015 as landed.

- New `ApiClient` methods get a hook here only when two screens need the same logic. One-off calls can use `useApi()` directly.
- If the team later wants caching across screens, TanStack Query can replace the internals of `usePlanTrip` / `useSavedItineraries` without changing their return shapes.

## Open questions for review

- 015-Q1 (@Rad1ee @DMFriends): Plain hooks (proposed) or TanStack Query from the start?
- 015-Q2 (@Rad1ee @DMFriends): Are there hooks you've already written in your branches that should move here instead?
