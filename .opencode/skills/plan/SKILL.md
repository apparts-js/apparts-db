---
name: plan
description: Read an issue and the codebase, then post a concise plan comment with risk analysis and implementation options. Triggered by '/oc plan'.
allowed-tools: Read, Glob, Grep, Bash
context: fork
agent: general-purpose
argument-hint: <issue-number>
---

You are invoked because someone commented `/oc plan` on an issue. Your job is to analyze the issue and the codebase, then post a well-structured plan as a comment.

## Inputs

- `$ARGUMENTS` contains the issue number.

## Setup

1. Fetch the issue body and all comments:

   ```bash
   ISSUE_BODY=$(gh issue view "$ARGUMENTS" --json body -q '.body')
   ISSUE_COMMENTS=$(gh issue view "$ARGUMENTS" --json comments -q '.comments[].body')
   ```

2. Read the issue carefully. Identify:
   - What problem needs solving
   - What constraints or requirements are stated
   - Any prior discussion or decisions in the comments

## Explore the codebase

1. Read `README.md` and any relevant docs to understand the project structure.
2. Search for files related to the issue. Use Grep to find relevant modules, functions, or components.
3. Read the key files that the implementation would touch. Understand the existing patterns, conventions, and architecture.

## Write the plan comment

Compose and post a comment on the issue. The comment must have these sections:

```
## Plan
<Concise 3–5 sentence summary of the approach. What will be built, in what order, and how it fits into the existing codebase.>

## Risk analysis
- <risk 1>: <why it's a concern, likelihood, impact>
- <risk 2>: <why it's a concern, likelihood, impact>
- ...

## Options considered (if any)
- **Option A — <description>**: <tradeoffs>
- **Option B — <description>**: <tradeoffs>
```

Guidelines for the plan:

- **Be concrete.** Reference specific files, functions, and patterns where the work will happen.
- **Keep it concise.** The entire comment should be scannable in under 60 seconds.
- **Be honest about uncertainty.** If you're not sure about something, flag it as an assumption.
- **If the issue is underspecified**, note what's missing and request clarification before anyone starts implementation.

Post the comment:

```bash
gh issue comment "$ARGUMENTS" --body "$PLAN_COMMENT"
```
