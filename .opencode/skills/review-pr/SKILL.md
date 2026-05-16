---
name: review-pr
description: Run code-review and verify-tests audits on a PR, filter findings for relevance and scope, post only targeted review comments, and if clean set the PR ready for review and request phuhl. Triggered by '/oc code-review'.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
context: fork
agent: general-purpose
argument-hint: <pr-number>
---

You are invoked because someone commented `/oc code-review` on a PR.

## Inputs

Parse `$ARGUMENTS` as: `<pr-number>`. The calling workflow may also pass a `<comment-id>`, but the skill no longer uses it directly (the workflow handles the reaction).

## Setup

1. Fetch PR metadata and head SHA.
2. Determine diff range:
   ```bash
   BASE=$(git merge-base origin/master HEAD)
   RANGE="${BASE}..HEAD"
   ```
3. Determine changed files:
   ```bash
   CHANGED_FILES=$(git diff --name-only "$RANGE")
   ```

## Audit

1. Run test coverage audit:
   ```
   Skill("verify-tests", args=RANGE)
   ```
2. Run code review audit:
   ```
   Skill("code-review", args=RANGE)
   ```
3. Save both outputs to temp files immediately.

## Filter findings

The goal is to keep the review focused on the feature at hand. Do **not** post a flood of comments.

1. Parse findings from both audit outputs. Look for:
   - `**File:** path/to/file.ts, line N` (legacy format)
   - `**file:** path/to/file.ts` + `**line:** N` (structured Actionable findings format)

2. **Scope filter** — discard any finding whose file is **not** in `CHANGED_FILES`. Only issues in files touched by this PR belong in the review.

3. **Relevance filter** — within the changed files, keep only findings that are clearly related to the PR's purpose:
   - **Keep:** bugs, correctness issues, safety problems, or missing/thin test coverage for logic introduced or modified by this PR.
   - **Keep:** pre-existing issues only if the PR actively touches that exact code and the issue is a genuine risk (not a style nit).
   - **Discard:** style nicks, formatting preferences, naming suggestions unrelated to the change, architectural musings, or general "best practice" recommendations that do not address a concrete bug or test gap in the new code.
   - **Discard:** off-topic issues in changed files that concern code the PR did not materially alter (e.g., "this nearby function could be improved").

4. **Severity priority** — if many findings survive filtering, prioritize `must-fix`, then `should-fix`. If the list is still long (> 10 inline comments), post only the `must-fix` items inline and summarize the rest in a single general comment.

## Post findings

1. For each **filtered** finding that maps to a line in the PR diff, post an inline review comment on the head SHA with `side="RIGHT"`:
   ```bash
   bash .opencode/skills/review-pr/scripts/post-review-comment.sh \
     <pr-number> \
     <head-sha> \
     "path/to/file.ts" \
     <line-number> \
     RIGHT \
     "Comment body"
   ```
2. Collect any remaining non-diff or lower-priority findings into **at most one** general PR comment. If there are no such findings, do **not** post a general comment.

## Finalize

- If **no findings** were posted:
  - Promote PR to ready for review:
    ```bash
    gh pr ready <pr-number>
    ```
- If findings were posted, leave the PR state as-is so the author can fix them.

In **both cases**, request `phuhl` as reviewer so a human is notified:

```bash
gh pr edit <pr-number> --add-reviewer phuhl
```

**Note:** The calling workflow handles adding a reaction to the triggering comment.
