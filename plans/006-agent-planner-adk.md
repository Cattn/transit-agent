# Plan 006: Add the Gemini trip-planner agent (ADK TypeScript) behind `POST /api/agent/messages`

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If a STOP condition occurs, stop and report — do
> not improvise. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 9ccf722..HEAD -- apps/server package.json .nvmrc .github/workflows/ci.yml`
> Reconciled 2026-11-14: plans 003–005 are already on this commit, so an empty diff is expected. If this prints anything, compare Current state before proceeding. Read `apps/server/src/app.ts` and `apps/server/src/planning/plan-trip.ts` before starting.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED (new external dependency and model behaviour; mitigated by keeping ADK behind one module and testing with a fake agent)
- **Depends on**: plans/003, plans/004 (needs `TripDraftPatchSchema`); plan 005 optional (profile defaults)
- **Category**: direction
- **Decisions**: D3-A (ADK TypeScript + Gemini) and D5-A (request/response JSON) are decided. D5-B (SSE streaming) is a **planned later follow-up**: out of scope here, but don't design it out (see Maintenance notes).
- **Planned at**: commit `9ccf722`, 2026-11-14 (refreshed; steps unchanged)
- **Issue**: https://github.com/Cattn/transit-agent/issues/10

<!-- help:start -->
## Who's on it & how to help

- **Status:** **Done:** [PR #38](https://github.com/Cattn/transit-agent/pull/38) merged as `7ee32a0a85848aab2c3c55895a67a0c63976fc6e`. Plan 006 implementation is on main; live Gemini/model-quality validation remains outstanding.
- **Owner:** @Cattn
- **Up for grabs?** Partly. Anyone can help with the agent's test prompts or tools, but running it needs the Gemini key on the server.

**Open questions** (answer by number in a comment on #10):

1. Which exact model should the main agent use, and should different tasks use different models? (Model research is in progress; the default stays `gemini-flash-latest` until decided.)

*Decided:* the agent can see your saved trips (read-only), and the model is switchable by configuration, per task if needed.

**How to help**
- **Take it:** comment "taking this" and assign yourself, so two people don't build the same thing.
- **With a coding agent** (Claude Code, Codex, Cursor, ...): pull `main`, then tell your agent:
  > Read `plans/006-agent-planner-adk.md` and follow it step by step. Run every verification command and check the output matches. Only change files listed under Scope. If a STOP condition happens, stop and tell me instead of working around it. Don't push. When done, show me the diff and the check results.

  Review what it did, then open a PR that says `Closes #10`.
- **Just feedback:** answer the open questions above by number in a comment.

<!-- help:end -->

## Why this matters

