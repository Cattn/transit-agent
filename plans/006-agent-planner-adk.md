# Plan 006: Add the Gemini trip-planner agent (ADK TypeScript) behind `POST /api/agent/messages`

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If a STOP condition occurs, stop and report — do
> not improvise. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat c9e33cc..HEAD -- apps/server package.json .nvmrc .github/workflows/ci.yml`
> Expected: plans 003–005 landed. Read `apps/server/src/app.ts` and `apps/server/src/planning/plan-trip.ts` before starting.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED (new external dependency and model behaviour; mitigated by keeping ADK behind one module and testing with a fake agent)
- **Depends on**: plans/003, plans/004 (needs `TripDraftPatchSchema`); plan 005 optional (profile defaults)
- **Category**: direction
- **Blocked by decisions**: D3 (ADK vs direct `@google/genai`), D5 (request/response, no streaming) — defaults assumed
- **Planned at**: commit `c9e33cc`, 2026-11-13
- **Issue**: https://github.com/Cattn/transit-agent/issues/10

<!-- help:start -->
## Who's on it & how to help

- **Status:** ⏳ **Waiting** on #7 and #8.
- **Owner:** Suggested: @Cattn (holds the Gemini API key). Unassigned until started.
- **Up for grabs?** Partly. Anyone can help with the agent's test prompts or tools, but running it needs the Gemini key on the server.
- **Waiting on:** #7, #8

**Open questions** (answer by number in a comment on #10):

1. Should the agent be able to see your saved trips ("same as my usual commute but later")? *(suggested: later)*
2. Use the fast, cheap Gemini Flash model, or a stronger Pro model? *(suggested: Flash, switchable by a setting)*

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

- `apps/server/src/planning/plan-trip.ts` — `planTrip(req, providers, signal)` → `PlanResponse` (plan 003).
- `packages/shared` exports `TripDraftSchema`, `TripDraftPatchSchema`, `applyDraftPatch`, `toTripRequest`, `PlanResponseSchema` (plans 002/004).
- `apps/server/.env.example` has no LLM key. `.gitignore` already ignores `.env`.
- Root `package.json` `"engines": { "node": ">=22.13.0", "npm": ">=10" }`; `.nvmrc` = `24`; CI `actions/setup-node@v4` with `node-version: 24`.
- README rule: *"Client environment variables are public. Keep provider keys and secrets on the server."* `VITE_*` and `EXPO_PUBLIC_*` vars ship to users. The Gemini key must never use those prefixes.

## Scope

**In scope:**
```
package.json (engines), .nvmrc, .github/workflows/ci.yml (npm version step only), README.md (Node version + env var docs)
apps/server/package.json, package-lock.json
apps/server/.env.example                 add GEMINI_API_KEY=, GEMINI_MODEL=gemini-flash-latest
apps/server/src/agent/types.ts           PlannerAgent interface (framework-free)
apps/server/src/agent/instructions.ts    system instruction text
apps/server/src/agent/tools.ts           createPlannerTools(turn) — FunctionTools via closures
apps/server/src/agent/adk-planner.ts     the ONLY file importing '@google/adk'
apps/server/src/agent/fake-planner.ts    deterministic test double
apps/server/src/places/gazetteer.ts      static place lookup (until plan 007 adds geocoding)
apps/server/src/routes/agent.ts
packages/shared/src/domain/agent.ts      request/response schemas (additive) + re-export
packages/shared/src/client/api-client.ts add sendAgentMessage()
scripts/agent-eval.mjs                   optional live check, NOT run in CI
tests beside each module
```
**Out of scope:** booking, streaming (D5-B), clients' chat UI (UI team), real geocoding/routing (plan 007).

## Steps

### Step 1: Raise Node/npm minimums

Root `package.json` engines → `{ "node": ">=24.13.0", "npm": ">=11.8.0" }`. Leave `.nvmrc` at `24`. In `ci.yml`, after `setup-node`, add `- run: npm --version` and, if the runner's npm is below 11.8, `- run: npm install -g npm@^11.8`. Update README Quick start ("Use Node.js 24.13+ and npm 11.8+").
**Verify**: `npm run check` → exit 0.

### Step 2: Shared agent contract (additive)

`packages/shared/src/domain/agent.ts`:
```ts
export const AgentMessageRequestSchema = z.object({
  sessionId: z.string().optional(),
  message: z.string().min(1).max(2000),
  /** Client's current draft (filters state) — the agent edits relative to this. */
  draft: TripDraftSchema
});
export const AgentMessageResponseSchema = z.object({
  sessionId: z.string(),
  reply: z.string(),
  /** Everything the agent changed this turn. Client applies with source 'agent' and shows it as editable chips. */
  draftPatch: TripDraftPatchSchema,
  /** Focused clarifying questions, each tied to the draft field it would fill. */
  questions: z.array(z.object({ field: z.string(), question: z.string(), options: z.array(z.string()).optional() })),
  /** Present when the agent ran a search this turn. Same shape as POST /api/plan. */
  plan: PlanResponseSchema.optional()
});
```
Client: `sendAgentMessage(body): Promise<AgentMessageResponse>` with a 45 s timeout.

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

`createPlannerTools(turn: TurnContext)`, where `TurnContext` is a per-request object `{ draft: TripDraft; patch: TripDraftPatch; questions: …[]; plan?: PlanResponse; providers: RouteProvider[] }`. Build the tools fresh per request, so closures write into this turn's context. Do not use module-level state.

| Tool name | Parameters (zod) | Behaviour | Returns to model |
|---|---|---|---|
| `update_trip_draft` | `TripDraftPatchSchema` | merge into `turn.patch`; recompute merged draft via `applyDraftPatch` | `{ status, draftSummary: describePatch(...) , missing }` |
| `find_place` | `{ query: string }` | `gazetteer.search(query)` → up to 5 `Place`s | the places |
| `search_routes` | `{}` | `toTripRequest(mergedDraft)`. If incomplete, return `{ status: 'incomplete', missing }`. Else `planTrip` and store the result in `turn.plan` | **compact** list: `id, summary, departAt, arriveAt, durationMinutes, cost.totalUsd, risk.level, risk.reasons, violations` (no geometry: saves tokens) |
| `ask_user` | `{ field: string, question: string, options?: string[] }` | push to `turn.questions` | `{ status: 'queued' }` |

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

### Step 7: ADK implementation (`agent/adk-planner.ts`)

`export class AdkPlanner implements PlannerAgent`:
- Holds one module-lifetime `InMemorySessionService`. Gets the session by `sessionId` (scoped `appName: 'transit-agent'`, `userId: deviceId`), or creates a new one when it's missing or not found.
- Per request: `createPlannerTools(turn)` → `new LlmAgent({ name: 'trip_planner', model: process.env.GEMINI_MODEL ?? 'gemini-flash-latest', instruction, tools })` → runner (signature from step 3) → iterate events and collect the final response text.
- Returns `{ sessionId, reply, draftPatch: turn.patch, questions: turn.questions, plan: turn.plan }`, validated with `AgentMessageResponseSchema.parse`.
- Abort after 40 s (pass `signal` if the runner supports it).
If ADK forbids changing the agent/tools for an existing session's runner, keep one agent and pass per-turn context through session `state` or the tool context. Describe what you did in the PR. If neither works, STOP.

### Step 8: Route

`routes/agent.ts`: `POST /api/agent/messages` (requires `x-device-id`) → `parse(AgentMessageRequestSchema)` → `deps.agent.respond(...)`.
`ServerDeps` gains `agent?: PlannerAgent`. In `index.ts`, construct `AdkPlanner` only if `GEMINI_API_KEY` is set. Otherwise, the route returns 503 `{ error: { code: 'agent_unavailable', message: 'Set GEMINI_API_KEY on the server' } }`. Log at startup whether the agent is enabled. **Never log the key.**
Rate-limit lightly: max 20 agent requests/minute per device (simple in-memory token bucket in the route file).

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
- [ ] Eval run recorded in PR

## STOP conditions

- ADK's runner API can't support per-request tools or context (step 7).
- zod version conflict that `zod/v3` doesn't resolve (step 3).
- Gemini returns prices/times in replies without calling `search_routes` in > 1 of 6 eval prompts, even after tightening instructions once. Report: this is a product-risk finding.

## Maintenance notes

- ADK is isolated in `adk-planner.ts`, so switching to `@google/genai` function-calling (D3-B) means rewriting that one file.
- `InMemorySessionService` loses conversations on restart. That's fine; durable data (profiles, saved trips) lives in SQLite (plan 005).
- New provider capabilities (flights, bikeshare) become new tools here, plus one instruction line each.

## Open questions for review

- 006-Q1: Should the agent *auto-search* as soon as the draft is complete, or wait for the user to say "go"? Proposed: auto-search (fewer round trips).
- 006-Q2: Should the agent see the user's saved itineraries ("same as my usual commute but leave later")? Proposed: later, as a `list_saved_trips` tool.
- 006-Q3: Model: `gemini-flash-latest` (fast, cheap) vs a Pro model for harder flight reasoning? Proposed: Flash, env-configurable.
