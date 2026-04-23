---
name: fix-pr-ci
description: Diagnose and fix failing CI checks on a pull request. Reads logs, fixes test/lint/build failures, re-triggers flaky runs, and confirms green. Use when CI is red on a PR, "fix the failing checks", "CI is broken", "tests are failing in the PR".
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
argument-hint: [pr-number]
---

Fix the failing CI checks on PR `$ARGUMENTS`.

If no PR number was given, find the PR for the current branch:

```bash
gh pr view --json number -q .number
```

## Step 1 — Read the failing checks

```bash
gh pr checks <pr-number>
```

For each failing check, fetch the log:

```bash
gh run view <run-id> --log-failed
```

Read the errors carefully. Understand *what* failed and *why* before touching any code.

## Step 2 — Check out the branch

```bash
gh pr checkout <pr-number>
git pull
```

## Step 3 — Fix the failures

Work through each failure type:

- **Test failures**: understand what assertion broke. Fix the code, or the test if the test itself is wrong — but be honest about which one needs changing.
- **Lint / type errors**: fix the flagged lines.
- **Build errors**: fix compilation or missing-dependency issues.
- **Flaky / infra errors** (network timeouts, rate limits, unrelated service outages): re-trigger rather than changing code:

```bash
gh run rerun <run-id> --failed
```

Before pushing, run tests locally to confirm green. Get the test command:

```bash
TEST_CMD=$(python ${CLAUDE_SKILL_DIR}/scripts/detect_test_runner.py)
$TEST_CMD
```

Stage only the files you changed (avoid accidentally staging secrets):

```bash
git add <specific-files>
git commit -m "fix: resolve CI failure – <what broke>"
git push
```

## Step 4 — Confirm CI passes

```bash
gh pr checks <pr-number> --watch
```

If CI is green and the PR is still a draft, promote it:

```bash
gh pr ready <pr-number>
```

Report back: which checks were failing, what was fixed, and whether CI is now green.