The product promise (issue #4, "Agent/App") is: *"You can do this yourself, but it can be annoying.
Have an agent do it for you to meet your specific preferences."* The design thread fixed the
agent's role. **It interprets requests into the same structured `TripDraft` the filters edit.
It asks focused questions when something important is ambiguous. It calls server tools to
search, and it explains the results.** It must never produce fares, times, or routes from model
memory. Every number comes from a tool.

## Facts about ADK TypeScript (verified from adk.dev on 2026-11-13; re-check if versions moved)

- Package: `@google/adk` (dev tools: `@google/adk-devtools` → `npx adk web` for inspecting agents). Requires **Node ≥ 24.13.0 and npm ≥ 11.8.0**.
- Agent definition (quickstart):
  ```ts
  import { FunctionTool, LlmAgent } from '@google/adk';
  import { z } from 'zod';
  const getCurrentTime = new FunctionTool({
    name: 'get_current_time',
    description: 'Returns the current time in a specified city.',
    parameters: z.object({ city: z.string().describe('…') }),
    execute: ({ city }) => ({ status: 'success', report: `…` }),
  });
  export const rootAgent = new LlmAgent({ name: 'hello_time_agent', model: 'gemini-flash-latest', description: '…', instruction: `…`, tools: [getCurrentTime] });
  ```
- API key env var: `GEMINI_API_KEY`.
- Sessions: `InMemorySessionService` with `createSession({ appName, userId, state })`; sessions have `id`, `appName`, `userId`, `state`, `events`.
- **Not verified from docs:** the exact `Runner` / `InMemoryRunner` constructor, the `runAsync` signature, and how to detect the final response event. Step 3 finds these in the installed package's type definitions.
- TS tool-confirmation is documented as experimental. **No booking tools in this plan.**

## Current state

- `apps/server/src/planning/plan-trip.ts` — `planTrip(req, providers, signal?, logger?)` → `PlanResponse`. The fourth argument is optional (`PlanLogger`, default `console`). There is no `apps/server/src/agent/` directory.
- `packages/shared/src/index.ts` exports `TripDraftSchema`, `TripDraftPatchSchema`, `applyDraftPatch`, `toTripRequest`, `PlanResponseSchema`, `createDeviceId`, and `createMockApiClient` (plans 002/004/012).
- `apps/server/.env.example` has `HOST`, `PORT`, `CORS_ORIGIN`, `DATABASE_PATH` and no LLM key. `.gitignore` already ignores `.env`.
- Root `package.json` `"engines": { "node": ">=22.13.0", "npm": ">=10" }`; `.nvmrc` = `24`; CI `actions/setup-node@v4` with `node-version: 24`. `createServer` in `apps/server/src/app.ts` defaults providers to `[new FixtureProvider()]`.
- README rule: *"Client environment variables are public. Keep provider keys and secrets on the server."* `VITE_*` and `EXPO_PUBLIC_*` vars ship to users. The Gemini key must never use those prefixes.

## Scope

**In scope:**
```
package.json (engines), .nvmrc, .github/workflows/ci.yml (npm version step only), README.md (Node version + env var docs)
apps/server/package.json, package-lock.json
apps/server/.env.example                 add GEMINI_API_KEY=, GEMINI_MODEL=gemini-flash-latest, AGENT_MODEL_PLANNER= (optional override)
apps/server/src/agent/types.ts           PlannerAgent interface (framework-free)
apps/server/src/agent/instructions.ts    system instruction text
apps/server/src/agent/tools.ts           createPlannerTools(turn) — FunctionTools via closures
apps/server/src/agent/models.ts          modelFor(task) — the one place model ids are chosen (Step 6b)
apps/server/src/agent/adk-planner.ts     the ONLY file importing '@google/adk'
apps/server/src/agent/fake-planner.ts    deterministic test double
apps/server/src/places/gazetteer.ts      static place lookup (until plan 007 adds geocoding)
apps/server/src/routes/agent.ts
scripts/agent-eval.mjs                   optional live check, NOT run in CI
tests beside each module
```
**Out of scope:** booking, streaming (D5-B, planned as a later follow-up), clients' chat UI (UI team), real geocoding/routing (plan 007).

## Steps

### Step 1: Raise Node/npm minimums

Root `package.json` engines → `{ "node": ">=24.13.0", "npm": ">=11.8.0" }`. Leave `.nvmrc` at `24`. In `ci.yml`, after `setup-node`, add `- run: npm --version` and, if the runner's npm is below 11.8, `- run: npm install -g npm@^11.8`. Update README Quick start ("Use Node.js 24.13+ and npm 11.8+").
**Verify**: `npm run check` → exit 0.

### Step 2: Shared agent contract: already done by plan 004

*Moved 2026-11-14.* `AgentMessageRequestSchema`, `AgentMessageResponseSchema` and the client's
`sendAgentMessage()` are written in plan 004 Step 2b, so the mock client and chat UI can use them
early. Check they exist in `@transit/shared`; if they don't, STOP (plan 004 isn't done).

### Step 3: Install ADK and learn the runner API from its types

`npm install @google/adk -w @transit/server` and `npm install -D @google/adk-devtools -w @transit/server`.
Then inspect `node_modules/@google/adk/package.json` (`types`/`exports`) and grep its `.d.ts` files for `class Runner`, `InMemoryRunner`, `runAsync`, `isFinalResponse`, `ToolContext`. Write down (in the PR description) the exact signatures you'll use.
Also check ADK's zod requirement: `npm ls zod`. If ADK requires zod 3 while shared uses zod 4, try importing `z` from `'zod/v3'` **only inside `agent/tools.ts`** and converting. If tool parameter schemas still don't type-check, STOP and report.
**Verify**: `npm ls @google/adk` → one version, no `UNMET`.

