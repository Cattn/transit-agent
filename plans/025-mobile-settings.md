# Plan 025: Add the mobile settings screen

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If a STOP condition occurs, stop and report. When done, update
> this plan's row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat bd41542..HEAD -- apps/mobile/src/screens/settings packages/shared/src/domain/profile.ts packages/shared/src/domain/trip-draft.ts`
> Plan 020 must already navigate to Settings. If `TravelProfileSchema` no longer has `home`, `work`, and `defaults`, STOP.

## Status

- **Priority**: P2
- **Effort**: L
- **Risk**: MED
- **Depends on**: plans/020-mobile-map-home.md (navigation and the appearance context). Reads the profile from plan 012's mock.
- **Category**: direction
- **Planned at**: commit `bd41542`, 2026-11-14
- **Issue**: https://github.com/Cattn/transit-agent/issues/41

<!-- help:start -->
## Who's on it & how to help

- **Status:** 📝 **First draft, after plan 020.** Feedback welcome. Several rows are drawn but have no field to save. Those stay visible and unsaved until the questions below are answered.
- **Owner:** Nobody yet. Suggested: @Rad1ee @DMFriends
- **Up for grabs?** Yes, for UI.
- **Waiting on:** The home shell. Not on plan 018. If device-id storage is missing, show a session id.

**Open questions** (answer `025-Q1: ...` on the issue):

