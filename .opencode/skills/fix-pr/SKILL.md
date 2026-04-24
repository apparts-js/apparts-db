---
name: fix-pr
description: Fix a PR that has failing CI or unresolved review comments. Checks out the branch, merges base, handles merge conflicts, diagnoses, applies fixes, commits, and pushes. The calling workflow manages the 'complete' label.
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
   ```mcp
   get_pull_request(pr_number=<pr-number>)
   ```
2. Check out the branch and merge the latest base:
   ```bash
   git fetch origin
   git checkout <head-ref>
   git pull
   git merge origin/<base-ref>
   ```
3. **If the merge produces conflicts**, resolve each file thoughtfully:
   - Open the file and look for `<<<<<<< HEAD`, `=======`, `>>>>>>> origin/...` markers.
   - `HEAD` is your branch's code; `origin/<base-ref>` is the incoming base.
   - When both sides contain real logic, merge them into a correct result rather than blindly picking one side.
   - `git add <file>` after resolving each one.
   - When all conflicts are resolved, commit the merge:
     ```bash
     git commit -m "chore: merge ${BASE} into ${BRANCH}"
     git push
     ```
4. If the merge conflict resolution is complex or you are unsure, invoke the `resolve-pr-conflicts` skill:
   ```
   Skill("resolve-pr-conflicts", args="<pr-number>")
   ```

## Fix CI failures

If context is `ci-failing`:
1. Discover the test runner:
   ```bash
   cat package.json 2>/dev/null | grep -A10 '"scripts"'
   cat Makefile 2>/dev/null | grep -E '^(test|check)'
   cat pyproject.toml 2>/dev/null | grep -A5 '\[tool'
   ```
2. Run tests locally to reproduce the failure.
3. Fix the root cause.
4. Commit and push:
   ```bash
   git add <specific-files>
   git commit -m "fix: resolve CI failure – <description> (#<issue_number>)"
   git push
   ```
5. If the `fix-pr-ci` skill is available, you may invoke it for deeper diagnostics:
   ```
   Skill("fix-pr-ci", args="<pr-number>")
   ```

## Address review comments

If context is `review-comments`:
1. Fetch comments:
   ```mcp
   list_pull_request_comments(pr_number=<pr-number>)
   list_pull_request_reviews(pr_number=<pr-number>)
   ```
2. For each unresolved comment:
   - **Code change**: make change, run tests, commit `fix: address review comment – <description>`.
   - **Question**: reply via `add_issue_comment(issue_number=<pr-number>, body="...")`.
   - **Outdated**: ignore.
3. Push:
   ```bash
   git push
   ```
4. Post summary:
   ```mcp
   add_issue_comment(
     issue_number=<pr-number>,
     body="All review comments addressed. Changes made:\n- <bullet list>"
   )
   ```

## After fixing

Run tests locally one final time. The calling workflow will add the `complete` label after you finish.
