# Plan 022: Edit trip filters in the Android full sheet and the iOS form sheet

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
- **Depends on**: plans/020-mobile-map-home.md. Plan 021's Filters chip should open this screen. You may stub that chip if 021 has not merged: Home gets a temporary "Filters" text button.
- **Category**: implementation (first-pass UI)
- **Planned at**: commit `bd41542`, 2026-11-14
- **Issue**: https://github.com/Cattn/transit-agent/issues/46

<!-- help:start -->
## Who's on it & how to help

- **Status:** 📝 **First draft, after plan 020.** Feedback welcome. Build with the defaults until a question is answered.
- **Owner:** Nobody yet. Suggested: @Rad1ee @DMFriends
- **Up for grabs?** Yes, for UI.
- **Waiting on:** The home shell. Not on the server.

**Open questions** — @Rad1ee @DMFriends: reply as `022-Q1: ...`. Use the proposed defaults until answered.

- 022-Q1: iOS form sheet and Android full sheet, as drawn? *(proposed: yes)*
- 022-Q2: keep each screen's own strictness words? *(proposed: yes)*
- 022-Q3: place search stays inside this sheet? *(proposed: yes)*
- 022-Q4: which controls should change before a first build?

**How to help**
- **Take it:** comment "taking this" and assign yourself.
- **With a coding agent:** pull `main`, then:
  > Read `plans/022-mobile-filters.md` and follow it step by step. Only change files under Scope. Stop on a STOP condition. Don't push.

<!-- help:end -->

## This plan will change

First Figma pass, read 2026-11-14. The sheet layout is the part most likely to be redrawn. Re-read the issue before building. If the filters frame changes, replace **Current state**. Keep writing through `applyDraftPatch` with source `'user'`.

## Why this matters

Filters and the agent edit one `TripDraft`. Hard limits exclude routes. Preference sliders only rank them. Figma draws those differently: a lock on hard limits, and the section title "Preferences (rank, never exclude)". This is UI slice 2, with the layout from frame **03 Filters**.

## Current state

- Frames: `Android · 03 Filters (full sheet, scrolled length)` (`2004:1253`) and its dark twin `2018:1721`. `iOS · 03 Filters (form sheet, scrolled length)` (`2011:446`) and its dark twin `2019:1422`.
- Android sheet (`2004:1341`): title "Trip filters", close icon, "Reset", then:
  - Where & when: From "Current location · Beacon Hill", To "Office · 200 Clarendon St", a Depart / Arrive segmented control, and a locked time "9:00 AM".
  - Modes: filter chips. The drawn selected set is the product default walk, bus, and train, plus bike and car available. Map chips to `draft.modes`. At least one mode stays on. Walk, bus, and rail start selected for a new draft (`TripDraftSchema` default).
  - "How strict is the arrival time?" segmented control. iOS labels in the same control are "On time", "Bit late OK", "Flexible". Android may use the Material segmented button with those three labels. Map them to `preferences.lateTolerance`: `strict`, `some`, `flexible`.
  - Three sliders: Cheaper ↔ Comfier (`comfortVsCost`), Safe transfers ↔ Tight (`transferRisk`), Less walking ↔ More (`activeTravel`). Values are 0..1. The walking slider shows an "Agent" mark when `provenance['preferences.activeTravel'] === 'agent'`.
  - Advanced limits, expanded in the frame: Max walk (lock, "15 min", agent edit icon), Max transfers (lock, "1"), Budget (lock, "$10"), Step-free access (lock, "Off"). Locks are the visual for constraints. Clearing a limit sends `null` in the patch, not `0`.
  - Footer: "3 routes match" / "1 almost works" from the latest plan response when plan 021 has run, otherwise hide the counts. Button "Show routes" closes the sheet and leaves the results sheet up.
- iOS is an inset-grouped form sheet, not a Material list:
  - Close and Reset are glass circular buttons. Title "Trip Filters".
  - Section labels are uppercase: "WHERE & WHEN", "MODES", "HOW STRICT IS 9:00?", "PREFERENCES · RANK, NEVER EXCLUDE".
  - Mode choices are capsules with a checkmark when selected.
  - Sliders are inset rows. The strictness control is a segmented control with "On time" / "Bit late OK" / "Flexible".
  - "Show routes" is the bottom button.
