---
name: verify-tests
description: Audit test cases for completeness and correctness in this @apparts/db TypeScript codebase. Use this skill whenever the user asks to check, review, verify, or improve test coverage — including "are there missing tests?", "what should I test?", "is this well tested?", or after adding a new feature or operator.
allowed-tools: Read, Glob, Grep, Bash
context: fork
agent: general-purpose
model: claude-opus-4-7
---

# Verify Test Completeness

Your job is to audit the test suite for completeness and quality. This is not a surface-level check — you're looking for real gaps where bugs could hide, not just line counts.

## How to approach the audit

1. **Read the source first.** For each source file under review, enumerate every public method, every operator/case in switch statements, and every branch in conditional logic. These are your coverage targets.

2. **Map source → tests.** For each target you found, locate the corresponding test(s) in the `.test.ts` file alongside it. Note what's covered, what's thin (one test), and what's missing entirely.

3. **Check for correctness gotchas.** Beyond missing tests, look for tests that exist but are subtly wrong and won't actually catch bugs. See `${CLAUDE_SKILL_DIR}/references/gotchas.md` for known patterns specific to this codebase.

4. **Report findings** in a structured way (see below).

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

Structure your findings as:

### ✅ Well covered
List methods/cases that have solid test coverage.

### ⚠️ Thin coverage
List items with only 1–2 tests where edge cases could still hide bugs. Suggest what to add.

### ❌ Missing tests
List methods or branches with zero coverage. For each, explain *why* it matters — what bug could slip through? Suggest a concrete test case.

### 🐛 Correctness issues
Tests that exist but won't reliably catch bugs (wrong assertion style, missing await, etc.). Point to the specific line and explain what would go wrong.

### Recommended next tests
Pick the 3–5 highest-value tests to add first, ordered by risk. Write them out as concrete Jest test skeletons the user can paste in.

## Scope

If the user specifies a file or method, focus there. Otherwise audit the full test suite. Start by running:

```bash
find /workspace/src -name "*.test.ts" | sort
```

Then read both the test file and the corresponding source file side-by-side.
