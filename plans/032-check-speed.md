# Plan 032: Faster `npm run check` and `npm test` (no coverage cut)

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: HIGH by the review rules (changes CI); approved by @Cattn on 2026-11-14, including merge after a passing review and green CI
- **Owner**: Cattn (worker)
- **State**: PR #63 open
- **Issue**: #62
- **Source**: research run on 2026-11-14 at `8cb5a4c` (Windows, Node 26). Ranked results below; the full report stayed in the research worktree.

## Why this matters

`npm run check` took 89–98 s locally and `npm test` 53 s. Most of it was rebuilding the three libraries (shared, maps, client-react) up to three times per command, not the tests. Cutting tests saves little.

## Measured (local, Windows)

| Variant | npm test | npm run check |
|---|---|---|
| Baseline | 52.8 s | 88.6–97.6 s |
| 1–3 combined (warm) | 34.8 s | 61.5–66.4 s |

All 332 tests, all builds (incl. both mobile platforms) and the smoke run still run.

## Scope

1. Build libraries once per top-level command (`test`, `check`); standalone `typecheck`, `test:unit`, `build` stay self-sufficient.
2. Incremental TypeScript (`--incremental`; emit state in `dist/.tsbuildinfo`, no-emit state in `node_modules/.cache/`).
3. ESLint cache under `node_modules/.cache`.
4. CI runs `npm run check` instead of `npm test` + `npm run build` + smoke.

**Out of scope:** parallel validation (follow-up after CI timing), cutting tests, CI artifact caches.

## Steps

