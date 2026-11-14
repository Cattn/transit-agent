# Plan 005: Persist saved itineraries and travel profiles in SQLite (`node:sqlite`)

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If a STOP condition occurs, stop and report — do
> not improvise. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat c9e33cc..HEAD -- apps/server/src/store apps/server/src/app.ts`
> Expected: plan 003 created `store/types.ts` + `store/memory.ts`. Read them; if `ItineraryStore` differs from the excerpt below, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED (`node:sqlite` stability flag varies by Node version — see step 1)
- **Depends on**: plans/003-planning-api-fixture-provider.md (DONE, #27), plans/004-client-sdk-and-trip-draft.md (DONE, #29; `TripDraftPatchSchema`)
- **Category**: direction
- **Decisions**: D4-A (device-id identity) and D6-A (`node:sqlite` file) are both decided.
- **Planned at**: commit `c9e33cc`, 2026-11-13
- **Issue**: https://github.com/Cattn/transit-agent/issues/9

<!-- help:start -->
## Who's on it & how to help

- **Status:** 🔄 **In progress.** @Cattn is running a coding agent on it (started 2026-11-14).
- **Owner:** @Cattn
- **Up for grabs?** Yes. Server-side; small database work.

**Open questions** (answer by number in a comment on #9):

1. @Rad1ee @DMFriends: one profile per device, or several named profiles ("Work trips", "Weekend")? *(suggested: one for now)*

**How to help**
- **Take it:** comment "taking this" and assign yourself, so two people don't build the same thing.
- **With a coding agent** (Claude Code, Codex, Cursor, ...): pull `main`, then tell your agent:
  > Read `plans/005-persistence-profiles-itineraries.md` and follow it step by step. Run every verification command and check the output matches. Only change files listed under Scope. If a STOP condition happens, stop and tell me instead of working around it. Don't push. When done, show me the diff and the check results.

  Review what it did, then open a PR that says `Closes #9`.
- **Just feedback:** answer the open questions above by number in a comment.

<!-- help:end -->

## Why this matters

Issue #4 asks for "profiles to save travel preferences/routes". The map thread makes the map
*be* the user's library of saved routes, and saved routes are auto-watched (plan 008). The
in-memory store from 003 loses everything on restart. SQLite via Node's built-in `node:sqlite`
needs no native build on Windows. It sits behind the existing `ItineraryStore` interface, so a
Postgres move later only touches `apps/server/src/store/`.

## Current state

- `apps/server/src/store/types.ts` (from plan 003) — `ItineraryStore` with `list/get/save/update/remove`, all keyed by `deviceId`.
- `apps/server/src/app.ts` — `createServer(deps: Partial<ServerDeps>)`, defaults to `MemoryItineraryStore`.
- `apps/server/.env.example` — `HOST`, `PORT`, `CORS_ORIGIN`. `.gitignore` ignores `.env` and `*.log` but **not** `*.db` — this plan adds that.
- Node: `.nvmrc` = 24; CI uses Node 24; the dev machine has Node 26. `node:sqlite` exports `DatabaseSync`.

## Scope

**In scope:** `apps/server/src/store/sqlite.ts`, `apps/server/src/store/migrations.ts`, `apps/server/src/store/profiles.ts` (interface + sqlite + memory impls), `apps/server/src/routes/profile.ts`, `apps/server/src/app.ts` (wire), `apps/server/src/index.ts` (open DB from env), `apps/server/.env.example`, `.gitignore` (add `*.db`, `*.db-*`), `packages/shared/src/domain/profile.ts` + re-export (new schema — additive), `packages/shared/src/client/api-client.ts` (add 2 methods), tests.

**Out of scope:** watch scheduling (008), auth providers, `apps/web`, `apps/mobile`.

## Steps

### Step 1: Confirm `node:sqlite` works on Node 24 and 26

Run `node -e "const {DatabaseSync}=require('node:sqlite');const d=new DatabaseSync(':memory:');console.log(d.prepare('select 1 as x').get())"` on the local Node and (if available) Node 24.
**Expected**: `{ x: 1 }` (an `ExperimentalWarning` line is acceptable). If it requires `--experimental-sqlite`, add that flag to the server `dev`/`start` scripts and to `scripts/smoke.mjs` runs; if it's unavailable entirely, STOP.

### Step 2: Profile schema (shared, additive)

