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

## Step 3 — Format and push the rebased branch

After the rebase completes successfully, run prettier on all changed files to avoid a CI formatting failure on the next run:

```bash
CHANGED_FILES=$(git diff --name-only "origin/$BASE" 2>/dev/null || true)
if [ -n "$CHANGED_FILES" ]; then
  echo "$CHANGED_FILES" | xargs npx prettier --write 2>/dev/null || true
  echo "$CHANGED_FILES" | xargs npx eslint --fix 2>/dev/null || true
  git add -u
  git commit -m "style: format after conflict resolution" || true
fi
```

Then force-push the rewritten history. If any regressions are discovered later by CI, they will be handled by the complete-gate workflow.

```bash
git push --force-with-lease
```

## Step 4 — Confirm the PR is now mergeable

```bash
gh pr view <pr-number> --json mergeable,mergeStateStatus
```

`mergeable: MERGEABLE` means conflicts are resolved. CI will re-run automatically:

```bash
gh pr checks <pr-number> --watch
```

Report back: which files had conflicts, how they were resolved, and current CI status.
