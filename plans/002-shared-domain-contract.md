# Plan 002: Define the shared trip domain contract (zod schemas + types) in `@transit/shared`

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If a STOP condition occurs, stop and report — do
> not improvise. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat c9e33cc..HEAD -- packages/shared`
> Expected changes from plan 001 (merged in #18): `packages/shared/package.json` (vitest + `test:unit`), `packages/shared/tsconfig.json` (`exclude` tests), new `packages/shared/src/index.test.ts`. `packages/shared/src/index.ts` itself must be unchanged; if it differs from "Current state", STOP.

## Status

- **Priority**: P1 — everything else builds on this
- **Effort**: M
- **Risk**: MED (contract churn is expensive once three teams build on it — hence the review gate in step 6)
- **Depends on**: plans/001-test-baseline.md
- **Category**: direction / tech-debt
- **Planned at**: commit `c9e33cc`, 2026-11-13
- **Issue**: https://github.com/Cattn/transit-agent/issues/6
- **Review**: answered on #6 (2026-11-14). Changes from that review are already applied below: no `rideshare` mode; optional user-chosen `timeZone`; risk stays two separate fields.

<!-- help:start -->
## Who's on it & how to help

- **Status:** ✅ **Done.** Merged in #19.
- **Owner:** @Cattn

<!-- help:end -->

## Why this matters

Four consumers need one shared definition of a trip: the filters UI, the Gemini agent (which must
emit the same structure the filters edit), the server's planner/ranker, and the map (which draws
itinerary legs by mode and selects by itinerary id). Today `packages/shared` only has `Section` and
`HealthResponse`. Defining the contract as **zod schemas** gives one source for (a) TypeScript types
(`z.infer`), (b) server request validation, and (c) the agent's tool parameter schemas — ADK
TypeScript `FunctionTool` takes a zod `z.object` for `parameters`.

Product rules this contract encodes (from issues #1–#4 and the design threads):

- **Hard constraints vs soft preferences are separate objects.** "Arrive by 9" excludes options; "prefer fewer transfers" ranks.
- **"How safe can you be"** (issue #2) → `preferences.lateTolerance` (`strict` | `some` | `flexible`) plus optional hard `constraints.arriveBy`.
- **"Comfort vs Risk"**, **"How evil of a transfer"** → `preferences.comfortVsCost` and `preferences.transferRisk` (0–1 sliders) and hard `constraints.minTransferBufferMinutes`.
- **"Is a 15 minute walk fine"** → `constraints.maxWalkMinutes`.
- **"How rich are you"** (issue #1) → `constraints.maxBudgetUsd` + `preferences.comfortVsCost`.
- **"Can I make it back" (late night)** → optional `returnTime`.
- **"Choose modes for the day (bike + car)"** (map thread) → `modes.allowed` plus `vehicles` (owns bike/car).
- **Freshness**: each leg carries `timeSource: 'realtime' | 'scheduled' | 'estimated'`, each itinerary carries `fetchedAt` — bus schedules "are NOT reliable" (issue #2), so the UI must be able to say which times are live.
- **Map needs**: each leg has GeoJSON `LineString` geometry and a stable `id`; each itinerary has a stable `id` so tapping any leg selects the whole journey.

## Current state

- `packages/shared/src/index.ts` (42 lines): `SectionId`, `Section`, `HealthResponse`, `sections` array, `createApiClient(baseUrl)` with a private `get<T>()` and `health()`/`sections()` methods.
- `packages/shared/package.json`: no dependencies; `"type": "module"`; builds with `tsc` to `dist/`; consumers (`apps/web`, `apps/mobile`, `apps/server`) import from `@transit/shared` which resolves to `dist/index.js`. **After editing shared you must `npm run build:shared` before other workspaces see changes.**
- `packages/shared/tsconfig.json`: `"module": "NodeNext"` → relative imports need `.js` extensions; `lib` includes `DOM` (fetch types). `tsconfig.base.json` has `strict` and `noUncheckedIndexedAccess`.
- Code style (see `packages/shared/src/index.ts`): 2-space indent, single quotes, semicolons, named exports, no default exports.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Add zod | `npm install zod@^4 -w @transit/shared` | exit 0 |
| Build shared | `npm run build:shared` | exit 0 |
| Unit tests | `npm run test:unit -w @transit/shared` | all pass |
| Full | `npm test` | exit 0 |
| Mobile bundle check | `npm run build:mobile` | exit 0 (proves zod bundles under Metro) |

## Scope

**In scope:** `packages/shared/package.json`, `package-lock.json` (npm only), new files under
`packages/shared/src/domain/`, `packages/shared/src/index.ts` (add re-exports only), new tests under `packages/shared/src/domain/*.test.ts`.

**Out of scope:** `apps/*` (no consumer changes in this plan), `createApiClient` (plan 004 extends it),
the existing `sections` export (keep it — the UI currently renders it).

## Git workflow

Branch `plan/002-domain-contract`; commit `add shared trip domain schemas`. No push unless told.

## Steps

### Step 1: Add zod

`npm install zod@^4 -w @transit/shared` (add to `dependencies`, not devDependencies — server and clients use it at runtime).

**Verify**: `node -e "import('zod').then(z=>console.log(typeof z.z.object))"` run from `packages/shared` → `function`

### Step 2: Create `packages/shared/src/domain/modes.ts`

```ts
import { z } from 'zod';

export const travelModes = ['walk', 'bike', 'bikeshare', 'bus', 'rail', 'ferry', 'car', 'flight'] as const;
export const TravelModeSchema = z.enum(travelModes);
export type TravelMode = z.infer<typeof TravelModeSchema>;

/** Modes whose times come from a timetable and can be late. */
export const scheduledModes: readonly TravelMode[] = ['bus', 'rail', 'ferry', 'flight'];

