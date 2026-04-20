
- [ ] Update github workflows to fix this issue: `Error: This request has been automatically failed because it uses a deprecated version of `actions/cache: v2`. Please update your workflow to use v3/v4 of actions/cache to avoid interruptions. Learn more: https://github.blog/changelog/2024-12-05-notice-of-upcoming-releases-and-breaking-changes-for-github-actions/#actions-cache-v1-v2-and-actions-toolkit-cache-package-closing-down`
 (use branch bug/gh-workflows, create PR)
- [ ] Setup github workflow for testing dynamo db (use branch feature/dynamo)
- [ ] Implement class for dynamo db (use branch feature/dynamo). Only implement what is possible with dynamo. Other stuff should throw a NotSupportedByDBEngine error
- [ ] Setup github workflow for testing sqlite (use branch feature/sqlite, starting from branch feature/dynamo)
- [ ] Implement class for sqlite db (use branch feature/sqlite, starting from branch feature/dynamo). Only implement what is possible with sqlite. Other stuff should throw a NotSupportedByDBEngine error