- `applyDraftPatch` is the only writer. Source is `'user'` for every control in this screen. An agent chip disappears once the user edits that field, because the reducer records the new source. Do not delete the chip by hand.
- Provenance keys look like `constraints.maxWalkMinutes` and `preferences.activeTravel` (`packages/shared/src/client/trip-draft-state.ts`).
- Place search: From and To open a list. Use `searchPlaces` on the mock client, or `usePlaceSearch` if plan 015 exported it. Do not send a query shorter than 3 characters. Picking a row applies `{ origin }` or `{ destination }` with source `'user'`. "Use my location" on From calls `getCurrentPlace` only on that tap, (plan 018, merged in #37; never at launch). On `{ ok: true, place }`, apply `{ origin: place }` with source `'user'`. On denied or unavailable, keep the draft and show a short message.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run typecheck -w @transit/mobile` | exit 0 |
| Lint | `npm run lint` | exit 0 |

## Scope

**In scope:**
- `apps/mobile/src/screens/filters/FiltersScreen.tsx`
- `apps/mobile/src/screens/filters/FiltersChrome.ios.tsx`
- `apps/mobile/src/screens/filters/FiltersChrome.android.tsx`
- `apps/mobile/src/screens/filters/PlaceField.tsx`
- `apps/mobile/src/screens/home/HomeScreen.tsx` (only the flag that presents Filters)
- `apps/mobile/package.json` and `package-lock.json` (only `@react-native-community/slider` from Step 2)

**Out of scope:** `packages/shared/**`, `apps/mobile/src/platform/**`, `app.json` plugins, results cards (plan 021), settings rows (plan 025).

## Git workflow

- Branch: `plan/022-mobile-filters`
- One commit: `mobile: edit trip filters in the platform sheet (plan 022)`.
- Do not push unless told.

## Steps

### Step 1: Shared filter state

`FiltersScreen.tsx` reads the draft from the callback props Home passes: `draft`, `provenance`, `apply`. Every control calls `apply` with a `TripDraftPatch` and `'user'`. Reset calls `apply` to set modes back to `['walk', 'bus', 'rail']`, `preferences` back to the schema defaults (`comfortVsCost` 0.5, `transferRisk` 0.3, `lateTolerance` `'some'`, `activeTravel` 0.5), and each constraint key to `null`.

**Verify**: `npm run typecheck -w @transit/mobile` → exit 0

### Step 2: Android full sheet

`FiltersChrome.android.tsx` is a full-height surface with a drag handle, the sections in Current state, `Switch` from `react-native` for step-free access, and `Slider` from `@react-native-community/slider`. If it is not already installed, install it with `npx expo install @react-native-community/slider` in `apps/mobile`. One slider component, used by both platforms.

**Verify**: `npm run typecheck -w @transit/mobile` → exit 0

### Step 3: iOS form sheet

Present Filters with React Native `Modal` `presentationStyle="formSheet"` on iOS. Do not use that presentation on Android. `FiltersChrome.ios.tsx` uses inset grouped sections and `BlurView` on the nav buttons. The segmented strictness control is three buttons, not a Material segmented button.

**Verify**: `npm run lint` → exit 0

### Step 4: Show routes

"Show routes" closes Filters and asks Home to show Results (plan 021). If 021 has not merged, Home still unmounts Filters. Do not call the network. The mock client is enough.

## Test plan

Do not add tests or a runner. Run the typecheck and lint commands above.

## Done criteria

- [ ] `npm run typecheck -w @transit/mobile` exits 0
- [ ] `npm run lint` exits 0
- [ ] iOS uses `presentationStyle="formSheet"`. Android does not.
- [ ] A hard limit control sends `null` when cleared
- [ ] `lateTolerance` and `transferRisk` are two controls
- [ ] No files outside Scope are modified

## STOP conditions

- `applyDraftPatch` is missing.
- You are about to add `expo-location` or edit `src/platform`.
- The filters frame in Figma no longer says "form sheet" on iOS or "full sheet" on Android.

## Maintenance notes

When a question is answered or a frame changes, update this same plan and its issue. Strike answered questions and keep the decision and source link. Do not open a second plan for the same screen.

- New optional constraints stay `null` when cleared.
- The agent chip is provenance. Do not store a second "set by agent" flag.

## Open questions for review

- 022-Q1: iOS form sheet and Android full sheet, as drawn? *(proposed: yes)*
- 022-Q2: keep each screen's own strictness words? *(proposed: yes)*
- 022-Q3: place search stays inside this sheet? *(proposed: yes)*
- 022-Q4: which controls should change before a first build?