1. Apply the two patches below to current `main` (they were made against `8cb5a4c`; resolve any drift by hand, keeping the intent).
2. Run `npm run check` twice and `npm test` twice; record times in the PR next to the baseline above.
3. Open the PR (closes #62). After CI runs, record the CI job time and compare it with a recent CI run on `main`.

**Verify**: `npm run check` exits 0 with the same test count (332 at research time, more if tests were added since) and both mobile platforms exported.

## Done criteria

- [ ] Both patches applied; `npm run check` and `npm test` pass
- [ ] Local before/after and CI before/after times in the PR
- [ ] Root scripts still list every app and library

## STOP conditions

- A check or test that ran before no longer runs.
- CI is slower than before.

## Patch A: changes 1–3 (`package.json` files)

```diff
diff --git a/apps/mobile/package.json b/apps/mobile/package.json
index 308a177..55080eb 100644
--- a/apps/mobile/package.json
+++ b/apps/mobile/package.json
@@ -14,7 +14,7 @@
     "build:preview": "npx --yes eas-cli@27.10.0 build --platform android --profile preview",
     "build:ios": "npx --yes eas-cli@27.10.0 build --platform ios --profile development",
     "eas-build-post-install": "npm run build -w @transit/shared && npm run build -w @transit/client-react",
-    "typecheck": "tsc --noEmit",
+    "typecheck": "tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/typecheck.tsbuildinfo",
     "test:unit": "vitest run",
     "test": "npm run typecheck"
   },
diff --git a/apps/server/package.json b/apps/server/package.json
index deace32..c0c264a 100644
--- a/apps/server/package.json
+++ b/apps/server/package.json
@@ -5,9 +5,9 @@
   "type": "module",
   "scripts": {
     "dev": "tsx watch --env-file-if-exists=.env src/index.ts",
-    "build": "tsc",
+    "build": "tsc --incremental --tsBuildInfoFile dist/.tsbuildinfo",
     "start": "node --env-file-if-exists=.env dist/index.js",
-    "typecheck": "tsc --noEmit",
+    "typecheck": "tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/typecheck.tsbuildinfo",
     "test:unit": "vitest run",
     "test": "npm run typecheck && npm run test:unit",
     "airports:northeast": "node scripts/northeast-airports.mjs"
diff --git a/apps/web/package.json b/apps/web/package.json
index 7686bf6..43e33a8 100644
--- a/apps/web/package.json
+++ b/apps/web/package.json
@@ -5,9 +5,9 @@
   "type": "module",
   "scripts": {
     "dev": "vite --host 0.0.0.0",
-    "build": "tsc --noEmit && vite build",
+    "build": "tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/typecheck.tsbuildinfo && vite build",
     "preview": "vite preview --host 0.0.0.0",
-    "typecheck": "tsc --noEmit",
+    "typecheck": "tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/typecheck.tsbuildinfo",
     "test": "npm run typecheck"
   },
   "dependencies": {
diff --git a/package.json b/package.json
index 0e7c5ba..98c6195 100644
--- a/package.json
+++ b/package.json
@@ -19,11 +19,11 @@
     "build:server": "npm run build:packages && npm run build -w @transit/server",
     "build:mobile": "npm run build:packages && npm run build -w @transit/mobile",
     "build": "npm run build:packages && npm run build -w @transit/server && npm run build -w @transit/web && npm run build -w @transit/mobile",
-    "lint": "eslint . --max-warnings=0",
+    "lint": "eslint . --max-warnings=0 --cache --cache-location node_modules/.cache/eslint",
     "typecheck": "npm run build:packages && npm run typecheck --workspaces --if-present",
     "test:unit": "npm run build:packages && npm run test:unit --workspaces --if-present",
-    "test": "npm run lint && npm run typecheck && npm run test:unit",
-    "check": "npm test && npm run build && node scripts/smoke.mjs",
+    "test": "npm run lint && npm run build:packages && npm run typecheck --workspaces --if-present && npm run test:unit --workspaces --if-present",
+    "check": "npm test && npm run build -w @transit/server && npm run build -w @transit/web && npm run build -w @transit/mobile && node scripts/smoke.mjs",
     "smoke": "npm run build:server && node scripts/smoke.mjs",
     "mobile:doctor": "npm exec -w @transit/mobile -- expo-doctor",
     "android:setup": "powershell -NoProfile -ExecutionPolicy Bypass -File scripts/android-setup.ps1"
diff --git a/packages/client-react/package.json b/packages/client-react/package.json
index 7028000..b66fce8 100644
--- a/packages/client-react/package.json
+++ b/packages/client-react/package.json
@@ -13,8 +13,8 @@
   },
   "scripts": {
     "dev": "tsc --watch",
-    "build": "tsc",
-    "typecheck": "tsc --noEmit",
+    "build": "tsc --incremental --tsBuildInfoFile dist/.tsbuildinfo",
+    "typecheck": "tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/typecheck.tsbuildinfo",
     "test:unit": "vitest run --passWithNoTests",
     "test": "npm run typecheck && npm run test:unit"
   },
diff --git a/packages/maps/package.json b/packages/maps/package.json
index 6795fca..ff293a9 100644
--- a/packages/maps/package.json
+++ b/packages/maps/package.json
@@ -21,9 +21,9 @@
   },
   "scripts": {
     "dev": "tsc --watch",
-    "build": "tsc",
+    "build": "tsc --incremental --tsBuildInfoFile dist/.tsbuildinfo",
     "demo": "vite --config demo/vite.config.ts",
-    "typecheck": "tsc --noEmit && tsc --noEmit -p demo",
+    "typecheck": "tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/typecheck.tsbuildinfo && tsc --noEmit -p demo --incremental --tsBuildInfoFile node_modules/.cache/typecheck-demo.tsbuildinfo",
     "test:unit": "vitest run",
     "test": "npm run typecheck && npm run test:unit"
   },
diff --git a/packages/shared/package.json b/packages/shared/package.json
index 89968b6..5ba2315 100644
--- a/packages/shared/package.json
+++ b/packages/shared/package.json
@@ -13,8 +13,8 @@
   },
   "scripts": {
     "dev": "tsc --watch",
-    "build": "tsc",
-    "typecheck": "tsc --noEmit",
+    "build": "tsc --incremental --tsBuildInfoFile dist/.tsbuildinfo",
+    "typecheck": "tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/typecheck.tsbuildinfo",
     "test:unit": "vitest run",
     "test": "npm run typecheck && npm run test:unit"
   },
```

## Patch B: change 4 (CI)

```diff
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -19,9 +19,7 @@
       - run: npm install -g npm@^11.8
       - run: npm --version
       - run: npm ci
-      - run: npm test
-      - run: npm run build
-      - run: node scripts/smoke.mjs
+      - run: npm run check
       - uses: actions/upload-artifact@v4
         with:
           name: web-server-mobile-bundles
```

## Follow-ups

- Parallel lint / typecheck / unit tests after the libraries build (`concurrently`, already installed): `npm test` ~24 s locally. Measure on the Node 24 CI runner first.
