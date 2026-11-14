# Plan 017: Shared colors so the map line and the result card match

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If a STOP condition occurs, stop and report. Do
> not improvise. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 45f5379..HEAD -- packages/shared/src packages/maps`
> If `packages/maps/src/colors.ts` already exists with a palette, read it: **reuse its colors** in
> Step 2 instead of inventing new ones, and note that in the PR.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (new pure module; plan 009 switches to it)
- **Depends on**: plans/016-display-formatters.md (for the `Tone` type only; if 016 hasn't landed, define `Tone` exactly as in 016 Step 1 inside `theme/` and note it).
- **Category**: direction (parallel work)
- **Planned at**: commit `45f5379`, 2026-11-14
- **Co-owners**: maps (@KrakenTheJaken) and UI (@Rad1ee @DMFriends) review the palette.
- **Related:** [PR #35](https://github.com/Cattn/transit-agent/pull/35) (maps) already ships a palette in `packages/maps/src/colors.ts` and proposes `assignRouteColors(ids)` (no two on-screen trips share a color; plan 009 proposal P4, **not decided**). **Wait for #35 to merge before starting**, then move its palette into shared **keeping the exact colors and order**, and have maps re-export from shared. Add `assignRouteColors` only if P4 is accepted **and** #35's allocator has been fixed and re-reviewed. The first review found it swaps colors when the same trips are reordered. **Do not copy the allocator from #35 as-is.**

<!-- help:start -->
## Who's on it & how to help

- **Status:** 🔄 **Assigned to @DMFriends.** Still waits for PR #35 (maps) to merge, since it moves #35's palette into shared. Don't reuse #35's color allocator until it's fixed and re-reviewed.
- **Owner:** @DMFriends
- **Waiting on:** PR #35 (merge + allocator fix/re-review); PR #36 (formatters) merge

**Open questions** (answer by number in a comment on #25):

1. @KrakenTheJaken: OK to move the route color palette out of the maps package into shared, so result cards and map lines use the same colors?
2. Colors: unique per screen vs stable per trip (plan 009 proposal P4, discussed on #13)
3. Dark + light with a Settings toggle (@DMFriends' direction): @Cattn / @Rad1ee, confirm it's in UI scope now?

<!-- help:end -->

## Why this matters

The map draws each route in its own color (plan 009: "a different color per route", same color
every time for a saved trip). The results list and trip cards must show the **same** color next
to the same route, or users can't tell which card is which line. Today that palette is planned
inside `packages/maps`, which the apps' list components shouldn't import just for colors. Also,
"live" vs "scheduled", risk levels and leave-now states need consistent colors on web, mobile
and the map.

This plan puts the colors (data only, no CSS, no React) in `@transit/shared`, where the map and
both apps can import them.

## Current state

- `plans/009-maps-package-contract.md` Step 3 specifies `packages/maps/src/colors.ts`: `routeColor(itineraryId)` → one of 8 colors chosen by a stable string hash; legible on a light basemap; `selectedWidth` / `dimmedOpacity` constants. After this plan, 009 imports `routeColor` from shared instead.
- `apps/mobile/app.json`: `"userInterfaceStyle": "light"`. Web has no dark mode yet. Plan for both anyway (tokens have `light` and `dark` values).
- `packages/shared` must stay framework-free and Hermes-safe.
- Basemap (D8) is decided: **OpenFreeMap**. Set `mapBasemapReference.light` to the land/background color of the OpenFreeMap style the maps team uses (ask @KrakenTheJaken which style), instead of the placeholder value in Step 2.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Shared tests | `npm run test:unit -w @transit/shared` | all pass |
| Full | `npm run check` | exit 0 |

## Scope

**In scope (create):** `packages/shared/src/theme/colors.ts`, `packages/shared/src/theme/contrast.ts`, `packages/shared/src/theme/colors.test.ts`; modify `packages/shared/src/index.ts`.
**Out of scope:** `packages/maps/**` (plan 009 switches its import), `apps/**`, fonts, spacing, icons.

## Git workflow

Branch `plan/017-theme`. One commit. Do not push unless told.

## Steps

### Step 1: Contrast helper (`theme/contrast.ts`)

`relativeLuminance(hex)` and `contrastRatio(hexA, hexB)` per WCAG 2.x. Accept `#rrggbb` only.

### Step 2: Tokens (`theme/colors.ts`)

```ts
export type ColorScheme = 'light' | 'dark';
export interface ToneColors { fg: string; bg: string }

/** 8 route colors, in order. Stable: never reorder (saved trips would change color). Append only. */
export const routePalette: readonly string[]
export function routeColor(itineraryId: string): string        // FNV-1a hash of the id, mod 8

export const modeColors: Record<TravelMode, string>             // chips/icons in lists, not map lines
export const toneColors: Record<ColorScheme, Record<Tone, ToneColors>>
export const freshnessColors: Record<ColorScheme, { live: string; scheduled: string; estimated: string }>
export const mapBasemapReference = { light: '#f2efe9', dark: '#1d1f21' } as const   // used only by tests
export const routeLine = { width: 5, selectedWidth: 8, dimmedOpacity: 0.35, casing: '#ffffff' } as const
```
Pick colors that are distinguishable for common color-vision deficiencies (e.g. start from the Okabe–Ito or Tableau 10 palettes and adjust for contrast). Freshness: `live` is green-ish, `scheduled` is gray: "scheduled" must **not** look like a success state.

### Step 3: Tests (`theme/colors.test.ts`)

- `routeColor` is stable across calls; 20 sample ids use at least 6 of the 8 colors.
- Every `routePalette` color has contrast ≥ 3:1 against `mapBasemapReference.light` (WCAG non-text contrast).
- Every `toneColors[scheme][tone]` has `fg` on `bg` contrast ≥ 4.5:1 for both schemes.
- `modeColors` has an entry for every `travelModes` value.
- `routePalette` has exactly 8 unique values.

**Verify**: `npm run check` → exit 0.

## Done criteria

- [ ] `npm run check` exits 0; ≥ 6 new tests
- [ ] `routeColor`, `routePalette`, `routeLine`, `modeColors`, `toneColors`, `freshnessColors`, `contrastRatio` exported from `@transit/shared`
- [ ] Only files in Scope changed

## STOP conditions

- A palette that meets 3:1 on the light basemap can't also be told apart by color-blind users. Report the trade-off with the candidate colors; it's a design decision for the maps and UI people.

## Maintenance notes

- **Never reorder `routePalette`**: a saved trip's color comes from its position.
- If the maps team changes the basemap style (D8), update `mapBasemapReference` and re-run the contrast test.
- Plan 009 Step 3 changes from "write `colors.ts`" to "import `routeColor` and `routeLine` from `@transit/shared`".

## Open questions for review

- 017-Q1 (@KrakenTheJaken): OK to move the route palette out of `packages/maps` into shared, so lists and the map use the same colors?
- 017-Q2 (**direction from @DMFriends, [#25](https://github.com/Cattn/transit-agent/issues/25#issuecomment-6872563612)**): ship **dark and light now**, with a toggle in Settings. Recorded as the plan owner's direction; adding a dark theme and a Settings toggle to the apps is UI scope, which the UI team / @Cattn should confirm. Either way this plan already defines `light` and `dark` tokens and tests contrast for both, so no step here changes. The toggle itself belongs to UI slice 6 (Settings), not this plan.
