# Plan and issue reconciliation — 2026-11-14

Baseline: `0b37886`. Reviewed all 36 original numbered plan files, UI direction/slices and transit research, all 43 issue bodies (17 open, 26 closed; historical bodies checked for status/decision drift), and PR states. Source audit focused on the Android trip flow and its hooks, maps contract, provider/planning/store boundaries. Current user decision: finish Android transit before flights. iOS works; design polish is deferred.

## Work split

- **Cattn:** finish/evaluate #72 using #54 prompts, then 035 chat card and 029 progress with actual Android wiring. Own cross-screen acceptance (036), 031 real transit and 008 durable watches. Make final design decisions and resolve unsupported Settings rows. Do not start a second speed fix before measuring the candidate.
- **DMFriends:** finish 022/#74 with D12 Transit/Fly + Drive filter, then 037 search → Filters → Results → Save → reopen/manage, including loading/error/retry and light/dark consistency. Coordinate Home edits with Cattn/Kraken. Fly waits until transit acceptance, then 011 fixture comparator → 024 functional Fly.
- **Kraken:** finish 009/#76 with real Android selection, gestures, fit/padding, worker and saved-color proof. Then 030 motion coordinated with Cattn's 029 consumer; supported 025 Settings after 037, coordinating Home profile refresh. Map remains a renderer, not an API/store owner.

## Vetted findings

All findings below have HIGH confidence from source/plan reads. Effort is the implementation size; fixing plan wording alone is smaller.

| Finding | Impact | Effort | Fix risk | Evidence and disposition |
|---|---|---|---|---|
| Home search/cards do not finish actions; save failures hidden | High: main flow stops after initial demo | M | MED | `HomeChrome.android.tsx:158` discards query; TripCard has no callback; `HomeScreen.tsx:65,190` omits hook errors/catches save. New 037 owns completion. |
| Settings omits the platform file Metro actually selects | High: Android would keep the placeholder | S | LOW | `SettingsScreen.android.tsx:57`; original 025 Scope excluded it. Scope now includes platform replacement and Home profile refresh. |
| Streaming/animation had no Android consumer owner | High: package demos could pass without product behavior | M | MED | 029/030 excluded screens and assigned wiring to DONE 023. 029 now owns Android plumbing; 030 owns renderer/device handoff. |
| Watch lookup drops departed trips and owner identity | High: missed-trip replacement/persistence cannot work safely | M | MED | `store/sqlite.ts:86` filters departure >= now; `store/types.ts:4` requires deviceId. 008 BLOCKED pending internal owned records, durable updates and retention/cadence policy. |
| Transitous plan still specified OTP GraphQL | High: wrong adapter implementation | M–L | HIGH | Original 031 Steps 2/3 used OTP_URL/OtpProvider. Replaced with captured MOTIS v6 contract, recorded mapping/provenance cases and explicit unresolved return/identity gates. |
| Historical chat-card data absent from hook messages | Medium: old replies can show/select unrelated results | S | MED | `use-agent-chat.ts:5,37` stores only latest plan. 035 scope now allows per-message plan/draft snapshots and defined historical selection. |
| Fixture flight plan depended on unfinished 019 helpers | Medium: supposedly independent work cannot close | L | MED | Original 011 Steps 6/7 require missing selector/summary/filter helpers; JFK test conflicts with 250 km radius. Fixture boundary corrected; full handoff deferred/refinement-required. |

## Direction and trade-offs

1. **One complete Android transit journey.** 037 closes concrete dead ends in the already-merged Home/Results. This delays Fly but makes the existing product usable; Cattn selected this direction during reconciliation.
2. **Truthful progress over decorative waiting.** 029 and 030 implement the existing map-build vision, with Android consumer ownership and failure/reset handling. Animation must not delay the functional loop or create false live-data claims.
3. **Real routes before automated watches.** 031 supplies real geometry/provenance/identity; 008 then supplies durable departure assistance. Exact watch cadence, return representation and unsupported Settings controls remain owner decisions, not guessed defaults.

## Plan coverage and reconciliation outcome