### Step 4: Framework-free agent interface + fake

`agent/types.ts`:
```ts
export interface AgentTurnInput { deviceId: string; sessionId?: string; message: string; draft: TripDraft }
export interface PlannerAgent { respond(input: AgentTurnInput, signal?: AbortSignal): Promise<AgentMessageResponse> }
```
`agent/fake-planner.ts`: deterministic rules for tests, e.g. a message containing "15 min walk" → patch `constraints.maxWalkMinutes: 15`; "can't be late" → `preferences.lateTolerance: 'strict'`; "search" → runs `planTrip` with the merged draft.

### Step 5: Tools (`agent/tools.ts`)

`createPlannerTools(turn: TurnContext)`, where `TurnContext` is a per-request object `{ deviceId: string; draft: TripDraft; patch: TripDraftPatch; questions: …[]; plan?: PlanResponse; providers: RouteProvider[]; itineraries: ItineraryStore }`. Build the tools fresh per request, so closures write into this turn's context. Do not use module-level state.

| Tool name | Parameters (zod) | Behaviour | Returns to model |
|---|---|---|---|
| `update_trip_draft` | `TripDraftPatchSchema` | merge into `turn.patch`; recompute merged draft via `applyDraftPatch` | `{ status, draftSummary: describePatch(...) , missing }` |
| `find_place` | `{ query: string }` | `gazetteer.search(query)` → up to 5 `Place`s | the places |
| `search_routes` | `{}` | `toTripRequest(mergedDraft)`. If incomplete, return `{ status: 'incomplete', missing }`. Else `planTrip` and store the result in `turn.plan` | **compact** list: `id, summary, departAt, arriveAt, durationMinutes, cost.totalUsd, risk.level, risk.reasons, violations` (no geometry: saves tokens) |
| `ask_user` | `{ field: string, question: string, options?: string[] }` | push to `turn.questions` | `{ status: 'queued' }` |
| `list_saved_trips` | `{}` | `turn.itineraries.list(turn.deviceId)` (read-only; the agent never saves, edits or deletes trips) | **compact** list, max 20: `id, label, summary, departAt, arriveAt, watch`, plus `request` origin/destination names + coordinates, `time`, `modes`. The agent copies what it needs into the draft with `update_trip_draft` ("same as my usual commute but leave later"). Decided on #10 (Q1). |

`places/gazetteer.ts`: a hard-coded list (≈ 25 entries) for the launch metro (D1, Boston default): Boston Common, South Station, North Station, Back Bay, Kendall/MIT, Harvard Sq, Logan Airport (BOS, `kind: 'airport'`), PVD, MHT, BDL, HVN, JFK, LGA, EWR, New Haven Union Station, NYC Penn Station, DC Union Station. Case-insensitive substring + IATA code match.

### Step 6: Instructions (`agent/instructions.ts`)

The instruction string must state, in plain sentences:
1. You help plan trips by car, transit, bike, and plane. You never state times, prices, or routes unless they came from `search_routes`.
2. Turn every stated preference into `update_trip_draft` calls. Requirements ("must arrive by 9", "max $300") go into `constraints`. Inclinations ("I don't mind walking", "I'm cheap") go into `preferences` (0–1).
   Mapping examples: "can't be late" → `lateTolerance: 'strict'`; "a 15 minute walk is fine" → `maxWalkMinutes: 15`; "tight connections are ok" → `transferRisk: 0.8`; "money's no object" → `comfortVsCost: 0.9`.
3. Use `find_place` for any place name. If several match, use `ask_user` with the options.
4. Ask at most 2 questions per turn, only for fields `search_routes` reports as missing or that are genuinely ambiguous.
5. When origin, destination, and time are known, call `search_routes`. Explain the top 1–3 options in ≤ 120 words, naming tradeoffs and quoting risk reasons verbatim. If nothing satisfies the requirements, describe the near-misses and propose one specific constraint to relax. Never relax a constraint yourself.
6. Never claim to book or buy anything.

Include today's date and the user's timezone (from `draft.time` if present, else `America/New_York`) in the instruction per request.

### Step 6b: Configurable model selection (`agent/models.ts`)

