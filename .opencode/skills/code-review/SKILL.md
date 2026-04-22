---
name: code-review
description: Review code changes in this @apparts/db TypeScript codebase. Invoke with commit range, e.g. "/code-review abc123..def456". Use whenever the user asks to review a commit range, PR, new feature, or recently changed file.
allowed-tools: Read, Glob, Grep, Bash
context: fork
subagent_type: general
argument-hint: <from-commit>..<to-commit>
---

# Code Review

Your job is to give a thorough, actionable code review tailored to this codebase. Focus on things that actually matter — correctness, safety, consistency with established patterns — not style nits.

## How to approach the review

1. **Understand what changed.** Use the commit range from `$ARGUMENTS` if provided (e.g. `git diff $ARGUMENTS`). If no range is given, review the entire codebase — read all source files under `src/`.

2. **Read the surrounding context.** Don't review a method in isolation — read the related source and tests to understand the established patterns before judging whether new code fits.

3. **Apply the repo-specific checklist.** See `.opencode/skills/code-review/references/checklist.md` for what to verify for this codebase specifically.

## Report format

```
## Summary
<one paragraph: what the change does and overall assessment>

## Must fix
<only present if there are must-fix issues>

### <short title>
**File:** `path/to/file.ts`, line <N>
**Problem:** <what's wrong and why it matters>
**Fix:**
\`\`\`typescript
<corrected code>
\`\`\`

## Should fix
<only present if there are should-fix issues>

### <short title>
**File:** `path/to/file.ts`, line <N>
**Problem:** <what's inconsistent or fragile>
**Fix:**
\`\`\`typescript
<corrected code>
\`\`\`
```

Omit a section entirely if it has no findings. Every finding must include a ready-to-apply code fix — don't describe what to change, show it.
