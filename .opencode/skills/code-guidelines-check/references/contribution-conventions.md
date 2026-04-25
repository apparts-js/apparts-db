# Contribution Conventions

## Process

- Discuss changes on the GitHub Issue tracker.
- Make your PRs against the `master` branch.

## Clean Changesets

- Focus on some topic, resist changing anything else.
- Do not do style changes mixed with functional changes.
- Try to avoid refactorings mixed with functional changes.
- If you need to fix something after commit/push:
  - If there are ongoing reviews: talk to the reviewers and coordinate a fix.
  - If there are no ongoing reviews or you did not push the bad commit yet: amend the commit to include your fix or merge the fixup commit before pushing.
- Have a nice, clear, typo-free commit comment.
- If you fixed an issue, refer to it in your commit comment.
- Follow the style guide (see coding-conventions.md).

## Testing and Documentation

- If you write new code, please add tests and docs for it.
- Run tests:
  - Before every Push/PR.
  - Make sure, branch coverage is 100% (except for extreme rare cases).
  - Fix upcoming issues.

## Review

- Make a pull request on GitHub.
- Wait for review by other developers.

## Sources

- [Borg Development Guidelines](https://borgbackup.readthedocs.io/en/stable/development.html#branching-model)