`packages/shared/src/domain/profile.ts`:
```ts
export const TravelProfileSchema = z.object({
  displayName: z.string().max(60).optional(),
  home: PlaceSchema.optional(),
  work: PlaceSchema.optional(),
  /** Applied to every new TripDraft before user/agent edits (provenance 'profile'). */
  defaults: TripDraftPatchSchema.default({}),
  updatedAt: z.iso.datetime({ offset: true })
});
```
Re-export from `index.ts`. (`TripDraftPatchSchema` comes from plan 004.)

### Step 3: Migrations

`store/migrations.ts` — an ordered array of SQL strings, applied in a transaction, tracked in `PRAGMA user_version`:
```sql
-- 1
CREATE TABLE saved_itineraries (
  device_id TEXT NOT NULL, id TEXT NOT NULL,
  saved_at TEXT NOT NULL, label TEXT, watch INTEGER NOT NULL DEFAULT 1, leave_by TEXT,
  itinerary_json TEXT NOT NULL, request_json TEXT NOT NULL,
  PRIMARY KEY (device_id, id)
);
CREATE INDEX saved_itineraries_watch ON saved_itineraries (watch, leave_by);
CREATE TABLE profiles (device_id TEXT PRIMARY KEY, profile_json TEXT NOT NULL, updated_at TEXT NOT NULL);
```
Itinerary/request are stored as JSON blobs **validated with the shared zod schemas on read**. A row that fails validation is logged and skipped, never thrown to the client. That way contract evolution doesn't 500 the list endpoint.

### Step 4: `SqliteItineraryStore implements ItineraryStore`

Constructor takes a `DatabaseSync`. Use prepared statements; `save` = `INSERT … ON CONFLICT(device_id,id) DO UPDATE`. Add a non-interface method `listWatched(nowIso: string, horizonIso: string)` for plan 008: rows with `watch = 1` whose itinerary `departAt` is between now and the horizon (filter departAt in JS after parsing; fine at hackathon scale).

### Step 5: Profiles store + routes

`ProfileStore { get(deviceId); put(deviceId, profile) }` with memory + sqlite impls.
Routes: `GET /api/profile` → 200 profile or 404; `PUT /api/profile` body = `TravelProfileSchema.omit({ updatedAt: true })` → 200 saved profile. Both require `x-device-id`.
Client: add `getProfile()` (404 → `undefined`) and `putProfile()` to `api-client.ts`.

### Step 6: Wiring

`index.ts`: `DATABASE_PATH` env (default `./data/transit-agent.db`; create the dir with `fs.mkdirSync(..., { recursive: true })`). `DATABASE_PATH=:memory:` is allowed. Pass the sqlite stores into `createServer`. `createServer()` with no deps keeps using memory stores (tests and smoke stay hermetic). Close the DB on shutdown (after `app.close()`).
Add `DATABASE_PATH=./data/transit-agent.db` to `.env.example`; add `*.db`, `*.db-*`, `apps/server/data/` to `.gitignore`.

### Step 7: Tests

Run the **same test suite against both store implementations** (`describe.each([['memory', …], ['sqlite', () => new SqliteItineraryStore(new DatabaseSync(':memory:'))]])`). Cover: save/list order/get/update/remove, overwrite on re-save, device isolation, corrupted JSON row is skipped (insert one manually), migrations idempotent (run twice → `user_version` = 1), profile get/put round-trip.

**Verify**: `npm run check` → exit 0; then `npm run dev:server`, save an itinerary via curl, restart the server, `GET /api/itineraries` → still there.

## Done criteria

- [ ] `npm run check` exits 0
- [ ] Restart-survival manual check above passes
- [ ] `git check-ignore apps/server/data/transit-agent.db` prints the path
- [ ] No changes in `apps/web`, `apps/mobile`

## STOP conditions

- `node:sqlite` unavailable/unstable on Node 24 in CI.
- Deploy target (unknown yet) has a read-only or ephemeral filesystem → report; that's a D6 re-decision (Postgres), not a workaround.

## Maintenance notes

- JSON-blob columns are deliberate (contract still moving). Once 002's contract stabilises, promote queried fields (e.g. `depart_at`) to columns.
- Replacing device IDs with real auth (D4-B): add a `user_id` column and a one-time "claim device" endpoint. Don't rename `device_id`.

## Open questions for review

- 005-Q1: Multiple named profiles per device ("Work trips", "Weekend") or one profile with presets? Proposed: one profile now; presets are just saved `TripDraftPatch`es later.
- 005-Q2: Where will the server be deployed (Fly.io / Render / Railway / a VM)? This decides whether SQLite on disk is viable.