/** Product tabs (issue #4: "tabs for car, bus/bike, plane"). A tab is a filter over modes, not a separate data model. */
export const modeGroups = {
  transit: ['walk', 'bike', 'bikeshare', 'bus', 'rail', 'ferry'],
  drive: ['walk', 'car'],
  fly: ['walk', 'car', 'rail', 'bus', 'flight']
} as const satisfies Record<string, readonly TravelMode[]>;
export type ModeGroup = keyof typeof modeGroups;
```

### Step 3: Create `packages/shared/src/domain/places.ts`

```ts
import { z } from 'zod';

export const LngLatSchema = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]); // GeoJSON order: [lng, lat]
export type LngLat = z.infer<typeof LngLatSchema>;

export const PlaceSchema = z.object({
  name: z.string().min(1).optional(),
  coordinates: LngLatSchema,
  kind: z.enum(['address', 'stop', 'station', 'airport', 'bikeDock', 'poi']).optional(),
  /** Provider code: IATA for airports, stop_id for transit stops, station_id for bike docks. */
  code: z.string().optional()
});
export type Place = z.infer<typeof PlaceSchema>;
```

### Step 4: Create `packages/shared/src/domain/trip-draft.ts`

```ts
import { z } from 'zod';
import { TravelModeSchema } from './modes.js';
import { PlaceSchema } from './places.js';

const IsoDateTime = z.iso.datetime({ offset: true });
const Unit = z.number().min(0).max(1);

/** True for IANA zones like 'America/New_York'. Uses Intl (works in browsers, Node and Hermes). */
export function isValidTimeZone(zone: string): boolean {
  try { new Intl.DateTimeFormat('en-US', { timeZone: zone }); return true; } catch { return false; }
}

export const TripTimeSchema = z.object({
  type: z.enum(['departAt', 'arriveBy']),
  at: IsoDateTime
});

