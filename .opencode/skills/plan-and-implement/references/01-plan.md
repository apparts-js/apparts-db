# Plan — Post subtasks comment

## Goal

Decompose the issue into small, committable steps and post them as a comment.

## Important

The original issue body must remain untouched. Subtasks are tracked in a separate bot comment.

## Steps

1. Post a comment with the subtasks:

   ```bash
   gh issue comment "$ARGUMENTS" --body "## Subtasks
   - [ ] Write stubs and failing tests
   - [ ] Implement logic to pass tests
   - [ ] Update docs / README if needed
   - [ ] Open draft PR
   - [ ] Fix issues found in audit"
   ```

2. Load `references/02-create-pr.md` and continue in this session.
