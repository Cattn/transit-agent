# Plan 017: Shared badge and mode colors (light + dark), and saved trips keep their route color

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If a STOP condition occurs, stop and report. Do
> not improvise. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 1e8328a..HEAD -- packages/shared/src packages/maps/src/colors.ts`
> If this prints anything, compare Current state with the live code. If `packages/shared/src/theme/` already exists, STOP.

## Status

- **Priority**: P1
- **Effort**: S–M (Steps 1–3 S; Step 4 adds a contract field and a server column)
- **Risk**: LOW (new pure module; one optional contract field and one additive migration)
- **Depends on**: plan 016 (merged in #36; `Tone` and `Badge` come from it)
- **Category**: direction (parallel work)
- **Planned at**: commit `1e8328a`, 2026-11-14 (rescoped: route colors already ship in `@transit/maps`)
- **Issue**: https://github.com/Cattn/transit-agent/issues/25

<!-- help:start -->
## Who's on it & how to help

- **Status:** ✅ **DONE** in [PR #61](https://github.com/Cattn/transit-agent/pull/61) (Steps 1–4, merged as `009a165`, 2026-11-14). Route-line colors stay in `@transit/maps`; apps import them from there.
- **Owner:** @DMFriends
- **Waiting on:** nothing. Moving the route palette into shared (Later, below) is a separate later PR and waits on question 1, now asked on [#13](https://github.com/Cattn/transit-agent/issues/13).
- **Step 4 (added 2026-11-14, from 017-Q2):** saved trips store their route color so the same trip keeps one color everywhere. Contract + server store + mock client; the UI side is in plans 021, 026, 027 and the maps side in plan 009 step 5.

**Open questions** (answer by number in a comment on #25):

1. @KrakenTheJaken: should the route palette eventually move from `@transit/maps` into shared? Until then, apps import `assignRouteColors` from `@transit/maps`, which is fine.

**Answered** ([#25](https://github.com/Cattn/transit-agent/issues/25#issuecomment-6877423429), @Cattn, 2026-11-14):

- 017-Q2: route colors are **per trip**: a trip keeps its color, rather than colors being reassigned per screen. This also settles the color half of plan 009's P4. Persisting a trip's color is not part of this plan.
- 017-Q3: **yes**, dark + light with a Settings toggle is in UI scope now (matches @DMFriends). This plan defines both schemes.

<!-- help:end -->

## Why this matters

Every screen shows the same badges: "Live", "Scheduled (not live)", "Safe / Some risk / Tight", "Leave now". Plan 016 already returns each badge as `{ label, tone }`. Without shared colors for those tones, web and mobile will each pick their own greens and reds, and "Scheduled" may end up looking like a success. This plan adds one tested color table per tone and per travel mode, in light and dark, so both apps render badges identically.

Route-line colors are **not** part of this plan anymore: `@transit/maps` already exports `PALETTE`, `routeColor`, and `assignRouteColors`, and card swatches should use `assignRouteColors` from there so they match the map.

Step 4 is the storage half of 017-Q2: a trip's color today comes from `assignRouteColors` over whatever set is on screen, so the same trip can change color between the home map and a results list. Storing the color on the saved trip fixes that; plan 009 step 5 makes `assignRouteColors` honor stored colors.

## Current state

- `packages/shared/src/format/format.ts` (plan 016):
  ```ts
  export type Tone = 'neutral' | 'info' | 'ok' | 'warn' | 'danger';
  export interface Badge { label: string; tone: Tone }
  ```
  Freshness already maps to tones: realtime → `ok` (or `warn` when late), scheduled and estimated → `neutral`. Risk: low `ok`, medium `warn`, high `danger`.
- `packages/maps/src/colors.ts` exports `PALETTE` (8 route colors, Tailwind 600/700 shades), `routeColor(id)`, `assignRouteColors(ids)`. Do not copy or move them in this plan.
- `travelModes` and `TravelMode` come from `packages/shared/src/domain/modes.ts`.
- `packages/shared` must stay framework-free (no React, no CSS) and Hermes-safe.
- Test pattern: `packages/shared/src/format/format.test.ts` (Vitest, `describe`/`it`).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Shared tests | `npm run test:unit -w @transit/shared` | all pass |
| Full | `npm test` | exit 0 |

## Scope

**In scope (create):** `packages/shared/src/theme/contrast.ts`, `packages/shared/src/theme/colors.ts`, `packages/shared/src/theme/colors.test.ts`. **Modify:** `packages/shared/src/index.ts` (add `export * from './theme/colors.js'` and `'./theme/contrast.js'`).
**In scope for Step 4 (modify):** `packages/shared/src/domain/itinerary.ts`, `packages/shared/src/domain/api.ts`, `packages/shared/src/client/mock/mock-client.ts` (+ cases in `mock-client.test.ts`), `apps/server/src/store/migrations.ts`, `apps/server/src/store/sqlite.ts`, `apps/server/src/store/memory.ts` (+ cases in `apps/server/src/routes/itineraries.test.ts`).
**Out of scope:** `packages/maps/**` (plan 009 step 5), other `apps/**` files (UI plans 021, 026, 027), choosing colors on the server, fonts, spacing, icons.

## Git workflow

Branch `plan/017-theme`. One commit, e.g. `shared: add tone and mode colors for light and dark (plan 017)`. Do not push unless told.

## Steps

### Step 1: Contrast helper (`theme/contrast.ts`)

`relativeLuminance(hex)` and `contrastRatio(hexA, hexB)` per WCAG 2.x. Accept `#rrggbb` only; throw on anything else.

**Verify**: `npm run typecheck -w @transit/shared` → exit 0

### Step 2: Tokens (`theme/colors.ts`)

```ts
export type ColorScheme = 'light' | 'dark';
export interface ToneColors { fg: string; bg: string }
export const toneColors: Record<ColorScheme, Record<Tone, ToneColors>>;
export const modeColors: Record<ColorScheme, Record<TravelMode, string>>; // chips and icons in lists, not map lines
```

`neutral` must be gray, not green: "Scheduled (not live)" is neutral and must never look like a success. Pick colors distinguishable under common color-vision deficiencies.

**Verify**: `npm run typecheck -w @transit/shared` → exit 0

### Step 3: Tests (`theme/colors.test.ts`)

- `contrastRatio('#000000', '#ffffff')` is 21 (±0.01); invalid hex throws.
- For both schemes and every tone, `fg` on `bg` contrast ≥ 4.5.
- `modeColors[scheme]` has an entry for every value in `travelModes`, and each has contrast ≥ 3 against white (light) / `#121212` (dark).
- `toneColors.light.neutral.bg` ≠ `toneColors.light.ok.bg`.

**Verify**: `npm run test:unit -w @transit/shared` → all pass, ≥ 5 new tests.

### Step 4: Saved trips keep their route color (017-Q2)

Decision (@Cattn, [#25](https://github.com/Cattn/transit-agent/issues/25#issuecomment-6877423429)): the same trip keeps one color wherever it appears, across screens and sessions. A trip is its itinerary `id` (providers derive it from the request and the option, and saves are keyed by it).

- Contract: add `color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional()` to `SaveItineraryRequestSchema` (`api.ts`) and `SavedItinerarySchema` (`itinerary.ts`). Optional, so older saves and clients still parse.
- Server: append a migration `ALTER TABLE saved_itineraries ADD COLUMN color TEXT` (never edit the first one). `sqlite.ts` writes `color` on save and reads it back. Re-saving an id that already has a color keeps the stored one (`color = COALESCE(saved_itineraries.color, excluded.color)` in the upsert). `memory.ts` behaves the same.
- Mock client: `saveItinerary` stores and returns `color` the same way, so UI built on the mock sees it.
- The server never picks a color and does not import `@transit/maps`. Clients send the color the trip was showing when the user saved it (see the UI plans).
- Tests (existing files only): a saved color round-trips through list and a reload of the store; re-saving keeps the first color; an invalid color is rejected with 400; the mock client keeps the color.

**Verify**: `npm run test:unit -w @transit/shared` and `npm run test:unit -w @transit/server` → all pass.

## Done criteria

- [ ] `npm test` exits 0
- [ ] `toneColors`, `modeColors`, `contrastRatio` are exported from `@transit/shared`
- [ ] `SavedItinerary.color` is saved, listed, kept on re-save, and survives a server restart (sqlite)
- [ ] Only files in Scope changed (`git status`)

## STOP conditions

- A tone palette that meets 4.5:1 cannot keep `ok`, `warn`, and `danger` distinguishable for color-blind users. Report the candidates on #25; it is a design decision.
- Someone has already added theme tokens in an app (`apps/*/src/theme/colors.ts` exporting tone colors). Report so they can be merged rather than duplicated.

## Maintenance notes

- Apps map `Badge.tone` → `toneColors[scheme][tone]`. Do not add per-badge colors.
- Per-trip route colors (017-Q2) are split three ways: storage here (Step 4), honoring stored colors in `assignRouteColors` (plan 009 step 5), and passing/saving them on screens (plans 021, 026, 027).
- **Later (after question 1):** move `PALETTE` / `routeColor` / `assignRouteColors` into `packages/shared/src/theme/` keeping the exact colors and order, and have `@transit/maps` re-export them so no import breaks. That is a separate PR coordinated with @KrakenTheJaken.
