---
name: code-guidelines-check
description: >
  Check code, documentation, and contributions against
  best-practice conventions. Invoke with a commit range, e.g.
  "/code-guidelines-check abc123..def456", or a file path. Use whenever
  the user asks to review code, audit documentation, validate a
  pull request, or verify that something follows coding standards — even
  if they don't explicitly say "guidelines" or "conventions". Also use
  when the user says "is this good?", "review this", "check my code",
  "does this follow best practices?", or similar.
  This skill never posts comments to GitHub; it returns a structured
  report that the caller can act on or pass to review-pr for posting.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
argument-hint: [<commit-range> | <file-path> | <pr-number>]
---

# Code Guidelines Check

This skill helps you review code, documentation, and
contribution practices against a set of established conventions derived
from the phuhl/contribution-guidelines repository.

## When to Use

Invoke this skill when the user asks you to:

- Review or check code for style, quality, or convention compliance.
- Audit documentation (README, ARCHITECTURE, inline comments, etc.).
- Check a pull request or changeset for cleanliness and best practices.
- Answer whether something "follows best practices" or "looks good".

## Important Context

**Code formatting and basic style are assumed to be handled by tooling.**
Prettier, ESLint, and the TypeScript compiler already enforce:

- Spacing, indentation, and line breaks
- camelCase / SCREAMING_SNAKE_CASE naming
- `const`/`let` over `var`
- Brace usage
- Variable declaration requirements

Do **not** flag these in code reviews. Focus instead on what the tooling
cannot enforce: clarity, structure, architectural judgment, and the
conventions below.

## Workflow

1. **Determine scope from `$ARGUMENTS`.**
   - If `$ARGUMENTS` looks like a PR number (digits only), fetch the PR
     metadata and derive the diff range:
     ```bash
     BASE=$(git merge-base origin/master HEAD)
     RANGE="${BASE}..HEAD"
     ```
   - If `$ARGUMENTS` looks like a commit range (contains `..`), get the
     changed files and diffs:
     ```bash
     git diff --name-only $ARGUMENTS
     git diff $ARGUMENTS
     ```
   - If `$ARGUMENTS` looks like a file path, read that file directly.
   - If no argument is given, ask the user what they want reviewed.

2. **Load the relevant reference document(s).** Based on what is being
   reviewed, read the appropriate reference file(s) from the skill's
   `references/` directory:
   - Code review → `references/coding-conventions.md`
   - Documentation review → `references/documentation-conventions.md`
   - Contribution / PR review → `references/contribution-conventions.md`

3. **Perform the review.** Walk through the item systematically against
   the loaded conventions. Look for:
   - Violations of explicit rules that tooling does not catch (e.g.,
     unclear naming, poor code structure, missing issue references).
   - Opportunities to apply general principles (e.g., simplicity,
     keeping related code together, designing for search).
   - Missing elements that the conventions require (e.g., tests, docs,
     ARCHITECTURE file for large projects).

4. **Format your findings.** Present the review results in this structure:

   ````markdown
   ## Review Summary

   - **Item reviewed:** [file name / commit hash / PR link]
   - **Conventions checked:** [list of reference docs used]
   - **Overall verdict:** [Pass / Needs minor changes / Needs significant changes]

   ## Findings

   ### [Category, e.g., Code Structure]

   - **Issue:** [description]
   - **File:** `path/to/file.ts`, line [N]
   - **Suggestion:** [concrete fix]
   - **Reference:** [specific rule from the conventions]

   ### [Category, e.g., Documentation Style]

   ...

   ## Positive Observations

   - [Anything done well, to keep feedback balanced and actionable]

   ## Recommendations

   - [Prioritized list of changes to make]

   ## Actionable findings

   <only present if there are findings that map to specific lines>

   ### <short title>

   - **file:** `path/to/file.ts`
   - **line:** [N]
   - **severity:** must-fix | should-fix | note
   - **problem:** <what's wrong and why it matters>
   - **fix:**
     ```typescript
     <corrected code or text>
     ```
   ````

   ```

   ```

5. **Be specific and constructive.** Always cite the exact convention
   that supports your feedback. Provide concrete code or text snippets
   showing how to fix the issue. Explain _why_ the convention matters
   when it is not self-evident.

6. **Acknowledge trade-offs.** If a guideline is violated for a good
   reason (e.g., performance optimization, backward compatibility), note
   it and suggest documenting the rationale in a comment or commit body.

## Important Notes

- Do not invent new conventions. Stick to the ones in the reference
  documents. If a topic is not covered there, say so rather than
  imposing your own rule.
- Keep the tone helpful and educational. The goal is to help the user
  write better code and documentation, not to scold them.
- For large reviews, prioritize the most impactful issues first (e.g.,
  correctness and clarity over minor formatting nits).
