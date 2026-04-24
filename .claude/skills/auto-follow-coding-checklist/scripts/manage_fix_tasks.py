#!/usr/bin/env python3
"""Manage an auto-fix-tasks checklist comment on a GitHub PR.

Commands:
  create <pr> --label "Review Fixes" --tasks "Fix X" "Fix Y"
      Creates a <!-- auto-fix-tasks --> comment on the PR and prints the comment ID.
      If a fix-tasks comment already exists, prints its ID without creating a duplicate.

  read <pr>
      Prints a JSON array of unchecked task texts, or [] if no comment exists.

  check <pr> --task "Fix X"
      Checks off the matching task (exact match, then case-insensitive substring).
"""

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile

SENTINEL = "<!-- auto-fix-tasks -->"


def run(cmd: list[str], **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(cmd, capture_output=True, text=True, **kwargs)


def get_repo() -> str:
    r = run(
        ["gh", "repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"],
        check=True,
    )
    return r.stdout.strip()


def _api_call(endpoint: str, method: str, body: dict, repo: str) -> dict:
    """POST or PATCH a JSON body to a GitHub API endpoint via a temp file."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump(body, f)
        tmp = f.name
    try:
        r = run(
            ["gh", "api", endpoint, "--method", method, "--input", tmp],
            check=True,
        )
        return json.loads(r.stdout) if r.stdout.strip() else {}
    finally:
        os.unlink(tmp)


def get_fix_tasks_comment(pr_number: int, repo: str) -> tuple[int | None, str | None]:
    """Return (comment_id, body) or (None, None) if no fix-tasks comment exists."""
    r = run(["gh", "api", f"repos/{repo}/issues/{pr_number}/comments"])
    if r.returncode != 0 or not r.stdout.strip():
        return None, None
    try:
        comments = json.loads(r.stdout)
    except json.JSONDecodeError:
        return None, None
    for c in comments:
        if c.get("body", "").startswith(SENTINEL):
            return c["id"], c["body"]
    return None, None


def cmd_create(pr_number: int, label: str, tasks: list[str]) -> None:
    repo = get_repo()
    comment_id, _ = get_fix_tasks_comment(pr_number, repo)
    if comment_id:
        # Already exists — don't duplicate; just return the existing ID.
        print(comment_id)
        return

    lines = [SENTINEL, f"## {label}", ""] + [f"- [ ] {t}" for t in tasks]
    body = "\n".join(lines)

    data = _api_call(
        f"repos/{repo}/issues/{pr_number}/comments",
        "POST",
        {"body": body},
        repo,
    )
    print(data.get("id", ""))


def cmd_read(pr_number: int) -> None:
    repo = get_repo()
    _, body = get_fix_tasks_comment(pr_number, repo)
    if not body:
        print("[]")
        return
    unchecked = re.findall(r"^- \[ \] (.+)$", body, re.MULTILINE)
    print(json.dumps(unchecked))


def cmd_check(pr_number: int, task_text: str) -> None:
    repo = get_repo()
    comment_id, body = get_fix_tasks_comment(pr_number, repo)
    if not comment_id or not body:
        print(f"ERROR: No fix-tasks comment found on PR {pr_number}", file=sys.stderr)
        sys.exit(1)

    # 1. Exact match
    needle = f"- [ ] {task_text}"
    if needle in body:
        new_body = body.replace(needle, f"- [x] {task_text}", 1)
    else:
        # 2. Case-insensitive substring match across all unchecked lines
        new_body = body
        for line in body.splitlines():
            if line.startswith("- [ ]") and task_text.lower() in line.lower():
                new_body = body.replace(line, line.replace("- [ ]", "- [x]", 1), 1)
                break
        if new_body == body:
            unchecked = re.findall(r"^- \[ \] (.+)$", body, re.MULTILINE)
            print(f"ERROR: Task not found: {task_text!r}", file=sys.stderr)
            if unchecked:
                print("Available unchecked tasks:", file=sys.stderr)
                for t in unchecked:
                    print(f"  {t}", file=sys.stderr)
            sys.exit(1)

    _api_call(
        f"repos/{repo}/issues/comments/{comment_id}",
        "PATCH",
        {"body": new_body},
        repo,
    )
    print(f"Checked off: {task_text}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pr_number", type=int)
    parser.add_argument("command", choices=["create", "read", "check"])
    parser.add_argument("--label", default="Fix Tasks")
    parser.add_argument("--tasks", nargs="+", default=[])
    parser.add_argument("--task", default="")
    args = parser.parse_args()

    if args.command == "create":
        if not args.tasks:
            print("ERROR: --tasks is required for create command", file=sys.stderr)
            sys.exit(1)
        cmd_create(args.pr_number, args.label, args.tasks)
    elif args.command == "read":
        cmd_read(args.pr_number)
    elif args.command == "check":
        if not args.task:
            print("ERROR: --task is required for check command", file=sys.stderr)
            sys.exit(1)
        cmd_check(args.pr_number, args.task)


if __name__ == "__main__":
    main()
