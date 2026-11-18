# Plan 029: Stream the agent's progress (places, draft, searching, routes) while it works

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If a STOP condition occurs, stop and report. Do
> not improvise. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 043cbe6..HEAD -- apps/server/src/agent apps/server/src/routes/agent.ts packages/shared/src/domain/agent.ts packages/shared/src/client packages/client-react/src/use-agent-chat.ts`
> PR #52 (Vertex + tool-schema fixes, merged as `40cf8e2`) touches `adk-planner.ts`, `tools.ts`, and `routes/agent.ts`, and the excerpts below include it. Compare Current state with the live code. On a mismatch, STOP.

## Status

- **Priority**: P1 (right after the MVP check; the agent's turns take ~16 s, see #54)
- **Effort**: M
- **Risk**: MED (streaming over `fetch` on React Native; ADK runner lifetime)
- **Depends on**: PR #52 merged (same files). Builds on plans 006, 004, 012, 015 (merged).
- **Category**: direction
- **Planned at**: commit `043cbe6` (main) plus PR #52 head `b6cb637`, 2026-11-14
- **Issue**: https://github.com/Cattn/transit-agent/issues/55

<!-- help:start -->
## Who's on it & how to help

- **Owner:** @KrakenTheJaken (server + shared + hooks + Android wiring; reassigned on #55). PR #86 merged.
- **Up for grabs?** No. Talk to @Cattn before starting related work.
- **Waiting on:** nothing (#52 merged).
- **Pairs with:** plan 030 (@KrakenTheJaken), which turns these events into the map animation.

**Open questions** (answer by number in a comment on #55) — **@Cattn answers these.**

- 029-Q1: stream as newline-delimited JSON over `POST` instead of Server-Sent Events? *(proposed: yes; `EventSource` cannot send a POST body, and `fetch` streaming works on web and Expo)*
- 029-Q2: keep `POST /api/agent/messages` (JSON) as the fallback forever? *(proposed: yes; tests and older clients use it)*

<!-- help:end -->

## Why this matters

The owner wants the map to "build itself" while the agent drafts a trip: places appear, the camera moves to the trip, and routes draw in as soon as they exist. Today the client sees nothing until the whole turn ends (median 16 s, up to 31 s in #51). Every step the user would want to watch already happens inside a tool call (`find_place`, `update_trip_draft`, `search_routes`). This plan reports those steps to the client as they happen, without changing what the agent decides. It is the "streaming later" item from decision D5, scoped to progress events (no token-by-token text).

## Current state

- `apps/server/src/agent/adk-planner.ts` — `AdkPlanner.respond(input, signal)` runs `runner.runAsync(...)`. With #52, an event with `errorCode` throws (`Planner model error …`); the stream sends that as an `error` event. It keeps the final text and returns `AgentMessageResponseSchema.parse({ sessionId, reply, draftPatch: turn.patch, questions: turn.questions, plan: turn.plan })`.
- `apps/server/src/agent/tools.ts` — `createPlannerTools(turn: TurnContext)` returns `FunctionTool`s. The steps to report are already isolated:
  - `find_place` → `execute: ({ query }) => searchPlaces(query)`
  - `update_trip_draft` → updates `turn.draft` and `turn.patch`
  - `search_routes` → calls `planTrip(...)`; sets `turn.plan` only if the draft revision did not change meanwhile
  - `ask_user` → pushes to `turn.questions`
- `apps/server/src/agent/types.ts`:
  ```ts
  export interface PlannerAgent {
    respond(input: AgentTurnInput, signal?: AbortSignal): Promise<AgentMessageResponse>;
  }
  ```
  `FakePlanner` (`fake-planner.ts`) implements it for tests.
- `apps/server/src/routes/agent.ts` — `POST /api/agent/messages`: device id, 503 without an agent, per-device rate limit (20/min), then `deps.agent.respond(...)`.
- `packages/shared/src/domain/agent.ts` — `AgentMessageRequestSchema`, `AgentQuestionSchema`, `AgentMessageResponseSchema`.
- `packages/shared/src/client/api-client.ts` — `sendAgentMessage(body)` posts JSON with a 45 s timeout. The private `request()` helper shows the error conventions to copy (`ApiClientError` with `status 0` for network/timeouts; API errors parsed with `ApiErrorSchema`).
- `packages/shared/src/client/mock/mock-client.ts` — `sendAgentMessage` returns `mockAgentReply(...)`.
- `packages/client-react/src/use-agent-chat.ts` — `useAgentChat(draft, apply)` returns `{ messages, pending, error, send, lastPlan }`; `send` awaits `api.sendAgentMessage` then applies `draftPatch` with source `'agent'`.
- Mobile is Expo SDK 58. React Native's built-in `fetch` does not expose `response.body` as a stream; `expo/fetch` does.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Shared tests | `npm run test:unit -w @transit/shared` | all pass |
| Server tests | `npm run test:unit -w @transit/server` | all pass |
| Hooks typecheck | `npm run typecheck -w @transit/client-react` | exit 0 |
| Full | `npm test` | exit 0 |

## Scope

**In scope:** `packages/shared/src/domain/agent.ts` (event schema), `packages/shared/src/client/api-client.ts` (`streamAgentMessage`), `packages/shared/src/client/agent-progress.ts` (create: pure reducer), `packages/shared/src/client/mock/mock-client.ts` (simulated events), their tests; `apps/server/src/agent/{types,tools,adk-planner,fake-planner}.ts`, `apps/server/src/routes/agent.ts`, their tests; `packages/client-react/src/use-agent-chat.ts`.
**Additional in scope:** `apps/mobile/src/screens/home/HomeScreen.tsx`, `apps/mobile/src/screens/chat/*`, and the existing DOM wrapper, for progress wiring only.
**Out of scope:** maps renderer internals (030), screen redesign, token-by-token reply text, changing what the agent does or its instructions, the JSON endpoint's response shape.

## Git workflow

Branch `plan/029-agent-progress`. Commit per step, e.g. `shared: add agent progress events (plan 029 step 1)`. Do not push unless told.

## Steps

### Step 1: Event schema (shared)

In `domain/agent.ts` add a discriminated union `AgentProgressEventSchema` (export the type `AgentProgressEvent`). Every event has `seq` (number, increasing from 0) and `at` (ISO string):

| `type` | Extra fields | Emitted when |
|---|---|---|
| `thinking` | — | turn starts |
| `places` | `query`, `places: Place[]` | `find_place` returns |
| `draft` | `patch: TripDraftPatch`, `draft: TripDraft` | `update_trip_draft` applies |
| `searching` | `origin`, `destination` (Place) | `search_routes` starts with a complete draft |
| `routes` | `plan: PlanResponse` | `search_routes` result is kept (revision unchanged) |
| `question` | `question: AgentQuestion` | `ask_user` queues one |
| `done` | `response: AgentMessageResponse` | turn finished; identical to the JSON endpoint's body |
| `error` | `code`, `message` | turn failed |

**Verify**: `npm run typecheck -w @transit/shared` → exit 0

### Step 2: Pure progress reducer (shared)

`client/agent-progress.ts`: `initialAgentProgress` and `reduceAgentProgress(state, event)` → `{ phase: 'idle' | 'thinking' | 'locating' | 'searching' | 'routes' | 'done' | 'error', candidates: Place[], origin?: Place, destination?: Place, plan?: PlanResponse }`. Rules: `places` → phase `locating`, replace `candidates`; `draft` → copy origin/destination from `event.draft`, clear `candidates` once both are set; `searching` → phase `searching`; `routes` → phase `routes`, set `plan`; `done` → phase `done`, `plan = response.plan ?? state.plan`; ignore events whose `seq` is not greater than the last one seen. Export both from `src/index.ts`. Plan 030's map prop is built from this state.

Tests (`agent-progress.test.ts`, pattern: `format/format.test.ts`): a full happy sequence; out-of-order `seq` ignored; `routes` then a later `draft` change keeps the old plan until a new `routes` arrives; `error` sets phase `error`.

**Verify**: `npm run test:unit -w @transit/shared` → all pass

### Step 3: Server emits events

- `TurnContext` gains `emit?: (event: Omit<AgentProgressEvent, 'seq' | 'at'>) => void`. Each tool calls it at the moments in the Step 1 table. Emitting must never throw into the tool (wrap in try/catch).
- `PlannerAgent` gains optional `stream?(input, emit, signal): Promise<AgentMessageResponse>`. In `AdkPlanner`, factor the body of `respond` into one private method that takes `emit`; `respond` passes a no-op. Emit `thinking` first and `done` last.
- `FakePlanner.stream`: emits `thinking`, a `draft` event if it patched, `searching` + `routes` if it searched, then `done`.

**Verify**: `npm run test:unit -w @transit/server` → all pass

### Step 4: Streaming route

`POST /api/agent/messages/stream`: same validation, 503, and rate limit as the JSON route (share a helper; do not copy). Reply with `content-type: application/x-ndjson`, `cache-control: no-cache`, and write one JSON event per line as they arrive (`reply.raw.write(JSON.stringify(event) + '\n')`), assigning `seq` and `at` here. Abort the agent when the client disconnects (`request.raw.on('close', …)`). Errors after the stream started are sent as an `error` event, then the response ends. Errors before it starts keep the normal JSON error body.

Tests with `app.inject` and `FakePlanner`: a searching turn yields `thinking … routes … done` in order, and every line parses with `AgentProgressEventSchema`; the final `done.response` equals what `POST /api/agent/messages` returns for the same input; rate limit still applies; no agent → 503 JSON.

**Verify**: `npm run test:unit -w @transit/server` → all pass

### Step 5: Client + mock

- `api-client.ts`: `streamAgentMessage(body, onEvent): Promise<AgentMessageResponse>`. Read `response.body` with a reader and split on `\n`; validate each line with `AgentProgressEventSchema`; resolve with `done.response`; reject with `ApiClientError` on an `error` event or transport failure. Timeout 60 s. If `response.body` is missing (a fetch without streaming), fall back to `sendAgentMessage(body)` and synthesize one `done` event. Accept an optional `fetch` override like the other options (mobile passes `expo/fetch`).
- Mock client: `streamAgentMessage` emits the same sequence a real turn would (`thinking` → `places` → `draft` → `searching` → `routes` → `done`) with `latencyMs`-based gaps (default 400 ms each), so UI and map work run without a server.

Tests: a fake `fetch` returning a chunked body that splits lines across chunks; missing body → fallback; `error` event → `ApiClientError`.

**Verify**: `npm run test:unit -w @transit/shared` → all pass

### Step 6: Hook

`useAgentChat` uses `api.streamAgentMessage` when it exists, keeping the existing behavior when it does not. It also returns `progress` (the Step 2 state, reset to `initialAgentProgress` at the start of each `send`). Apply `draftPatch` only from the final response, exactly as today; progress events never edit the user's draft. Keep the existing generation/stale-result guards.

`@transit/client-react` has no test setup (no jsdom); do not add one here. The progress logic is covered by the shared reducer tests in Step 2.

**Verify**: `npm run typecheck -w @transit/client-react` → exit 0; `npm test` → exit 0

## Test plan

New tests in Steps 2, 4, and 5, as listed. Existing JSON-endpoint tests must pass unchanged.

## Done criteria

- [ ] `npm test` exits 0
- [ ] `curl -N -X POST localhost:3001/api/agent/messages/stream -H 'content-type: application/json' -H 'x-device-id: t' -d '{"message":"MIT to South Station at 9","draft":{}}'` against a server with a live agent prints `thinking` first and `done` last, one JSON object per line, with lines arriving over time (not all at the end). (Fill the draft with what `TripDraftSchema` requires; see a server test for a minimal valid draft.)
- [ ] The JSON endpoint's response is unchanged (its tests pass without edits)
- [ ] Only in-scope files changed

## STOP conditions

- ADK does not run tool `execute` functions before the turn ends (events arrive only at the end). Report it; the design assumes tools run as the model calls them.
- Fastify buffers the response so lines arrive together even with `reply.raw.write`. Report what you tried.
- `expo/fetch` cannot stream on SDK 58. Report it; mobile keeps the JSON fallback, and web still streams.

## Maintenance notes

- New agent tools should emit an event only if the map or chat has something to show for it. Add the type to the schema and the reducer together.
- Token-by-token reply text (the rest of D5-B) can be added later as a `text` event without changing these.
- #54 (turn speed) is separate: this makes the wait visible, not shorter.

## Android integration and closure (`0b37886`)

Cattn owns the running Android consumer, not completed 023. Rebase on #72 and 035. Verify platform streaming support (`expo/fetch` in the installed SDK), retain JSON fallback, consume session progress in Home, convert Place coordinates to 030 buildPreview, and send plain JSON across the DOM boundary. Before 030 lands, show truthful textual phases and omit map preview; after 030, attach Android proof of the whole sequence before closing #56. Clear previews on new turns, invalidated drafts, cancellation and errors. Ignore late events from older turns. Preserve prior usable results and retry after stream failures. `npm run check` must pass; record Android start/progress/success/failure/retry. Extend existing tests only.
