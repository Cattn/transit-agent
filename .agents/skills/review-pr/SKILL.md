---
name: review-pr
description: Review one transit-agent PR at a specific head SHA against its plan and the repo's rules, validate it in an isolated worktree, and post the result as one PR comment. Use for "review #N", "re-check #N", or any PR review request.
---

# Review a PR

Input: a PR number. One review = one PR head. A re-check after fixes is a new review of the new head.

## 1. Gather context
- `gh pr view <n> --json title,body,headRefName,headRefOid,author,files,statusCheckRollup`
- Note the **head SHA**; everything you report is about that SHA.
- Read the plan the PR names (`plans/NNN-*.md`) and its issue. The plan is the spec.
- For a re-check, read your previous review comment and only confirm those findings plus anything new in the diff since.

## 2. Validate in an isolated worktree
Never check out the PR in the main working tree.
```
git fetch origin pull/<n>/head:review/pr<n>
git worktree add .review-worktrees/pr<n> review/pr<n>
cd .review-worktrees/pr<n> && npm ci && npm run check
```
If you can't run something (devices, live API keys), say it's unverified; don't guess.

## 3. Review
Look for, in order:
1. **Correctness**: does it do what the plan says? Bugs, broken edge cases, contract mismatches with `packages/shared`.
2. **Scope**: changes outside the plan, or plan steps missing.
3. **Repo rules**: no new code comments; no removed logging; no new test files (cases belong in an existing test file); matches existing style; no AI attribution in commits.
4. **Tests**: the plan's verification steps actually covered.
5. **UI evidence**: a PR that changes any screen must have a video or screenshots of each changed screen in "Screenshots / video". Missing = P2.

Each finding needs a `file:line`, a concrete failure scenario, and a severity (P1 blocks merge, P2 fix before merge, P3 optional). Skip style nits that aren't rule violations. Verify a suspected bug (run it, or read the code path end to end) before reporting it.

## 4. Post once
- One PR comment: verdict (**pass** / **fix needed**), head SHA, findings, what was validated, what's unverified.
- Use `gh pr review <n> --comment` (an approval isn't possible when the reviewer's `gh` account authored the PR, and merging isn't the reviewer's decision).
- Don't push fixes to the PR unless you were asked to. Don't merge unless the user explicitly authorized merging this PR.

## 5. Clean up and report
```
git worktree remove --force .review-worktrees/pr<n>
git branch -D review/pr<n>
```
Final reply: verdict, findings (one line each), review comment link. Don't message other threads.
