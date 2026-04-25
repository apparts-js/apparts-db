---
name: review-pr
description: Run code-review, verify-tests, and code-guidelines-check audits on a PR, post all findings as review comments, and if clean set the PR ready for review and request phuhl. Triggered by '/oc code-review'.
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

## Audit

1. Run test coverage audit:
   ```
   Skill("verify-tests", args=RANGE)
   ```
2. Run code review audit:
   ```
   Skill("code-review", args=RANGE)
   ```
3. Run guidelines check:
   ```
   Skill("code-guidelines-check", args=RANGE)
   ```
4. Save all three outputs to temp files immediately.

## Post findings

1. Parse findings from all three audit outputs. Look for:
   - `**File:** path/to/file.ts, line N` (legacy format)
   - `**file:** path/to/file.ts` + `**line:** N` (structured Actionable findings format)
2. For each finding that maps to a line in the PR diff, post an inline review comment on the head SHA with `side="RIGHT"`:
    ```bash
    bash .opencode/skills/review-pr/scripts/post-review-comment.sh \
      <pr-number> \
      <head-sha> \
      "path/to/file.ts" \
      <line-number> \
      RIGHT \
      "Comment body"
    ```
3. Collect any non-diff findings (including general recommendations and non-line-specific issues) into a general PR comment:
    ```bash
    gh pr comment <pr-number> --body "General findings ..."
    ```

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
