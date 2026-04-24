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
2. Fetch the issue:
   ```mcp
   get_issue(issue_number=$ARGUMENTS)
   ```

## State detection

- **No subtasks**: Issue body lacks `## Subtasks`.
- **No PR**: No open PR whose head is `{owner}:${ARGUMENTS}-*`.
- **In progress**: Open draft PR exists with unchecked subtasks.
- **Done**: All subtasks checked.

## Plan

If no subtasks exist, decompose the issue into small, committable steps. Append:

```text
## Subtasks
- [ ] Write stubs and failing tests
- [ ] Implement logic to pass tests
- [ ] Update docs / README if needed
- [ ] Open draft PR
- [ ] Fix issues found in audit
- [ ] CI passes and PR is ready for review
```

Update the issue body with `update_issue`.

## Create PR

If no branch/PR exists:
```bash
git fetch origin
git checkout main && git pull
git checkout -b ${ARGUMENTS}-<short-slug>
git push -u origin ${ARGUMENTS}-<short-slug>
```

Create a draft PR:
```mcp
create_pull_request(
  title="<concise title>",
  body="Work in progress — see issue #${ARGUMENTS} for context.\n\nCloses #${ARGUMENTS}",
  head="${ARGUMENTS}-<short-slug>",
  base="main",
  draft=true
)
```

Check off "Open draft PR" in the issue.

## Merge base branch before implementing

Before starting any work on an existing branch, keep it up to date with its base to avoid conflicts later.

1. Fetch PR metadata to get `base.ref`.
2. Check out the branch and merge the latest base:
   ```bash
   git fetch origin
   git checkout <branch-name>
   git pull
   git merge origin/<base-branch>
   ```
3. **If the merge produces conflicts**, resolve each file thoughtfully:
   - Open the file and look for `<<<<<<< HEAD`, `=======`, `>>>>>>> origin/...` markers.
   - `HEAD` is your branch's code; `origin/<base-branch>` is the incoming base.
   - When both sides contain real logic, merge them into a correct result rather than blindly picking one side.
   - `git add <file>` after resolving each one.
   - When all conflicts are resolved, commit the merge:
     ```bash
     git commit -m "chore: merge ${BASE_BRANCH} into ${BRANCH}"
     git push
     ```
4. If the merge conflict resolution is complex or you are unsure, invoke the `resolve-pr-conflicts` skill for assistance:
   ```
   Skill("resolve-pr-conflicts", args="<pr-number>")
   ```

## Implement

Find the open PR:
```mcp
list_pull_requests(head="${OWNER}:${ARGUMENTS}-*", state="open")
```

Record `pr_number`. **Before starting work**, remove the `complete` label:
```mcp
remove_labels_from_pr(pr_number=<pr_number>, labels=["complete"])
```

For each unchecked subtask up to "Fix issues found in audit":
1. Do the work (TDD: stubs + failing tests → implement → refactor).
2. Run tests locally.
3. Commit and push:
   ```bash
   git add <specific-files>
   git commit -m "feat: <description> (#${ARGUMENTS})"
   git push
   ```
4. Update the issue checkbox:
   - Fetch current body with `get_issue(issue_number=$ARGUMENTS)`.
   - Replace `- [ ] <exact text>` with `- [x] <exact text>`.
   - Update with `update_issue(issue_number=$ARGUMENTS, body="...")`.

## Self-check before finalizing

Before promoting the PR, run the same audits that `review-pr` runs and fix any `must-fix` findings inline. This prevents the CI gate from immediately rejecting the PR.

1. Determine the diff range:
   ```bash
   BASE=$(git merge-base origin/main HEAD)
   RANGE="${BASE}..HEAD"
   ```
2. Run the three audit skills and capture their outputs:
   ```
   Skill("code-review", args=RANGE)
   Skill("verify-tests", args=RANGE)
   Skill("code-guidelines-check", args=RANGE)
   ```
3. Parse the **Actionable findings** sections for `**severity:** must-fix`.
4. For each `must-fix` finding:
   - Apply the provided fix using `Write` or `Edit`.
   - Run tests locally to confirm the fix does not break anything.
   - Commit and push:
     ```bash
     git add <specific-files>
     git commit -m "fix: resolve self-check finding – <description> (#${ARGUMENTS})"
     git push
     ```
5. Re-run the three audits. Repeat steps 3–5 until no `must-fix` items remain.
6. If `should-fix` or `note` items remain that you cannot address quickly, leave them for the human reviewer; do not block finalization on them.

## Finalize

When all subtasks are checked and the self-check is clean:
1. Merge base branch one final time (same steps as above) to ensure the PR is up to date.
2. Update the PR body with a reviewer summary using `update_pull_request`.
3. Promote the PR to ready:
   ```mcp
   update_pull_request(pr_number=<pr_number>, draft=false)
   ```
4. Add the `complete` label to trigger the CI gate:
   ```mcp
   add_labels_to_pr(pr_number=<pr_number>, labels=["complete"])
   ```

## Principles
- Push every commit. Each push is a checkpoint.
- Never check off a subtask if tests are failing.
- If interrupted, re-running this skill on the same issue will resume from the first unchecked subtask.
- Always merge the base branch before starting work to minimize conflicts.
