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
- **Category**: implementation (first-pass UI)
- **Planned at**: commit `bd41542`, 2026-11-14
- **Issue**: https://github.com/Cattn/transit-agent/issues/41

<!-- help:start -->
## Who's on it & how to help

- **Status:** 📝 **First draft, after plan 020.** Feedback welcome. Several rows are drawn but have no field to save. Those stay visible and unsaved until the questions below are answered.
- **Owner:** @KrakenTheJaken, after plan 030 (Reassigned 2026-11-14 from @Rad1ee, who is inactive). Full app, not MVP.
- **Visual proof:** the PR must show each primary feature of this plan working, as screenshots or a video, ideally about 4 pieces of media (more is fine when needed). Attach them with `gh pr create/edit --attach` (gh 2.104+).
- **Up for grabs?** Yes, until @KrakenTheJaken starts it. Comment on the issue first.
- **Waiting on:** nothing for the home shell (plan 020 merged in #60, `51b33a0`). Plan 018 is merged in #37; reuse its persistent device-id storage.

**Open questions** — **@Cattn answers these (design).** Reply as `025-Q1: ...`. Use the proposed defaults until answered.

- 025-Q1: show the reminder rows without saving them? *(proposed: yes)*
- 025-Q2: Home and Work save, "Add a place" does not? *(proposed: yes)*
- 025-Q3: Theme writes System / Light / Dark? *(proposed: yes)*
- ~~025-Q4~~ Moot: iOS is parked (@Cattn, 2026-11-14). Android comfort is an inline slider.
- 025-Q5: which groups should be cut first?

**How to help**
- **Take it:** comment "taking this" and assign yourself.
- **With a coding agent:** pull `main`, then:
  > Read `plans/025-mobile-settings.md` and follow it step by step. Only change files under Scope. Stop on a STOP condition. Don't push. When an answered question changes a step, update this same plan before building.
- **Just feedback:** answer by question number. Unsaved rows are intentional until you say otherwise.

<!-- help:end -->

## This plan will change

First Figma pass, read 2026-11-14. Settings is the longest frame and the most likely to lose or gain rows. Re-read the issue before building. If a row disappears from the frame, delete it from this plan. Do not invent a profile field to make a drawn row persist.

## Why this matters

One profile per device fills the next trip. The screen is pushed, not a sheet. Android uses a top app bar. Light and dark already exist as a second row of the same frames.

## Current state

- Frames: `Android · 06 Settings (scrolled length)` (`2016:1068`), dark twin `2018:2572`.
- Profile card: "This device's profile" and "One profile per device — no account needed. Your defaults fill every new trip."
- Places: Home and Work. Sample subtitles "Beacon Hill, Boston" and "200 Clarendon St" are the draft. Show `profile.home.name` and `profile.work.name`, or "Not set". "Add a place" is drawn and, until 025-Q2 is answered, does not write.
- Trip defaults, saved on `profile.defaults` through `putProfile`:
  - Modes a new trip starts with. The sample has Walk, Bus, Train on; Bike and Car off. That matches the schema default `['walk', 'bus', 'rail']`. At least one mode stays on.
  - Comfort. Slider "Cheaper" / "Comfier" writes `preferences.comfortVsCost` (0..1).
  - Max walk, lock, sample "15 min", subtitle "Hard limit". Writes `constraints.maxWalkMinutes`. Clearing sends `null`.
  - Max transfers, lock, sample "1". Writes `constraints.maxTransfers`. Clearing sends `null`.
  - Arrival strictness. Subtitle "A little late is OK" for `some`, "Must be on time" for `strict`, "Flexible" for `flexible`. Writes `preferences.lateTolerance`.
  - Step-free. "Step-free routes only". `Switch` from `react-native`. Writes `constraints.wheelchairAccessible`.
- Vehicles, on `profile.defaults.vehicles`: "I have my own bike" (`ownsBike`, subtitle "Adds bike + transit options"), "I have a car" (`ownsCar`, subtitle "Lets trips include driving part of the way"; D12: Drive is a filter chip, not a tab), fuel economy (`carMpg`). Sample "28 mpg" is the draft. If `carMpg` is unset, show "Not set", not 28.
- Leave reminders. Show the three rows from the frames. Do not persist them (025-Q1).
- Display. Time zone writes `defaults.timeZone`. Unset subtitle: "Trip's starting point". Do not store `America/New_York` just because the sample shows it. Theme / Appearance writes the context from plan 020. Row title "Theme", sample value "System (light / dark)".
- About. Device id: read the app's existing ID through `secureStoreDeviceIdStorage` from plan 018; show the first 8 characters, an ellipsis, and the last 3. Use the same ID as the API client; do not generate another ID for Settings. Add "stored on this phone". Do not display the sample `dev_7f3a…c21`. Data sources is the static sentence "Sample data until live MBTA feeds land (#11)". Version is `apps/mobile/package.json` `"version"` (`0.1.0` at this writing). The frame shows `0.1.0 (design)`; the app shows the package version.
- `getProfile()` on the mock returns `undefined` until `putProfile` is called. Start from an empty profile. `putProfile` body is `PutProfileRequest` (no `updatedAt`).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run typecheck -w @transit/mobile` | exit 0 |
| Lint | `npm run lint` | exit 0 |

## Scope

**In scope:**
- `apps/mobile/src/screens/settings/SettingsScreen.tsx`
- `apps/mobile/src/screens/settings/SettingsChrome.tsx` (plain fallback, see Step 2)
- `apps/mobile/src/screens/settings/SettingsChrome.android.tsx`
- `apps/mobile/package.json` and `package-lock.json` (only `@react-native-community/slider` if not already installed)

**Out of scope:** `packages/shared/**`, `apps/mobile/src/platform/**`, `app.json` plugins, a new profile field, web settings.

## Git workflow

- Branch: `plan/025-mobile-settings`
- One commit: `mobile: add the settings screen (plan 025)`.
- Do not push unless told.

## Steps

### Step 1: Load and save the profile

On mount, `getProfile()`. Edits to places, trip defaults, vehicles, time zone, and step-free call `putProfile` with the merged profile. A failed call shows the error and keeps the old values on screen.

**Verify**: `npm run typecheck -w @transit/mobile` → exit 0

### Step 2: Android layout

`SettingsChrome.android.tsx`: top app bar "Settings" with a back icon, the groups in Current state, inline slider for comfort. Next to it, a plain `SettingsChrome.tsx` with the same props (no Compose, minimal styling) so `npm run build:mobile`, which still exports iOS, keeps bundling. Do no iOS design work. Use `@react-native-community/slider` if plan 022 already added it. If it is not installed, `npx expo install @react-native-community/slider` inside `apps/mobile`.

The Theme row calls the appearance setter from plan 020 with `"system" | "light" | "dark"`.

**Verify**: `npm run lint` → exit 0

## Test plan

Do not add tests or a runner. Run the typecheck and lint commands above.

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

- Missed-trip behavior is automatic switching ([roadmap answer](https://github.com/Cattn/transit-agent/issues/17#issuecomment-6873720245)), implemented by plan 008. Any drawn “suggest next” row is not a persisted control for choosing automatic versus tap-to-confirm behavior. Keep unsaved reminder rows consistent with this decision; do not add a competing setting or imply a tap is required.

When a question is answered or a frame changes, update this same plan and its issue. Strike answered questions and keep the decision and source link. Do not open a second plan for the same screen.

- When a later plan adds a real field for the watch default or the leave buffer, persist the row then. Until that, the row is visual.
- Plan 017 owns color tokens. This screen only picks system, light, or dark.

## Open questions for review

See the help box at the top (025-Q*). It is the single list; answers are recorded there.

## Backlog: iOS

iOS is parked in the backlog (@Cattn, 2026-11-14): the mobile app is Android-only until it comes back out. Nothing here is scheduled.

- Frames: `iOS · 06 Settings (scrolled length)` (`2017:795`) and dark twin `2019:2043` on the [Figma](https://www.figma.com/design/noG2YImxFJKauBOvC1TLjb/Transit-Agent-Design-Mockups) page `iOS — Liquid Glass` (`12:3`).
- Layout: stack header large title "Settings", inset groups, uppercase section labels, `Switch` for switch rows. Build it as `SettingsChrome.ios.tsx`.
- iOS copy that differs: profile card "This iPhone's Profile" / "Defaults fill every new trip."; modes as capsules; comfort is a chevron row valued "Balanced" (0.5), "Cheaper" (< 0.35), "Comfier" (> 0.65) that opens the same slider (was 025-Q4); strictness values "On time" / "Bit late OK" / "Flexible"; "Step-Free Routes Only"; time zone unset subtitle "Trip start"; row "Appearance" with value "System"; About shows the package version.
- iOS reminder footers: "Watching uses live arrivals and tells you when to leave." and "Hard limits (lock) remove routes. Preferences only change the order."
