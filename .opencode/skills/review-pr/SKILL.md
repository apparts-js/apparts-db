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
   BASE=$(git merge-base origin/main HEAD)
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
2. For each finding that maps to a line in the PR diff:
   - Post an inline review comment on the head SHA using `create_pull_request_review_comment` with `side="RIGHT"`.
3. Collect any non-diff findings (including general recommendations and non-line-specific issues) into a general PR comment via `add_issue_comment`.

## Finalize

- If **no findings** were posted:
  - Promote PR to ready for review:
    ```mcp
    update_pull_request(pr_number=<pr-number>, draft=false)
    ```
  - Request `phuhl` as reviewer:
    ```bash
    gh pr edit <pr-number> --add-reviewer phuhl
    ```
- If findings were posted, leave the PR state as-is so the author can fix them.

**Note:** The calling workflow handles adding a reaction to the triggering comment.