/** Requirements. An itinerary that violates any of these is excluded (or shown only as an explained near-miss). */
export const TripConstraintsSchema = z.object({
  arriveBy: IsoDateTime.optional(),
  maxBudgetUsd: z.number().nonnegative().optional(),
  maxWalkMinutes: z.number().int().nonnegative().optional(),
  maxBikeMinutes: z.number().int().nonnegative().optional(),
  maxTransfers: z.number().int().nonnegative().optional(),
  minTransferBufferMinutes: z.number().int().nonnegative().optional(),
  maxDriveMinutes: z.number().int().nonnegative().optional(),
  wheelchairAccessible: z.boolean().optional()
});

/** Preferences. Only affect ranking. 0..1 sliders map directly to UI sliders. */
export const TripPreferencesSchema = z.object({
  /** 0 = cheapest, 1 = most comfortable ("how rich are you"). */
  comfortVsCost: Unit.default(0.5),
  /** 0 = only safe transfers, 1 = "evil" tight transfers are fine. */
  transferRisk: Unit.default(0.3),
  /** "Do you HAVE to be there on time?" */
  lateTolerance: z.enum(['strict', 'some', 'flexible']).default('some'),
  /** 0 = minimise walking/biking effort, 1 = happy to walk/bike more for a better trip. */
  activeTravel: Unit.default(0.5)
});

export const VehiclesSchema = z.object({
  ownsBike: z.boolean().default(false),
  ownsCar: z.boolean().default(false),
  /** Used for driving cost (issue #1 gas prices). */
  carMpg: z.number().positive().optional()
});

export const TripDraftSchema = z.object({
  origin: PlaceSchema.optional(),
  destination: PlaceSchema.optional(),
  time: TripTimeSchema.optional(),
  /** "Can I make it back?" — plan also checks the latest viable return after this time. */
  returnTime: IsoDateTime.optional(),
  /** IANA zone used to DISPLAY this trip's times (user-choosable, review #6 Q5). Omitted = the origin's local zone. Stored times keep their own offsets regardless. */
  timeZone: z.string().refine(isValidTimeZone, { message: 'Unknown IANA time zone' }).optional(),
  modes: z.array(TravelModeSchema).min(1).default(['walk', 'bus', 'rail']),
  vehicles: VehiclesSchema.default({ ownsBike: false, ownsCar: false }),
  constraints: TripConstraintsSchema.default({}),
  preferences: TripPreferencesSchema.default({ comfortVsCost: 0.5, transferRisk: 0.3, lateTolerance: 'some', activeTravel: 0.5 })
});
export type TripDraft = z.infer<typeof TripDraftSchema>;

/** A draft that is complete enough to search. */
export const TripRequestSchema = TripDraftSchema.extend({
  origin: PlaceSchema,
  destination: PlaceSchema,
  time: TripTimeSchema
});
export type TripRequest = z.infer<typeof TripRequestSchema>;
export type TripConstraints = z.infer<typeof TripConstraintsSchema>;
export type TripPreferences = z.infer<typeof TripPreferencesSchema>;
```

If zod 4's `.extend` on a schema with `.default()` fields produces a type error, STOP and report (do not restructure the schema on your own — reviewers have signed off on this shape).

### Step 5: Create `packages/shared/src/domain/itinerary.ts`

```ts
import { z } from 'zod';
import { TravelModeSchema } from './modes.js';
import { LngLatSchema, PlaceSchema } from './places.js';

const IsoDateTime = z.iso.datetime({ offset: true });

export const LineStringSchema = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(LngLatSchema).min(2)
});

export const TimeSourceSchema = z.enum(['realtime', 'scheduled', 'estimated']);

export const LegSchema = z.object({
  id: z.string().min(1),
  mode: TravelModeSchema,
  from: PlaceSchema,
  to: PlaceSchema,
  departAt: IsoDateTime,
  arriveAt: IsoDateTime,
  durationMinutes: z.number().nonnegative(),
  distanceMeters: z.number().nonnegative().optional(),
  geometry: LineStringSchema,
  timeSource: TimeSourceSchema,
  /** Transit/flight line label, e.g. "Red Line", "Bus 1", "B6 1123". */
  routeName: z.string().optional(),
  agency: z.string().optional(),
  /** Realtime minus scheduled, minutes. Present only when timeSource === 'realtime'. */
  delayMinutes: z.number().optional(),
  /** Minutes between previous leg's arrival and this leg's departure (transfers only). */
  transferBufferMinutes: z.number().optional()
});
export type Leg = z.infer<typeof LegSchema>;