1. "Watch saved trips", "Buffer before leave now", and "Agent can suggest the next option" are not fields on `TravelProfile`. *(proposed: show the rows, keep the toggle in component state, do not add schema fields in this plan)*
2. "Add a place" and the Gym chip have no profile slot. The schema has `home` and `work` only. *(proposed: Home and Work save. "Add a place" stays visible and does not save)*
3. Theme / Appearance offers System, Light, and Dark, writing plan 020's appearance context. *(proposed: yes. This is the toggle plan 017 asked the UI to own)*
4. iOS shows "Cheaper ↔ Comfier" as a row with the value "Balanced" and a chevron. Android shows the slider inline. *(proposed: follow each platform's frame)*
5. Which groups should be cut from the first build? Name them. This file will be edited.

**How to help**
- **Take it:** comment "taking this" and assign yourself.
- **With a coding agent:** pull `main`, then:
  > Read `plans/025-mobile-settings.md` and follow it step by step. Only change files under Scope. Stop on a STOP condition. Don't push. If an issue comment contradicts a step, follow the comment.
- **Just feedback:** answer by question number. Unsaved rows are intentional until you say otherwise.

<!-- help:end -->

## This plan will change

First Figma pass, read 2026-11-14. Settings is the longest frame and the most likely to lose or gain rows. Re-read the issue before building. If a row disappears from the frame, delete it from this plan. Do not invent a profile field to make a drawn row persist.

## Why this matters

One profile per device fills the next trip. The screen is pushed, not a sheet. iOS uses a large title and inset groups. Android uses a top app bar. Light and dark already exist as a second row of the same frames.

## Current state

- Frames: `Android · 06 Settings (scrolled length)` (`2016:1068`), dark twin `2018:2572`. `iOS · 06 Settings (scrolled length)` (`2017:795`), dark twin `2019:2043`.
- Profile card. Android: "This device's profile" and "One profile per device — no account needed. Your defaults fill every new trip." iOS: "This iPhone's Profile" and "One profile per device — no account needed. Defaults fill every new trip."
- Places: Home and Work. Sample subtitles "Beacon Hill, Boston" and "200 Clarendon St" are the draft. Show `profile.home.name` and `profile.work.name`, or "Not set". "Add a place" is drawn and, until 025-Q2 is answered, does not write.
- Trip defaults, saved on `profile.defaults` through `putProfile`:
  - Modes a new trip starts with. iOS capsules: Walk, Bus, Train checked; Bike and Car unchecked in the sample. That matches the schema default `['walk', 'bus', 'rail']`. At least one mode stays on.
  - Comfort. Android slider "Cheaper" / "Comfier" writes `preferences.comfortVsCost` (0..1). iOS row value "Balanced" when the value is 0.5, "Cheaper" when it is under 0.35, "Comfier" when it is over 0.65. Tapping the iOS row opens the same slider.
  - Max walk, lock, sample "15 min", subtitle "Hard limit" on Android. Writes `constraints.maxWalkMinutes`. Clearing sends `null`.
  - Max transfers, lock, sample "1". Writes `constraints.maxTransfers`. Clearing sends `null`.
  - Arrival strictness. Android subtitle "A little late is OK" for `some`. iOS value "Bit late OK" for `some`. `strict` is "Must be on time" on Android and "On time" on iOS. `flexible` is "Flexible" on both. Writes `preferences.lateTolerance`.
  - Step-free. Android "Step-free routes only". iOS "Step-Free Routes Only". `Switch` from `react-native`. Writes `constraints.wheelchairAccessible`.
- Vehicles, on `profile.defaults.vehicles`: "I have my own bike" (`ownsBike`, subtitle "Adds bike + transit options"), "I have a car" (`ownsCar`, subtitle "Unlocks Drive and park-and-ride"), fuel economy (`carMpg`). Sample "28 mpg" is the draft. If `carMpg` is unset, show "Not set", not 28.
- Leave reminders. Show the three rows from the frames. Do not persist them (025-Q1). iOS footer: "Watching uses live arrivals and tells you when to leave." iOS also has "Hard limits (lock) remove routes. Preferences only change the order." Show those sentences.
- Display. Time zone writes `defaults.timeZone`. Unset subtitle: Android "Trip's starting point", iOS "Trip start". Do not store `America/New_York` just because the sample shows it. Theme / Appearance writes the context from plan 020. Android row title "Theme", sample value "System (light / dark)". iOS row title "Appearance", sample value "System".
- About. Device id: if plan 018's storage exists, read it and show the first 8 characters, an ellipsis, and the last 3. Android adds "stored on this phone". If storage is missing, `createDeviceId()` once per session and the subtitle "for this session". Do not display the sample `dev_7f3a…c21`. Data sources is the static sentence "Sample data until live MBTA feeds land (#11)". Version is `apps/mobile/package.json` `"version"` (`0.1.0` at this writing). iOS shows that version. Android shows `0.1.0 (design)` only if you are looking at the mock; the app shows the package version.
- `getProfile()` on the mock returns `undefined` until `putProfile` is called. Start from an empty profile. `putProfile` body is `PutProfileRequest` (no `updatedAt`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run typecheck -w @transit/mobile` | exit 0 |
| Lint | `npm run lint` | exit 0 |

## Scope

**In scope:**
- `apps/mobile/src/screens/settings/SettingsScreen.tsx`
- `apps/mobile/src/screens/settings/SettingsChrome.ios.tsx`
- `apps/mobile/src/screens/settings/SettingsChrome.android.tsx`

**Out of scope:** `packages/shared/**`, `apps/mobile/src/platform/**`, `app.json` plugins, a new profile field, web settings.

## Git workflow

- Branch: `plan/025-mobile-settings`
- One commit: `mobile: add the settings screen (plan 025)`.
- Do not push unless told.

## Steps

### Step 1: Load and save the profile

On mount, `getProfile()`. Edits to places, trip defaults, vehicles, time zone, and step-free call `putProfile` with the merged profile. A failed call shows the error and keeps the old values on screen.

**Verify**: `npm run typecheck -w @transit/mobile` → exit 0

### Step 2: Platform layout

iOS: stack header large title "Settings", inset groups, uppercase section labels as in the frame, `Switch` for the switch rows. Android: top app bar "Settings" with a back icon, the same groups, inline slider for comfort. Use `@react-native-community/slider` if plan 022 already added it. If it is not installed, `npx expo install @react-native-community/slider` inside `apps/mobile`.

The Theme row calls the appearance setter from plan 020 with `"system" | "light" | "dark"`.

**Verify**: `npm run lint` → exit 0

## Test plan

No new runner. Typecheck is the gate.

## Done criteria

- [ ] `npm run typecheck -w @transit/mobile` exits 0
- [ ] `npm run lint` exits 0
- [ ] Home and Work round-trip through `putProfile`
- [ ] Watch, buffer, and "suggest next" do not add fields to `packages/shared`
- [ ] No file under `apps/mobile/src/platform` is modified

## STOP conditions

- You are about to edit `packages/shared/src/domain/profile.ts` or `trip-draft.ts`.
- You are about to add `expo-secure-store` or `expo-location`.
- The settings frame was removed. Stop so this plan can be rewritten.

## Maintenance notes

- When a later plan adds a real field for the watch default or the leave buffer, persist the row then. Until that, the row is visual.
- Plan 017 owns color tokens. This screen only picks system, light, or dark.

## Open questions for review

- 025-Q1: show the reminder rows without saving them? *(proposed: yes)*
- 025-Q2: Home and Work save, "Add a place" does not? *(proposed: yes)*
- 025-Q3: Theme writes System / Light / Dark? *(proposed: yes)*
- 025-Q4: iOS comfort is a chevron row, Android is a slider? *(proposed: yes)*
- 025-Q5: which groups should be cut first?
