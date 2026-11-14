---
name: ship-plan
description: Implement one plan from plans/NNN-*.md end to end — branch, build, validate, open a PR, update the plan's status. Use when asked to "do", "ship", "execute" or "implement" plan NNN (or its issue).
---

# Ship a plan

Input: a plan number (e.g. `026`) or its issue. One plan = one PR = one closable issue.

## 1. Read before you touch anything
- `plans/NNN-*.md` (the spec), its row in `plans/README.md`, and its GitHub issue (`gh issue view <n> --comments`).
- Run the plan's **Drift check** if it has one. If the code no longer matches "Current state", stop and ask (see step 2).
- Check the plan's "Depends on" are DONE on `main`.

## 2. Ask instead of guessing
Ask when any of these come up, before writing code for that part:
- The plan is ambiguous, contradicts the code, or a STOP condition triggers.
- A product/UX/API decision isn't settled in the plan, issue, or #17.
- The work would grow past the plan's scope or touch another owner's area.

How to ask:
- Interactive session: ask the user directly, batched into one set of questions with your recommended answer for each.
- Running as a delegated/background worker: finish any parts that don't depend on the answer, then end with the questions as your final result. Don't message other threads.
- Decisions that belong to a teammate (the plan's help box says who answers): post the question on the plan's issue, then report that you did.

Never invent an answer to a product decision to keep moving.

## 3. Build
- Branch from up-to-date `main`: `git switch -c <area>/<short-name>` (area = server, web, mobile, shared, maps, client-react, plans).
- Follow the plan's steps in order and run each verification it lists.
- Code rules: smallest change that works; match existing style; **no new code comments**; don't remove existing logging; **don't create new test files** (add cases to an existing test file, and only when the plan calls for tests).
- Stay inside the plan's scope. Note anything else you find under "Follow-ups" in the PR instead of fixing it.

## 4. Validate
- `npm run check` must pass (lint, typecheck, unit tests, all builds, smoke). Paste the summary into the PR.
- Anything you couldn't verify (devices, live APIs, credentials) goes in the PR as untested — say so plainly.

## 5. Open the PR
- Commit messages and PR text: **no AI attribution** (no Co-Authored-By, no "generated with/by").
- `gh pr create` using `.github/pull_request_template.md`; fill in every section, including `Closes #<issue>`.
- Update the plan's status row in `plans/README.md` (and the plan's Status block) to "PR #N open" in the same PR.
- Don't merge. Merging is the user's call unless they authorized it for this PR.

## 6. Report
End with exactly: PR URL, head SHA, what `npm run check` showed, what's untested, and any open questions.
