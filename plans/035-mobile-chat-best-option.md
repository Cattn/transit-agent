# Plan 035: Agent chat matches frame 04 (best-option card, chip icons)

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If a STOP condition occurs, stop and report. Do
> not improvise. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: PRs #69 (plan 034) and #72 must be merged. Compare Current state with `apps/mobile/src/screens/chat/` and `apps/mobile/src/screens/results/` on `main`. On a mismatch, STOP.

## Status

- **Owner:** @Cattn (mobile)
- **State:** TODO (waits on #69 and #72, which both change the chat)
- **Priority:** P1 (MVP polish: the chat should look like the mockup)
- **Effort:** S
- **Risk:** LOW (Android chat UI only; no contract or server change)
- **Depends on:** 023 (#67), 021 (#66), 034 (#69), and #72 (latest-turn chips)
- **Issue:** #73
- **Decision:** @Cattn, 2026-11-14. The chat must match Figma `Android · 04 Agent chat` (`2004:1571`) and `Android · Dark · 04 Agent chat` (`2018:2055`). This plan covers the two parts that plan 023 left out. iOS is in the backlog.

## Why this matters

PR #67 built the frame's header, the bubbles, the change chips, the question chips and the composer. It left out two parts of the mockup:

1. **The best-option card.** In the mockup, the agent's reply ("Done — I updated your trip:") ends with "Best option: Bus 1, leave by 8:04, arrive 8:27." and, inside the bubble, the same result card that Results shows: time range, duration, leg chips (walk 6 › Bus 1 › walk 5), Live · +1 min, price and the risk badge.
2. **Chip icons.** Each change chip ("Arrive by 9:00", "Max walk 15 min") has a leading check icon and a trailing pencil (edit) icon. Today the chips show a single `tune` icon.

## Out of scope (left as they are, @Cattn 2026-11-14)

- **The mic button** in the composer. Voice input isn't planned. Don't add a mic icon.
- **What "Yes, watch it / Only if delayed / No thanks" does.** These stay plain quick replies that send their text, as `questions[].options` already do. Real watching is plan 008.
- The server, the shared contract, `useAgentChat`, and iOS.

## Current state (main at `b26c290`, before #69 and #72)

- `apps/mobile/src/screens/chat/ChatChrome.android.tsx`: the agent bubble renders `entry.chips` as `AssistChip`s with a `Tune` leading icon. `onChip(field)` opens Filters on that field.
- `apps/mobile/src/screens/chat/ChatScreen.tsx`: `lastPlan` from the agent is forwarded to Home with `onPlan(plan, draft)`. Home keeps it as `currentPlan`, which is valid while `state.draft` is unchanged.
- `apps/mobile/src/screens/results/ItineraryCard.tsx`: `itineraryCardText(it, now, timeZone)` builds the card text, including leg chips, freshness, cost and risk, and `toneRole(tone)` maps risk to Material roles. `ResultsChrome.android.tsx` renders the Android Compose result card from that text.
- Icons in `apps/mobile/assets/icons/` include `check_fill.xml`, `edit_fill.xml` and `wand_shine_fill.xml`.
- After #69 the chat state lives in `useChatSession` at Home. After #72, chips are only shown for the fields the agent changed in its latest turn.

## Steps

1. **Reuse the result card.**
   - If the Android Compose result card is defined inline in `ResultsChrome.android.tsx`, move it into its own component in `screens/results/`, unchanged, so both Results and Chat can use it.
   - Don't fork its look. Use `itineraryCardText` and `toneRole` as Results does.
   - Results must look exactly the same after the move.
2. **Best-option card in the agent bubble.**
   - When an agent turn returns a plan, find its best itinerary: the first entry of `plan.itineraries`, the same one Results shows first.
   - Render that card inside that turn's agent bubble, below the reply text, in the same Material container style Results uses.
   - Only the turn that returned the plan gets the card. A later turn without a plan doesn't repeat it.
   - Tapping the card does the same as selecting it in Results: set `selectedItineraryId` and close the chat to show it on the map. If plan 034's return-to-chat behavior makes closing awkward, keep the chat open and only select it. Say which in the PR.
   - Route color: if the card shows the trip's color the way Results does, use the same `routeColors` map. Don't add a dot; Results doesn't have one (plan 021).
   - The "Best option: …" sentence comes from the agent's reply text; don't build it in the app.
3. **Chip icons.**
   - Each change chip gets a leading `check_fill` icon and a trailing `edit_fill` icon. Use `AssistChip.TrailingIcon` if Expo UI has it, otherwise the closest Compose chip slot; check the `.d.ts`.
   - Tapping still opens Filters on that field. Keep the theme colors.
4. **Fallback.** Keep `ChatChrome.tsx` building for the iOS export with no design work. If the card component is `.android.tsx` only, give it a plain fallback.
5. **Verify.**
   - Run `npm run check`.
   - On the Android phone, using ship-plan's adb recipe, capture in light and dark: an agent turn with change chips (check and pencil icons) and the best-option card. Also capture tapping the card. Use the mock client: the "office by 9, walk ≤ 15 min" prompt returns a plan.
   - Put the Figma frames next to the screenshots in the PR.
6. **Bookkeeping.** Update this plan's status and its `plans/README.md` row. The PR closes this plan's issue.

## STOP conditions

- The agent response doesn't carry a plan on the turn that changed the trip, so there's nothing to show without a contract or server change.
- Reusing the Results card would need changes to how Results looks.

## Done criteria

- [ ] An agent turn that returns a plan shows the best-option card inside its bubble, matching Results' card.
- [ ] Change chips show a check icon and a pencil icon and still open Filters on their field.
- [ ] No mic button; quick replies unchanged.
- [ ] Android light and dark screenshots next to the Figma frames in the PR; `npm run check` exits 0.
