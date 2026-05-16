---
name: fix-pr
description: Fix a PR that has failing CI or unresolved review comments. Checks out the branch, merges base, handles merge conflicts, diagnoses, applies fixes, commits, and pushes. The calling workflow manages the 'auto-review' label.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
context: fork
agent: general-purpose
argument-hint: <pr-number> [ci-failing|review-comments]
---

You are invoked to fix a PR. The context is provided in `$ARGUMENTS`.

## Inputs

Parse `$ARGUMENTS` as: `<pr-number> <context>` where context is `ci-failing` or `review-comments`.

## Setup

1. Fetch PR metadata (note `base.ref` and `head.ref`):
   ```bash
   gh pr view <pr-number> --json baseRefName,headRefName,title,body
   ```
2. Check out the branch and merge the latest base:
   ```bash
   git fetch origin
   git checkout <head-ref>
   git pull
   git merge origin/<base-ref>
   ```
3. **If the merge succeeds** (no conflicts), proceed directly to "Check implementation completeness".
4. **If the merge produces conflicts** (merge exits non-zero), **do not attempt to resolve them inline.** Abort the merge and delegate to the `resolve-pr-conflicts` skill, which handles conflict resolution end-to-end via rebase:
   ```bash
   git merge --abort
   ```
   Then invoke:
   ```
   Skill("resolve-pr-conflicts", args="<pr-number>")
   ```
   After `resolve-pr-conflicts` completes (it rebases onto the base branch and force-pushes), pull the updated branch so you are back on the latest conflict-free state:
   ```bash
   git fetch origin
   git checkout <head-ref>
   git pull
   ```
   The branch is now up-to-date with the base. Proceed to "Check implementation completeness".

## Check implementation completeness

Before attempting any fix, determine whether the implementation is actually finished.

1. Find the associated issue:

   ```bash
   ISSUE_NUM=$(gh pr view <pr-number> --json headRefName -q '.headRefName' | grep -oE '^[0-9]+' || true)

   if [ -z "$ISSUE_NUM" ]; then
     ISSUE_NUM=$(gh pr view <pr-number> --json body -q '.body' | grep -oEi '(close|closes|closed|fix|fixes|fixed|resolve|resolves|resolved)[[:space:]]*#[0-9]+' | grep -oE '[0-9]+' | head -1)
   fi
   ```

2. Count unchecked subtasks in the issue body **and** in issue comments:

   ```bash
   UNCHECKED_BODY=$(gh issue view "$ISSUE_NUM" --json body -q '.body' 2>/dev/null | grep -c '\- \[ \]' || true)
   UNCHECKED_COMMENTS=$(gh api "repos/{owner}/{repo}/issues/${ISSUE_NUM}/comments" --jq '.[].body' 2>/dev/null | grep -c '\- \[ \]' || true)
   UNCHECKED=$((UNCHECKED_BODY + UNCHECKED_COMMENTS))
   ```

3. **If unchecked subtasks exist** (`$UNCHECKED -gt 0`):

   - The implementation is not complete. **Hand off to `plan-and-implement` and stop.**
   - Invoke:
     ```
     Skill("plan-and-implement", args="$ISSUE_NUM")
     ```
   - **Do not proceed to Fix CI failures or Address review comments.** The auto-review gate will re-invoke `fix-pr` after `plan-and-implement` finishes.

4. **If all subtasks are checked** (or no associated issue was found):
   - Proceed to the relevant section below.

## Fix CI failures

If context is `ci-failing`:

1. **Read the failed CI logs first.** Do not touch code until you understand what failed:
   ```bash
   BRANCH=$(gh pr view <pr-number> --json headRefName -q '.headRefName')
   RUN_ID=$(gh run list --branch "$BRANCH" --status failure --limit 1 --json databaseId -q '.[0].databaseId')
   gh run view "$RUN_ID" --log-failed
   ```
   Read the errors carefully. Understand _what_ failed and _why_ before making any changes.
2. Fix the root cause.
3. Format and commit:
   ```bash
   git add <specific-files>
    npx prettier --write $(git diff --cached --name-only) 2>/dev/null || true
    npx eslint --fix $(git diff --cached --name-only) 2>/dev/null || true
    git add $(git diff --cached --name-only) 2>/dev/null || true
    git commit -m "fix: resolve CI failure – <description> (#<issue_number>)"
   git push
   ```
4. If the `fix-pr-ci` skill is available, you may invoke it for deeper diagnostics:
   ```
   Skill("fix-pr-ci", args="<pr-number>")
   ```

## Address review comments

If context is `review-comments`:

1. Fetch comments and reviews:
   ```bash
   gh pr view <pr-number> --json comments,reviews
   ```
2. For each unresolved comment:
   - **Code change**: make change, then format and commit:
     ```bash
     git add <specific-files>
     npx prettier --write $(git diff --cached --name-only) 2>/dev/null || true
     npx eslint --fix $(git diff --cached --name-only) 2>/dev/null || true
     git add $(git diff --cached --name-only) 2>/dev/null || true
     git commit -m "fix: address review comment – <description>"
     ```
   - **Question**: reply via `gh pr comment <pr-number> --body "..."`.
   - **Outdated**: ignore.
3. Push:
   ```bash
   git push
   ```
4. Post summary:
   ```bash
   gh pr comment <pr-number> --body "All review comments addressed. Changes made:
   ```

- <bullet list>"

  ```

  ```

## After fixing

Push your changes. The auto-review gate workflow will monitor CI and re-invoke you if further fixes are needed. **Do not run tests locally.**
