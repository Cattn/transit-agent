# Plan 015: One set of React hooks for both apps (`@transit/client-react`)

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If a STOP condition occurs, stop and report. Do
> not improvise. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 45f5379..HEAD -- packages package.json apps/web/package.json apps/mobile/package.json`
> Expected: plans 004 and 012 landed in `packages/shared/src/client/`. If a `packages/client-react`
> or `packages/ui-hooks` directory already exists, STOP: the UI team may have started their own.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MEDIUM (new workspace package; touches root build scripts that every app uses)
- **Depends on**: plans/004-client-sdk-and-trip-draft.md, plans/012-mock-api-client.md (tests run against the mock). Uses plan 013's `computeWatchStatus` only through data already on `SavedItinerary`.
- **Category**: direction (parallel work)
- **Planned at**: commit `45f5379`, 2026-11-14

<!-- help:start -->
## Who's on it & how to help

- **Status:** 🟢 **Up for grabs** once #8 and #20 merge.
- **Owner:** Nobody yet
- **Up for grabs?** Yes. Good fit for a UI person. No screens, just the logic both apps share.
- **Waiting on:** #8, #20

**Open questions** (answer by number in a comment on #23):

1. @Rad1ee @DMFriends: plain React hooks (suggested) or TanStack Query from the start?
2. @Rad1ee @DMFriends: have you already written hooks in your branches that should move here instead?

**How to help**
- **Take it:** comment "taking this" and assign yourself, so two people don't build the same thing.
- **With a coding agent** (Claude Code, Codex, Cursor, ...): pull `main`, then tell your agent:
  > Read `plans/015-client-react-hooks.md` and follow it step by step. Run every verification command and check the output matches. Only change files listed under Scope. If a STOP condition happens, stop and tell me instead of working around it. Don't push. When done, show me the diff and the check results.

  Review what it did, then open a PR that says `Closes #23`.
- **Just feedback:** answer the open questions above by number in a comment.

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
- After plan 004: `@transit/shared` exports `ApiClient`, `ApiClientError`, `createDeviceId`, `initialDraftState`, `applyDraftPatch`, `toTripRequest`, `describePatch`, `DraftState`, `TripDraftPatch`, `DraftChangeSource`, `AgentMessageResponse`, `Place`. After plan 012: `createMockApiClient`.
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

- New `ApiClient` methods get a hook here only when two screens need the same logic. One-off calls can use `useApi()` directly.
- If the team later wants caching across screens, TanStack Query can replace the internals of `usePlanTrip` / `useSavedItineraries` without changing their return shapes.

## Open questions for review

- 015-Q1 (@Rad1ee @DMFriends): Plain hooks (proposed) or TanStack Query from the start?
- 015-Q2 (@Rad1ee @DMFriends): Are there hooks you've already written in your branches that should move here instead?