export const CostLineSchema = z.object({
  label: z.string(),           // "Fare", "Gas", "Parking", "Bikeshare unlock"
  usd: z.number(),
  estimated: z.boolean()
});

export const ItinerarySchema = z.object({
  id: z.string().min(1),
  legs: z.array(LegSchema).min(1),
  departAt: IsoDateTime,
  arriveAt: IsoDateTime,
  durationMinutes: z.number().nonnegative(),
  transfers: z.number().int().nonnegative(),
  walkMinutes: z.number().nonnegative(),
  cost: z.object({ totalUsd: z.number().nonnegative(), lines: z.array(CostLineSchema) }),
  risk: z.object({
    level: z.enum(['low', 'medium', 'high']),
    /** Human-readable, deterministic reasons, e.g. "4 min transfer at Park St (scheduled times)". No invented probabilities. */
    reasons: z.array(z.string())
  }),
  /** Hard constraints this option breaks. Empty for normal results. */
  violations: z.array(z.string()),
  /** Short one-liner for list rows, e.g. "Bike 6 min → Red Line → walk 4 min". */
  summary: z.string(),
  source: z.object({ provider: z.string(), fetchedAt: IsoDateTime })
});
export type Itinerary = z.infer<typeof ItinerarySchema>;

export const SavedItinerarySchema = ItinerarySchema.extend({
  savedAt: IsoDateTime,
  label: z.string().optional(),       // "Morning commute"
  watch: z.boolean(),                 // auto-watched after saving (map thread)
  /** Computed by the watch engine (plan 008). */
  leaveBy: IsoDateTime.optional(),
  /** The request that produced this itinerary — needed to re-plan when watching. */
  request: TripRequestSchema
});
export type SavedItinerary = z.infer<typeof SavedItinerarySchema>;
```

Add `import { TripRequestSchema } from './trip-draft.js';` to the imports at the top of this file. (`trip-draft.ts` does not import `itinerary.ts`, so there is no cycle.)

### Step 6: Create `packages/shared/src/domain/api.ts` (HTTP envelopes)

```ts
import { z } from 'zod';
import { ItinerarySchema, SavedItinerarySchema } from './itinerary.js';
import { TripRequestSchema } from './trip-draft.js';

export const PlanRequestSchema = TripRequestSchema;
export const PlanResponseSchema = z.object({
  itineraries: z.array(ItinerarySchema),
  /** Near-misses that break a hard constraint, with reasons — shown as "almost works". */
  nearMisses: z.array(ItinerarySchema),
  warnings: z.array(z.string())
});
export type PlanResponse = z.infer<typeof PlanResponseSchema>;

export const SaveItineraryRequestSchema = z.object({
  itinerary: ItinerarySchema,
  request: TripRequestSchema,
  label: z.string().max(80).optional(),
  watch: z.boolean().default(true)
});
export type SaveItineraryRequest = z.infer<typeof SaveItineraryRequestSchema>;

export const SavedItineraryListSchema = z.object({ itineraries: z.array(SavedItinerarySchema) });

