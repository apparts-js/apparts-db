---
name: auto-follow-coding-checklist
description: Work autonomously on GitHub issues tagged "claude": pick highest-priority open issue, plan subtasks, implement with TDD, open PR. Also resumes in-progress issues, fixes CI, resolves conflicts, addresses draft PR comments. Trigger on: "work on next issue", "pick up claude issues", "do the next task".
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, TaskCreate, TaskUpdate, TaskList
context: fork
agent: general-purpose
disable-model-invocation: true
---

Your job is to look at open GitHub issues labeled "claude", figure out what state they are in, and drive the work to completion — creating subtasks in the issue, implementing the code, and opening (or finalizing) a PR.

## Step 1 — Gather open issues labeled "claude"

```bash
gh issue list --label claude --state open --json number,title,labels,body,url --limit 50
```

If there are no open issues, tell the user and stop.

## Step 2 — Pick the highest-priority issue

Look at each issue's labels and map them to a priority tier:

| Tier | Common label patterns |
|------|-----------------------|
| P0 (highest) | `p0`, `critical`, `blocker`, `priority: critical`, `priority/critical` |
| P1 | `p1`, `high`, `priority: high`, `priority/high` |
| P2 | `p2`, `medium`, `priority: medium`, `priority/medium` |
| P3 (lowest) | `p3`, `low`, `priority: low`, `priority/low` |

No priority label → treat as P3. Break ties by issue number (lower = older = first).

## Step 3 — Determine the issue's current state

Run the classifier script — it fetches the issue, finds any branch and PR, checks CI status, and returns a single JSON object:

```bash
python ${CLAUDE_SKILL_DIR}/scripts/classify_issue.py <number>
```

Example output:
```json
{
  "state": "D",
  "issue_number": 42,
  "pr_number": 7,
  "pr_branch": "42-add-auth",
  "is_draft": false,
  "mergeable": "MERGEABLE",
  "ci_failing": true,
  "has_comments": false,
  "has_subtasks": true,
  "has_branch": true,
  "dependencies": [38]
}
```

State meanings (already prioritized by the script):

| State | Meaning |
|-------|---------|
| **F** | PR has merge conflicts |
| **D** | PR has failing CI |
| **C** | Draft PR with review comments (CI passing) |
| **B** | Branch/subtasks exist but no open PR yet |
| **A** | Fresh — no branch, no PR, no subtasks |
| **E** | PR open and ready, CI green — waiting on human reviewer |

If State E: move to the next issue in the priority list. If every open issue is State E (or there are no open issues), tell the user: "All open issues are waiting on human review. Nothing to do right now." Then stop.

Also note any `dependencies` in the output — if they list unmerged issue numbers, you will need to stack (see A2).

---

## State A — Fresh issue: plan, implement, PR

### A1 — Write subtasks into the issue

Think carefully about what the issue requires. Decompose into small subtasks, each completable in a single commit. For any new logic, follow TDD order:
1. Write stubs + failing tests → commit
2. Implement to make tests pass → commit
3. (Optional) refactor → commit

Append a `## Subtasks` section to the issue body — don't replace the original text:

```bash
gh issue edit <number> --body "$(gh issue view <number> --json body -q .body)

## Subtasks
- [ ] Write stubs and failing tests
- [ ] Implement logic to pass tests
- [ ] Update docs / README if needed
- [ ] Verify test coverage and audit for bugs
- [ ] Open PR with work summary
- [ ] CI passes and PR is ready for review"
```

The last three items are sequenced gates — never check one off before its condition is truly met (see A4, A5). This ensures the issue always has open checkboxes until the work is genuinely done.

### A2 — Create and link a branch

Branch name must include the issue number (GitHub uses this to auto-link).

**No unmerged dependencies:**
```bash
git checkout main && git pull
git checkout -b <number>-<short-slug-of-title>
git push -u origin <number>-<short-slug-of-title>
```

**Unmerged dependency exists — stack on the dependency branch:**
```bash
git fetch origin
git checkout origin/<dep-branch-name>
git checkout -b <number>-<short-slug-of-title>
git push -u origin <number>-<short-slug-of-title>
```

For multi-level stacks (A→B→C), branch from the furthest unmerged branch in the chain. The PR targets the dependency branch, not main (see A5).

### A3 — Implement each subtask

For each subtask:
1. Do the work.
2. Check it off in the issue:
```bash
python ${CLAUDE_SKILL_DIR}/scripts/check_subtask.py <number> "<exact subtask text>"
```
3. Stage specific files (not `git add .` — avoid accidentally staging secrets):
```bash
git add <specific files>
git commit -m "feat: <what was done> (#<number>)"
git push
```

