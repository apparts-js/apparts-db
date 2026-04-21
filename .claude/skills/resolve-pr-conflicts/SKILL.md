---
name: resolve-pr-conflicts
description: Resolve merge conflicts on a pull request by rebasing onto its base branch, fixing each conflict thoughtfully, verifying tests pass, and force-pushing. Use when a PR shows merge conflicts, "branch is out of date", "conflicts need resolving", "can't merge due to conflicts".
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
argument-hint: [pr-number]
---

Resolve the merge conflicts on PR `$ARGUMENTS`.

If no PR number was given, find the PR for the current branch:

```bash
gh pr view --json number -q .number
```

## Step 1 — Check out the branch and identify the base

```bash
gh pr checkout <pr-number>
git fetch origin
BASE=$(gh pr view <pr-number> --json baseRefName -q .baseRefName)
echo "Rebasing onto: $BASE"
```

## Step 2 — Rebase onto the base branch

```bash
git rebase origin/$BASE
```

If Git pauses with conflicts, work through each conflicted file:

1. Open the file. `<<<<<<< HEAD` is your branch's code, `>>>>>>> origin/...` is the incoming base.
2. Resolve thoughtfully — when both sides contain real logic, merge them into a correct result rather than blindly picking one side.
3. `git add <file>` after resolving each one.

Then continue:

```bash
git rebase --continue
```

Repeat until the rebase completes. If the result looks wrong at any point (logic deleted, unexpected state), abort and think again:

```bash
git rebase --abort
```

## Step 3 — Verify correctness

Run the full test suite to catch any regressions from the resolution:

```bash
TEST_CMD=$(python ${CLAUDE_SKILL_DIR}/scripts/detect_test_runner.py)
$TEST_CMD
```

Fix any regressions with their own commit, staging only changed files:

```bash
git add <specific-files>
git commit -m "fix: post-rebase corrections"
```

## Step 4 — Force-push

A rebase rewrites history, so a force-push is required. `--force-with-lease` is safer than `--force` — it refuses if someone else pushed to the branch since your last fetch:

```bash
git push --force-with-lease
```

## Step 5 — Confirm the PR is now mergeable

```bash
gh pr view <pr-number> --json mergeable,mergeStateStatus
```

`mergeable: MERGEABLE` means conflicts are resolved. CI will re-run automatically:

```bash
gh pr checks <pr-number> --watch
```

Report back: which files had conflicts, how they were resolved, and current CI status.
