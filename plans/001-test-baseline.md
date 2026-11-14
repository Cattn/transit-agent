# Plan 001: Add a unit-test runner so `npm test` runs real tests in shared and server

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If a STOP condition occurs, stop and report — do
> not improvise. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat c9e33cc..HEAD -- package.json packages/shared apps/server eslint.config.mjs`
> If any of these changed, compare the "Current state" excerpts with the live files; on a mismatch, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests / dx
- **Planned at**: commit `c9e33cc`, 2026-11-13

## Why this matters

`npm test` today is only lint + typecheck (`package.json` → `"test": "npm run lint && npm run typecheck"`);
the README says "No unit test suite has been added." Every following plan adds pure logic
(schemas, ranking, leave-by time math, GeoJSON conversion) that must be unit tested, and CI
(`.github/workflows/ci.yml` runs `npm test`) should run those tests automatically. This plan adds
Vitest to `packages/shared` and `apps/server` with one real test each, so later plans only add test files.

## Current state

- `package.json` (root) scripts, relevant lines:
  ```json
  "typecheck": "npm run build:shared && npm run typecheck --workspaces --if-present",
  "test": "npm run lint && npm run typecheck",
  ```
- `packages/shared/package.json` scripts: `"typecheck": "tsc --noEmit", "test": "npm run typecheck"`.
- `apps/server/package.json` scripts: `"typecheck": "tsc --noEmit", "test": "npm run typecheck"`.
- `packages/shared/tsconfig.json` and `apps/server/tsconfig.json` both use `"module": "NodeNext"`,
  `"rootDir": "src"`, `"include": ["src"]`. **Relative imports therefore need a `.js` extension**
  (e.g. `import { x } from './foo.js'` for `foo.ts`). Vitest resolves `.js` → `.ts` automatically.
- `apps/server/src/app.ts` exports `createServer()`; `scripts/smoke.mjs` shows the in-process testing
  pattern via Fastify `app.inject(...)` — mirror it in the server test.
- `packages/shared/src/index.ts:21-42` exports `createApiClient(baseUrl)`.
- `.github/workflows/ci.yml` runs `npm ci`, `npm test`, `npm run build`, `node scripts/smoke.mjs`. No change needed there.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Install dev dep | `npm install -D vitest@^4 -w @transit/shared -w @transit/server` | exit 0 |
| Lint | `npm run lint` | exit 0 |
| Typecheck | `npm run typecheck` | exit 0 |
| Unit tests | `npm run test:unit` | exit 0, ≥ 2 test files pass |
| Full | `npm test` | exit 0 |

## Scope

**In scope:** `package.json` (root scripts only), `packages/shared/package.json`, `apps/server/package.json`,
`package-lock.json` (via npm only), new `packages/shared/src/index.test.ts`, new `apps/server/src/app.test.ts`,
`packages/shared/tsconfig.json` and `apps/server/tsconfig.json` (only to exclude test files from the build), `README.md` (Commands section line about tests).

**Out of scope:** `apps/web`, `apps/mobile` (the UI team is actively working there — no test runner for them in this plan), CI workflow files, `scripts/smoke.mjs`.

## Git workflow

- Branch: `plan/001-test-baseline`. Commit message style matches `git log` (short lowercase imperative, e.g. `project scaffold`): `add vitest unit test baseline`.
- Do not push unless the operator says so.

## Steps

### Step 1: Install Vitest in the two workspaces

Run `npm install -D vitest@^4 -w @transit/shared -w @transit/server` from the repo root.
If npm reports a peer-dependency conflict with Vite 8 (used by `apps/web`), STOP and report the exact message.

**Verify**: `npx vitest --version` → prints a version starting with `4.`

### Step 2: Add scripts

In `packages/shared/package.json` and `apps/server/package.json` add `"test:unit": "vitest run"` and change
`"test"` to `"npm run typecheck && npm run test:unit"`.

In root `package.json` add `"test:unit": "npm run build:shared && npm run test:unit --workspaces --if-present"`
and change `"test"` to `"npm run lint && npm run typecheck && npm run test:unit"`.

**Verify**: `npm run test:unit` → Vitest reports "No test files found" and exits non-zero (expected at this point; tests come next).

### Step 3: Exclude tests from `tsc` build output

In `packages/shared/tsconfig.json` and `apps/server/tsconfig.json` add `"exclude": ["src/**/*.test.ts"]`.
Tests are still typechecked by Vitest at runtime only; that's acceptable for now.

**Verify**: `npm run build:shared && ls packages/shared/dist` → no `*.test.*` files appear (after step 4 too).

### Step 4: Write the two first tests

`packages/shared/src/index.test.ts`:
- `sections` has ids `['flight','commute','biking','agent']` in that order.
- `createApiClient('http://x/').health()` calls `fetch` with `http://x/api/health` (strip trailing slash) — stub `globalThis.fetch` with `vi.fn` returning `new Response(JSON.stringify({status:'ok',service:'t'}))`, restore in `afterEach`.
- non-OK response (status 500) rejects with an Error whose message contains `500`.

`apps/server/src/app.test.ts` (pattern: `scripts/smoke.mjs`):
- `createServer()`, `app.inject({ method: 'GET', url: '/api/health' })` → 200 and `json().status === 'ok'`.
- unknown route `/api/nope` → 404.
- `afterEach` / `finally`: `await app.close()`.

Use `import { describe, it, expect, vi, afterEach } from 'vitest';` and `.js` extensions on relative imports
(`import { createServer } from './app.js';`).

**Verify**: `npm run test:unit` → 2 test files, all tests pass, exit 0.

### Step 5: Update README

In `README.md` replace "`npm test`: lint and type-check every workspace. No unit test suite has been added." with
"`npm test`: lint, type-check, and run Vitest unit tests (`packages/shared`, `apps/server`). Run `npm run test:unit` for tests only."

**Verify**: `npm test` → exit 0.

## Test plan

Covered in step 4. Later plans add `*.test.ts` files next to the code they test.

## Done criteria

- [ ] `npm test` exits 0 and its output shows Vitest running ≥ 2 files
- [ ] `npm run check` exits 0
- [ ] `git status` shows only in-scope files modified
- [ ] `plans/README.md` row 001 updated

## STOP conditions

- `npm install` modifies `apps/web` or `apps/mobile` dependency versions in `package-lock.json` beyond hoisting (check `git diff package-lock.json | grep '"version"'` for react/expo/vite changes).
- Vitest cannot resolve `@transit/shared` from server tests even after `npm run build:shared`.

## Maintenance notes

- Server tests should keep using `app.inject` (no open ports) so they're parallel-safe.
- If web/mobile want tests later, add Vitest to web and `jest-expo` to mobile in their own plan; don't mix.

## Open questions for review

- 001-Q1: Vitest vs Node's built-in `node:test`? **Proposed: Vitest** (TS + `.js`-extension resolution with no extra loader; same runner can later serve `apps/web`).