- **Keep DONE (merged implementation/history, not fresh runtime certification):** 001–007, 012–018, 020, 021, 023, 028, 032–034. GitHub merge states agree with index completion. Hotspot source reads confirm API/provider/contracts, SQLite saves, format/color helpers, places, hooks and mobile Home/Results/session code exist. 006 live-check and 028 merge wording corrected; 017 palette question retired. 018 link removal is open #75, not merged.
- **In progress:** 009/#76, 022/#74. Preserve their active owners; no competing implementations.
- **Near-term:** 035 waits on #72, 036 is fixture acceptance, new 037 is continuity, 029 progress, 030 renderer/Android handoff, 025 supported Settings (unsupported controls await decision).
- **Refinement/blocked:** 031 return/identity/freshness contracts; 008 due/overdue ownership/storage/cadence. Do not hand these to an executor as fully specified builds.
- **Deferred and refresh before implementation:** 010 (validated bike/transit composition), 011 (fixture comparator response/scope), 019 (live fares/round trips), 024 (consume comparator), 026/027 (web). Existing plans retained; no duplicate flight/map feature plans created.
- **References:** ui-direction updated for no Budget/lock icons, existing client-react hooks, completed screen handoffs and functional iOS. ui-slices stays historical.
- **Numbering:** chat polish keeps 035/#73. Duplicate MVP verification renamed 036; new continuity is 037. Historical reconcile-log mentions of the old 035 are preserved as history.

## GitHub issue reconciliation

The initial advisory run made local changes only. On the owner's subsequent instruction, GitHub issue bodies/owners/blockers/milestones were synchronized, #77 (037) and #78 (036) created, and the plans prepared for publication. The inventory below preserves the original audit snapshot, not the later publication state. Closed history stays closed.

Issue corrections included in publication:

- #17: mirror Android transit sequence, 034 merged, 036/037 numbering, and real versus fixture acceptance.
- #16: mirror current UI direction; remove inactive design ownership and obsolete Drive tab/budget/lock/tap-to-confirm guidance.
- #13: mark #76 in progress; retire palette migration question. #46: #74 in review and D12 scope.
- #73: #69 is merged; only #72 blocks. #54: evaluate #72 before prescribing another fix.
- #55/#56: explicit Android consumer in 029; do not reopen DONE 023 for wiring.
- #57: replace OTP outline with refreshed Transitous plan; #12: retain storage/cadence blockers.
- #14: validated bike composition after real transit. #15: fixture composer independent of unfinished 019, real routing #57 rather than closed #11.
- #41: actual Android file/Compose scope, profile refresh and unresolved unsupported rows. #28/#44: flight expansion deferred.
- #42/#45: consistently P3/deferred; refresh functional controls when resumed.
- Closed #49/#6/#23 bodies have historical status/questions drift; do not reopen delivered work to resolve prose.

