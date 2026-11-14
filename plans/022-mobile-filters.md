# Plan 022: Edit trip filters in the Android full sheet

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If a STOP condition occurs, stop and report. When done, update
> this plan's row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat bd41542..HEAD -- apps/mobile/src/screens/filters packages/shared/src/domain/trip-draft.ts packages/shared/src/client/trip-draft-state.ts`
> Plan 020 must have created `apps/mobile/src/screens/filters/FiltersScreen.tsx`. If the draft helpers in Current state are gone, STOP.

## Status

- **Priority**: P1
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans/020-mobile-map-home.md (merged #60) and plan 023 (merged #67), plan 021 (merged #66: Results, its Filters chip and `plan` are on main). Plan 034 (chat kept for the session, @Cattn) runs in parallel and also touches Home's sheet state: rebase on it before opening the PR.
- **Category**: implementation (first-pass UI)
- **Planned at**: commit `bd41542`, 2026-11-14; refreshed at `3a55b10` (021 and 023 merged; Material components; open on the tapped field)
- **Issue**: https://github.com/Cattn/transit-agent/issues/46

<!-- help:start -->
## Who's on it & how to help

- **Status:** **MVP, in review (PR #74).** Visual target: Figma frame 03 Filters, Android, exactly. **Scope added 2026-11-14 (D12):** the Drive chip in Modes and the two-segment Transit / Fly control on Home (Step 4).
- **Owner:** @DMFriends (2026-11-14; moved from @Cattn, originally @Rad1ee). DMFriends built Home (020) and Results (021), which this sheet sits on. Fly (024) waits until this is done.
- **Visual proof:** the PR must show each primary feature of this plan working, as screenshots or a video, ideally about 4 pieces of media (more is fine when needed). Attach them with `gh pr create/edit --attach` (gh 2.104+).
- **Up for grabs?** No. Talk to @DMFriends before starting related work.
- **Waiting on:** nothing for the home shell (plan 020 merged in #60, `51b33a0`). Not on the server.

**Questions** — all answered by @Cattn ([#46](https://github.com/Cattn/transit-agent/issues/46), 2026-11-14).

- ~~022-Q1~~ **Decided:** yes, the Android full-height sheet as drawn (replaces Home's RN `Modal` `pageSheet` for Filters).
- ~~022-Q2~~ **Decided:** yes, keep each screen's wording (Filters: On time / Bit late OK / Flexible; Settings keeps its own).
- ~~022-Q3~~ **Decided:** yes, place search stays inside the sheet.
- ~~022-Q4~~ **Decided — changes from the frame:** (a) ~~no car chip under Modes~~ **superseded by D12: the car chip comes back as the Drive filter** (see Modes and Step 4); (b) **Advanced limits start collapsed**; (c) the **Agent mark** goes on every field the agent set or recommended (provenance `'agent'`), not only the ones drawn; (d) **no Budget control** at all: budget is not a hard limit.

**How to help**
- **Take it:** comment "taking this" and assign yourself.
- **With a coding agent:** pull `main`, then:
  > Read `plans/022-mobile-filters.md` and follow it step by step. Only change files under Scope. Stop on a STOP condition. Don't push.

<!-- help:end -->

## This plan will change

First Figma pass, read 2026-11-14. The sheet layout is the part most likely to be redrawn. Re-read the issue before building. If the filters frame changes, replace **Current state**. Keep writing through `applyDraftPatch` with source `'user'`.

## Why this matters

Filters and the agent edit one `TripDraft`. Hard limits exclude routes. Preference sliders only rank them. Figma draws those differently: limits sit in their own Advanced limits section, and the section title is "Preferences (rank, never exclude)". **No lock icons anywhere** (the Figma was updated; @Cattn's review of PR #74, 2026-11-14). This is UI slice 2, with the layout from frame **03 Filters**.

## Current state

- Frames: `Android · 03 Filters (full sheet, scrolled length)` (`2004:1253`) and its dark twin `2018:1721`.
- Android sheet (`2004:1341`): title "Trip filters", close icon, "Reset", then:
  - Where & when: From "Current location · Beacon Hill", To "Office · 200 Clarendon St", a Depart / Arrive segmented control, and the time "9:00 AM" (no lock icon).
  - Modes: filter chips for walk, bus, train, bike and **Drive** (the car chip the frame draws, icon `directions_car`, label "Drive"). **Transit / Fly, no Drive tab** (@Cattn, 2026-11-14; D12 in `plans/README.md`): Drive is a filter chip (`car` in `draft.modes`), off by default, that can be turned on under Transit or Fly so a trip can include driving part of the way. The Drive chip adds or removes `car` in `draft.modes`. It is off for a new draft and shows under both Transit and Fly. Map chips to `draft.modes`; leave any mode without a chip untouched in the draft (for example `flight` under Fly). At least one mode stays on. Walk, bus, and rail start selected for a new draft (`TripDraftSchema` default).
  - "How strict is the arrival time?" Material segmented button with the labels "On time", "Bit late OK", "Flexible". Map them to `preferences.lateTolerance`: `strict`, `some`, `flexible`.
  - Three sliders: Cheaper ↔ Comfier (`comfortVsCost`), Safe transfers ↔ Tight (`transferRisk`), Less walking ↔ More (`activeTravel`). Values are 0..1. Any control whose provenance key is `'agent'` shows the "Agent" mark (022-Q4: every agent-set or agent-recommended field, not only the walking slider drawn in the frame), e.g. `provenance['preferences.activeTravel'] === 'agent'`.
  - Advanced limits, **collapsed by default** (022-Q4; the frame draws them expanded). Opening Filters on a limit field from an agent chip expands them. Rows: Max walk ("15 min", agent mark when set by the agent), Max transfers ("1"), Step-free access ("Off"). **Build this section from the current Figma frame `2004:1253`, not from this text** (@Cattn's review of PR #74, 2026-11-14: the Advanced limits section was far off the frame); where this text and the frame disagree on layout, the frame wins, except the 022-Q4 decisions. **No Budget row** (022-Q4: budget is not a hard limit; leave any budget constraint in the draft untouched, and do not change `packages/shared`). Clearing a limit sends `null` in the patch, not `0`.
  - Footer: "3 routes match" / "1 almost works" from the latest plan response when plan 021 has run, otherwise hide the counts. Button "Show routes" closes the sheet and leaves the results sheet up.
- `applyDraftPatch` is the only writer. Source is `'user'` for every control in this screen. An agent chip disappears once the user edits that field, because the reducer records the new source. Do not delete the chip by hand.
- Provenance keys look like `constraints.maxWalkMinutes` and `preferences.activeTravel` (`packages/shared/src/client/trip-draft-state.ts`).
- Place search: From and To open a list. Use `usePlaceSearch` from `@transit/client-react`. (Against the real server this needs plan 028's `/api/places`.) Do not send a query shorter than 3 characters. Picking a row applies `{ origin }` or `{ destination }` with source `'user'`. "Use my location" on From calls `getCurrentPlace` on tap (plan 018, merged in #37); the app may also request foreground location permission at launch without a tap. On `{ ok: true, place }`, apply `{ origin: place }` with source `'user'`. On denied or unavailable, keep the draft and show a short message.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run typecheck -w @transit/mobile` | exit 0 |
| Lint | `npm run lint` | exit 0 |

## Scope

**In scope:**
- `apps/mobile/src/screens/filters/FiltersScreen.tsx`
- `apps/mobile/src/screens/filters/FiltersChrome.tsx` (plain fallback, see Step 2)
- `apps/mobile/src/screens/filters/FiltersChrome.android.tsx`
- `apps/mobile/src/screens/filters/PlaceField.tsx`
- `apps/mobile/src/screens/home/HomeScreen.tsx` (the flag that presents Filters, the tapped field, and the mode-control handler in Step 4)
- `apps/mobile/src/screens/home/ModeSlider.tsx`, `HomeChrome.android.tsx`, `HomeChrome.ios.tsx` (Step 4 only: drop the Drive segment; no iOS design work)

**Out of scope:** `packages/shared/**` (leave `modeGroups.drive` in place; the app stops using it), `apps/mobile/src/platform/**`, `app.json` plugins, results cards (plan 021), settings rows (plan 025).

## Git workflow

- Branch: `plan/022-mobile-filters`
- One commit: `mobile: edit trip filters in the full sheet (plan 022)`.
- Do not push unless told.

## Steps

### Step 1: Shared filter state

`FiltersScreen.tsx` reads the draft from the callback props Home passes: `draft`, `provenance`, `apply`, and an optional `field` (a provenance key such as `constraints.maxWalkMinutes`). **Open on the tapped field:** the agent's chips call `onOpenFilters(field)` (plan 023), but Home currently drops the argument (`onOpenFilters={() => setSheet('filters')}` in `apps/mobile/src/screens/home/HomeScreen.tsx`). Keep the field in Home state, pass it to `FiltersScreen`, and scroll to (and expand, for Advanced limits) that section. The Results Filters chip passes no field and opens at the top. Every control calls `apply` with a `TripDraftPatch` and `'user'`. Reset calls `apply` to set modes back to `['walk', 'bus', 'rail']` (plus `flight` when the draft has it, so Reset under Fly stays on Fly; Drive turns off), `preferences` back to the schema defaults (`comfortVsCost` 0.5, `transferRisk` 0.3, `lateTolerance` `'some'`, `activeTravel` 0.5), and each constraint key to `null`.

**Verify**: `npm run typecheck -w @transit/mobile` → exit 0

### Step 2: Android full sheet

`FiltersChrome.android.tsx` is a full-height surface with a drag handle and the sections in Current state, built with **Expo UI Jetpack Compose** components per plan 020's "Android Material 3 rules" and the `expo-ui` skill (@Cattn's review of PR #66: no hand-styled stand-ins for components Material 3 has): `FilterChip` for modes, `SingleChoiceSegmentedButtonRow` for Depart/Arrive and for the strictness choice, `Slider` for the three preferences, `Switch` for step-free access, `ListItem` rows for the limits, Material Symbols icons (no lock icons) and theme colors. Do not install `@react-native-community/slider` or use React Native's `Switch`. If the installed `@expo/ui` has no Compose `Slider`, STOP and ask @Cattn instead of adding a package. Match Figma frame 03 Filters exactly. Next to it, a plain `FiltersChrome.tsx` with the same props (no Compose, minimal styling) so `npm run build:mobile`, which still exports iOS, keeps bundling. Do no iOS design work.

**Verify**: `npm run typecheck -w @transit/mobile` → exit 0

### Step 3: Show routes

"Show routes" closes Filters and asks Home to show Results (plan 021, on main). The footer counts come from Home's current `plan` (the agent's `currentPlan` or the search Results ran); hide them while it is loading. Do not call the client directly from Filters.

**Verify**: `npm run lint` → exit 0

### Step 4: Transit / Fly control and the Drive filter (D12)

**Transit / Fly, no Drive tab** (@Cattn, 2026-11-14; D12 in `plans/README.md`): Drive is a filter chip (`car` in `draft.modes`), off by default, that can be turned on under Transit or Fly so a trip can include driving part of the way.

- `ModeSlider.tsx`: `ModeGroupName` is `'transit' | 'fly'`; `MODE_OPTIONS` has Transit and Fly only. `groupForModes` returns `'fly'` when `flight` is in the modes, otherwise `'transit'` (a car-only draft from the agent shows as Transit with Drive on).
- `modesForGroup(group, currentModes)` takes `modeGroups[group]` without `car`, then adds `car` back only if `currentModes` has it. So switching Transit ⇄ Fly keeps the Drive choice, and Fly no longer turns driving on by itself.
- `HomeChrome.android.tsx`: the `SingleChoiceSegmentedButtonRow` has two segments (bus and airplane icons); remove the `drive` entry from `MODE_ICONS`. `HomeChrome.ios.tsx` only needs to keep compiling.
- `HomeScreen.tsx`: pass the current modes into `modesForGroup`. Switching must still keep from, to and time.
- The Figma Home frames may still draw three segments. This rule wins for the mode control; everything else on Home follows the frame.

**Verify**: `npm run typecheck -w @transit/mobile` and `npm run lint` → exit 0. On the phone: Home shows Transit / Fly; Drive chip on, switch to Fly and back, Drive is still on.

## Test plan

Do not add tests or a runner. Run the typecheck and lint commands above.

## Done criteria

- [ ] `npm run typecheck -w @transit/mobile` exits 0
- [ ] `npm run lint` exits 0
- [ ] Android shows the full sheet, not `presentationStyle="formSheet"`
- [ ] A hard limit control sends `null` when cleared
- [ ] `lateTolerance` and `transferRisk` are two controls
- [ ] Drive chip in Modes (off by default, kept across Transit ⇄ Fly); no Budget row; Advanced limits start collapsed
- [ ] Home's mode control is Transit / Fly only
- [ ] No files outside Scope are modified

## STOP conditions

- `applyDraftPatch` is missing.
- You are about to add `expo-location` or edit `src/platform`.
- The filters frame in Figma no longer says "full sheet" on Android.

## Maintenance notes

When a question is answered or a frame changes, update this same plan and its issue. Strike answered questions and keep the decision and source link. Do not open a second plan for the same screen.

- New optional constraints stay `null` when cleared.
- The agent chip is provenance. Do not store a second "set by agent" flag.

## Open questions for review

See the help box at the top (022-Q*). It is the single list; answers are recorded there.

## Backlog: iOS

iOS is parked in the backlog (@Cattn, 2026-11-14): iOS stays functional through existing fallbacks; iOS-specific design is deferred. Keep the iOS bundle export passing.

- Frames: `iOS · 03 Filters (form sheet, scrolled length)` (`2011:446`) and its dark twin `2019:1422` on the [Figma](https://www.figma.com/design/noG2YImxFJKauBOvC1TLjb/Transit-Agent-Design-Mockups) page `iOS — Liquid Glass` (`12:3`).
- Present Filters with React Native `Modal` `presentationStyle="formSheet"` on iOS only, from a `FiltersChrome.ios.tsx`.
- Inset-grouped form sheet, not a Material list: glass circular Close and Reset buttons (`BlurView`), title "Trip Filters"; uppercase section labels "WHERE & WHEN", "MODES", "HOW STRICT IS 9:00?", "PREFERENCES · RANK, NEVER EXCLUDE"; mode capsules with a checkmark when selected; sliders as inset rows; strictness as three buttons "On time" / "Bit late OK" / "Flexible"; "Show routes" as the bottom button.
