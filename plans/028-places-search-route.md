# Plan 028: Serve `GET /api/places` from the built-in place list

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If a STOP condition occurs, stop and report. Do
> not improvise. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 1e8328a..HEAD -- apps/server/src/app.ts apps/server/src/routes apps/server/src/places packages/shared/src/domain/place-search.ts`
> If this prints anything, compare Current state with the live code. On a mismatch, STOP.

## Status

- **Owner:** @Cattn (verified sole assignee on #49).
- **Status:** CLAIMED. Completion is not confirmed; do not start a competing implementation.
- **Priority**: P1 (MVP: the search box fails against the real server without it)
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (006 and 004 are merged)
- **Category**: bug
- **Planned at**: commit `1e8328a`, 2026-11-14
- **Issue**: https://github.com/Cattn/transit-agent/issues/49

## Why this matters

The shared API client already calls `GET /api/places` (`searchPlaces`), and the mock client answers it.
The server never registered that route, so every "Where to?" search returns 404 once a UI switches
from the mock to the real server. The agent's `find_place` tool already searches a small built-in
list (`places/gazetteer.ts`). Serving that same list over HTTP makes the search box and the agent
agree, and unblocks the MVP flow. Plan 007 later puts a real geocoder behind this same route.

## Current state

- `packages/shared/src/client/api-client.ts:172-176` (client side, already shipped):
  ```ts
  searchPlaces: async (q: string, near?: LngLat): Promise<Place[]> => {
    let path = `/api/places?q=${encodeURIComponent(q)}`;
    if (near) path += `&near=${near[0]},${near[1]}`;
    return (await request('GET', path, { schema: PlaceSearchResponseSchema })).places;
  }
  ```
- `packages/shared/src/domain/place-search.ts`: `PlaceSearchResponseSchema = z.object({ places: z.array(PlaceSchema) })`.
- `apps/server/src/places/gazetteer.ts` exports `searchPlaces(query: string): Place[]` (case-insensitive name match or exact airport code, max 5). `apps/server/src/agent/tools.ts:35` uses it for `find_place`.
- `apps/server/src/app.ts` registers route plugins: `app.register(planRoutes, resolved)` … `app.register(agentRoutes, resolved)`. There is no places route.
- Route pattern to copy: `apps/server/src/routes/profile.ts` (a `FastifyPluginAsync<ServerDeps>` that validates input with `parse(schema, value)` from `../http/validate.js`, which throws a 400 `invalid_request`).
- Test pattern to copy: `apps/server/src/routes/plan.test.ts` (`createServer()`, `app.inject`, `afterEach` closes the app).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Server tests | `npm run test:unit -w @transit/server` | all pass |
| Full | `npm test` | exit 0 |

## Scope

**In scope:** `apps/server/src/routes/places.ts` (create), `apps/server/src/routes/places.test.ts` (create), `apps/server/src/app.ts` (register it).
**Out of scope:** `places/gazetteer.ts` contents, `packages/shared/**` (the contract already exists), the agent tools, a geocoder or any network call (plan 007 step 5).

## Git workflow

Branch `plan/028-places-route`. One commit, e.g. `server: serve /api/places from the gazetteer (plan 028)`. Do not push unless told.

## Steps

### Step 1: Route

`routes/places.ts` exports `placeRoutes: FastifyPluginAsync<ServerDeps>` with `app.get('/api/places', …)`:

- Validate `request.query` with `parse(z.object({ q: z.string().trim().min(1).max(100), near: z.string().regex(/^-?\d+(\.\d+)?,-?\d+(\.\d+)?$/).optional() }), request.query)`.
- Return `{ places: searchPlaces(q) }` typed as `PlaceSearchResponse`. Accept `near` but ignore it for now (the list is tiny; plan 007's geocoder uses it).

Register it in `app.ts` next to the other routes.

**Verify**: `npm run typecheck -w @transit/server` → exit 0

### Step 2: Tests

`routes/places.test.ts`, cases: `q=south` returns South Station and parses with `PlaceSearchResponseSchema`; `q=BOS` returns Logan; `q=zzzz` returns `{ places: [] }` with 200; missing `q` → 400 `invalid_request`; `near=abc` → 400.

**Verify**: `npm run test:unit -w @transit/server` → all pass, 5 new.

## Done criteria

- [ ] `npm test` exits 0
- [ ] `curl "http://localhost:3001/api/places?q=kendall"` against `npm run dev:server` returns Kendall/MIT station
- [ ] Only the three in-scope files changed

## STOP conditions

- `/api/places` already exists on main (someone landed plan 007 step 5). Mark this plan REJECTED.
- The client's request shape differs from the excerpt above.

## Maintenance notes

Plan 007 step 5 replaces the body of this route with `Geocoder.search(q, near)` and keeps the gazetteer as a fallback. Keep the response shape; the client and mock depend on it.
