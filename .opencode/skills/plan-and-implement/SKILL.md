---
name: plan-and-implement
description: Plan, subdivide, and implement a GitHub issue end-to-end. Triggered when an issue is labeled 'opencode'. Creates subtasks, opens a branch and draft PR, merges base regularly, handles merge conflicts, implements with TDD, pushes regularly, self-checks with the same audits used in code review, and marks the PR complete when finished.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
context: fork
agent: general-purpose
argument-hint: <issue-number>
---

You are invoked to drive an issue labeled `opencode` to completion.

## Inputs

- `$ARGUMENTS` contains the issue number.

## Setup

1. Determine repo slug:
   ```bash
   REPO=$(git remote get-url origin | sed -E 's/.*github\.com[/:]([^/]+)\/([^/]+?)(\.git)?$/\1\/\2/')
   OWNER=$(echo "$REPO" | cut -d/ -f1)
   ```
2. Fetch the issue body and all comments:
   ```bash
   ISSUE_BODY=$(gh issue view "$ARGUMENTS" --json body -q '.body')
   ISSUE_COMMENTS=$(gh issue view "$ARGUMENTS" --json comments -q '.comments[].body')
   ```
3. Determine the base branch — check issue body and comments for stacking instructions (e.g. "stack on #42", "base on #42", "depends on #42"). If none found, default to `master`:
   ```bash
   STACK_ISSUE=$(printf '%s\n%s' "$ISSUE_BODY" "$ISSUE_COMMENTS" | grep -oPi '(?:stack|base|depends) (?:this )?(?:on |upon )?(?:PR |issue )?#\d+' | grep -oP '\d+' | head -1 || echo "")
   if [ -n "$STACK_ISSUE" ]; then
     STACK_BRANCH=$(gh pr list --state open --json number,headRefName -q ".[] | select(.headRefName | startswith(\"${STACK_ISSUE}-\")) | .headRefName" 2>/dev/null || echo "")
     BASE_BRANCH="${STACK_BRANCH:-master}"
   else
     BASE_BRANCH="master"
   fi
   ```
4. If a PR already exists for this issue, fetch its comments and review comments too:
   ```bash
   PR_NUMBER=$(gh pr list --state open --json number,headRefName -q ".[] | select(.headRefName | startswith(\"${ARGUMENTS}-\")) | .number")
   if [ -n "$PR_NUMBER" ]; then
     PR_COMMENTS=$(gh pr view "$PR_NUMBER" --json comments -q '.comments[].body')
     PR_REVIEW_COMMENTS=$(gh api "repos/${REPO}/pulls/${PR_NUMBER}/comments" --jq '.[] | {id, path, line, body, in_reply_to_id, user: .user.login}' 2>/dev/null || echo "")
   fi
   ```

## State detection

Check these conditions in order. The first matching condition determines the state.

1. **No subtasks comment**: Neither `$ISSUE_BODY` nor any comment in `$ISSUE_COMMENTS` contains `## Subtasks`.
   → Load `references/01-plan.md`

2. **No PR exists**: No open PR has a head ref starting with `${ARGUMENTS}-`.
   → Load `references/02-create-pr.md`

3. **"Open draft PR" unchecked**: The subtasks comment contains `- [ ] Open draft PR`.
   → Load `references/02-create-pr.md`

4. **"Write stubs and failing tests" unchecked**: The subtasks comment contains `- [ ] Write stubs and failing tests`.
   → Load `references/02-create-pr.md`

5. **"Implement logic to pass tests" unchecked**: The subtasks comment contains `- [ ] Implement logic to pass tests`.
   → Load `references/05-implement.md`

6. **"Update docs / README if needed" unchecked**: The subtasks comment contains `- [ ] Update docs / README if needed`.
   → Load `references/05-implement.md`

7. **"Fix issues found in audit" unchecked**: The subtasks comment contains `- [ ] Fix issues found in audit`.
   → Load `references/06-self-check.md`

8. **All subtasks checked**: None of the above are unchecked.
   → Load `references/07-finalize.md`

## Dispatch

Load the identified reference file and follow its instructions **from top to bottom**.

- Some reference files end with **STOP** — do not proceed further in this session.
- Some reference files end with "Load `references/XX-...md`" — load that file next and continue in the same session.
- Do not continue beyond what the reference file instructs.

## Principles

- Push every commit. Each push is a checkpoint.
- Never check off a subtask if tests are failing.
- If interrupted, re-running this skill on the same issue will resume from the first unchecked subtask.
- Always merge the base branch before starting work to minimize conflicts.
- **Do not run tests locally.** The target repository's CI workflows are the source of truth for test results. Push changes and let CI verify them.
- **Read all comments on the issue and on the PR before implementing anything.** Previous review feedback, discussions, and issue comments may contain critical context. Re-reading them prevents repeating the same mistakes that were already pointed out.
- **When writing code that could be misunderstood** — non-obvious patterns, intentional workarounds, deliberate deviations from convention — add an inline code comment explaining _why_ the code is written that way. This prevents reviewers from flagging deliberate choices as errors.
- **No code-line review comment may be left unaddressed.** Before marking any subtask complete, fetch all PR review comments on code lines. For each comment from a reviewer: either implement the suggested change, or reply with an explanation of why the current code is correct. After all comments are handled, verify with `scripts/verify-no-unresolved-comments.sh`. The final state must have zero unresolved code-line review comments.
- **Respect stacking instructions in issue comments.** If any issue comment says to stack/base/depend on another issue or PR (e.g. "stack on #42"), that PR's branch becomes the base branch instead of `master`. The setup step already parses this into `$BASE_BRANCH`.
