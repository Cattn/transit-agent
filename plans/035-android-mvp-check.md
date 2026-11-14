# Plan 035: Android MVP check against the real server

> **Executor instructions**: This plan writes no product code. It is a manual end-to-end check on
> an Android phone, with the result recorded on the issue. If a step fails, record the failing step
> and open (or point at) the bug on the plan that owns that screen. Do not fix screens from this
> plan. When done, update this plan's status row in `plans/README.md`.
>
> **Drift check (run first)**: `git log --oneline -1 main` and confirm that plans 009, 021, 022
> and 034 show DONE in `plans/README.md`. If any is not DONE, STOP: the MVP is not assembled yet.

## Status

- **Priority**: P1 (this is the MVP milestone)
- **Effort**: S
- **Risk**: LOW (no code). Needs Cattn's machine, which holds the Gemini credentials.
- **Depends on**: 009 (DOM map on Android), 021 (Results + Save), 022 (Filters), 034 (chat kept for the session). Already merged: 020 home, 023 chat, 028/033 place search, 006 agent.
- **Category**: verification
- **Planned at**: commit `db8b72c`, 2026-11-14
- **Issue**: tracked on [#17](https://github.com/Cattn/transit-agent/issues/17) (roadmap). No separate issue; post the result there.

<!-- help:start -->
## Who's on it & how to help

- **Status:** Waiting on 009, 021, 022 and 034.
- **Owner:** @Cattn (only Cattn's server holds the Gemini key).
- **Up for grabs?** No.
- **Waiting on:** #13 (009, @KrakenTheJaken), #40 (021, @DMFriends), #46 (022, @Cattn), #68 (034, @Cattn).

**Open questions:** none.

<!-- help:end -->

## Why this matters

The MVP goal on #17 is: type a trip request, see and edit the interpreted filters, see routes on
the map, save one. Sample (fixture) routes are enough. The pieces are built in separate plans and
reviewed one at a time against the mock client. Nobody has run them together against the real
server and the live agent. This plan is that run, on Android, the main target (@Cattn,
2026-11-14). Web has the same check as plan 027 Step 3, which is low priority.

## Current state

- Mobile picks its client in `apps/mobile/src/data/client.ts`: the mock unless
  `EXPO_PUBLIC_API_MODE=server`. In server mode the URL comes from `EXPO_PUBLIC_API_URL`, or the
  laptop's LAN address Expo is serving from (`apps/mobile/src/platform/api-url.ts`, port 3001).
- The server reads `apps/server/.env` (see `apps/server/.env.example`): `GEMINI_API_KEY`, or
  Vertex AI with Application Default Credentials. Routes come from the fixture provider. Saved
  trips go to the SQLite file at `DATABASE_PATH`.
- The app runs in Expo Go (`npm run dev:mobile` runs `expo start --go`). The map is plan 009's
  Expo DOM component, so no dev build is needed.

## Commands

| Purpose | Command | Expected |
|---|---|---|
| Full check first | `npm run check` | exit 0 |
| Server | `npm run dev:server` | listening on port 3001 |
| Mobile, real server | `EXPO_PUBLIC_API_MODE=server npm run dev:mobile` (PowerShell: `$env:EXPO_PUBLIC_API_MODE='server'; npm run dev:mobile`) | QR code; open it in Expo Go on the phone (same Wi-Fi) |

## Steps

### Step 1: Start on a clean main

`git pull` on `main`, then `npm run check`.

**Verify**: exit 0.

### Step 2: Run the server and the app

Start the server, then the app in server mode, and open it on an Android phone in Expo Go.

**Verify**: Home shows the map (not the placeholder) and the Transit / Drive / Fly control.

### Step 3: The MVP flow

1. Tap Ask and type: "Get me from MIT to South Station by 9 tomorrow".
2. When the agent replies, tap one of its chips to open Filters.
3. In Filters, change one preference (for example less walking) and tap "Show routes".
4. In Results, tap a card. Then tap Save.
5. Reopen the chat.
6. Fully close the app and open it again.

**Verify**, in order:
- the agent's reply fills From, To and the arrival time, and Filters shows those values with the agent mark;
- the Filters change is kept and Results updates;
- at least one route is drawn on the map, in the same color as its card, and tapping a card selects that route on the map;
- after Save, the trip appears in Tracked trips on Home with the same color;
- the chat thread is still there when reopened (plan 034);
- after the restart, the saved trip is still in Tracked trips.

### Step 4: Record the result

Post one comment on #17 with a short screen recording (or about 4 screenshots) and
a pass / fail line per check in Step 3. For each failure, name the plan that owns the screen
(map 009, Results 021, Filters 022, chat 023/034) and link the bug issue.

**Verify**: the comment is posted. If every check passed, close the MVP milestone.

## Done criteria

- [ ] `npm run check` exits 0 on the tested commit
- [ ] Every check in Step 3 passes on an Android phone against the real server
- [ ] The result comment with media is on #17

## STOP conditions

- Any of 009, 021, 022 or 034 is not merged.
- The server has no Gemini credentials. Record that, and do not count a run with the mock as the MVP check.

## Maintenance notes

- If the MVP definition on #17 changes, change Step 3 to match it.
- After the MVP, plan 029 (progress stream) and 030 (map animation) change what the user sees
  during Step 3. Re-run this check after they land.
