---
name: auto-follow-coding-checklist
description: Work autonomously on GitHub issues tagged 'claude': pick highest-priority open issue, plan+implement with TDD, open PR. Resumes in-progress work, fixes CI, resolves conflicts, addresses review comments. Use for: 'work on next issue', 'next task'.
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
| **G** | Stacked PR — base branch merged/deleted, needs retargeting |
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
- [ ] Open draft PR
- [ ] Post test-coverage and code-review findings to PR (checkpoint)
- [ ] Fix issues found in audit
- [ ] Promote PR to ready for review
- [ ] CI passes and PR is ready for review"
```

The last four items are sequenced gates — never check one off before its condition is truly met (see A2, A4, A5). This ensures the issue always has open checkboxes until the work is genuinely done.

### A2 — Create branch and open a draft PR

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

Open a **draft** PR now so findings can be posted to it as a checkpoint in A4:

```bash
gh pr create \
  --draft \
  --title "<concise title matching the issue>" \
  --body "$(cat <<'EOF'
Work in progress — see issue #<number> for context.

Closes #<number>
EOF
)" \
  --head <branch-name> \
  --base <main-or-dep-branch>
```

Capture the PR number (printed by `gh pr create`, or retrieve it with `gh pr view --json number -q .number`). Check off "Open draft PR" in the issue.

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

### A4 — Audit, post findings as PR checkpoint, then fix

This is a real quality gate, not a formality. Critically: findings are posted to the draft PR **before** any fixes so there is a permanent record of what was found — just like a linter checkpoint.

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

**Step 1 — Run the audits.**

Test coverage audit:
```
Skill("verify-tests", args=RANGE)
```
If `verify-tests` is not available, manually read every changed source file and its `.test.ts` counterpart and check every new method/branch has a test.

Code review / bug audit:
```
Skill("code-review", args=RANGE)
```
If `code-review` is not available, re-read the diff with fresh eyes: off-by-one errors, null/undefined paths, unhandled edge cases, silently-swallowed errors, race conditions, boundary values.

**Step 2 — Save both outputs to temp files immediately** (before making any fixes):
```bash
cat > /tmp/verify-tests-results.md << 'ENDOFRESULTS'
<paste the full verify-tests output here>
ENDOFRESULTS

cat > /tmp/code-review-results.md << 'ENDOFRESULTS'
<paste the full code-review output here>
ENDOFRESULTS
```

**Step 3 — Post findings to the draft PR as a checkpoint.** This records what was found before anything is changed:
```bash
python ${CLAUDE_SKILL_DIR}/scripts/post_review_comments.py \
  <pr_number> /tmp/verify-tests-results.md --label "Verify Tests"

python ${CLAUDE_SKILL_DIR}/scripts/post_review_comments.py \
  <pr_number> /tmp/code-review-results.md --label "Code Review"
```

Each finding with a `**File:** path, line N` reference is posted as an inline comment on that diff line. Findings without a diff anchor are collected into a single general PR comment. Check off "Post test-coverage and code-review findings to PR (checkpoint)" in the issue.

**Step 4 — Fix every issue found** (each fix = its own commit). Never mark the next subtask done if tests are failing. Then check off "Fix issues found in audit" in the issue.

### A5 — Finalize PR body and promote to ready

Update the PR body with a proper reviewer-facing summary, then promote the draft to ready:

```bash
gh pr edit <pr-number> \
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
)"

gh pr ready <pr-number>
```

Check off "Promote PR to ready for review" in the issue. Then watch CI and check off the final item once green:

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

Run existing tests first to confirm a clean baseline. Then complete remaining subtasks following the same loop as A3.

If no draft PR exists yet, open one now (same as A2) so the audit checkpoint in A4 has somewhere to post. Run the audit gate (A4) before promoting (A5). The PR summary should note that work was resumed and cover changes from both sessions.

---

## State F — Merge conflicts

```
Skill("resolve-pr-conflicts", args=str(pr_number))
```

---

## State D — Failing CI

```
Skill("fix-pr-ci", args=str(pr_number))
```

---

## State G — Stacked PR: base branch merged, needs retargeting

The PR's base branch no longer exists on the remote — it was merged and deleted. Retarget the PR to the default branch and rebase:

```bash
DEFAULT=$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name)
gh pr edit <pr-number> --base $DEFAULT
gh pr checkout <pr-number>
git fetch origin
git rebase origin/$DEFAULT
git push --force-with-lease
```

If the rebase produces conflicts, resolve them the same way as State F (pick both sides' real logic, don't just discard one). After force-pushing, verify CI triggers cleanly:

```bash
gh pr checks <pr-number> --watch
```

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