Requested on #10: model choice must be **switchable**, possibly with **different models for different tasks**. The exact models and which task gets which are **not decided** (006-Q3).
```ts
export type AgentTask = 'planner';   // more tasks (e.g. 'flightSearch', 'summarize') get added only when a plan needs them
export function modelFor(task: AgentTask, env = process.env): string
```
Lookup order: `AGENT_MODEL_<TASK>` (e.g. `AGENT_MODEL_PLANNER`) → `GEMINI_MODEL` → the current default `'gemini-flash-latest'`. This is the **only** place model ids are read; no other file hard-codes one. Document both env vars in `.env.example`. A per-user setting in the app (changing the model from the Settings screen) is a later follow-up that would feed this same function. Don't build it here.

### Step 7: ADK implementation (`agent/adk-planner.ts`)

`export class AdkPlanner implements PlannerAgent`:
- Holds one module-lifetime `InMemorySessionService`. Gets the session by `sessionId` (scoped `appName: 'transit-agent'`, `userId: deviceId`), or creates a new one when it's missing or not found.
- Per request: `createPlannerTools(turn)` → `new LlmAgent({ name: 'trip_planner', model: modelFor('planner'), instruction, tools })` → runner (signature from step 3) → iterate events and collect the final response text.
- Returns `{ sessionId, reply, draftPatch: turn.patch, questions: turn.questions, plan: turn.plan }`, validated with `AgentMessageResponseSchema.parse`.
- Abort after 40 s (pass `signal` if the runner supports it).
If ADK forbids changing the agent/tools for an existing session's runner, keep one agent and pass per-turn context through session `state` or the tool context. Describe what you did in the PR. If neither works, STOP.

### Step 8: Route

`routes/agent.ts`: `POST /api/agent/messages` (requires `x-device-id`) → `parse(AgentMessageRequestSchema)` → `deps.agent.respond(...)`.
`ServerDeps` gains `agent?: PlannerAgent`. In `index.ts`, construct `AdkPlanner` only if `GEMINI_API_KEY` is set. Otherwise, the route returns 503 `{ error: { code: 'agent_unavailable', message: 'Set GEMINI_API_KEY on the server' } }`. Log at startup whether the agent is enabled. **Never log the key.**
Rate-limit lightly: max 20 agent requests/minute per device (simple in-memory token bucket in the route file).

### Shared development server (owner decision, 2026-11-14)

Cattn runs the Gemini-enabled server on their own machine. Teammates run their web/mobile apps locally and point them at that server only when testing live AI or available live API integrations. They do not need Cattn's Gemini account, credentials, or a local Gemini key. Mock clients and fake planners remain the normal development/CI path.

- Keep `GEMINI_API_KEY` only in the host machine's server environment or ignored `apps/server/.env`. Never send it to clients, teammates, logs, or source control.
- Document the host setup in README: run the API with `HOST=0.0.0.0`, port `3001`, and `CORS_ORIGIN` listing teammates' actual browser origins (comma-separated; each teammate's `http://localhost:5173` works for their local browser). Existing server configuration already supports this; no separate hosted service is required.
- Teammates set `VITE_API_URL=http://HOST_LAN_IP:3001` for web or `EXPO_PUBLIC_API_URL=http://HOST_LAN_IP:3001` for mobile, then restart their app. These variables contain only the API address. `localhost` and `10.0.2.2` on their machines do not address Cattn's server. Check `/api/health` from the teammate's machine first.
- A LAN address works when the devices can reach that network. Off-network testing needs a reachable private-network address or separately arranged API tunnel; Expo's bundle tunnel does not expose the API. Document this distinction without provisioning a tunnel as part of 006.
- The host server must be running for live calls. Without a configured key, agent requests retain the planned 503 behavior. Plan 006 enables live Gemini, not real transit/flight sources still owned by other plans; label fixture data accordingly.

### Step 9: Tests

- `tools.test.ts`: `update_trip_draft` accumulates patches across 2 calls; `search_routes` with incomplete draft → `incomplete` + missing list; complete draft → `turn.plan` set and model-facing result has no `geometry` key; `ask_user` queues.
- `routes/agent.test.ts` with `FakePlanner`: 200 shape validates; missing key path → 503; 21st request in a minute → 429.
- Nothing in CI calls Gemini.

