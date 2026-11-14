# Plan 027: Show web results beside the permanent agent

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If a STOP condition occurs, stop and report. When done, update
> this plan's row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat bd41542..HEAD -- apps/web/src`
> Plan 026 must already have the two panels. If `apps/web/src/home/AgentPanel.tsx` does not exist, STOP.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/026-web-map-home.md
- **Category**: implementation (first-pass UI)
- **Planned at**: commit `bd41542`, 2026-11-14; refreshed at `1e8328a` (use the merged hooks; this plan closes the MVP loop)
- **Issue**: https://github.com/Cattn/transit-agent/issues/45

<!-- help:start -->
## Who's on it & how to help

- **Status:** 📝 **First draft, after plan 026.** Feedback welcome. There is still no web filters frame. "All filters" is a chip with nowhere to go.
- **Owner:** Nobody yet. Suggested: @Rad1ee @DMFriends
- **Up for grabs?** Yes, once 026 is on the branch you are using.
- **Waiting on:** The web home shell (026). Plan 028 (`/api/places`) is needed only for Step 3's real-server check.

**Open questions** — @Rad1ee @DMFriends: reply as `027-Q1: ...`. Use the proposed defaults until answered.

- 027-Q1: "All filters" does not open a page yet? *(proposed: yes)*
- ~~027-Q2~~ **Decided ([#24](https://github.com/Cattn/transit-agent/issues/24#issuecomment-6872458297)):** keep plan 016 wording, including "Safe / Some risk / Tight" and "Scheduled (not live)".
- 027-Q3: Share copies the summary and does nothing else? *(proposed: yes)*
- 027-Q4: quick replies come from the agent response, and "Yes, watch it" saves with `watch: true`? *(proposed: yes)*
- 027-Q5: what in this frame should change first?

**How to help**
- **Take it:** comment "taking this" and assign yourself.
- **With a coding agent:** pull `main`, then:
  > Read `plans/027-web-planning.md` and follow it step by step. Only change files under Scope. Stop on a STOP condition. Don't push. When an answered question changes a step, update this same plan before building.
- **Just feedback:** answer by question number.

<!-- help:end -->

## This plan will change

First Figma pass, read 2026-11-14. Results, the agent thread, and the map card are one frame and will be redrawn together. Re-read the issue before building. Replace **Current state** when the frame changes. Keep freshness honest.

## Why this matters

After a search, the left panel becomes the result list and the agent stays put. That is `Web · 02 Planning — results + agent`. The map keeps showing the routes. The selected one is also a small card over the map.

## Current state

- Frames: `Web · 02 Planning — results + agent` (`2028:247`) and `Web · Dark · 02 Planning — results + agent` (`2028:1118`).
- Left panel:
  - From "Current location", To "Office · 200 Clarendon St", a swap control. Bind to the draft. Swap uses `applyDraftPatch` with source `'user'`.
  - Segmented Transit / Drive / Fly, same rule as plan 026.
  - Chips: "Arrive by 9:00", "Agent: walk ≤ 15 min", "Cheaper", "All filters". The first three come from the draft (time, provenance on `constraints.maxWalkMinutes`, and `comfortVsCost` under 0.35). The agent chip clears that field back to the user when clicked, by applying the same value with source `'user'`. "All filters" follows question 1.
  - "3 routes" is `plan.itineraries.length`. Subtitle from the draft time. "updated 20s ago" from `source.fetchedAt`.
  - Warning banner. Render `plan.warnings[0]`. The sample sentence is "Green Line realtime unavailable — showing timetable".
  - Itinerary cards, then "Almost works" and `nearMisses`. Sample near-miss: "Walk the whole way · 8:04 – 8:49" / "45 min walk — breaks your 15 min limit" / "$0". Bind to the near-miss and `violations[0]`.
  - Empty scenario warning is `No routes found for this trip`. Offline: "You are offline". Server error: `ApiClientError.message`.
- Map card "Selected route card": "Leave by 8:04 · arrive 8:27", "Bus 1 live · $1.70 · low risk", Share, Save & watch. Bind times and cost to the selected itinerary. Save calls `saveItinerary({ itinerary, request, watch: true })` when `toTripRequest` is `ok`.
- Agent panel, same chrome as plan 026, with a thread once messages exist:
  - User sample: "Get me to the office by 9. I don't want to walk more than 15 minutes."
  - Agent: "Done — I updated the filters on the left:" plus chips from the patch, then "Bus 1 is best: leave by 8:04, arrive 8:27. It's highlighted on the map."
  - Question: "Want me to watch this trip and tell you when to leave?"
  - Quick replies in question 4.
  - Composer placeholder "Ask about this trip…".
  - Send uses `sendAgentMessage({ message, draft })` where `draft` is the `TripDraft`. Apply `draftPatch` with source `'agent'`. If `plan` is returned, show it in the left panel.
- Selecting a card sets `selectedItineraryId` on the map from plan 026. There is no separate detail page. Clicking a route on the map selects the card.
- Do not draw routes in the app.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run typecheck -w @transit/web` | exit 0 |
| Lint | `npm run lint` | exit 0 |

## Scope

**In scope:**
- `apps/web/src/home/Results.tsx`
- `apps/web/src/home/AgentPanel.tsx` (thread, not the empty state plan 026 owns)
- `apps/web/src/home/Home.tsx` (switch the left panel to results after a search)
- `apps/web/src/styles.css` (only rules for the new blocks)

**Out of scope:** a filters page, settings, `packages/shared/**`, `packages/maps/**`, mobile screens.

## Git workflow

- Branch: `plan/027-web-planning`
- One commit: `web: show results beside the agent panel (plan 027)`.
- Do not push unless told.

## Steps

### Step 1: Search

When origin, destination, and time are set, call `run(request)` from `usePlanTrip()` (plan 015). Build `request` with `toTripRequest(draft)`; when it is not `ok`, leave the home list up and do not search. The hook already keeps only the latest response. Use the client from plan 026's `src/data/client.ts`; do not create a second one.

**Verify**: `npm run typecheck -w @transit/web` → exit 0

### Step 2: List, card, thread

Render the left panel and the map card from Current state. Use `itineraryFreshness`, `legFreshness`, `formatCost`, and `riskBadge` from `@transit/shared` (plan 016, merged in #36). Keep "Safe / Some risk / Tight", "Scheduled (not live)", and "Estimated" exactly as returned.

The agent thread uses `useAgentChat(draft, apply)` (plan 015), the same hook plan 026 uses. When `lastPlan` changes, show it in the left panel.

**Verify**: `npm run lint` → exit 0

### Step 3: MVP check against the real server

This is the MVP milestone: type a request, see editable filters, see routes on the map, save one.

1. `npm run dev:server` (fixture routes; the agent needs `GEMINI_API_KEY` on that machine, or use Cattn's server via `VITE_API_URL`).
2. `VITE_API_MODE=server npm run dev:web`, open http://localhost:5173.
3. Type "Get me from MIT to South Station by 9 tomorrow" in the agent panel.

**Verify**: filter chips update with the agent provenance chip, ≥ 1 route is drawn on the map and listed on the left, "Save & watch" adds the trip to Tracked trips, and a page reload still shows it. Record the result (or the failing step) in the PR. If the server has no Gemini key, record that and run steps 1–2 with a typed From/To instead.

## Test plan

Do not add tests or a runner. Run the typecheck and lint commands above.

## Done criteria

- [ ] `npm run typecheck -w @transit/web` exits 0
- [ ] `npm run lint` exits 0
- [ ] A scheduled itinerary does not render "Live"
- [ ] "All filters" does not navigate to a new route
- [ ] Step 3's real-server check is recorded in the PR
- [ ] No files outside Scope are modified

## STOP conditions

- Plan 026's panels are missing.
- You are about to add a filters route or a Tailwind dependency.
- The planning frame was renamed or removed. Stop so this plan can be rewritten.

## Maintenance notes

When a question is answered or a frame changes, update this same plan and its issue. Strike answered questions and keep the decision and source link. Do not open a second plan for the same screen.

- A later web filters frame should become its own short plan, or a new step here after the question is answered. Do not copy the mobile form sheet onto the web and call it done.
- The sample agent sentences are the draft's example. The screen shows `response.reply`.

## Open questions for review

See the help box at the top (027-Q1 to 027-Q5). It is the single list; answers are recorded there.
