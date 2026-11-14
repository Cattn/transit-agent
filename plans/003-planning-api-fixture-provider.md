# Plan 003: Serve `POST /api/plan` and saved-itinerary endpoints, backed by a deterministic fixture route provider

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If a STOP condition occurs, stop and report — do
> not improvise. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat c9e33cc..HEAD -- apps/server scripts/smoke.mjs`
> Plans 001 and 002 are expected to have landed (test files, `packages/shared/src/domain/`). Any other change in `apps/server/src` → compare with "Current state"; mismatch → STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW (new code; existing endpoints unchanged)
- **Depends on**: plans/002-shared-domain-contract.md (must be DONE — this plan imports its schemas)
- **Category**: direction
- **Planned at**: commit `c9e33cc`, 2026-11-13
- **Issue**: https://github.com/Cattn/transit-agent/issues/7

<!-- help:start -->
## Who's on it & how to help

- **Status:** 🔄 **In progress.** @Cattn is running a coding agent on it (started 2026-11-14).
- **Owner:** @Cattn

**Open questions** (answer by number in a comment on #7):

1. When nothing matches all your limits, we show up to 3 "almost works" options. Is 3 the right number?
2. Should planning a trip use your saved profile defaults automatically (needs the device ID on every request)? *(suggested: yes, when the app sends it)*
3. Who explains why option #1 is ranked first: the server (a fixed one-line reason) or the AI agent? *(suggested: agent; server only gives the facts)*

<!-- help:end -->

## Why this matters

The UI and maps teams are building now and need real-shaped data: multi-leg itineraries with
GeoJSON geometry, costs, risk reasons, and freshness flags. Real transit routing (plan 007) needs
provider research. This plan unblocks both teams by shipping the **full API surface** with a
**deterministic fixture provider** behind a `RouteProvider` interface. Later providers plug in with
no client changes. It also puts the product's core logic, which is the same for every provider,
into pure, tested server modules:

- constraint checking (requirements exclude options),
- risk assessment (deterministic transfer-buffer rules: "how evil of a transfer"),
- ranking (preferences order options).

## Current state

- `apps/server/src/app.ts` (20 lines): `createServer()` builds Fastify with `logger: true`, registers `@fastify/cors` with origins from `CORS_ORIGIN`, defines `GET /api/health` and `GET /api/sections`.
- `apps/server/src/index.ts`: calls `createServer()`, listens on `HOST`/`PORT`, graceful shutdown on SIGINT/SIGTERM.
- `apps/server/tsconfig.json`: NodeNext — **relative imports need `.js` extensions**.
- `scripts/smoke.mjs`: imports `../apps/server/dist/app.js`, uses `app.inject`, asserts health/sections/CORS.
- After plan 002: `@transit/shared` exports `TripRequestSchema`, `TripRequest`, `Itinerary`, `ItinerarySchema`, `Leg`, `SavedItinerary`, `SaveItineraryRequestSchema`, `PlanResponse`, `ApiErrorBody`, `TravelMode`, `scheduledModes`, `sampleItinerary`. Read `packages/shared/src/domain/*.ts` before starting — those files are the contract; do not modify them here.
- Style: see `apps/server/src/app.ts` — 2-space, single quotes, named exports, `async` route handlers returning typed objects.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Build shared | `npm run build:shared` | exit 0 |
| Server tests | `npm run test:unit -w @transit/server` | all pass |
| Smoke | `npm run smoke` | "API smoke checks passed." |
| Full | `npm run check` | exit 0 |
| Manual | `npm run dev:server` then `curl -s -X POST localhost:3001/api/plan -H 'content-type: application/json' -d @apps/server/src/providers/fixture-request.json` | JSON with `itineraries` |

## Scope

**In scope (create unless noted):**
```
apps/server/src/app.ts                      (modify: accept deps, register route modules, error handler)
apps/server/src/http/errors.ts              ApiError helper + Fastify error handler
apps/server/src/http/validate.ts            parse(schema, value) → typed value or throws 400 ApiError
apps/server/src/http/device.ts              read x-device-id header (decision D4)
apps/server/src/routes/plan.ts
apps/server/src/routes/itineraries.ts
apps/server/src/planning/geo.ts             haversine, interpolate, offsetLine
apps/server/src/planning/constraints.ts     checkConstraints(itinerary, request) → string[]
apps/server/src/planning/risk.ts            assessRisk(itinerary, request) → Itinerary['risk']
apps/server/src/planning/rank.ts            scoreItinerary / rankItineraries
apps/server/src/planning/plan-trip.ts       orchestration
apps/server/src/providers/types.ts          RouteProvider interface
apps/server/src/providers/fixture.ts        FixtureProvider
apps/server/src/providers/fixture-request.json  sample Boston request for curl
apps/server/src/store/types.ts              ItineraryStore interface
apps/server/src/store/memory.ts             in-memory implementation
*.test.ts next to each planning/provider/route module
scripts/smoke.mjs                           (modify: add one /api/plan assertion)
```

**Out of scope:** `packages/shared/**` (contract is frozen for this plan — if it's missing something, STOP), `apps/web/**`, `apps/mobile/**`, database (plan 005), Gemini (plan 006), real providers (plan 007).

## Git workflow

Branch `plan/003-planning-api`; one commit per step group (planning, providers, routes). No push unless told.

## Steps

### Step 1: HTTP helpers

`http/errors.ts`:
```ts
export class ApiError extends Error {
  constructor(public readonly statusCode: number, public readonly code: string, message: string, public readonly details?: unknown) { super(message); }
}
export function registerErrorHandler(app: FastifyInstance): void
```
The handler maps `ApiError` → `reply.status(e.statusCode).send({ error: { code, message, details } })` (shape = `ApiErrorBody` from shared). Fastify's own 404 → `{ error: { code: 'not_found', message } }` via `app.setNotFoundHandler`. Anything else → log it, return 500 `{ error: { code: 'internal', message: 'Internal error' } }` (never leak stack traces).

`http/validate.ts`:
```ts
export function parse<T extends z.ZodType>(schema: T, value: unknown): z.infer<T>
```
On failure throw `new ApiError(400, 'invalid_request', 'Request validation failed', z.treeifyError(result.error))`. If `z.treeifyError` doesn't exist in the installed zod, use `result.error.issues`.

`http/device.ts`: `getDeviceId(request): string` → header `x-device-id`, must match `/^[A-Za-z0-9_-]{8,64}$/`, else `ApiError(400, 'missing_device_id', …)`.

**Verify**: `npm run typecheck -w @transit/server` → exit 0.

### Step 2: Geometry helpers (`planning/geo.ts`) + tests

- `haversineMeters(a: LngLat, b: LngLat): number`
- `interpolate(a, b, t): LngLat` (linear in lng/lat is fine at city scale)
- `wobbleLine(a, b, points = 12, amplitude = 0.002, seed = 0): LngLat[]` — a gently curved polyline from a to b (perpendicular sine offset). Fixture routes then don't render as overlapping straight lines on the map.

Tests: Boston (−71.0589, 42.3601) → Cambridge (−71.1097, 42.3736) is 4.0–4.6 km; `wobbleLine` starts at a, ends at b, has `points` entries.

### Step 3: Provider interface + fixture provider

`providers/types.ts`:
```ts
export interface RouteProvider {
  readonly name: string;
  /** True if this provider can answer for these modes/places (e.g. flight provider only when 'flight' allowed). */
  supports(request: TripRequest): boolean;
  /** Return candidate itineraries. risk/violations may be left empty — planTrip fills them. */
  search(request: TripRequest, signal?: AbortSignal): Promise<Itinerary[]>;
}
```

`providers/fixture.ts` — `export class FixtureProvider implements RouteProvider { name = 'fixture' }`. `supports()` → true. `search()` generates **deterministic** options from the straight-line distance `d` between origin and destination:

| Option key | Generate when | Legs (fraction of the route) | Speeds (m/min) |
|---|---|---|---|
| `transit` | `bus` or `rail` allowed | walk 0→0.08, bus 0.08→0.55, rail 0.55→0.94 (transfer buffer 4 min), walk 0.94→1 | walk 80, bus 300, rail 600 |
| `transit-safe` | same | same as above but transfer buffer 12 min and one fewer transfer (single bus 0.08→0.94) | bus 300 |
| `bike-rail` | (`bike` or `bikeshare`) and `rail` allowed | bike 0→0.3, rail 0.3→0.95 (buffer 5), walk 0.95→1 | bike 250 |
| `drive` | `car` allowed and `vehicles.ownsCar` | car 0→1 | car 500 |
| `walk` | `d < 3000` | walk 0→1 | walk 80 |

Rules:
- Leg distance = fraction × `d` × 1.3 (detour factor). Duration = distance ÷ speed, rounded up to whole minutes.
- Times: if `time.type === 'departAt'`, the first leg starts at `time.at`; if `arriveBy`, the last leg ends at `time.at` (compute backwards). Transfers insert their buffer before the next leg's `departAt` and set `transferBufferMinutes` on that leg.
- `timeSource`: `'scheduled'` for bus/rail, `'estimated'` otherwise.
- Costs (all `estimated: true`): bus $1.70, rail $2.40 (one line per transit leg), bikeshare $2.95 unlock (only if `bikeshare` allowed and `ownsBike` false), drive: miles ÷ (`vehicles.carMpg ?? 28`) × $3.20 gas + $15 parking.
- IDs: `itineraryId = \`fx-${optionKey}-${hash}\`` where `hash` is the first 8 hex chars of sha1(JSON.stringify([origin.coordinates, destination.coordinates, time])) (use `node:crypto`). Leg id `\`${itineraryId}-${index}\``. Same input → same ids (tests rely on it).
- Geometry: `wobbleLine(from, to, 12, 0.002, optionIndex)` per leg.
- `summary`: legs joined with ` → `, e.g. `Walk 5 min → Bus → Red Line → Walk 3 min` (use `routeName` when present: bus `'Bus 1'`, rail `'Red Line'`).
- `source: { provider: 'fixture', fetchedAt: new Date().toISOString() }`.
- `transfers` = number of transit legs − 1 (min 0); `walkMinutes` = sum of walk legs.
- Every returned itinerary must pass `ItinerarySchema.parse` — assert this in tests.

