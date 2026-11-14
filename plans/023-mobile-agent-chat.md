# Plan 023: Open the agent chat from the mobile Ask button

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If a STOP condition occurs, stop and report. When done, update
> this plan's row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat bd41542..HEAD -- apps/mobile/src/screens/chat apps/mobile/src/screens/home packages/shared/src/client/mock/mock-agent.ts`
> Plan 020's "Ask agent" control must exist. If it does not, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/020-mobile-map-home.md. Reads the same draft plan 022 edits.
- **Category**: implementation (first-pass UI)
- **Planned at**: commit `bd41542`, 2026-11-14
- **Issue**: https://github.com/Cattn/transit-agent/issues/43

<!-- help:start -->
## Who's on it & how to help

- **Status:** 📝 **First draft, after plan 020.** Feedback welcome. The mobile sheet versus the web side panel is already decided on #16. Everything else in the thread can still change.
- **Owner:** @Cattn (assigned 2026-11-14 from the build timeline)
- **Visual proof:** the PR must show each primary feature of this plan working, as screenshots or a video, at most 4 pieces of media (combine features into one video or screenshot where possible).
- **Up for grabs?** No. Talk to @Cattn before starting related work.
- **Agent:** plan 006 is merged. This screen uses the client from plan 020's `src/data/client.ts`: the mock by default, the real agent with `EXPO_PUBLIC_API_MODE=server`.
- **Waiting on:** The home shell. Not on `GEMINI_API_KEY`.

**Open questions** — **@Cattn answers Q1–Q2; @Rad1ee answers Q3 (design).** Reply as `023-Q1: ...`. Use the proposed defaults until answered.

- 023-Q1: render live agent replies instead of the sample sentences? *(proposed: yes)*
- 023-Q2: buttons only when `questions[].options` exists? *(proposed: yes)*
- 023-Q3: changes you want in the sheet before it is built?

**How to help**
- **Take it:** comment "taking this" and assign yourself.
- **With a coding agent:** pull `main`, then:
  > Read `plans/023-mobile-agent-chat.md` and follow it step by step. Only change files under Scope. Stop on a STOP condition. Don't push.

<!-- help:end -->

## This plan will change

First Figma pass, read 2026-11-14. The bubble-opens-a-sheet decision stays. The bubbles, chips, and quick replies inside it are draft copy. Re-read the issue before building. If the chat frame is redrawn, replace **Current state** and keep sending `TripDraft` to `sendAgentMessage`.

## Why this matters

On the phone the agent is a button that opens a sheet. It is not a side panel. The sheet edits the same draft the filters edit. Frame **04 Agent chat** is that sheet. Web's permanent side panel is out of scope.

## Current state

- Frames: `iOS · 04 Agent chat` (`2012:482`), `iOS · Dark · 04 Agent chat` (`2019:1672`), `Android · 04 Agent chat` (`2004:1571`), `Android · Dark · 04 Agent chat` (`2018:2055`).
- The sheet covers most of the map. A dim route preview stays behind it. Do not fetch that route inside the sheet. Pass the current itineraries through for the map slot plan 020 already owns.
- Header: sparkle avatar, title "Trip agent", subtitle that a reply edits the trip. Android uses a Material sheet and drag handle. iOS uses a glass sheet and grabber.
- Sample thread, in order:
  1. User bubble. The frame's sample asks for a cheap trip to the office with little walking.
  2. Agent bubble that lists what it changed, as chips the user can tap. The sample includes arrive by 9:00 and a walk limit. Tapping a chip opens Filters (plan 022) on that field. The chips are the draft provenance entries whose source is `'agent'`, not a second list.
  3. A shorter agent bubble that asks a question, then quick-reply buttons. Render `questions[].options` from the agent response as those buttons. Tapping one sends that option as the next user message.
- Composer: text field and a send button. Disable send while a request is in flight.
- `createMockApiClient` already implements `sendAgentMessage`. The mock understands phrases such as a walk limit and "cheap". Use `useAgentChat(draft, apply)` from `@transit/client-react` (merged in #47); do not call the client directly.
- If the call throws `ApiClientError` with status 503 or code `agent_unavailable`, show "The agent is not available yet" in the sheet. Do not invent a reply.
- `POST /api/agent/messages` is merged (plan 006). Only Cattn's server holds the Gemini key. Do not add server code, a key, or a streaming client.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run typecheck -w @transit/mobile` | exit 0 |
| Lint | `npm run lint` | exit 0 |

## Scope

**In scope:**
- `apps/mobile/src/screens/chat/ChatScreen.tsx`
- `apps/mobile/src/screens/chat/ChatChrome.ios.tsx`
- `apps/mobile/src/screens/chat/ChatChrome.android.tsx`
- `apps/mobile/src/screens/home/HomeScreen.tsx` (only the `chatOpen` flag plan 020 left)

**Out of scope:** `apps/server/**`, `packages/shared/**`, `packages/client-react/**`, web chat, booking.

## Git workflow

- Branch: `plan/023-mobile-agent-chat`
- One commit: `mobile: open agent chat from the Ask button (plan 023)`.
- Do not push unless told.

## Steps

### Step 1: Send and apply

`ChatScreen` keeps `{ id, role, text }[]`. Send calls `sendAgentMessage({ message, draft, sessionId })`. `draft` is the current `TripDraft` (`AgentMessageRequestSchema` in `packages/shared/src/domain/agent.ts`), not a `TripRequest`. Apply `response.draftPatch` with `applyDraftPatch(..., 'agent')`. If `response.plan` is present, pass it up to Home so Results (plan 021) can show it. `questions[].options` is optional. When it is missing, show `questions[].question` as text and do not invent buttons.

**Verify**: `npm run typecheck -w @transit/mobile` → exit 0

### Step 2: Platform sheet

iOS: glass sheet, `BlurView`, grabber. Android: Material surface, drag handle, no blur. Both use the same message list. Quick replies are buttons under the latest agent message that has `options`.

**Verify**: `npm run lint` → exit 0

## Test plan

Do not add tests or a runner. Run the typecheck and lint commands above. Manually, the mock message "cheap, walk at most 10 min, to Harvard" should change the draft. That string is the mock's example in `plans/ui-slices.md` slice 4. If the mock does not understand it, show the reply it did return. Do not special-case a fake success.

## Done criteria

- [ ] `npm run typecheck -w @transit/mobile` exits 0
- [ ] `npm run lint` exits 0
- [ ] The chat is not mounted until Ask agent is pressed
- [ ] Agent patches use source `'agent'`
- [ ] No server file is modified

## STOP conditions

- Plan 020 did not leave a way to open the chat.
- `sendAgentMessage` is missing on the mock client.
- You are about to import `@google/adk` or read `GEMINI_API_KEY` in the app.

## Maintenance notes

When a question is answered or a frame changes, update this same plan and its issue. Strike answered questions and keep the decision and source link. Do not open a second plan for the same screen.

- Switching to the real agent is plan 020's `EXPO_PUBLIC_API_MODE=server`; the screen does not change. Do not open a streaming connection in this plan.
- **Animated map (plans 029 + 030):** later, `useAgentChat` streams progress (pass `expo/fetch` to the API client) and Home passes `buildPreview` to the native `RouteMap` while the chat sheet is open. Follow-up PR after 029, 030, and the native map (009) land.

## Open questions for review

See the help box at the top (023-Q*). It is the single list; answers are recorded there.
