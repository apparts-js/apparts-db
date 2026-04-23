---
name: verify-tests
description: Audit test cases for completeness and correctness in this @apparts/db TypeScript codebase. Invoke with a commit range to focus on changed files, e.g. "/verify-tests abc123..def456". Use whenever the user asks to check, review, verify, or improve test coverage.
allowed-tools: Read, Glob, Grep, Bash
context: fork
agent: general-purpose
model: claude-opus-4-7
argument-hint: <from-commit>..<to-commit>
---

# Verify Test Completeness

Your job is to audit the test suite for completeness and quality. This is not a surface-level check — you're looking for real gaps where bugs could hide, not just line counts.

## How to approach the audit

1. **Determine scope.** If `$ARGUMENTS` contains a commit range, derive the source files to audit from `git diff --name-only $ARGUMENTS` and focus only on those. If no range is given, audit the full test suite — all `.test.ts` files under `src/`.

2. **Read the source first.** For each source file under review, enumerate every public method, every operator/case in switch statements, and every branch in conditional logic. These are your coverage targets.

3. **Map source → tests.** For each target you found, locate the corresponding test(s) in the `.test.ts` file alongside it. Note what's covered, what's thin (one test), and what's missing entirely.

4. **Check for correctness gotchas.** Beyond missing tests, look for tests that exist but are subtly wrong and won't actually catch bugs. See `${CLAUDE_SKILL_DIR}/references/gotchas.md` for known patterns specific to this codebase.

## What to examine

For each file being audited, check:

- Every public method has at least one happy-path test
- Every operator or enum-style case in the implementation has a dedicated test
- Error paths and rejection cases are tested, not just happy paths
- Edge inputs are covered: empty arrays, empty objects, null, undefined, zero, negative numbers
- The return shape is asserted, not just that the promise resolves
- Tests use `toStrictEqual` when exact shape matters, not just `toMatchObject` (which silently allows extra fields)

For a checklist of what each part of the codebase should have tested, read:
- `${CLAUDE_SKILL_DIR}/references/coverage-map.md` — what to verify for each method, operator, and config option
- `${CLAUDE_SKILL_DIR}/references/gotchas.md` — recurring patterns that make tests look correct but silently miss bugs

## Report format

```
## Summary
<one paragraph: scope reviewed and overall assessment>

## Missing tests
<only present if there are gaps>

### <method or case name>
**File:** `path/to/file.ts`
**Gap:** <what's missing and what bug could slip through>
**Suggested test:**
\`\`\`typescript
<concrete Jest skeleton>
\`\`\`

## Thin coverage
<only present if there are thin areas>

### <method or case name>
**File:** `path/to/file.ts`
**Gap:** <what edge cases are unprotected>
**Suggested test:**
\`\`\`typescript
<concrete Jest skeleton>
\`\`\`

## Correctness issues
<only present if tests exist but are subtly wrong>

### <short title>
**File:** `path/to/file.test.ts`, line <N>
**Problem:** <why the test won't catch the bug it's meant to catch>
**Fix:**
\`\`\`typescript
<corrected test code>
\`\`\`
```

Omit a section entirely if it has no findings. Every finding must include a ready-to-paste Jest skeleton or fix.