`providers/fixture-request.json`: Boston Common (−71.0656, 42.3550) → Harvard Square (−71.1190, 42.3736), `departAt` `2026-11-16T08:00:00-05:00`, modes `["walk","bus","rail","bike","car"]`, vehicles `{ "ownsBike": true, "ownsCar": true }`.

Tests (`fixture.test.ts`): option set changes with modes; ids are stable across two calls; `arriveBy` makes the last leg end exactly at `time.at`; every result passes `ItinerarySchema`.

### Step 4: Constraints, risk, ranking (pure) + tests

`planning/constraints.ts` — `checkConstraints(it: Itinerary, req: TripRequest): string[]`, one human-readable string per violation:
- leg mode not in `req.modes` → `"Uses car, which is not selected"`
- `arriveBy` and `it.arriveAt > arriveBy` → `"Arrives 8:12 AM, after the 8:00 AM deadline"` (format with `Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' })`; tests may match with a regex)
- `maxBudgetUsd`, `maxWalkMinutes` (vs `walkMinutes`), `maxBikeMinutes` (sum bike + bikeshare legs), `maxDriveMinutes`, `maxTransfers`, `minTransferBufferMinutes` (any leg's `transferBufferMinutes` below it).

`planning/risk.ts` — `assessRisk(it, req)`: for each leg with `transferBufferMinutes` defined:
- threshold shift `s` = `{ strict: 3, some: 0, flexible: -1 }[req.preferences.lateTolerance]`
- buffer < 3 + s → **high**, reason `"Tight 2 min transfer to Red Line"`
- buffer < 6 + s, or (previous leg `timeSource === 'scheduled'` and previous mode `bus` and buffer < 10 + s) → **medium**, reason `"5 min transfer after a scheduled (not live) bus"`
- overall level = max over transfers; no transfers → `low`, `reasons: []`.
**No probabilities, no invented percentages** (product rule).

`planning/rank.ts` — `scoreItinerary(it, prefs): number` (lower is better):
```
score = durationMinutes
      + (1 - comfortVsCost) * 1.5 * cost.totalUsd
      + (0.5 + comfortVsCost) * 6 * transfers
      + (1 - activeTravel) * 0.5 * walkMinutes
      + { low: 0, medium: 8, high: 20 }[risk.level] * (1 - transferRisk)
```
`rankItineraries(its, prefs)` → stable sort by score. Export the weights as a named `const rankingWeights` object so they're tunable in one place.

Tests (`rank.test.ts`) assert **orderings, not numbers**: with `comfortVsCost: 0` a $3 60-min trip beats a $25 50-min trip; with `comfortVsCost: 1` the 50-min trip wins; with `transferRisk: 0` a high-risk trip loses to an otherwise-equal low-risk one, and with `transferRisk: 1` they tie.

`planning/plan-trip.ts`:
```ts
export async function planTrip(req: TripRequest, providers: RouteProvider[], signal?: AbortSignal): Promise<PlanResponse>
```
1. `Promise.allSettled` over providers whose `supports(req)` is true. Each rejection → `warnings.push(\`${p.name} unavailable\`)` (log the error, do not throw).
2. For each itinerary: `risk = assessRisk`, `violations = checkConstraints`.
3. Split: `violations.length === 0` → `itineraries` (ranked); else → `nearMisses` (ranked, max 3).
4. If both empty → `warnings.push('No routes found for this trip')`.

**Verify**: `npm run test:unit -w @transit/server` → all pass.

### Step 5: Store interface + memory implementation

`store/types.ts`:
```ts
export interface ItineraryStore {
  list(deviceId: string): Promise<SavedItinerary[]>;
  get(deviceId: string, id: string): Promise<SavedItinerary | undefined>;
  save(deviceId: string, input: SaveItineraryRequest): Promise<SavedItinerary>;   // id = itinerary.id; re-saving the same id overwrites
  update(deviceId: string, id: string, patch: { label?: string; watch?: boolean }): Promise<SavedItinerary | undefined>;
  remove(deviceId: string, id: string): Promise<boolean>;
}
```
`store/memory.ts`: `export class MemoryItineraryStore implements ItineraryStore` using `Map<deviceId, Map<id, SavedItinerary>>`. `savedAt = new Date().toISOString()`. Plan 005 adds a SQLite implementation of the same interface.

### Step 6: Routes + wire into `createServer`

Change `app.ts` signature to:
```ts
export interface ServerDeps { providers: RouteProvider[]; itineraries: ItineraryStore }
export function createServer(deps: Partial<ServerDeps> = {}) {
  const resolved: ServerDeps = { providers: deps.providers ?? [new FixtureProvider()], itineraries: deps.itineraries ?? new MemoryItineraryStore() };
  …existing cors + health + sections unchanged…
  registerErrorHandler(app);
  app.register(planRoutes, resolved);
  app.register(itineraryRoutes, resolved);
}
```
(`scripts/smoke.mjs` calls `createServer()` with no args — that must keep working.)

`routes/plan.ts`: `POST /api/plan` → `parse(TripRequestSchema, request.body)` → `planTrip(...)` → `PlanResponse`.

`routes/itineraries.ts` (all require `getDeviceId`):
| Method | Path | Body | Success |
|---|---|---|---|
| GET | `/api/itineraries` | — | 200 `{ itineraries: SavedItinerary[] }` (newest `savedAt` first) |
| GET | `/api/itineraries/:id` | — | 200 `SavedItinerary`, else 404 `not_found` |
| POST | `/api/itineraries` | `SaveItineraryRequest` | 201 `SavedItinerary` |
| PATCH | `/api/itineraries/:id` | `{ label?: string, watch?: boolean }` (zod, `.strict()`) | 200 / 404 |
| DELETE | `/api/itineraries/:id` | — | 204 / 404 |

CORS: confirm the preflight for `x-device-id` passes. Add a test: OPTIONS `/api/itineraries` with `access-control-request-headers: x-device-id` → response `access-control-allow-headers` includes `x-device-id`. If it doesn't, set `allowedHeaders: ['content-type', 'x-device-id']` in the existing cors registration.

Route tests (`routes/*.test.ts`, pattern: `scripts/smoke.mjs` inject style):
- plan with `fixture-request.json` → 200, ≥ 3 itineraries, each passes `ItinerarySchema`.
- plan with `{}` → 400 with `error.code === 'invalid_request'`.
- plan with `constraints.maxTransfers: 0` → the multi-transfer `transit` option appears in `nearMisses`, not `itineraries`.
- save → list → get → patch watch false → delete → get 404, all with header `x-device-id: test-device-1`.
- list without header → 400 `missing_device_id`. Device A cannot see device B's itinerary.

### Step 7: Smoke script

Add to `scripts/smoke.mjs` (inside the try): POST `/api/plan` with an inline copy of the fixture request → 200 and `json().itineraries.length > 0`.

**Verify**: `npm run check` → exit 0, prints "API smoke checks passed."

## Test plan

Unit: geo, fixture, constraints, risk, rank, plan-trip (provider that throws → warning, not 500). Integration: route tests via `app.inject`. Expect ≥ 25 tests total.

## Done criteria

- [ ] `npm run check` exits 0
- [ ] `curl -s -X POST localhost:3001/api/plan -H 'content-type: application/json' -d @apps/server/src/providers/fixture-request.json | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).itineraries.length))"` prints ≥ 3 (with `npm run dev:server` running)
- [ ] `grep -rn "Math.random" apps/server/src/providers` → no matches (determinism)
- [ ] No changes under `packages/shared`, `apps/web`, `apps/mobile`
- [ ] `plans/README.md` row 003 updated

## STOP conditions

- A shared schema is missing a field you need → report; do not edit `packages/shared`.
- Fastify plugin encapsulation prevents the error handler from applying to registered route plugins (symptom: validation errors come back as Fastify's default 500 shape). Report with the observed response.
- `planTrip` results fail `ItinerarySchema.parse` and the cause is in the schema rather than your fixture.

## Maintenance notes

- `rankingWeights` will need tuning against real data (plan 007). Keep the ordering tests; they encode intent.
- Risk rules are deliberately deterministic. If historical delay data appears later, replace `assessRisk` internals, not its output shape.
- The fixture provider stays forever as the offline/demo provider (`ROUTE_PROVIDERS=fixture`, plan 007).

## Open questions for review

- 003-Q1: Near-misses capped at 3 — right number?
- 003-Q2: Should `POST /api/plan` also require `x-device-id` (to apply saved profile defaults, plan 005)? Proposed: optional — applied when present.
- 003-Q3: Ranking weights above are a starting point. Want a "why this is #1" explanation string from the server, or leave explanations to the agent?