| Issue | Observed state | Owner | Title |
|---|---|---|---|
| [#1](https://github.com/Cattn/transit-agent/issues/1) | CLOSED | Unassigned | Flights |
| [#2](https://github.com/Cattn/transit-agent/issues/2) | CLOSED | Unassigned | Commute |
| [#3](https://github.com/Cattn/transit-agent/issues/3) | CLOSED | Unassigned | Bike |
| [#4](https://github.com/Cattn/transit-agent/issues/4) | CLOSED | Unassigned | Agent/app implementation |
| [#5](https://github.com/Cattn/transit-agent/issues/5) | CLOSED | Cattn | Plan 001: Add a unit-test runner (Vitest) for shared + server |
| [#6](https://github.com/Cattn/transit-agent/issues/6) | CLOSED | Cattn | Plan 002: Shared trip domain contract (zod schemas + types) |
| [#7](https://github.com/Cattn/transit-agent/issues/7) | CLOSED | Unassigned | Plan 003: Planning API + saved itineraries with a fixture route provider |
| [#8](https://github.com/Cattn/transit-agent/issues/8) | CLOSED | Cattn | Plan 004: Typed API client + shared TripDraft state (filters ↔ agent) |
| [#9](https://github.com/Cattn/transit-agent/issues/9) | CLOSED | Cattn | Plan 005: Persist saved itineraries + travel profiles (SQLite) |
| [#10](https://github.com/Cattn/transit-agent/issues/10) | CLOSED | Cattn | Plan 006: Gemini trip-planner agent via ADK (POST /api/agent/messages) |
| [#11](https://github.com/Cattn/transit-agent/issues/11) | CLOSED | Cattn | Plan 007: Real transit routing + live arrivals (spike → integration) |
| [#12](https://github.com/Cattn/transit-agent/issues/12) | OPEN | Cattn | Plan 008: Auto-watch saved trips + "when do I leave" engine |
| [#13](https://github.com/Cattn/transit-agent/issues/13) | OPEN | KrakenTheJaken | Plan 009: Finish shared route maps on web and Android (mobile via Expo DOM) |
| [#14](https://github.com/Cattn/transit-agent/issues/14) | OPEN | Cattn | Plan 010: Bike + transit ("modeMix"): personal bike, bikeshare docks, bike-on-board rules |
| [#15](https://github.com/Cattn/transit-agent/issues/15) | OPEN | DMFriends | Plan 011: Flight door-to-door comparator (other airports, drive/train, gas + parking) |
| [#16](https://github.com/Cattn/transit-agent/issues/16) | OPEN | Cattn, DMFriends | UI direction: screens, filters ↔ agent, results, map, home (web + mobile) |
| [#17](https://github.com/Cattn/transit-agent/issues/17) | OPEN | Cattn | Roadmap: MVP priorities, status, and open decisions |
| [#20](https://github.com/Cattn/transit-agent/issues/20) | CLOSED | Cattn | Plan 012: Mock API client so the UI can build every screen before the server is ready |
| [#21](https://github.com/Cattn/transit-agent/issues/21) | CLOSED | DMFriends | Plan 013: "When do I leave" logic as pure shared code |
| [#22](https://github.com/Cattn/transit-agent/issues/22) | CLOSED | DMFriends | Plan 014: Airport list, drive-to-airport cost model and sample fares |
| [#23](https://github.com/Cattn/transit-agent/issues/23) | CLOSED | Cattn | Plan 015: Shared React hooks for web + mobile (@transit/client-react) |
| [#24](https://github.com/Cattn/transit-agent/issues/24) | CLOSED | DMFriends | Plan 016: Shared display text (times, costs, live vs scheduled, risk) |
| [#25](https://github.com/Cattn/transit-agent/issues/25) | CLOSED | DMFriends | Plan 017: Shared badge and mode colors (light + dark), and saved trips keep their route color |
| [#26](https://github.com/Cattn/transit-agent/issues/26) | CLOSED | DMFriends | Plan 018: Mobile platform plumbing (device ID, location, foreground, links, API URL) |
| [#28](https://github.com/Cattn/transit-agent/issues/28) | OPEN | Cattn | Plan 019: Real flight prices from an adapted copy of Clovis (all flights, not just the cheapest) |
| [#39](https://github.com/Cattn/transit-agent/issues/39) | CLOSED | DMFriends | Plan 020: Build the mobile map home (tracked trips, Transit/Drive/Fly, light and dark) |
| [#40](https://github.com/Cattn/transit-agent/issues/40) | CLOSED | DMFriends | Plan 021: Show route results in the mobile half sheet |
| [#41](https://github.com/Cattn/transit-agent/issues/41) | OPEN | KrakenTheJaken | Plan 025: Add the mobile settings screen |
| [#42](https://github.com/Cattn/transit-agent/issues/42) | OPEN | Rad1ee | Plan 026: Build the web map home (left panel, permanent agent, light and dark) |
| [#43](https://github.com/Cattn/transit-agent/issues/43) | CLOSED | Cattn | Plan 023: Open the agent chat from the mobile Ask button |
| [#44](https://github.com/Cattn/transit-agent/issues/44) | OPEN | DMFriends | Plan 024: Compare door-to-door options when Fly is selected |
| [#45](https://github.com/Cattn/transit-agent/issues/45) | OPEN | Unassigned | Plan 027: Show web results beside the permanent agent |
| [#46](https://github.com/Cattn/transit-agent/issues/46) | OPEN | DMFriends | Plan 022: Edit trip filters in the Android full sheet |
| [#49](https://github.com/Cattn/transit-agent/issues/49) | CLOSED | Cattn | Plan 028: Serve GET /api/places from the built-in place list |
| [#51](https://github.com/Cattn/transit-agent/issues/51) | CLOSED | Cattn | Live agent check: Hydrogen on real trip prompts |
| [#53](https://github.com/Cattn/transit-agent/issues/53) | CLOSED | Cattn | Real place search for the agent and search box (pull plan 007 step 5 forward) |
| [#54](https://github.com/Cattn/transit-agent/issues/54) | OPEN | Cattn | Planner turns are slow (median 16 s, flight-style prompts near the 40 s timeout) |
| [#55](https://github.com/Cattn/transit-agent/issues/55) | OPEN | Cattn | Plan 029: Stream the agent's progress (places, draft, searching, routes) while it works |
| [#56](https://github.com/Cattn/transit-agent/issues/56) | OPEN | KrakenTheJaken | Plan 030: Animate the map while the agent builds a trip |
| [#57](https://github.com/Cattn/transit-agent/issues/57) | OPEN | Cattn | Plan 031: Real Boston routing on Transitous (plan 007 steps 2–7) |
| [#62](https://github.com/Cattn/transit-agent/issues/62) | CLOSED | Unassigned | Plan 032: Faster npm run check and npm test (build once, caches, CI uses check) |
| [#68](https://github.com/Cattn/transit-agent/issues/68) | CLOSED | Cattn | Plan 034: Keep the mobile agent chat for the app session |
| [#73](https://github.com/Cattn/transit-agent/issues/73) | OPEN | Cattn | Plan 035: Agent chat matches frame 04 (best-option card, chip icons) |

## Considered and rejected

- Rebuilding merged Home/Results/chat, reopening closed research, or moving route palette into shared: duplicates settled work; use targeted completion instead.
- Treating iOS design deferral as removal of iOS support: contradicts the user; retain functional fallbacks and exports.
- Making fixtures prove live arrivals, or replacing walks with guessed bike times: unsupported data/connection claims; require actual provider evidence.
- More flight/web/booking breadth before transit completion: deferred by the owner's selected milestone.

## Initial audit verification and limits

Documentation consistency checks: duplicate numbered IDs, local Markdown targets, scope of changes and `git diff --check`. No source edits by this audit, no new tests, no installs/builds, no commits/pushes/merges. No full test suite, Android runtime/Figma visual comparison, provider API/terms revalidation, complete security audit, dependency advisory scan or performance benchmark was run. Historical DONE is not a statement that every old done criterion passed again today. PR snapshots are time-bound; re-read them before acting. An unrelated source edit to `apps/mobile/src/platform/location.ts` appeared during the run and was left untouched.

## Publication follow-through

Explicitly authorized by Cattn after the initial audit. New issues: #77 Android continuity (DMFriends, Android transit) and #78 Android MVP verification (Cattn, MVP). Milestone 2 is now Android transit; milestone 3 is Later expansion. Existing completed issues stay closed; no currently open implementation qualifies for closure solely from plan cleanup. Open #72/#74/#75/#76 remain unmerged. All 45 issue updates were read back and compared against intended bodies, titles, owners, labels and milestones without mismatches. Full npm run check was attempted: the default lint scan fails on unrelated .worktrees/sweetpad-ios files. Main-checkout lint with only .worktrees excluded and package builds pass; mobile typecheck fails because installed Expo UI/navigation/font/gesture dependencies are missing. No source/config workaround or dependency install was made for a plans-only publication.

Publication checks: all existing workspace unit tests passed (mobile 30, server 111, maps 65, shared 187; client-react has no test files), server/web builds passed, and API smoke checks passed. Main-checkout lint passes with unrelated nested worktrees excluded. Full check remains blocked by the default nested-worktree lint scan and missing local mobile dependencies. No dependency/source changes were made to mask these limitations.
