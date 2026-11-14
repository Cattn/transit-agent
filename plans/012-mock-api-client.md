# Plan 012: Add a mock API client so the UI can build every screen before the server is ready

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If a STOP condition occurs, stop and report. Do
> not improvise. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 45f5379..HEAD -- packages/shared/src`
> Expected: plan 004 has landed (`packages/shared/src/client/`). Anything else changed in
> `packages/shared/src/domain/` → read it; if `ApiClient` or the agent/place schemas look
> different from "Current state", STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (new files only; nothing calls them until the UI opts in)
- **Depends on**: plans/004-client-sdk-and-trip-draft.md (must be DONE: this plan implements its `ApiClient` interface). Plan 013 is optional: if `computeWatchStatus` exists, use it (Step 4).
- **Category**: direction (parallel work)
- **Planned at**: commit `45f5379`, 2026-11-14

<!-- help:start -->
## Who's on it & how to help

- **Status:** ✅ **Done.** Merged in #32. (Profile methods for the mock come with #31.)
- **Owner:** @Cattn

<!-- help:end -->

## Why this matters

Today every UI screen waits on a chain: contract (002) → server (003) → client (004) → real
data. Two UI people and a maps person are idle-or-guessing until the server lands.

A mock client with **exactly the same interface** as the real one removes that wait. The UI
builds every screen (results, saved trips, chat, place search) against realistic data now, and
switches to the real server by changing one line:

```ts
const api = useMock ? createMockApiClient() : createApiClient(BASE_URL, { deviceId });
```

It also gives the UI a way to see the awkward states (slow server, errors, "nothing found",
a bus running late) without having to make the server produce them.

## Current state

- After plan 004, `packages/shared/src/client/api-client.ts` exports `createApiClient(baseUrl, options)` and the type `ApiClient` with these methods: `health`, `sections`, `planTrip`, `listItineraries`, `getItinerary`, `saveItinerary`, `updateItinerary`, `deleteItinerary`, `sendAgentMessage`, `searchPlaces`. It also exports `ApiClientError(status, code, message, details?)`.
- `packages/shared/src/domain/fixtures.ts` exports `sampleItinerary` (one valid itinerary, Boston, with a bus leg that has `timeSource: 'realtime'` and `delayMinutes: 1`). Read it: it is the pattern for building valid itineraries.
- Schemas to validate against: `ItinerarySchema`, `SavedItinerarySchema`, `PlanResponseSchema`, `AgentMessageResponseSchema`, `PlaceSearchResponseSchema` (agent and place schemas are added by plan 004).
- Style: 2-space, single quotes, named exports, `.js` extensions on relative imports (NodeNext). Tests are Vitest files next to the code (`*.test.ts`), e.g. `packages/shared/src/domain/itinerary.test.ts`.
- `@transit/shared` must stay framework-free (no React) and must run in browsers, Node and Hermes (React Native). Do not use `node:` imports.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Shared tests | `npm run test:unit -w @transit/shared` | all pass |
| Typecheck all | `npm run typecheck` | exit 0 |
| Full | `npm run check` | exit 0 |
| Mobile bundle | `npm run build:mobile` | exit 0 (proves Hermes-safe) |

## Scope

**In scope (create):**
```
packages/shared/src/client/mock/mock-client.ts      createMockApiClient(options) implements ApiClient
packages/shared/src/client/mock/mock-routes.ts      mockItineraries(request) → Itinerary[] (deterministic)
packages/shared/src/client/mock/mock-agent.ts       mockAgentReply(request) → AgentMessageResponse (keyword rules)
packages/shared/src/client/mock/mock-places.ts      a small Boston gazetteer + search
packages/shared/src/client/mock/*.test.ts
packages/shared/src/index.ts                        (modify: export createMockApiClient, MockScenario, MockApiClientOptions)
```

**Out of scope:** `apps/**` (the UI team decides when to switch it on), `apps/server/**`, any change to existing schemas. If a schema is missing something, STOP.

## Git workflow

Branch `plan/012-mock-client`. One commit per step. Do not push unless told.

## Steps

### Step 1: Options and scenarios

`mock-client.ts`:
```ts
export type MockScenario =
  | 'normal'        // realistic results
  | 'empty'         // planTrip returns no itineraries and no near-misses, plus warning 'No routes found for this trip'
  | 'nearMissOnly'  // every option breaks a constraint → all in nearMisses with violations
  | 'serverError'   // every call rejects with ApiClientError(500, 'internal', 'Internal error')
  | 'offline';      // every call rejects with ApiClientError(0, 'network', 'Network error')

export interface MockApiClientOptions {
  scenario?: MockScenario | (() => MockScenario);   // function form lets a dev menu switch it live
  latencyMs?: number;                               // default 400; 0 in tests
  now?: () => Date;                                 // default () => new Date(); tests pass a fixed clock
  seedSaved?: boolean;                              // default true: start with 2 saved trips so Home isn't empty
}
export function createMockApiClient(options: MockApiClientOptions = {}): ApiClient
```
Every method: `await delay(latencyMs)`, then check the scenario, then answer. Every return value is
**parsed with its schema** before returning (`PlanResponseSchema.parse(...)` etc.). That guarantees
the mock never hands the UI a shape the real server can't produce.

**Verify**: `npm run typecheck` → exit 0. `const _check: ApiClient = createMockApiClient()` compiles (put that line in the test file).

### Step 2: Deterministic routes (`mock-routes.ts`)

```ts
export function mockItineraries(request: TripRequest): Itinerary[]
```
Build options from origin → destination. Keep it simple; it only needs to *look* right:

- Distance `d` = haversine metres between origin and destination (write a 6-line helper here; do not import from the server).
- Geometry for each leg: a straight `LineString` from the leg's start point to its end point, with 6 interpolated points. Leg start/end points are fractions of the origin→destination line.
- Options (generate only those whose modes are all in `request.modes`; `walk` is always allowed):

| id suffix | Legs (fraction of route) | Notes |
|---|---|---|
| `fast` | walk 0→0.1, bus 0.1→0.5, rail 0.5→0.95 (`transferBufferMinutes: 3`), walk 0.95→1 | bus leg `timeSource: 'realtime'`, `delayMinutes: 4`; rail `scheduled`; risk `high`, reason `"Tight 3 min transfer to Red Line"` |
| `safe` | walk 0→0.1, bus 0.1→0.95, walk 0.95→1 | bus `scheduled`; risk `low` |
| `bike` | bike 0→0.35, rail 0.35→0.95 (`transferBufferMinutes: 6`), walk 0.95→1 | needs `bike` or `bikeshare`; bikeshare adds a `"Bikeshare unlock"` $2.95 cost line |
| `drive` | car 0→1 | needs `car`; cost lines Gas + Parking, `estimated: true` |

- Speeds (m/min): walk 80, bike 250, bus 300, rail 600, car 500. Distance × 1.3 detour. Durations rounded up.
- Times: `departAt` → first leg starts at `request.time.at`; `arriveBy` → last leg ends at it. Legs are back-to-back plus each leg's `transferBufferMinutes`.
- Fares: bus 1.70, rail 2.40. Gas = miles ÷ (`vehicles.carMpg ?? 28`) × 3.20, Parking 15. All `estimated: true`.
- IDs: `mock-${suffix}-${hash}`, where `hash` is a stable string hash (e.g. FNV-1a, hex) of `JSON.stringify([origin.coordinates, destination.coordinates, time.at])`. No `Math.random`, no `crypto`.
- `source: { provider: 'mock', fetchedAt: now().toISOString() }`. `summary` like `Walk 4 min → Bus 1 → Red Line → Walk 3 min`.
- `violations: []` and the `risk` above; `planTrip` (Step 3) fills violations.

Tests (`mock-routes.test.ts`): every result passes `ItinerarySchema.parse`; same input → same ids; modes `['walk','bus']` returns only `safe`; `arriveBy` makes the last leg end exactly at `time.at`.

### Step 3: `planTrip` with constraints

In `mock-client.ts`, `planTrip(request)`:
1. `request` = `TripRequestSchema.parse(request)` (an invalid request → reject with `ApiClientError(400, 'invalid_request', 'Request validation failed')`, like the server).
2. Get `mockItineraries(request)`. For each, compute `violations` with a **small** check: `maxWalkMinutes`, `maxTransfers`, `maxBudgetUsd`, `arriveBy`. Use the same message style as the server: `"Walks 14 min, over your 10 min limit"`.
3. No violations → `itineraries`; otherwise → `nearMisses` (max 3). Sort `itineraries` by `durationMinutes` (the mock does not reproduce server ranking; say so in a JSDoc).
4. Scenarios `empty` / `nearMissOnly` override this as described in Step 1.

### Step 4: Saved itineraries (in memory)

A `Map<string, SavedItinerary>` inside the client instance (each `createMockApiClient()` call gets its own map).
- `saveItinerary(input)` → `SavedItinerarySchema.parse({ ...input.itinerary, savedAt, label, watch: input.watch, request: input.request })`.
- `listItineraries()` newest `savedAt` first. `getItinerary`, `updateItinerary`, `deleteItinerary`: unknown id → `ApiClientError(404, 'not_found', 'Itinerary not found')`.
- `seedSaved` (default true): seed two trips from `mockItineraries` of a fixed Boston Common → Harvard request: one departing `now + 25 min` labelled "Morning commute", one `now + 3 h` labelled "Dinner".
- **If `computeWatchStatus` is exported from `@transit/shared` (plan 013 landed)**, set `watchStatus` on every returned saved trip with `watch: true`, computed at `now()`. If plan 013 has not landed, skip this bullet and note it in the PR; do not invent the field.

### Step 5: Agent replies (`mock-agent.ts`)

```ts
export function mockAgentReply(body: AgentMessageRequest, now: Date, plan?: (r: TripRequest) => PlanResponse): AgentMessageResponse
```
Keyword rules over `body.message.toLowerCase()`, applied in order, each adding to `draftPatch`:
- `/walk (?:at most |max |under )?(\d+)/` → `constraints.maxWalkMinutes`
- `cheap|budget|save money` → `preferences.comfortVsCost: 0.2`; `comfort|comfy` → `0.8`
- `tight|risky|evil` → `preferences.transferRisk: 0.8`; `safe|no rush|careful` → `0.1`
- `must be on time|can't be late|interview|flight` → `preferences.lateTolerance: 'strict'`
- `bike` → `modes` = current modes + `bike`; `drive|car` → + `car`
- `to harvard|to mit|to logan|to south station` (use the gazetteer names) → `destination`
Then: if the draft (after the patch) has no `destination`, add question `{ field: 'destination', question: 'Where are you going?' }`. If it has origin, destination and time, call `planTrip` and include `plan`.
`reply` is a fixed sentence built from `describePatch(draftPatch)` (plan 004), e.g. `"Got it: max walk 10 min, cheaper options first."` If nothing matched: `"I'm a mock agent. Try \"cheap, walk at most 10 min, to Harvard\"."`
`sessionId`: `body.sessionId ?? 'mock-session'`.

Tests: `"cheap, walk at most 10 min"` → patch has `maxWalkMinutes: 10` and `comfortVsCost: 0.2`; a draft without destination → one question with `field: 'destination'`; result passes `AgentMessageResponseSchema.parse`.

### Step 6: Place search (`mock-places.ts`)

About 15 Boston places with real coordinates: Boston Common, Harvard Square, MIT, Kendall/MIT station, South Station, North Station, Back Bay, Logan Airport (`kind: 'airport'`, `code: 'BOS'`), Fenway Park, Davis Square, Downtown Crossing, Seaport, Boston University, Northeastern University, Providence Station. `searchPlaces(q)` → case-insensitive substring match on name; `q.length < 3` → empty list. Shape: whatever `PlaceSearchResponseSchema` defines in plan 004.

### Step 7: Export and verify

Export `createMockApiClient`, `MockScenario`, `MockApiClientOptions` from `packages/shared/src/index.ts`. Do **not** export the internal helpers.

Client-level tests (`mock-client.test.ts`, `latencyMs: 0`, fixed `now`): `planTrip` with `maxTransfers: 0` puts `fast` in `nearMisses`; save → list → update → delete → get rejects with `code 'not_found'`; `scenario: 'offline'` rejects with `code 'network'`; the function form of `scenario` switches behaviour between two calls.

**Verify**: `npm run check` → exit 0; `npm run build:mobile` → exit 0.

## Handoff to the UI team (put this in the PR description)

```ts
import { createApiClient, createMockApiClient } from '@transit/shared';
const api = import.meta.env.VITE_USE_MOCK === '1'          // web; mobile: process.env.EXPO_PUBLIC_USE_MOCK
  ? createMockApiClient({ scenario: () => devMenuScenario })
  : createApiClient(import.meta.env.VITE_API_URL ?? '', { deviceId: () => deviceId });
```
Try `scenario: 'nearMissOnly'`, `'empty'` and `'offline'` on every screen before calling it done.

## Done criteria

- [ ] `npm run check` exits 0; ≥ 12 new tests
- [ ] `npm run build:mobile` exits 0
- [ ] `grep -rn "Math.random\|node:" packages/shared/src/client/mock` → no matches
- [ ] No changes under `apps/` or `packages/shared/src/domain/`

## STOP conditions

- `ApiClient` (plan 004) is not an exported type, or lacks `sendAgentMessage` / `searchPlaces`.
- A mock value fails its schema and the cause is the schema, not the mock.
- `npm run build:mobile` fails because of something in `client/mock/`.

## Maintenance notes

- **Every new `ApiClient` method needs a mock method in the same PR.** TypeScript enforces this, since the mock is typed as `ApiClient`.
- The mock does not copy server ranking or risk rules. It only produces plausible data. Don't write UI tests that depend on mock ordering matching the server.
- When plan 008 adds fields to `watchStatus`, update Step 4's seeding.

## Open questions for review

- 012-Q1: Should the mock be on by default in development until the server is deployed? *(proposed: no; opt in with `VITE_USE_MOCK=1` / `EXPO_PUBLIC_USE_MOCK=1`)*
- 012-Q2: Is a hidden dev menu for switching scenarios worth building in each app? *(proposed: yes, tiny, UI team's call)*