Never mark a subtask complete if tests are failing.

### A4 — Verify test coverage and audit for bugs

This is a real quality gate, not a formality.

**Discover the test runner** if you don't already know it:
```bash
cat package.json 2>/dev/null | grep -A10 '"scripts"'
cat Makefile 2>/dev/null | grep -E '^(test|check)'
cat pyproject.toml 2>/dev/null | grep -A5 '\[tool'
cat README.md 2>/dev/null | grep -i -A2 'test\|run'
```

**Get the commit range** for this branch:
```bash
BASE=$(git merge-base main HEAD)
RANGE="${BASE}..HEAD"
```

**Test coverage audit:** Invoke the `verify-tests` skill via the Skill tool with the commit range — this runs it in its own forked context for an independent assessment:
```
Skill("verify-tests", args=RANGE)
```
If `verify-tests` is not listed in available skills, do this manually: read every changed source file and its `.test.ts` counterpart, check that every new method and branch has at least one test, and write any missing tests.

**Code review / bug audit:** Invoke the `code-review` skill via the Skill tool with the same range:
```
Skill("code-review", args=RANGE)
```
If `code-review` is not listed in available skills, do this manually — re-read the diff with fresh eyes looking for: off-by-one errors, null/undefined paths, unhandled edge cases, error handling that silently swallows failures, race conditions, empty inputs, boundary values, unexpected types.

Fix any issues found (each fix = its own commit). Then check off "Verify test coverage and audit for bugs" in the issue.

### A5 — Create the PR

```bash
gh pr create \
  --title "<concise title matching the issue>" \
  --body "$(cat <<'EOF'
## Summary
<2–4 sentences for a reviewer who hasn't seen the issue>

## Changes
- <bullet list of meaningful changes>

## Testing
- <how the changes were tested>

## Stack
<!-- only include when stacked — delete otherwise -->
Stacked on #<dep-pr-number> (`<dep-branch-name>`). Merge after that one.

Closes #<number>
EOF
)" \
  --head <branch-name> \
  --base <main-or-dep-branch>
```

Immediately check off "Open PR" in the issue. Leave "CI passes and PR is ready for review" open.

Watch CI, then check off the final item once green:
```bash
gh pr checks <pr-number> --watch
# once green:
python ${CLAUDE_SKILL_DIR}/scripts/check_subtask.py <number> "CI passes and PR is ready for review"
```

---

## State B — Resume in-progress work

A branch or subtask checkboxes exist, but no PR yet. Check out the branch, read which subtasks remain, and continue from where work left off.

```bash
git fetch origin
git checkout <branch-name> 2>/dev/null || git checkout --track origin/<branch-name>
git pull
```

Run existing tests first to confirm a clean baseline. Then complete remaining subtasks following the same loop as A3. Run the coverage/bug-audit gate (A4) before opening the PR (A5). The PR summary should note that work was resumed and cover changes from both sessions.

---

## State F — Merge conflicts

Invoke the `/resolve-pr-conflicts <pr-number>` skill. It will rebase the branch onto its base, resolve all conflicts, verify tests, and force-push.

---

## State D — Failing CI

Invoke the `/fix-pr-ci <pr-number>` skill. It will read the failing logs, fix or re-trigger each failure, and confirm CI is green.

---

## State C — Draft PR with review comments: address and promote

The PR has unresolved review comments. Address every one, then convert to ready.

```bash
gh pr view <pr-number> --json number,title,body,isDraft,url
gh pr view <pr-number> --comments
gh pr checkout <pr-number> && git pull
```

For each comment:
- **Code change requested**: make the change, run tests, commit: `fix: address review comment – <description>`
- **Question / clarification**: reply on GitHub: `gh pr comment <pr-number> --body "Addressed in <sha>: <explanation>"`
- **Outdated / already resolved**: note it, no action needed

After pushing all changes:
```bash
gh pr ready <pr-number>
gh pr comment <pr-number> --body "All review comments addressed. Changes made:
- <bullet list>"
```

---

## General principles

**Commit small and often.** Small commits protect work if a session ends unexpectedly and make reviews easier. Stage specific files rather than `git add .`.

**Tests must pass before any gate advances.** Never check off a subtask, promote a draft PR, or call CI fixed if tests are red.

**The issue body is the source of truth.** Subtask checkboxes show progress to humans and future sessions. Keep them accurate.

**Branch names encode the issue number.** This is how GitHub, PRs, and future sessions find each other.

**PR descriptions are for reviewers.** Write as if the reviewer hasn't seen the issue — enough context to understand what changed and why.

**Stacked PRs target their dependency, not main.** GitHub auto-retargets to main once the dependency merges. Always note the stack in the PR body.
