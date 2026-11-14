# Plan 004: Give both apps a typed API client and a shared `TripDraft` state reducer (filters ↔ agent)

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If a STOP condition occurs, stop and report — do
> not improvise. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat c9e33cc..HEAD -- packages/shared/src/index.ts apps/web/src/App.tsx apps/mobile/App.tsx`
> Expected: shared index gained re-exports (plan 002). If `App.tsx` files changed (UI team), that's fine — this plan does not edit them.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/002-shared-domain-contract.md (DONE). *Changed 2026-11-14: no longer waits for 003. The endpoint shapes are written below, so the client is built and tested with a stubbed `fetch`.*
- **Category**: direction
- **Planned at**: commit `c9e33cc`, 2026-11-13
- **Issue**: https://github.com/Cattn/transit-agent/issues/8

<!-- help:start -->
## Who's on it & how to help

- **Status:** 🔄 **In progress.** @Cattn is running a coding agent on it (started 2026-11-14).
- **Owner:** @Cattn

**Open questions** (answer by number in a comment on #8):

1. Should the app double-check every server response against the shared types in production too, or only in development? *(suggested: always, for now)*

<!-- help:end -->

## Why this matters

The UI team should not hand-write `fetch` calls, headers, or error parsing. Both clients also
need the **same rules** for editing a trip, whether the user moves a slider or the agent returns a
patch. The design thread put it this way: "Filters or chat → structured constraints". The agent's
interpretation must be shown as editable filters, so both paths must produce and apply the same
`TripDraftPatch`. This plan puts that framework-free logic in `@transit/shared`, where web,
mobile, and server all import it.

## Current state

- `packages/shared/src/index.ts:21-42`:
  ```ts
  export function createApiClient(baseUrl: string) {
    const url = baseUrl.replace(/\/$/, '');
    async function get<T>(path: string): Promise<T> { …AbortController 8000ms timeout…
      if (!response.ok) { throw new Error(`API request failed (${response.status})`); }
      return await response.json() as T;
    }
    return { health: () => get<HealthResponse>('/api/health'), sections: () => get<Section[]>('/api/sections') };
  }
  ```
- Callers: `apps/web/src/App.tsx:4` → `createApiClient(import.meta.env.VITE_API_URL ?? '')`; `apps/mobile/App.tsx:7-9` → `createApiClient(process.env.EXPO_PUBLIC_API_URL ?? …)`. Both only call `api.health()`. **Keep `health()` and `sections()` working with the same signature.**
- Server endpoints (plan 003): `POST /api/plan`, `GET/POST /api/itineraries`, `GET/PATCH/DELETE /api/itineraries/:id`, errors shaped `{ error: { code, message, details? } }`, itinerary routes require header `x-device-id`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Shared tests | `npm run test:unit -w @transit/shared` | all pass |
| Full | `npm run check` | exit 0 |

## Scope

**In scope:** move client to `packages/shared/src/client/api-client.ts` (re-export from `index.ts`), new `packages/shared/src/client/trip-draft-state.ts`, new `packages/shared/src/client/device-id.ts`, new `packages/shared/src/domain/agent.ts` and `packages/shared/src/domain/place-search.ts` (Step 2b), tests beside them, `packages/shared/src/index.ts`.

**Out of scope:** `apps/web/**`, `apps/mobile/**` (UI team adopts the client — see "Handoff" below), server code.

## Steps

### Step 1: `ApiClientError` + request core

In `client/api-client.ts`:
```ts
export class ApiClientError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly details?: unknown) { super(message); }
}
export interface ApiClientOptions { deviceId?: string | (() => string | undefined); timeoutMs?: number; fetch?: typeof fetch }
export function createApiClient(baseUrl: string, options: ApiClientOptions = {})
```
One private `request<T>(method, path, body?, schema?)`: JSON body + `content-type`, sets `x-device-id` when available, keeps the AbortController timeout (default 8000; **`planTrip` uses 20000**), parses error bodies with `ApiErrorSchema.safeParse` → `ApiClientError(status, code, message)`. When the body isn't the API shape, use `code: 'http_error'`. Network/timeout → `ApiClientError(0, 'network', …)`. `204` → `undefined`.
When `schema` is passed, validate the response with `schema.parse` (catches server/client contract drift early in dev).

### Step 2: Endpoint methods

```ts
health(), sections(),                                  // unchanged behaviour
planTrip(request: TripRequest): Promise<PlanResponse>,
listItineraries(): Promise<SavedItinerary[]>,
getItinerary(id: string): Promise<SavedItinerary>,
saveItinerary(input: SaveItineraryRequest): Promise<SavedItinerary>,
updateItinerary(id: string, patch: { label?: string; watch?: boolean }): Promise<SavedItinerary>,
deleteItinerary(id: string): Promise<void>,
```
`encodeURIComponent(id)` in paths.

Also export the client's type so the mock client (plan 012) can implement it:
```ts
export type ApiClient = ReturnType<typeof createApiClient>;
```

### Step 2b: Agent and place-search contracts + client methods (moved here from plans 006 and 007)

These are only shapes, but the mock client (plan 012) and the chat and place-search UI need them
now, long before the agent (006) or geocoder (007) exist. **Do Step 4 first if you need
`TripDraftPatchSchema`** (the agent response uses it).

`packages/shared/src/domain/agent.ts`:
```ts
export const AgentMessageRequestSchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().min(1).max(2000),
  /** Client's current draft (filters state). The agent edits relative to this. */
  draft: TripDraftSchema
});
export const AgentQuestionSchema = z.object({ field: z.string(), question: z.string(), options: z.array(z.string()).optional() });
export const AgentMessageResponseSchema = z.object({
  sessionId: z.string(),
  reply: z.string(),
  /** Everything the agent changed this turn. Client applies it with source 'agent' and shows editable chips. */
  draftPatch: TripDraftPatchSchema,
  /** Focused clarifying questions, each tied to the draft field it would fill. */
  questions: z.array(AgentQuestionSchema),
  /** Present when the agent ran a search this turn. Same shape as POST /api/plan. */
  plan: PlanResponseSchema.optional()
});
export type AgentMessageRequest = z.infer<typeof AgentMessageRequestSchema>;
export type AgentMessageResponse = z.infer<typeof AgentMessageResponseSchema>;
```
`packages/shared/src/domain/place-search.ts`:
```ts
export const PlaceSearchResponseSchema = z.object({ places: z.array(PlaceSchema) });
export type PlaceSearchResponse = z.infer<typeof PlaceSearchResponseSchema>;
```
Client methods:
```ts
sendAgentMessage(body: AgentMessageRequest): Promise<AgentMessageResponse>,   // POST /api/agent/messages, 45 s timeout
searchPlaces(q: string, near?: LngLat): Promise<Place[]>,                      // GET /api/places?q=&near=lng,lat → response.places
```
The server endpoints arrive later (006, 007); until then these calls return 404, which the client reports as `ApiClientError(404, 'not_found', …)`.

### Step 3: Device ID helper (decision D4)

`client/device-id.ts`: `export function createDeviceId(): string` → `crypto.randomUUID()` (available in browsers, Node, and Hermes/Expo SDK 58 — if `globalThis.crypto?.randomUUID` is undefined at runtime, fall back to a 32-char hex from `Math.random`). **Storage stays in each app** (localStorage on web, `expo-secure-store` or AsyncStorage on mobile); document this in the JSDoc.

### Step 4: `TripDraft` state reducer

`client/trip-draft-state.ts` — pure functions, no React:
```ts
export type DraftChangeSource = 'user' | 'agent' | 'profile';
export interface TripDraftPatch {            // deep-partial of the editable fields
  origin?: Place | null; destination?: Place | null; time?: TripDraft['time'] | null; returnTime?: string | null; timeZone?: string | null;
  modes?: TravelMode[]; vehicles?: Partial<TripDraft['vehicles']>;
  constraints?: { [K in keyof TripConstraints]?: TripConstraints[K] | null };   // null = clear
  preferences?: Partial<TripPreferences>;
}
export interface DraftState {
  draft: TripDraft;
  /** Which source last set each field path, e.g. { 'constraints.maxWalkMinutes': 'agent' } — UI shows an "agent set this" chip. */
  provenance: Record<string, DraftChangeSource>;
}
export function initialDraftState(defaults?: TripDraftPatch): DraftState
export function applyDraftPatch(state: DraftState, patch: TripDraftPatch, source: DraftChangeSource): DraftState
export function toTripRequest(draft: TripDraft): { ok: true; request: TripRequest } | { ok: false; missing: Array<'origin' | 'destination' | 'time'> }
export function describePatch(patch: TripDraftPatch): string[]   // ["Max walk: 15 min", "Must arrive by 9:00 AM"] — for agent chips / toasts
```
Rules: immutable (return new objects). `null` deletes an optional field. Merge `constraints`/`preferences`/`vehicles` per key, and replace `modes` wholesale. Run the result through `TripDraftSchema.parse`. Provenance keys use dotted paths for nested fields (`constraints.maxWalkMinutes`) and the top-level name otherwise (`modes`, `origin`).

Also export `TripDraftPatchSchema` (zod) mirroring the interface, because plan 006 uses it as the agent's tool parameter schema. Define the schema first and derive the type with `z.infer` so the two can't drift.

### Step 5: Tests

`api-client.test.ts` (stub `fetch` via `options.fetch`): sets `x-device-id`; error body → `ApiClientError` with server `code`; non-JSON 502 → `code 'http_error'`; abort → `code 'network'`; 204 → undefined; trailing slash on baseUrl handled.
`trip-draft-state.test.ts`: agent patch sets provenance `agent`; a later user patch on the same field flips it to `user`; `null` clears `constraints.arriveBy`; `modes` replace; `toTripRequest` reports missing fields; an invalid patch (`comfortVsCost: 2`) throws a ZodError; `describePatch` returns readable strings.

**Verify**: `npm run check` → exit 0.

## Handoff to the UI team (put this in the PR description)

```ts
import { createApiClient, initialDraftState, applyDraftPatch, toTripRequest } from '@transit/shared';
const api = createApiClient(BASE_URL, { deviceId: () => storedDeviceId });
// filters:  setState(s => applyDraftPatch(s, { constraints: { maxWalkMinutes: 15 } }, 'user'))
// agent:    setState(s => applyDraftPatch(s, agentResponse.draftPatch, 'agent'))
// search:   const r = toTripRequest(state.draft); if (r.ok) api.planTrip(r.request)
```
Recommend (not mandate) TanStack Query or a small `useReducer` in each app.

## Done criteria

- [ ] `npm run check` exits 0; ≥ 12 new tests
- [ ] `grep -n "health\|sections" packages/shared/src/client/api-client.ts` shows both methods still exist
- [ ] `TripDraftPatchSchema`, `ApiClient`, `AgentMessageRequestSchema`, `AgentMessageResponseSchema`, `PlaceSearchResponseSchema` exported from `@transit/shared`
- [ ] No files changed under `apps/`

## STOP conditions

- Mobile bundling (`npm run build:mobile`) fails due to something in `client/` (e.g. `crypto`) → report.
- The contract from plan 002 lacks a field the reducer needs.

## Maintenance notes

- If streaming agent replies arrive (D5-B), add an `agentStream()` method; keep `applyDraftPatch` as the only way patches reach state.
- Provenance is what makes the agent's interpretation correctable ("agent set max walk 15 min — tap to edit"). Don't drop it in UI refactors.

## Open questions for review

- 004-Q1: Should the client validate every response with zod in production too (cost: CPU on big itinerary lists)? Proposed: yes for now. Revisit if lists get large.
- ~~004-Q2~~ **Decided (#6, #16):** one draft per app; the mode slider sets `modes` via `modeGroups`.
