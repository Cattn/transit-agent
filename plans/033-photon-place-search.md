# Plan 033: Real place search with Photon behind `/api/places` and `find_place`

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If a STOP condition occurs, stop and report. Do
> not improvise. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat e5d6d46..HEAD -- apps/server/src/app.ts apps/server/src/index.ts apps/server/src/routes/places.ts apps/server/src/places apps/server/src/agent/tools.ts packages/shared/src/domain/place-search.ts packages/shared/src/domain/places.ts`
> If this prints anything, compare Current state with the live code. On a mismatch, STOP.

## Status

- **Owner:** @Cattn (worker)
- **State:** PR #64 open
- **Priority:** P1 (MVP)
- **Effort:** S–M
- **Risk:** MED (new outbound network call, behind an env var; no contract change)
- **Depends on:** 028 (merged)
- **Issue:** #53
- **Decision:** Photon, chosen by @Cattn on 2026-11-14 (plan 007 research recommendation). Public demo server `https://photon.komoot.io`, no key.

## Why this matters

The live check (#51) showed that the agent misses places only because the hand list in `places/gazetteer.ts` has about 25 entries. "Brookline Village", "Union Square Somerville" and "Orlando" all failed. A geocoder fixes this without adding places by hand or letting the model invent coordinates.

## Current state

- `apps/server/src/places/gazetteer.ts`: `searchPlaces(query): Place[]`. It does a sync substring or IATA-code match over the hand list and returns at most 5 results.
- `apps/server/src/routes/places.ts`: `GET /api/places?q=&near=lng,lat`. It validates `near` but ignores it, and returns `{ places: searchPlaces(q) }`.
- `apps/server/src/agent/tools.ts:52`: the `find_place` tool calls `searchPlaces(query)` directly.
- `apps/server/src/app.ts`: `ServerDeps { agent?, providers, itineraries, profiles }`. `createServer(deps)` fills in the defaults.
- `PlaceSchema` (shared) has `name?`, `coordinates: [lng, lat]`, `kind?` (`address | stop | station | airport | bikeDock | poi`) and `code?`. `PlaceSearchResponseSchema` is `{ places: Place[] }`. **Do not change either schema.**
- A Photon response sample is in `plans/research/samples/007-photon.json`: a GeoJSON `FeatureCollection` with `properties.{name, osm_key, osm_value, housenumber, street, city, state, countrycode}` and `geometry.coordinates: [lng, lat]`.

## Scope

**In:**
- the new `apps/server/src/places/geocoder.ts`;
- `routes/places.ts`, `agent/tools.ts`, `app.ts` and `index.ts` (wiring);
- `apps/server/.env.example`;
- cases in the existing `app.test.ts` and in the existing agent tools test, if there is one.

**Out:**
- shared schema changes;
- client or UI changes;
- self-hosting Photon;
- any other geocoder;
- persistent caching.

## Steps

1. **Geocoder module** (`places/geocoder.ts`).
   - Interface: `PlaceSearcher = { search(q: string, near?: [number, number]): Promise<Place[]> }`.
   - Implementation: `createPlaceSearcher({ photonUrl?, fetch? })`.
   - Hand list first: run `searchPlaces(q)` from the gazetteer.
   - Photon call: only when `photonUrl` is set and `q.trim().length >= 3`.
     - Request `GET {photonUrl}/api/?q=…&limit=5&lang=en`, plus `lat`/`lon` when `near` is given.
     - Send an identifying `User-Agent: transit-agent` header (generic; no personal details).
     - Use a 3 s timeout (`AbortSignal.timeout`).
   - Mapping from each Photon feature to a `Place`:
     - `coordinates` comes from the geometry.
     - `name`: `properties.name`, or `housenumber street` for addresses. Append `, city` (or `, state`) when present, so "Union Square, Somerville" is distinct.
     - `kind`: `osm_key=aeroway` with `osm_value=aerodrome` → `airport`; `railway` / `public_transport` stations → `station`; stops → `stop`; features that have a `housenumber` → `address`; everything else → `poi`.
   - Merge: hand-list results come first, then Photon results. Drop a Photon result within 150 m of a hand-list result. Cap the total at 5.
   - Run every result through `PlaceSchema.parse` and drop any that fail.
   - **Failure:** on any Photon error (network, timeout, non-2xx or bad JSON), log a warning through the app logger or `console.warn`, then return the hand-list results. Never throw to the caller.
   - **Cache:** in memory, keyed by `q.toLowerCase().trim()` plus `near` rounded to 2 decimals. Entries last 24 h, with at most 500 entries (drop the oldest). Cache only successful Photon responses.
2. **Wiring.**
   - Add an optional `places?: PlaceSearcher` to `ServerDeps`. It defaults to `createPlaceSearcher({})`, which uses the hand list only, so tests and the fixture setup never reach the network.
   - In `index.ts`, pass `createPlaceSearcher({ photonUrl: process.env.PHOTON_URL || undefined })`.
   - `.env.example`: add `PHOTON_URL=https://photon.komoot.io` with a comment above it saying "public demo server, light use only; leave empty to use the built-in place list".
3. **Route.** `/api/places` parses `near` into `[lng, lat]` and returns `{ places: await deps.places.search(q, near) }`.
4. **Agent.**
   - `find_place` calls the same `PlaceSearcher`. Pass it in where the tools are built.
   - Update the description to "Find up to five places (stations, airports, landmarks, addresses) by name, address or airport code."
   - `instructions.ts` needs no change unless a test pins the description.
5. **Tests** (existing files only):
   - In `app.test.ts`, inject a fake `fetch` that returns a trimmed copy of the sample. Check:
     - Photon results are merged after the hand-list results;
     - the 150 m dedupe;
     - the cap at 5;
     - `near` is passed as `lat`/`lon`;
     - a query shorter than 3 characters never calls fetch;
     - a fetch that throws, or returns a 500, still returns the hand-list results;
     - a second identical query is served from the cache (fetch is called once).
   - The existing `/api/places` cases must still pass unchanged.
   - **No real network in tests.**
6. **Live check (manual, not CI).**
   - Run the server with `PHOTON_URL` set.
   - `curl` `/api/places?q=Brookline%20Village&near=-71.06,42.36`, then `Union Square Somerville`, then a street address (e.g. `77 Massachusetts Ave Cambridge`).
   - Re-run the three failed #51 prompts through `POST /api/agent/turn` if `GEMINI_API_KEY` or Vertex is available.
   - Paste the results in the PR. If no Gemini credentials are available, say so and skip only that part.
7. **Bookkeeping.**
   - Mark plan 031 step 5 as done by this plan.
   - Update this plan's status and the `plans/README.md` row.
   - The PR closes #53.

## STOP conditions

- The work would need a shared schema change.
- Photon's public server refuses requests (403/429) during the live check. Report it; don't add retries.
- `npm run check` needs the network to pass.

## Done criteria

- [ ] "Brookline Village", "Union Square Somerville" and a street address resolve through both `/api/places` and `find_place` (live check in the PR).
- [ ] With no `PHOTON_URL`, the server behaves exactly as before (hand list only).
- [ ] A Photon failure falls back to the hand list without erroring.
- [ ] `npm run check` exits 0 offline.

## Notes

- OSM attribution: map views already show OpenFreeMap/OSM attribution. No UI change is needed for search results.
- Watches and replanning use saved coordinates, never repeated geocoding (plan 007 research).
