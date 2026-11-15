# Plan 038: Location-preset chips with matching route colours

## Status

- Owner: KrakenTheJaken (maps + Home chips). DMFriends filed #85 and owns Settings (#87); Cattn accepts design.
- State: in progress on `plan/038-location-presets`; steps 1–5 done and checked on Android (Pixel, Expo Go, mock and server mode, light and dark). Step 6 (PR) left.
- Priority: P1; effort M; risk MED (touches the shared profile contract and Home's chip row).
- Category: product / maps.
- Planned at: `fde2fea`, 2026-11-15.
- Issue: https://github.com/Cattn/transit-agent/issues/85

**Open question for @Cattn** (asked on #85): plan 020 says chips use theme colours ("do not hand-pick chip or surface colors"). This plan makes the three preset chips the exception, using the route palette. Until answered, build it but keep the colour on the chip's **icon only** (the chip container stays themed), which is the smallest change from plan 020.

## Why this matters

Home's bottom chips (Home, Office, Gym) are the quickest way to plan a common trip, and saved trips to those places are what the map shows every day. Giving each place its own colour and icon, and drawing saved trips to that place in the same colour, makes the map read at a glance: "the green line is my gym trip". The colour lives with the place, so every saved trip there matches automatically.

## Current state and drift check

Run `git diff --stat fde2fea..HEAD -- packages/shared/src/domain/profile.ts apps/server/src/routes/profile.ts apps/server/src/store/profiles.ts apps/mobile/src/screens/home packages/maps/src/colors.ts`. If #87 (Settings) has merged, re-read `HomeScreen.tsx` and the Settings places rows first; keep their Home/Work editing as is.

- `packages/shared/src/domain/profile.ts`: `TravelProfileSchema` has `home?`, `work?` (`PlaceSchema`), `defaults`, `updatedAt`. No colour, icon or gym place.
- `apps/server/src/routes/profile.ts`: `PUT /api/profile` parses `PutProfileRequestSchema` and stores the whole profile (memory or SQLite store as JSON), so new optional fields persist without a migration.
- `packages/shared/src/client/mock/mock-client.ts`: `putProfile` parses with `TravelProfileSchema`; `apps/mobile/src/data/client.ts` seeds a mock Home and Office.
- `apps/mobile/src/screens/home/HomeScreen.tsx`: `chips` is built from `profile.home` (Home), `profile.work` (Office) and nothing (Gym); a chip with no place opens Filters. `savedColors` comes from each saved trip's stored `color`; `routeColors = assignRouteColors(shownIds, savedColors)`.
- `HomeChrome.android.tsx`: `AssistChip` per chip with a fixed icon map (`home_fill`, `work_fill`, `fitness_center_fill`). Expo UI's `AssistChip` accepts `colors.leadingIconContentColor` / `containerColor`, and the `combinedClickable` modifier gives `onLongClick`.
- `packages/maps/src/colors.ts`: `PALETTE` (8 route colours) and `assignRouteColors(ids, fixed)`; fixed colours always win and count as taken.
- `SavedItinerary.request.destination` is the place a saved trip goes to.

## Scope

In scope:
- `packages/shared/src/domain/profile.ts` (+ its tests): optional `presets`.
- `packages/maps/src/colors.ts` / `src/presets.ts` (pure helpers) + existing maps tests.
- `apps/mobile/src/screens/home/*`: chips, long-press sheet, route colours.
- Mock profile seed; README; this plan and its index row.

Out of scope:
- Settings screen changes (#87, DMFriends) and "Add a place" (025-Q2, Cattn).
- Search-result colours (results keep the Figma look).
- Server code beyond what the schema change already covers.
- iOS design (the iOS chips stay functional with the plain fallback), new dependencies, new test files, new source comments.

## Commands and workflow

Branch `plan/038-location-presets`. `npm run typecheck -w @transit/mobile` and `npm run test:unit -w @transit/maps -w @transit/shared` while working; `npm run check` before push. Android proof in Expo Go on the Pixel (mock mode, then server mode for persistence). No merge without user authorization.

## Steps

1. **Profile presets (shared).** Add an optional `presets` field to `TravelProfileSchema`: a partial record keyed by `'home' | 'office' | 'gym'` of `{ color?: string; icon?: PresetIcon; place?: Place }`. `color` is a hex colour; the UI only offers `PALETTE`. `icon` is an enum of the bundled Material icons (`home`, `work`, `fitness`, plus a few added: `school`, `cafe`, `shopping`, `favorite`, `park`). `place` is used only for `gym`; Home and Office keep using `profile.home` / `profile.work`, so #87's Settings rows are unaffected. Old profiles without `presets` still parse.
   Verify: shared tests cover parse with and without presets and reject an unknown icon; `npm run typecheck` exits 0.
2. **Colours (maps, pure).** Add `presetForPlace(place, presets)` (the preset whose place is within 150 m, using `metersBetween`) and `presetColors(savedTrips, presetPlaces)` → `Map<tripId, colour>` for saved trips whose destination matches a preset with a colour. Default colours per preset come from `PALETTE` so they differ out of the box.
   Verify: maps tests cover a match within 150 m, no match beyond it, the closest preset winning, and default colours being distinct.
3. **Route colours on Home.** Saved trips to a preset use the preset's colour: merge `presetColors(...)` over `savedColors` before `assignRouteColors`, so other trips never borrow a preset colour and a colour change applies live. Saving a result to a preset destination stores the preset colour. Results keep the choosing look.
   Verify: on Android, two saved trips to Office both draw in the Office colour; changing Office's colour recolours them without re-saving.
4. **Chips.** Home builds chips from presets: icon and colour per chip (icon tinted with the preset colour; the container stays themed until Cattn answers). Gym uses `presets.gym.place`; a chip with no place still opens Filters.
   Verify: Android light and dark, chips readable, tap still plans to the place.
5. **Long-press sheet.** Long-pressing a chip opens a Material bottom sheet: colour swatches (`PALETTE`), icon choices, and for Gym a place field (reuse `PlaceField`). Saving calls `putProfile` with the merged profile; failures show an error and keep the old values. Home and Office places stay edited in Settings (#87); the sheet links there.
   Verify: on Android, long-press Gym, pick a place, colour and icon, close, then tap Gym and it plans there. Restart (server mode) keeps the values. Tapping still plans; only long-press opens the sheet.
   **Outcome (STOP condition hit):** `combinedClickable` is rejected by Expo Go 58 on Android ("Cannot set prop 'modifiers'"), so there is no long-press. An **Edit** chip after Gym opens a menu (Home / Office / Gym) that opens the sheet; tapping a preset chip still plans. `PlaceField` hosted in the sheet (`RNHostView`) got no keyboard input, so the sheet draws its own Compose search field (same hint / loading / results as `PlaceField`) with `imePadding()` and `verticalScroll()`. After #87 merged: Settings rebuilt the profile from `displayName`, `home`, `work` and `defaults` only, so any Settings change would have dropped `presets`; it now carries `presets` through.
   **PR #98 review fixes:** saving a preset reads the latest profile from the server first (after any pending Settings save) and writes nothing if that read fails, so an unknown profile is never replaced by just the preset; a Gym save without a new place keeps the stored one. `withPresetColors` gives preset colours priority and drops an unrelated trip's stored colour when it clashes with a preset, so `assignRouteColors` moves that trip to a free colour.
6. **Docs and proof.** README (maps: preset colours; Home behaviour), #85 comment, PR with about four media items (chips, the sheet, matching routes, light mode).

## Done criteria

- `npm run check` exits 0; new cases live in existing test files.
- Preset colours and icons persist through `putProfile` (mock and server), and old profiles still load.
- Saved trips to a preset draw in its colour on Home and follow colour changes live; no other trip shares a preset colour while 8 or fewer colours are in use.
- Chips show the preset icon and colour; the Edit chip edits them (long-press was not possible, see step 5); tapping behaves as before.
- Android proof (light and dark); iOS still bundles and works with the plain fallback.

## STOP conditions and maintenance

- `combinedClickable` cannot be combined with `AssistChip` clicks on Android: report it and fall back to an edit icon on the sheet header or the Settings row, with no new dependencies. **Hit:** fell back to an Edit chip with a preset menu (see step 5).
- #87 changes the profile shape or the chip row in a conflicting way: rebase onto it and keep its Home/Work flows; don't duplicate them.
- Cattn says no custom chip colours: keep presets and route colours, and drop the chip tint.
- Later: user-defined presets ("Add a place") reuse `presets` with more keys once 025-Q2 is decided.
