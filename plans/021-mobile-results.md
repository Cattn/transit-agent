# Plan 021: Show route results in the mobile half sheet

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat bd41542..HEAD -- apps/mobile/src/screens/results apps/mobile/src/screens/home packages/shared/src/client/mock`
> Plan 020 must already have created `apps/mobile/src/screens/results/ResultsScreen.tsx`. If that file does not exist, STOP. Plan 016 formatters merged in #36. Import them from `@transit/shared`.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: LOW
- **Depends on**: plans/020-mobile-map-home.md
- **Category**: implementation (first-pass UI)
- **Planned at**: commit `bd41542`, 2026-11-14
- **Issue**: https://github.com/Cattn/transit-agent/issues/40

<!-- help:start -->
## Who's on it & how to help

- **Status:** 📝 **First draft, after plan 020.** Feedback welcome. The steps use the defaults below until a question is answered.
- **Owner:** Nobody yet. Suggested: @Rad1ee @DMFriends
- **Up for grabs?** Yes, once 020 is on the branch you are using.
- **Waiting on:** Plan 020's home shell. Map drawing stays with @KrakenTheJaken. This plan only sets `selectedItineraryId`.

**Open questions** — @Rad1ee @DMFriends: reply as `021-Q1: ...`. Use the proposed defaults until answered.

- ~~021-Q1~~ **Decided ([#24](https://github.com/Cattn/transit-agent/issues/24#issuecomment-6872458297)):** keep plan 016 wording, including "Safe / Some risk / Tight" and "Scheduled (not live)".
- 021-Q2: expand the selected card in the sheet? *(proposed: yes)*
- 021-Q3: one text block for empty, offline, and error? *(proposed: yes)*
- 021-Q4: what in this layout should change before it is built?

**How to help**
- **Take it:** comment "taking this" and assign yourself.
- **With a coding agent:** pull `main`, then tell your agent:
  > Read `plans/021-mobile-results.md` and follow it step by step. Run every verification command and check the output matches. Only change files listed under Scope. If a STOP condition happens, stop and tell me instead of working around it. Don't push.

  Open a PR that says `Closes #40`.

<!-- help:end -->

## This plan will change

First Figma pass, read 2026-11-14. Re-read the issue comments before building. If the results frame is redrawn, replace **Current state** and drop the old copy. Card fields stay bound to the itinerary. Visual treatment can change without a new plan.

## Why this matters

After a search, the map stays up and the sheet grows to a results list. Figma frame **02 Results** is that state. Freshness is mandatory: a scheduled bus must not use the Live treatment. Near-misses sit in a separate "Almost works" block. This is UI slice 3, drawn to the mockups.

## Current state

