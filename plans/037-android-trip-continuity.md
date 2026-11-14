# Plan 037: Complete the Android trip loop

## Status

- Owner: DMFriends; Kraken supports map interactions; Cattn accepts design/product behavior.
- State: TODO after 009/#76 and 022/#74 merge; 034/#69 is merged.
- Priority: P1; effort M; risk MED (Home owns shared screen state).
- Category: correctness / product completion.
- Planned at: `0b37886`, 2026-11-14.
- Issue: https://github.com/Cattn/transit-agent/issues/77; roadmap #17.

## Why this matters

Home search and saved-trip cards currently look usable but do not complete their actions. Saving can fail without explanation. Finish the existing journey before adding Fly: search or ask, edit, choose a result, save, reopen and manage it. Do not redesign completed screens or add a second trip-state system.

## Current state and drift check

Run `git diff --stat 0b37886..HEAD -- apps/mobile/src/screens/home apps/mobile/src/screens/results apps/mobile/src/screens/filters`. Re-read all changed paths after #74/#76; stop if they already implement a step and reconcile that step rather than duplicate it.

- `apps/mobile/src/screens/home/HomeChrome.android.tsx:158` has `onQueryChange={() => undefined}`. Its TripCard has no interaction callback.
- `HomeScreen.tsx:65` takes `{ items, save }` from `useSavedItineraries`; that hook also supplies loading/error/refresh/update/remove.
- `HomeScreen.tsx:190` catches save failure with `catch(() => undefined)`. `requestKey` and `currentPlan` decide which request/results are valid.
- Home already owns the draft, session chat and selected itinerary; keep that ownership. `searchTo` is the existing destination-selection exemplar. Write user changes through `apply(..., 'user')` rather than mutating draft fields.
- `packages/client-react/src/use-place-search.ts` supplies place-search state; use it rather than a new fetch/debounce implementation.
- Map package only renders caller data and selection. Saved colors come from `assignRouteColors(ids, savedColors)`; search cards have no added color dots.

## Scope

In scope: `apps/mobile/src/screens/home/*`, `apps/mobile/src/screens/results/*`, existing Filters entry wiring only, and existing mobile test files if a relevant case belongs there. Documentation: this plan and its index row.

Out of scope: server/shared/hooks contracts, maps renderer internals, new dependencies, new test files, new comments, logging removal, Fly, iOS design, real watch engine and broad UI redesign. Keep plain fallback screens working.

## Commands and workflow

Branch `mobile/trip-continuity`; coordinate Home edits with Kraken's Settings and Cattn's chat/progress changes. Run `npm run typecheck -w @transit/mobile` during edits and `npm run check` before push; both must exit 0. Use mock mode for deterministic failures, then Cattn's real server for persistence acceptance. Never put Gemini credentials in the client. No merge without user authorization.

## Steps

1. Connect Home search to the existing place-search/Filters flow. Selecting a destination updates the shared draft and opens the existing planning flow. Missing origin/time opens the relevant editable fields, without fabricated values or automatic location permission. Loading, no matches, failed lookup and clear/cancel must be visible. Preserve typed text while selecting and ignore stale lookup results using the existing hook.
   Verify: mobile typecheck exits 0; on Android search a landmark, select it, edit From/time, show results; cancel and zero-result lookup leave a usable Home.
2. Make a saved-trip card open its saved itinerary/request on the map and in existing result/detail presentation. It must not immediately replace the saved route with a fresh fixture search or mark old data live. Match card/map selection and saved color; closing returns Home with chat intact. Expose watch toggle and delete via a small existing-style action surface; deletion requires a clear deliberate action. Rename is deferred.
   Verify: mobile typecheck exits 0; save → Home → tap saved card selects that exact route. Toggle/delete persist through list refresh and restart against the real server.
3. Surface list and mutation errors. Show loading separately from an empty saved list. On failed save/update/delete retain or restore the last confirmed state and show retry; do not leave Saved implying a durable success after rollback. Use hook errors and promises; preserve existing logging. Keep polling paused in background.
   Verify: mobile typecheck exits 0; simulate network loss for list/save/delete, restore connectivity, retry, and confirm exactly one saved trip with stable color.
4. Review the whole Android loop with Cattn and Kraken. Use Material 3 Compose controls, current typography/icons/card components, existing sheet gestures and Back behavior. Check light/dark, keyboard dismissal, map/sheet gesture separation, and chip → Filters → close → same chat. No blank modal or dead search control.
   Verify: `npm run check` exits 0. Attach device/OS, tested SHA, API mode and screenshots/recording covering search, saved reopen, failed save/retry and Back behavior. Record untested cases honestly.

## Done criteria

- Home search produces a usable draft and routes using existing planning state.
- Saved card opens the exact saved route/request; watch toggle/delete persist.
- List/save errors have clear recovery; failed mutations do not claim success.
- `npm run check` exits 0; no new tests/comments; existing logging retained.
- Android light/dark device proof covers the full loop; iOS bundle export still passes.
- Update this plan and index; repeat 036's extended product gate.

## STOP conditions and maintenance

Stop if existing hooks cannot support the flow without contract changes, prerequisite PRs already implement it differently, or opening an old saved route would overwrite an unrelated draft without a defined transition. Ask Cattn to resolve that transition; do not silently discard a trip. Coordinate Home changes before starting. Future 008 watch status and 031 real routing must reuse this presentation and preserve saved identity/color.
