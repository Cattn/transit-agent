# Plan 040: Custom places ("Add a place")

## Status

- Owner: KrakenTheJaken (maps + Home chips, plan 038). DMFriends filed #85 and #104 (its sub-issue) and owns Settings (#87); Cattn accepts design.
- State: steps 1–6 done; checked on Android (Pixel, Expo Go 58, mock mode). PR #116 merged. Issue #104 is closed; #85 remains open.
- Priority: P2 (QOL); effort M; risk MED (touches the shared profile contract, Home's chip row and Settings).
- Category: product / maps.
- Planned at: `e7441e1`, 2026-11-15.
- Issues: https://github.com/Cattn/transit-agent/issues/85 (reopened after #98) and its sub-issue https://github.com/Cattn/transit-agent/issues/104. One PR closes both.

**Decided (asked in person, 2026-11-15):** a custom place is a named place with an icon, a colour and a location, added with **+** (as the #85 mockup) or from Settings. Keep the current labelled chips (icon tinted, as #98) instead of the mockup's round icon-only buttons; the look can change later.

**Our choice, easy to change: at most 5 custom places.** Not asked for in #85 or #104. 3 defaults + 5 custom = 8, the size of the route `PALETTE`, so every place can have its own colour. It is one constant, `MAX_CUSTOM_PLACES` in `packages/shared/src/domain/profile.ts`; the schema, the **+** chip and Settings all read it. Raising it only means some places share a colour (see STOP conditions).

## Why this matters

Plan 038 gave Home, Office and Gym a colour, an icon and matching route colours. People also go to other regular places (school, a restaurant, a partner's flat). #85's mockup shows a fourth, custom place (a restaurant) and a **+** to add one; #104 asks for the same from Settings ("Add a place", now "Coming soon", 025-Q2). A custom place has its own name, icon and colour and works like the presets: a chip that plans a trip there, and saved trips there drawn in its colour.

## Current state and drift check

Run `git diff --stat e7441e1..HEAD -- packages/shared/src/domain/profile.ts packages/maps/src/presets.ts apps/mobile/src/screens/home apps/mobile/src/screens/settings`. If #92 or another Settings change has merged, re-read the Places rows in `SettingsChrome.android.tsx` first.

- `packages/shared/src/domain/profile.ts`: `presets` is a partial record keyed by `PRESET_KEYS` (`home`, `office`, `gym`) of `{ color?, icon?, place? }`. An unknown key is rejected (server test `itineraries.test.ts`, `cinema`). `PRESET_ICONS` has 8 icons.
- `apps/server/src/store/profiles.ts`: the whole profile is stored as JSON (`profile_json`), so a new optional field persists without a migration.
- `packages/maps/src/presets.ts`: `presetPlace` (Home → `profile.home`, Office → `profile.work`, Gym → `presets.gym.place`), `presetForPlace` (closest within 150 m), `presetTripColors`, `withPresetColors` (preset colours win; a clashing unrelated trip is moved).
- `HomeScreen.tsx`: `chips` = Home, Office, Gym; `savePreset` reads the latest profile and merges one preset before `putProfile`; `saveResult` stores `presetColor(presetForPlace(...))`.
- `HomeChrome.android.tsx`: chips, then an **Edit** chip whose menu (Home / Office / Gym) opens `PresetSheet.android.tsx` (colour swatches, icons, Gym place search).
- `SettingsScreen.tsx` / `SettingsChrome.android.tsx`: Places rows for Home and Work (inline `PlaceField`), then a disabled "Add a place" row. Settings rebuilds the profile from `displayName`, `home`, `work`, `defaults`, `presets` (line ~200), so a new field must be carried through there too.

## Scope

In scope:
- `packages/shared/src/domain/profile.ts` (+ existing tests): optional `places`.
- `packages/maps/src/presets.ts` (pure helpers) + existing maps tests.
- `apps/mobile/src/screens/home/*`: custom chips, a **+** chip, the sheet in add/edit mode, route colours.
- `PRESET_ICONS`: add `restaurant` (the mockup's fourth place) and its filled icon.
- `apps/mobile/src/screens/settings/*`: enable "Add a place", list custom places.
- README (maps), this plan and its index row.

Out of scope:
- Renaming or deleting Home, Office and Gym.
- Showing custom places as suggestions in place search (possible follow-up).
- Reordering chips, icons beyond `restaurant`, server code beyond the schema, iOS design, new dependencies, new test files, new source comments.

## Commands and workflow

Branch `plan/040-custom-places`. `npm run typecheck -w @transit/mobile` and `npm run test:unit -w @transit/maps -w @transit/shared` while working; `npm run check` before push. Android proof in Expo Go on the Pixel (mock mode, then server mode for persistence). No merge without user authorization.

## Steps

1. **Profile places (shared).** Add `restaurant` to `PRESET_ICONS`. Add `MAX_CUSTOM_PLACES = 5` and an optional `places` array to `TravelProfileSchema`, at most `MAX_CUSTOM_PLACES` entries: `{ id, name, icon, color, place }`. `id` matches `^[a-z0-9-]{1,40}$` and is unique within the array; `name` is 1–30 characters, trimmed; `icon` is a `PresetIcon`; `color` is a hex colour (the UI offers `PALETTE`); `place` is a `Place`. `presets` is unchanged, so old profiles and the three defaults work as before. Five custom places plus the three defaults is eight, the size of `PALETTE`, so every place can have its own colour (see Status: our choice).
   Settings carries `places` through its own saves now (one line, done here rather than in step 5, so nothing can drop places once they exist).
   Verify: shared tests parse a profile with and without `places`, and reject `MAX_CUSTOM_PLACES + 1` places, a duplicate id, an empty name and a bad colour; the server profile test round-trips `places` (memory and SQLite).
2. **One list of places (maps, pure).** Add `profilePlaces(profile)`, which returns Home, Office, Gym and the custom places as `{ key, name, icon, color, place? }` (custom keys are `place:<id>`). `placeFor(place, profile)` (replaces `presetForPlace`; returns the matched place with its key, name, icon and colour) and `presetTripColors` use it, so a saved trip to a custom place gets that place's colour, and the closest place within 150 m wins across all of them. Add `nextPlaceColor(profile)`: the first `PALETTE` colour no place uses yet, or the least-used one if all are taken (only possible if `MAX_CUSTOM_PLACES` is raised).
   Verify: maps tests cover a trip matching a custom place, the closest of a preset and a custom place winning, and `nextPlaceColor` skipping used colours.
3. **Chips and route colours on Home.** Custom places get chips after Gym (icon tinted in their colour, as plan 038); tapping plans a trip there. Saved trips to a custom place draw in its colour and follow changes live; saving a result to a custom place stores its colour.
   Verify: Android, a custom place "School" with two saved trips: both draw in its colour; changing the colour recolours them without re-saving.
4. **Add / edit / delete sheet.** `PresetSheet` gains a custom mode: a name field, the place search (as Gym), colour and icon, and **Delete** for an existing custom place. New places start with `nextPlaceColor`. A **+** chip at the end of the row (the #85 mockup) opens it in add mode; it is hidden at `MAX_CUSTOM_PLACES`. The Edit chip's menu also lists the custom places. Saving reuses `savePreset`'s rules: wait for a pending Settings save, read the latest profile, merge only this place, write nothing if the read fails.
   Verify: Android add, edit, delete; Save is disabled until the place has a name and a location; a failed save keeps the old values and shows "Could not save. Try again."
   **Built:** the **+** chip is an `AssistChip` labelled **Add** (the row keeps its labelled chips, see Decided). Add/edit/remove go through pure helpers in `@transit/maps` (`upsertCustomPlace`, `removeCustomPlace`, `isPresetKey`, tested in `colors.test.ts`) so Home and Settings share them; ids are `place-<time>-<random>` (`place-id.ts`). The sheet's "can save" rule is in `preset-choice.ts` (a separate file because `./PresetSheet` resolves to the Android file itself on Android).
5. **Settings.** Enable the "Add a place" row (#104): it opens the same sheet. Custom places are listed under Home and Work (icon in their colour, name, address); tapping one opens it in the sheet. Settings carries `places` through its own saves, like `presets`.
   Verify: Android, add a place from Settings, see it on Home; change a Settings default and the place is still there.
   **Built:** custom places are rows after Home and Work (icon in their colour, name, place); "Add a place" opens the sheet and is disabled with "Up to 5 places" at the limit. Settings saves through its own optimistic queue (`save(...)`), so a failed save rolls back and shows its usual error. `SettingsScreen` renders `PresetSheet` next to `SettingsChrome`.
6. **Docs and proof.** README (maps: custom places, with a short "Limits you can change" note naming `MAX_CUSTOM_PLACES`, why it is 5, and what raising it does), #85 comment, PR (closes #85 and #104) with about four media items.

## Android proof

Pixel, Expo Go 58, mock mode, 2026-11-15: added "Dinner" (restaurant, purple, Harvard Square) with **Add**; Save stayed disabled until name and place were set; the chip planned a trip there; both saved Harvard trips drew in its colour and turned orange when it was edited; **Delete place** removed it. From Settings, "Add a place" opened the sheet (the STOP condition was not hit); "School" (MIT) appeared in Settings and on Home and survived a Settings default change. Not checked: server-mode persistence across a restart.

## Done criteria

- `npm run check` exits 0; new cases live in existing test files.
- Custom places persist through `putProfile` (mock and server), and old profiles still load.
- Custom places can be added (Home **+**, Settings row), edited and deleted; their chips plan trips; saved trips to them draw in their colour.
- Android proof (light and dark); iOS still bundles.

## STOP conditions and maintenance

- The sheet (Compose `ModalBottomSheet`) can't be opened from the Settings screen: report it and edit custom places inline in Settings with the existing `PlaceField` pattern instead.
- DMFriends or Cattn want custom places to be something else (e.g. only search shortcuts, no chips or colours): stop after step 1 and re-plan.
- More places wanted: raise `MAX_CUSTOM_PLACES`. Past 5, places repeat `PALETTE` colours (`nextPlaceColor` falls back to the least-used colour), so their routes look alike; decide that's OK first.
