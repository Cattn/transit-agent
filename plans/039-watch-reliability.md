# Plan 039: Reliable saved-trip monitoring and Android journey controls

## Status

- State: IN PROGRESS, stacked on PR #100
- Priority: P1
- Risk: MED
- Issue: https://github.com/Cattn/transit-agent/issues/107
- Base: server/watches, rebased onto latest main before publication

## Why this matters

The PR #100 feature review identified stale predictions labelled live, uncertain boarding triggering replacement, disappearing switch explanations, and limited transfer monitoring. Cattn authorized implementing those improvements and using the supplied artwork as the Android APK icon.

## Scope and decisions

- Record successful refreshes separately from attempts; demote stored realtime data after refresh failures and age live badges on the client.
- Keep automatic replacement for confirmed misses and impossible connections. Without sufficient evidence, ask whether the rider boarded rather than switching based on server check history.
- Offer explicit boarding and missed-trip controls. Location sharing is opt-in per trip and session, foreground Home only, with bounded server retention. Require multiple accurate moving samples to infer boarding.
- Preserve change explanations until dismissed; stale in-flight checks must not overwrite rider actions.
- Dismiss waits for a successful save before closing the status sheet. The normal status line does not duplicate the durable change explanation, so acknowledging a change removes the visible announcement immediately.
- Track confirmed legs, show arrival/transfer/finished states, warn about tight connections, and recover from a recent position or the transfer stop. Preserve hard arrival deadlines.
- Android presentation selected on the Pixel: one compact status pill above the route drawer opens a native Material sheet. Boarding is a direct question with filled Yes and outlined No buttons; change details and optional location sharing live in the sheet. The pill uses a bus icon for boarding rather than a notification bell.
- Retry failed or empty replacement searches while the original trip remains active.
- A manual missed-departure action shows immediate rerouting progress, queues an immediate non-overlapping watch check, and polls the open trip every two seconds until the result arrives. The map reframes when the replacement request changes; no back navigation is required.
- Apply the supplied image to Android launcher icons through the existing app configuration.
- Settings: remove the misleading disabled/off watch and next-option switches. Watching is managed on each saved trip; describe confirmed-miss recovery rather than implying an AI-only global setting exists.
- Notifications are omitted under the user's feasibility exception: server-delivered alerts for a closed standalone APK require native FCM configuration and delivery integration absent from this repository. No Expo push dependency is introduced.

## Verification

Run `npm run check` before pushing. Modify existing test cases only. Cover degraded freshness and recovery, ambiguous boarding, confirmed missed departures, persistent changes and dismissal races, provider fallback refresh, missed connections and replan origins, endpoint ownership and validation, and SQLite persistence. Record any unavailable Android device or live-provider verification in the PR.

## Completion

Open a stacked PR targeting server/watches and closing #107. Update this status and the index row with its number. Rebase PR #100 onto latest main and this branch onto the resulting parent; Cattn explicitly permits force-with-lease updates to feature branches, never main. Do not merge.
