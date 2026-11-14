# Plan 017: Shared badge and mode colors (light + dark) in `@transit/shared`

> **Executor instructions**: Follow this plan step by step. Run every verification command and
> confirm the expected result before moving on. If a STOP condition occurs, stop and report. Do
> not improvise. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 1e8328a..HEAD -- packages/shared/src packages/maps/src/colors.ts`
> If this prints anything, compare Current state with the live code. If `packages/shared/src/theme/` already exists, STOP.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW (new pure module; nothing imports it yet)
- **Depends on**: plan 016 (merged in #36; `Tone` and `Badge` come from it)
- **Category**: direction (parallel work)
- **Planned at**: commit `1e8328a`, 2026-11-14 (rescoped: route colors already ship in `@transit/maps`)
- **Issue**: https://github.com/Cattn/transit-agent/issues/25

<!-- help:start -->
## Who's on it & how to help

- **Status:** 🔄 **Assigned to @DMFriends.** Rescoped 2026-11-14 so it is no longer blocked: this plan now ships only badge (tone) and mode colors. Route-line colors already exist in `@transit/maps` and apps import them from there.
- **Owner:** @DMFriends
- **Waiting on:** nothing for Steps 1–3. Moving the route palette into shared (Later, below) waits on question 1.

**Open questions** (answer by number in a comment on #25):

1. @KrakenTheJaken: should the route palette eventually move from `@transit/maps` into shared? Until then, apps import `assignRouteColors` from `@transit/maps`, which is fine.

**Answered** ([#25](https://github.com/Cattn/transit-agent/issues/25#issuecomment-6877423429), @Cattn, 2026-11-14):

- 017-Q2: route colors are **per trip**: a trip keeps its color, rather than colors being reassigned per screen. This also settles the color half of plan 009's P4. Persisting a trip's color is not part of this plan.
- 017-Q3: **yes**, dark + light with a Settings toggle is in UI scope now (matches @DMFriends). This plan defines both schemes.

<!-- help:end -->

## Why this matters

Every screen shows the same badges: "Live", "Scheduled (not live)", "Safe / Some risk / Tight", "Leave now". Plan 016 already returns each badge as `{ label, tone }`. Without shared colors for those tones, web and mobile will each pick their own greens and reds, and "Scheduled" may end up looking like a success. This plan adds one tested color table per tone and per travel mode, in light and dark, so both apps render badges identically.

Route-line colors are **not** part of this plan anymore: `@transit/maps` already exports `PALETTE`, `routeColor`, and `assignRouteColors`, and card swatches should use `assignRouteColors` from there so they match the map.

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
**Out of scope:** `packages/maps/**`, `apps/**`, route-line colors, fonts, spacing, icons.

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

## Done criteria

- [ ] `npm test` exits 0
- [ ] `toneColors`, `modeColors`, `contrastRatio` are exported from `@transit/shared`
- [ ] Only files in Scope changed (`git status`)

## STOP conditions

- A tone palette that meets 4.5:1 cannot keep `ok`, `warn`, and `danger` distinguishable for color-blind users. Report the candidates on #25; it is a design decision.
- Someone has already added theme tokens in an app (`apps/*/src/theme/colors.ts` exporting tone colors). Report so they can be merged rather than duplicated.

## Maintenance notes

- Apps map `Badge.tone` → `toneColors[scheme][tone]`. Do not add per-badge colors.
- Per-trip route colors (017-Q2) need a stable color per trip across screens and sessions. That is new work for maps + saves, planned separately; until then `assignRouteColors` stays as is.
- **Later (after question 1):** move `PALETTE` / `routeColor` / `assignRouteColors` into `packages/shared/src/theme/` keeping the exact colors and order, and have `@transit/maps` re-export them so no import breaks. That is a separate PR coordinated with @KrakenTheJaken.
