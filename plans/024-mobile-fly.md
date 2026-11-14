# Plan 024: Compare door-to-door options when Fly is selected

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If a STOP condition occurs, stop and report. When done, update
> this plan's row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat bd41542..HEAD -- apps/mobile/src/screens/fly packages/shared/src/client/mock/mock-routes.ts`
> Plan 020 must already present a fly screen when the mode group is `fly`. If that hook does not exist, STOP.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/020-mobile-map-home.md. Data for real fares is plan 011, which is not on main. This screen must work with whatever `planTrip` returns today.
- **Category**: implementation (first-pass UI)
- **Planned at**: commit `bd41542`, 2026-11-14
- **Issue**: https://github.com/Cattn/transit-agent/issues/44

<!-- help:start -->
## Who's on it & how to help

- **Status:** 📝 **First draft, after plan 020.** Feedback welcome. Do not start plan 011 from this screen.
- **Owner:** @DMFriends (assigned 2026-11-14 from the build timeline)
- **Up for grabs?** No. Talk to @DMFriends before starting related work.
- **Waiting on:** The home shell. Not on flight prices.

**Open questions** — **@DMFriends answers these.** Reply as `024-Q1: ...`. Use the proposed defaults until answered.

- 024-Q1: empty state until the data has a flight, rather than painted sample cards? *(proposed: yes)*
- 024-Q2: show a rail-only result in this list, labeled from `routeName`? *(proposed: yes)*
- 024-Q3: use component `2006:733` as field order only? *(proposed: yes)*
- 024-Q4: what should wait for a later Figma pass?

**How to help**
- **Take it:** comment "taking this" and assign yourself.
- **With a coding agent:** pull `main`, then:
  > Read `plans/024-mobile-fly.md` and follow it step by step. Only change files under Scope. Stop on a STOP condition. Don't push. When an answered question changes a step, update this same plan before building.
- **Just feedback:** answer by question number, or name the frame that feels wrong.

<!-- help:end -->

## This plan will change

First Figma pass, read 2026-11-14. The door-to-door layout is a draft, and the sample prices are not a data source. Re-read the issue before building. If the fly frame is redrawn, replace **Current state**. Keep sorting the list the client already has. Do not add a fare provider.

## Why this matters

Choosing Fly keeps the same trip (from, to, time) and changes `draft.modes` to the fly group. The sheet compares whole journeys, including the ride to the airport. Caption on both pages: door-to-door, including an Amtrak option (#15). Booking stays out.

## Current state

- Frames: `Android · 05 Fly — door-to-door` (`2006:748`) and dark twin `2018:2307`. `iOS · 05 Fly` (`2012:677`) and dark twin `2019:1851`.
- Shared content:
  - Trip line "Boston → Washington, DC" and "Fri, Nov 20 · arrive by 2:00 PM" are the sample. Bind the title to origin and destination names, and the subtitle to the draft time. If either place is missing, show "Add where and when".
  - Android title "Door-to-door, all options". iOS title "Door-to-Door". Subtitle on both: "Includes getting to the airport, security and parking".
  - Sort chips: Total time, Total cost, Fewest legs. Sort the array you already have. Do not search again.
  - Footer. Android: "~ fares are estimates from sample data · checked 2 min ago". iOS: "~ fares are estimates from sample data · 2 min ago". Show the "~" sentence only when some `cost.lines` entry has `estimated: true`, or when the list is the empty state above. Use `formatAge(source.fetchedAt, new Date())` from plan 016. Hide the age when no itinerary exists; do not show a checked time on an empty state.
- iOS vs Android: iOS glass sheet and grabber. Android Material sheet and drag handle. Same list.
- Component `2006:733` default props, for field order only: code "BOS", title "Fly from Logan", total time "4h 05m", breakdown "Blue Line 25m · airport buffer 1h 15m · flight 1h 35m · Metro 25m", cost "fare $129 + T $2.40", tag "Best overall", total "~$131". Those strings are the draft's example. They are not mock data.
- `modeGroups.fly` is `['walk', 'car', 'rail', 'bus', 'flight']` (`packages/shared/src/domain/modes.ts`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run typecheck -w @transit/mobile` | exit 0 |
| Lint | `npm run lint` | exit 0 |

## Scope

**In scope:**
- `apps/mobile/src/screens/fly/FlyScreen.tsx`
- `apps/mobile/src/screens/fly/FlyChrome.ios.tsx`
- `apps/mobile/src/screens/fly/FlyChrome.android.tsx`
- `apps/mobile/src/screens/home/HomeScreen.tsx` (only the flag that shows Fly when the mode group is `fly`)

**Out of scope:** `apps/server/**`, `packages/shared/**`, booking, a payment screen, plan 011's provider.

## Git workflow

- Branch: `plan/024-mobile-fly`
- One commit: `mobile: show door-to-door options when Fly is selected (plan 024)`.
- Do not push unless told.

## Steps

### Step 1: List

When the mode group is `fly` and `toTripRequest(draft)` is `ok`, call `run(request)` from `usePlanTrip()` (`@transit/client-react`). Render itineraries that contain a `flight` leg with the field order in Current state. Render a rail itinerary with no flight leg in the same list. If neither exists, show the empty sentence from question 1. Do not paste the Logan card.

**Verify**: `npm run typecheck -w @transit/mobile` → exit 0

### Step 2: Platform chrome

iOS uses `BlurView`. Android uses the theme surface. Sort chips reorder the same array: duration, then `cost.totalUsd`, then leg count.

**Verify**: `npm run lint` → exit 0

## Test plan

Do not add tests or a runner. Run the typecheck and lint commands above.

## Done criteria

- [ ] `npm run typecheck -w @transit/mobile` exits 0
- [ ] `npm run lint` exits 0
- [ ] The screen does not contain the hard-coded fare `$131` or the title "Fly from Logan" unless an itinerary's own fields produce them
- [ ] No server file is modified

## STOP conditions

- You are about to add `apps/server/src/flights` or a fare fixture so the cards look full.
- Plan 020 has no way to open this screen.
- The fly frame was removed from Figma. Stop and say so, so this plan can be rewritten.

## Maintenance notes

When a question is answered or a frame changes, update this same plan and its issue. Strike answered questions and keep the decision and source link. Do not open a second plan for the same screen.

- When plan 011 lands, this screen should start showing real itineraries without a new layout plan, unless the frame has changed. If the frame has changed, edit this file first.
- Amtrak stays a ground competitor from the data, matching the #15 decision. Do not drop that when the visual is redrawn.

## Open questions for review

See the help box at the top (024-Q*). It is the single list; answers are recorded there.
