---
name: expo-ui
description: "Android Material 3 UI in transit-agent's mobile app with @expo/ui Jetpack Compose (real Compose components: chips, segmented buttons, search bar, FABs, cards, Material Symbols icons, M3 theming). Use for any Android screen work in apps/mobile (plans 020-025). Trimmed from Expo's official expo-ui skill (MIT)."
license: MIT
allowed-tools: "Bash(node *expo-ui/scripts/list-components.js *)"
---

# Expo UI for transit-agent (Android Material 3)

Trimmed from Expo's `expo-ui` skill (expo/skills `7582922`, MIT, see `LICENSE`). Project rules come first: plan 020's "Android Material 3 rules" (Current state) apply to every Android screen in plans 020–025. iOS keeps its glass design and does not use this skill.

## Setup

- `npx expo install @expo/ui` in `apps/mobile` (Expo SDK 58; works in Expo Go).
- Components: `@expo/ui/jetpack-compose`. Modifiers: `@expo/ui/jetpack-compose/modifiers`. **`Host` always from the `@expo/ui` root.**
- `@expo/ui/jetpack-compose` crashes on iOS ("Unable to get view config"). Compose code lives only in `.android.tsx` files (e.g. `HomeChrome.android.tsx`) or behind `Platform.OS === 'android'`.

## Before writing code

1. List what the installed version has: `node .agents/skills/expo-ui/scripts/list-components.js .` from the repo root, where npm hoists `@expo/ui` (use `apps/mobile` if it is not hoisted; add `--docs` for one-line descriptions).
2. Read the component's `index.d.ts` under `node_modules/@expo/ui/build/jetpack-compose/` for exact props. Types beat docs and memory.
3. Docs per component: https://docs.expo.dev/versions/latest/sdk/ui/jetpack-compose/{component-name}/index.md. Modifiers: https://docs.expo.dev/versions/latest/sdk/ui/jetpack-compose/modifiers/index.md
4. The API mirrors Jetpack Compose + Material 3. Pick components the way an Android Compose developer would (https://m3.material.io/).

## Layout and sizing

- Every Compose tree sits in a `Host`. `<Host matchContents>` sizes to content; `<Host style={{ flex: 1 }}>` for an explicit size (needed around `LazyColumn`).
- Inside a `Host`, lay out with Compose `Row` / `Column` (`verticalArrangement={{ spacedBy: 8 }}`, `modifiers={[fillMaxWidth(), paddingAll(16)]}`), not flexbox.
- Never `matchContents` on the same axis as a scrolling child (`LazyColumn`, `LazyRow`, `Carousel`); it crashes. `matchContents` is read once on mount.
- `RNHostView` puts React Native views (e.g. the map) inside a Compose tree. Several small `Host`s inside an RN layout is fine.

```tsx
import { Host } from '@expo/ui';
import { Column, Text, AssistChip } from '@expo/ui/jetpack-compose';
import { fillMaxWidth, paddingAll } from '@expo/ui/jetpack-compose/modifiers';

<Host matchContents>
  <Column verticalArrangement={{ spacedBy: 8 }} modifiers={[fillMaxWidth(), paddingAll(16)]}>
    <Text style={{ typography: 'titleLarge' }}>Tracked trips</Text>
  </Column>
</Host>;
```

## Components we use (check exact props in the `.d.ts`)

| Need | Compose component |
|---|---|
| Transit / Drive / Fly | `SingleChoiceSegmentedButtonRow` |
| Search | `DockedSearchBar` (or `SearchBar`) |
| Home / Office / Gym / Recent chips | `AssistChip` (`FilterChip` for toggles) |
| Ask agent | `ExtendedFloatingActionButton` (`.Icon` / `.Text` slots) |
| Location button | `FloatingActionButton` / `SmallFloatingActionButton` |
| Trip cards | `Card` (elevated or filled), `Surface` |
| Live pill, badges | `Surface` / `Badge` + `Icon` |
| Settings rows | `ListItem`, `Switch`, `RadioButton` |
| Short fixed lists | `LazyColumn` (not for long lists; use RN `FlatList` there) |

## Sheets

- Home / results sheet (persistent over the map, dragged between collapsed and expanded): try Expo's drop-in `import BottomSheet, { BottomSheetView } from '@expo/ui/community/bottom-sheet'` (same API as `@gorhom/bottom-sheet`) first; fall back to `@gorhom/bottom-sheet` and say why in the PR.
- Modal sheets that open and close (e.g. agent chat): the universal `BottomSheet` from `@expo/ui`, controlled with `isPresented` / `onDismiss` (not `isOpen` / `onChange`); `snapPoints` takes `'half'`, `'full'`, `{ fraction }`, `{ height }`.

## Icons and theme

- Icons: Material Symbols as Android XML vector drawables, `<Icon source={require('../../assets/icons/bus.xml')} size={24} tint={...} contentDescription="Bus" />`. Get them from `@expo/material-symbols` or https://fonts.google.com/icons (Android, XML) into `apps/mobile/assets/icons/`.
- Theme: `Host` `colorScheme` follows the app's appearance setting (`useAppColors()`, plan 020), with one `seedColor` for the brand. `useMaterialColors()` gives the same palette to non-Compose views. Never hand-pick chip or surface colors. Android 12+ wallpaper colors apply only if we drop the seed.
- Fonts: Roboto is the system font; don't override it.

## Missing a component?

Fall back to a plain React Native view styled from `useMaterialColors()`, and note it in the PR. Extending Expo UI with a local Expo module needs the user's OK first.