export const ApiErrorSchema = z.object({
  error: z.object({ code: z.string(), message: z.string(), details: z.unknown().optional() })
});
export type ApiErrorBody = z.infer<typeof ApiErrorSchema>;
```

### Step 7: Re-export from `packages/shared/src/index.ts`

Append (do not remove existing exports):
```ts
export * from './domain/modes.js';
export * from './domain/places.js';
export * from './domain/trip-draft.js';
export * from './domain/itinerary.js';
export * from './domain/api.js';
```

**Verify**: `npm run build:shared` → exit 0; `ls packages/shared/dist/domain` → 5 `.js` + 5 `.d.ts` files.

### Step 8: Tests — `packages/shared/src/domain/trip-draft.test.ts` and `itinerary.test.ts`

Cover:
1. `TripDraftSchema.parse({})` succeeds and fills defaults (`preferences.lateTolerance === 'some'`, `modes` = `['walk','bus','rail']`).
2. `TripRequestSchema.safeParse({})` fails with issues on `origin`, `destination`, `time`.
3. `preferences.comfortVsCost: 1.5` fails.
4. `PlaceSchema` rejects `[200, 10]` (lng out of range) and accepts `[-71.06, 42.36]` (Boston).
5. An itinerary fixture with 3 legs (walk → bus → walk) parses; a leg with a 1-point LineString fails.
6. `IsoDateTime` rejects `'2026-11-13 08:00'` and accepts `'2026-11-13T08:00:00-05:00'`.
7. `timeZone: 'America/New_York'` parses; `timeZone: 'Mars/Olympus'` fails.
8. `TravelModeSchema` rejects `'rideshare'` (removed in review).

Put the 3-leg fixture in `packages/shared/src/domain/fixtures.ts` and **export it** (`export const sampleItinerary: Itinerary = …`) — plan 009 and the UI team reuse it for map rendering before the server exists.

**Verify**: `npm run test:unit -w @transit/shared` → all pass.

### Step 9: Prove clients still build

**Verify**: `npm run typecheck` → exit 0; `npm run build:mobile` → exit 0; `npm run build:web` → exit 0.

### Step 10: Review gate (already satisfied)

The contract review happened on issue #6 before execution and its outcomes are applied above. Do not open a PR or push; commit locally and report. The reviewer opens the PR.

## Test plan

Step 8. Pattern: `packages/shared/src/index.test.ts` from plan 001.

## Done criteria

- [ ] `npm test` exits 0, including ≥ 8 new schema tests
- [ ] `npm run build:mobile` and `npm run build:web` exit 0
- [ ] `grep -rn "from './domain" packages/shared/src/index.ts` shows 5 re-exports
- [ ] `sampleItinerary` is exported from `@transit/shared`
- [ ] Only in-scope files changed (`git status`)
- [ ] `grep -rn rideshare packages/shared/src` → no matches

## STOP conditions

- zod 4 is not installable or Metro (mobile build) fails to bundle it.
- Any `z.iso.datetime` / `.extend` API in the snippets doesn't exist in the installed zod version — report the error; don't substitute silently.
- You feel the need to change field names/shapes — that's a contract decision; report instead.

## Maintenance notes

- **Additive changes only** once the UI/maps teams consume this: add optional fields; don't rename. If a rename is needed, keep the old field for one iteration.
- Coordinates are **[lng, lat]** everywhere (GeoJSON / MapLibre order). Google APIs return lat/lng objects — convert at the provider boundary (plan 007), never in UI code.
- All times are ISO strings with offset. Render them in `draft.timeZone` when set, else the origin's local zone, never silently in the device's zone.
- UI expects to add more filters later (review #6). New filters = new optional fields in `TripConstraintsSchema` / `TripPreferencesSchema`; that's an additive change.

## Review outcomes (issue #6, 2026-11-14)

- 002-Q1 rideshare: **removed** (may return later as an additive enum value).
- 002-Q2 risk controls: **two separate controls** in the UI; data already has `transferRisk` and `lateTolerance`.
- 002-Q3 currency: **USD only** for now.
- 002-Q4 default modes: **kept** (`walk`, `bus`, `rail` start switched on for a new trip; a saved profile overrides).
- Travelers/bags: **later**, with flights (#15).
- Maps (KrakenTheJaken): one LineString per leg, select whole trip on tap, color per trip + dash per mode, Place fields sufficient, server-drawn flight arcs, overlap picker: **all confirmed**.
- Time zone: users can **choose** the display zone → optional `timeZone` field added.