`scripts/agent-eval.mjs` (manual; requires `GEMINI_API_KEY` and a built server): sends 6 scripted prompts in-process via `app.inject` and prints PASS/FAIL per expectation:
1. "Boston Common to Kendall by 9am tomorrow, I can't be late, 15 min walk max" → `constraints.arriveBy` set, `lateTolerance` strict, `maxWalkMinutes` 15, `plan` present.
2. "get me to the airport" → a question whose `field` is `origin` or `time`, no `plan`.
3. "Is it cheaper to fly out of Providence than Logan?" → reply mentions it needs flight data (flights land in plan 011), no fabricated prices (reply contains no `$` unless `plan` present).
4–6: your choice, one per mode (bike, drive, tight transfers).

**Verify**: `npm run check` → exit 0. With a key in `apps/server/.env`: `node scripts/agent-eval.mjs` → ≥ 4/6 PASS (record results in the PR).

## Done criteria

- [ ] `npm run check` exits 0 with no network access needed
- [ ] `grep -rln "@google/adk" apps/server/src` → only `agent/adk-planner.ts` (and possibly `agent/tools.ts` for `FunctionTool`)
- [ ] `grep -rn "GEMINI" apps/web apps/mobile` → no matches
- [ ] Server starts without `GEMINI_API_KEY` and `/api/agent/messages` returns 503
- [ ] README documents Cattn-hosted shared-server setup, teammate API URLs, browser CORS origins, and mock-first development without distributing the Gemini key
- [ ] Eval run recorded in PR

## STOP conditions

- ADK's runner API can't support per-request tools or context (step 7).
- zod version conflict that `zod/v3` doesn't resolve (step 3).
- Gemini returns prices/times in replies without calling `search_routes` in > 1 of 6 eval prompts, even after tightening instructions once. Report: this is a product-risk finding.

## Maintenance notes

- Final integrated head `8623a2534a809d7b4d4d66f8634385a490aab621` merged in PR #38 as `7ee32a0`. Normal main merge preserved reviewed agent source/routes/index and the production UUID11 workaround; only the lockfile conflict required regeneration. Author verified fresh `npm ci`, full `npm run check` (320 existing tests, all builds/exports/smoke), native ADK import, real built/TS no-key health 200/agent 503, completed/in-flight plan invalidation, and max two questions. No live Gemini calls or model-quality validation.
- The implementation dependency is satisfied on main. UI consumers can use the shared server endpoint; real transit/flight providers and live-model quality checks remain separate work.

- ADK is isolated in `adk-planner.ts`, so switching to `@google/genai` function-calling (D3-B) means rewriting that one file.
- `InMemorySessionService` loses conversations on restart. That's fine; durable data (profiles, saved trips) lives in SQLite (plan 005).
- New provider capabilities (flights, bikeshare) become new tools here, plus one instruction line each.
- **Planned follow-up: streaming (D5-B).** Keep `PlannerAgent.respond()` returning the final `AgentMessageResponse`, and keep the turn's patch, questions and plan in the per-turn `TurnContext`. Streaming then adds a second endpoint (e.g. `POST /api/agent/messages/stream`, server-sent events: `reply-delta`, `draft-patch`, `questions`, `plan`, `done` with the same final object) and a client `agentStream()` method (plan 004 maintenance notes), without changing this endpoint.

## Open questions for review

- 006-Q1: Should the agent *auto-search* as soon as the draft is complete, or wait for the user to say "go"? Proposed: auto-search (fewer round trips).
- ~~006-Q2~~ **Decided (@Cattn, 2026-11-14, [#10](https://github.com/Cattn/transit-agent/issues/10#issuecomment-6871994354)): yes.** The agent can read saved trips via the read-only `list_saved_trips` tool (Step 5).
- 006-Q3 (**partly decided**, [#10](https://github.com/Cattn/transit-agent/issues/10#issuecomment-6871994354)): model choice must be switchable, possibly per task (Step 6b). **Still open:** which exact model the main agent uses (the owner prefers a newer model; the identifier hasn't been confirmed) and whether different tasks get different models. Model research is happening separately; until it lands, keep the default `gemini-flash-latest` and don't guess new identifiers.
