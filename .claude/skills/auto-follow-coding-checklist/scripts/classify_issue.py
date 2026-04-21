#!/usr/bin/env python3
"""Classify a GitHub issue into its current workflow state.

Usage: python classify_issue.py <issue-number>

Outputs JSON with the state and all relevant IDs needed to act on it:

{
  "state": "A",          -- Fresh: no branch, no PR, no subtasks
  "state": "B",          -- In progress: branch/subtasks exist, no PR
  "state": "C",          -- Draft PR with review comments (CI passing)
  "state": "D",          -- PR has failing CI checks
  "state": "E",          -- PR is open, ready, CI green — waiting on reviewer
  "state": "F",          -- PR has merge conflicts
  "state": "G",          -- Stacked PR: base branch merged/deleted, needs retargeting

  "issue_number": 42,
  "pr_number": 7,        -- null if no PR
  "pr_branch": "42-foo", -- null if no branch
  "is_draft": false,
  "mergeable": "MERGEABLE|CONFLICTING|UNKNOWN",
  "ci_failing": false,
  "has_comments": false,
  "has_subtasks": true,
  "has_branch": true,
  "dependencies": [34]   -- issue numbers referenced as blockers
}
"""

import json
import re
import subprocess
import sys


def run(cmd: list[str]) -> str:
    """Run a command, return stdout. Never raises — returns empty string on error."""
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.stdout.strip() if r.returncode == 0 else ""


def classify(issue_number: int) -> dict:
    result = {
        "issue_number": issue_number,
        "state": None,
        "pr_number": None,
        "pr_branch": None,
        "is_draft": False,
        "mergeable": "UNKNOWN",
        "merge_state_status": "UNKNOWN",
        "ci_failing": False,
        "has_comments": False,
        "has_subtasks": False,
        "has_branch": False,
        "dependencies": [],
        "stale_base": None,
    }

    # --- Issue body ----------------------------------------------------------
    issue_raw = run(["gh", "issue", "view", str(issue_number),
                     "--json", "body,number,title"])
    if not issue_raw:
        print(f"ERROR: Could not fetch issue #{issue_number}", file=sys.stderr)
        sys.exit(1)

    issue = json.loads(issue_raw)
    body = issue.get("body") or ""

    result["has_subtasks"] = bool(re.search(r"^- \[[ x]\]", body, re.MULTILINE))

    # Dependency references: "depends on #34", "blocked by #12", "requires #56"
    deps = re.findall(
        r"(?:depends\s+on|blocked\s+by|requires)\s+#(\d+)",
        body, re.IGNORECASE
    )
    result["dependencies"] = [int(d) for d in deps]

    # --- Branch --------------------------------------------------------------
    run(["git", "fetch", "origin"])
    branch_output = run(["git", "branch", "-a"])
    branch_match = re.search(
        rf"(?:^|\s|remotes/origin/)({issue_number}-\S+)",
        branch_output, re.MULTILINE
    )
    branch_name = None
    if branch_match:
        branch_name = branch_match.group(1).strip()
        result["has_branch"] = True
        result["pr_branch"] = branch_name

    # --- PR ------------------------------------------------------------------
    pr_number = None
    if branch_name:
        prs_raw = run([
            "gh", "pr", "list", "--state", "open", "--head", branch_name,
            "--json", "number,isDraft,mergeable,mergeStateStatus,url",
        ])
        prs = json.loads(prs_raw) if prs_raw else []
        if prs:
            pr = prs[0]
            pr_number = pr["number"]
            result["pr_number"] = pr_number
            result["is_draft"] = pr.get("isDraft", False)
            result["mergeable"] = pr.get("mergeable", "UNKNOWN")
            result["merge_state_status"] = pr.get("mergeStateStatus", "UNKNOWN")

    # --- CI status -----------------------------------------------------------
    if pr_number:
        checks_raw = run(["gh", "pr", "checks", str(pr_number),
                          "--json", "name,state,conclusion"])
        if checks_raw:
            try:
                checks = json.loads(checks_raw)
                result["ci_failing"] = any(
                    c.get("conclusion") in ("FAILURE", "TIMED_OUT", "CANCELLED")
                    or c.get("state") == "FAILURE"
                    for c in checks
                )
            except json.JSONDecodeError:
                pass

    # --- PR comments ---------------------------------------------------------
    if pr_number:
        pr_data_raw = run(["gh", "pr", "view", str(pr_number),
                           "--json", "comments,reviews"])
        if pr_data_raw:
            try:
                pr_data = json.loads(pr_data_raw)
                result["has_comments"] = bool(pr_data.get("reviews")) or bool(pr_data.get("comments"))
            except json.JSONDecodeError:
                pass

    # --- Classify (priority: F > D > C > G > B > A > E) ---------------------
    if pr_number:
        if (result["mergeable"] == "CONFLICTING"
                or result["merge_state_status"] == "DIRTY"):
            result["state"] = "F"
        elif result["ci_failing"]:
            result["state"] = "D"
        elif result["is_draft"] and result["has_comments"]:
            result["state"] = "C"
        else:
            # Check if this is a stacked PR whose base branch has been merged/deleted
            pr_base = run(["gh", "pr", "view", str(pr_number),
                           "--json", "baseRefName", "-q", ".baseRefName"])
            default_branch = (run(["gh", "repo", "view", "--json", "defaultBranchRef",
                                   "-q", ".defaultBranchRef.name"]) or "main")
            if pr_base and pr_base != default_branch:
                remote_ref = run(["git", "ls-remote", "--heads", "origin", pr_base])
                if not remote_ref:
                    result["state"] = "G"
                    result["stale_base"] = pr_base
            if result["state"] is None:
                result["state"] = "E"
    else:
        result["state"] = "B" if (result["has_branch"] or result["has_subtasks"]) else "A"

    return result


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: classify_issue.py <issue-number>", file=sys.stderr)
        sys.exit(1)
    print(json.dumps(classify(int(sys.argv[1])), indent=2))
