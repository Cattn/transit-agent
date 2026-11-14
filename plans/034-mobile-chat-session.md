# Plan 034: Keep the mobile agent chat for the app session

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If a STOP condition occurs, stop and report. Do
> not improvise. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: compare Current state with `apps/mobile/src/screens/home/`, `apps/mobile/src/screens/chat/` and `packages/client-react/src/use-agent-chat.ts` on `main`. Plan 023 (PR #67) must be merged first. If the files differ from what's described, STOP.

## Status

- **Owner:** @Cattn (mobile)
- **State:** TODO (waits on plan 023, PR #67)
- **Priority:** P1 (MVP polish: losing the conversation on a chip tap feels broken)
- **Effort:** S
- **Risk:** LOW (mobile-only state move; no contract or server change)
- **Depends on:** 023 (PR #67). It touches the same chat as 029, but needs no hook change, so it can land before or after 029.
- **Issue:** #68
- **Decisions:** @Cattn, 2026-11-14 (from the plan 023 work on PR #67).

## Why this matters

In PR #67 the chat thread lives in `useAgentChat` inside `ChatScreen`, which only mounts while the chat sheet is open. When the user taps one of the agent's chips, the chat closes to open Filters and the thread is lost. The draft changes survive, but the conversation and the agent `sessionId` don't. The same thing happens when the user closes and reopens the chat.

## Decisions (Cattn)

- **Scope:** keep the chat thread for the app session only. It stays in memory with the agent `sessionId` and is lost when the app restarts. No persistence. One closable plan.
- **Chip tap:** opens Filters on top of the chat. Closing Filters returns to the chat with the thread intact.
- **Out of scope:** opening Filters on the tapped field. That's plan 022's job, and `onOpenFilters(field)` already passes the field through, so keep passing it.

## Current state (after PR #67)

- `apps/mobile/src/screens/chat/ChatScreen.tsx` calls `useAgentChat(draft, apply)`. Its `messages` and `sessionId` (a `useRef`) die when the sheet unmounts.
- `HomeScreen` owns the `sheet` state. It mounts `ChatScreen` outside the RN `Modal` that Filters and Fly use. On Android the chat is a Compose `ModalBottomSheet` at about 85% height.
- On a chip tap, `onOpenFilters(field)` closes the chat and opens Filters.
- `useAgentChat` (`packages/client-react/src/use-agent-chat.ts`) returns `{ messages, pending, error, send, lastPlan }`. It resets when the `api` instance changes.

## Scope

**In:**
- `apps/mobile/src/screens/home/*`;
- `apps/mobile/src/screens/chat/*`;
- the Filters and Fly sheet mounting, only where it's needed so Filters can stack over the chat.

**Out:**
- `packages/client-react` and `packages/shared` (no hook or contract change);
- the server;
- persistence (AsyncStorage etc.);
- plan 022's field targeting;
- iOS (parked in the backlog; see "Backlog: iOS").

## Steps

1. **Lift the chat state.**
   - Call `useAgentChat` once in `HomeScreen`, or in a small session-scoped provider mounted around Home, with the same `draft` and `apply` that `ChatScreen` uses today.
   - Pass `{ messages, pending, error, send, lastPlan }` down to `ChatScreen` as props.
   - `ChatScreen` no longer calls the hook.
2. **Keep the chat on a chip tap.**
   - `onOpenFilters(field)` opens Filters without throwing the thread away.
   - Pick whichever of these works on Android:
     - (a) Filters stacks over the open chat. This means mounting Filters so it renders above the Compose `ModalBottomSheet`.
     - (b) The chat hides, Filters opens, and closing Filters reopens the chat automatically.
   - Either way, the user lands back in the chat with the same messages. Say in the PR which option you used and why.
3. **Reopening the chat** later in the same session shows the earlier messages and keeps using the same `sessionId`. Check this by sending a follow-up that relies on context.
4. **Verify.**
   - Run `npm run check`.
   - On the Android phone (ship-plan's adb recipe), capture screenshots of:
     - a chat with a few messages;
     - Filters opened from a chip;
     - back in the chat with the thread intact;
     - after closing and reopening the chat.
5. **Bookkeeping.** Update this plan's status and its `plans/README.md` row. The PR closes this plan's issue.

## STOP conditions

- Keeping the thread would need a change to `useAgentChat` or the shared contract.
- Neither option (a) nor (b) can be made to work on Android with the Compose sheet.

## Done criteria

- [ ] Tapping an agent chip opens Filters, and closing Filters returns to the chat with the same messages.
- [ ] Closing and reopening the chat in the same app session keeps the messages and the agent session.
- [ ] Restarting the app starts a fresh chat.
- [ ] Android visual proof in the PR; `npm run check` exits 0.

## Backlog: iOS

iOS is parked in the backlog (@Cattn, 2026-11-14): the mobile app is Android-only until it comes back out. Nothing here is scheduled.

- Check that the thread survives a chip tap into Filters and a close/reopen with the iOS chat sheet (plan 023's backlog), using whichever option (a) or (b) Android shipped.