- Plan 020 owns `HomeScreen` and a placeholder `apps/mobile/src/screens/results/ResultsScreen.tsx`. Replace the placeholder. Do not re-layout the home chrome.
- Frames: `iOS · 02 Results` (`2011:152`), `iOS · Dark · 02 Results` (`2019:1140`), `Android · 02 Results` (`2003:660`), `Android · Dark · 02 Results` (`2018:1375`). Dark is the same layout.
- Shared content of the results sheet:
  - Trip header: back, "Current location", "Office · 200 Clarendon St", a swap control.
  - Chips: "Arrive by 9:00", an agent chip "Agent: walk ≤ 15 min", "Cheaper", and "Filters".
  - Header "3 routes" is the count of `plan.itineraries`, not a constant. Subtitle "Leave now · arrive by 9:00 AM" comes from the draft time.
  - "updated 20s ago" is `formatAge(source.fetchedAt, new Date())` from plan 016 (merged in #36). A scheduled itinerary still must not say Live.
  - Warning banner. The mock can return `warnings`. The frame's sample sentence is "Green Line realtime unavailable — showing timetable". Render `plan.warnings[0]` when present.
  - Itinerary card (`14:136`): time range, duration, leg chips (walk minutes, route name, walk minutes), freshness, "updated …", cost, risk badge. Sample row: "8:04 – 8:27", "23 min", legs "6 › Bus 1 › 5", "Live · +1 min", "updated 20s ago", "$1.70", risk label. A route-color swatch is a 8 pt circle using `routeColor(id)` if that export exists, otherwise omit the circle. Do not invent a palette in `packages/shared`.
  - "Almost works" then a dimmed row. Sample: "Walk the whole way · 8:04 – 8:49" and "45 min walk — breaks your 15 min limit". Bind this to `plan.nearMisses` and `violations[0]`.
- iOS vs Android:

| Piece | iOS | Android |
|---|---|---|
| Sheet | Inset glass sheet, grabber, more than half the screen | Material sheet from about y=372 on a 917 pt frame, drag handle, no blur |
| Header back | Glass circular button, chevron | 48 pt icon button, Material back icon |
| Chips | Agent chip uses the indigo accent. User chips are neutral. | Material chips. The agent chip includes the sparkle icon. |
| Card | Same fields. SF symbols for walk and bus. | Material icons. The bus leg is a primary-container chip. |

- Selecting a card sets `selectedItineraryId` on the map slot from plan 020. Tapping the same route on the map selects the card. There is no separate trip-detail frame in Figma. Expanding a selected card lists `leg.routeName` or the mode, `formatClock` times from plan 016, and `legFreshness`. Do not add a new stack route.
- `createMockApiClient` (plan 012) scenarios: `normal`, `empty`, `nearMissOnly`, `serverError`, `offline`. The empty scenario's warning is the string `No routes found for this trip` (`packages/shared/src/client/mock/mock-client.ts`). Render `plan.warnings[0]` for that case. For `offline`, show "You are offline". For `serverError`, show the `ApiClientError.message`. Figma does not draw those three. Use one text block in the sheet, not a new frame.
- Save: a text button "Save" on the expanded card calls `saveItinerary({ itinerary, request, watch: true })` via `useSavedItineraries` (plan 015). The request is `toTripRequest(draft)` when that returns a request. If the draft is incomplete, disable Save.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `npm run typecheck -w @transit/mobile` | exit 0 |
| Lint | `npm run lint` | exit 0 |

## Scope

**In scope:**
- `apps/mobile/src/screens/results/ResultsScreen.tsx`
- `apps/mobile/src/screens/results/ResultsChrome.ios.tsx`
- `apps/mobile/src/screens/results/ResultsChrome.android.tsx`
- `apps/mobile/src/screens/results/ItineraryCard.tsx`
- `apps/mobile/src/screens/home/HomeScreen.tsx` (only to present Results when a search has been run, and to pass `selectedItineraryId`)

**Out of scope:** `packages/shared/**`, `packages/maps/**`, `apps/mobile/src/platform/**`, `apps/web/**`, filters layout (plan 022), chat (plan 023), fly cards (plan 024).

## Git workflow

- Branch: `plan/021-mobile-results`
- One commit. Message: `mobile: show route results in the half sheet (plan 021)`.
- Do not push unless told.

## Steps

### Step 1: Run a search from the draft

When origin, destination, and time are all set, call `run(request)` from `usePlanTrip()` (`@transit/client-react`, merged in #47). The hook already ignores stale responses. Use the client from plan 020's `src/data/client.ts`; do not create another client.

The home search field does not run this search. The Filters "Show routes" button (plan 022) and a completed draft do. If the draft is incomplete, Results shows "Add where and when" and does not call `planTrip`.

**Verify**: `npm run typecheck -w @transit/mobile` → exit 0

### Step 2: Cards, freshness, near-misses

Render `itineraries` and `nearMisses` with the card fields above. Freshness text:

Use `legFreshness`, `itineraryFreshness`, `formatCost`, and `riskBadge` from `@transit/shared` (plan 016, merged in #36). Do not duplicate these helpers. Keep "Safe / Some risk / Tight", "Scheduled (not live)", and "Estimated" exactly as returned.

**Verify**: `npm run typecheck -w @transit/mobile` → exit 0

### Step 3: Platform chrome

`ResultsChrome.ios.tsx` uses `BlurView` for the sheet. `ResultsChrome.android.tsx` uses the theme surface and a 32×4 drag handle. Both receive the same card list.

The Filters chip sets Home state so plan 022's screen is visible. The agent chip scrolls to that field once plan 022 exists; until then it only opens Filters.

Swap exchanges origin and destination through `applyDraftPatch` with source `'user'`.

**Verify**: `npm run lint` → exit 0

## Test plan

Do not add tests or a runner. Run the typecheck and lint commands above.

## Done criteria

- [ ] `npm run typecheck -w @transit/mobile` exits 0
- [ ] `npm run lint` exits 0
- [ ] A card whose legs are all `scheduled` does not render the string "Live"
- [ ] `nearMisses` render under the heading "Almost works"
- [ ] No files outside Scope are modified

## STOP conditions

- Plan 020's `ResultsScreen.tsx` placeholder is missing.
- You need to edit `packages/shared` to format a time.
- The results frame was renamed or removed in Figma.

## Maintenance notes

When a question is answered or a frame changes, update this same plan and its issue. Strike answered questions and keep the decision and source link. Do not open a second plan for the same screen.

- The merged map handles overlaps internally and still calls `onRouteSelect(id, candidates)`. Select the returned id; do not add a second chooser or remove `candidates` from the contract. P1 remains a product question on #13.
- Empty, offline, and error copy is not in Figma. Keep it one text block.

## Open questions for review

See the help box at the top (021-Q*). It is the single list; answers are recorded there.

Map behavior (overlap chooser, mode filtering, colors) is tracked once in plan 009 under "Open product decisions". For card swatches, compute `assignRouteColors` once over all results and reuse it for cards and map.
