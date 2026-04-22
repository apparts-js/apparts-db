#!/usr/bin/env python3
"""Check off (or uncheck) a subtask checkbox in a GitHub issue.

Usage:
  python check_subtask.py <issue-number> <subtask-text>            # check off
  python check_subtask.py <issue-number> <subtask-text> --uncheck  # uncheck

Uses plain string replacement — safe against any special characters in the text.
Prints available checkboxes to stderr if the subtask text is not found.
"""

import argparse
import subprocess
import sys


def get_issue_body(issue_number: int) -> str:
    result = subprocess.run(
        ["gh", "issue", "view", str(issue_number), "--json", "body", "-q", ".body"],
        capture_output=True, text=True, check=True,
    )
    return result.stdout  # keep trailing newline as-is


def set_issue_body(issue_number: int, body: str) -> None:
    subprocess.run(
        ["gh", "issue", "edit", str(issue_number), "--body", body],
        check=True,
    )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("issue_number", type=int)
    parser.add_argument("subtask_text")
    parser.add_argument("--uncheck", action="store_true", help="Uncheck instead of check")
    args = parser.parse_args()

    body = get_issue_body(args.issue_number)

    if args.uncheck:
        needle = f"- [x] {args.subtask_text}"
        replacement = f"- [ ] {args.subtask_text}"
        action = "Unchecked"
    else:
        needle = f"- [ ] {args.subtask_text}"
        replacement = f"- [x] {args.subtask_text}"
        action = "Checked off"

    if needle not in body:
        # Help the caller understand what's there
        lines = [l.strip() for l in body.splitlines() if l.strip().startswith("- [")]
        print(f"ERROR: Subtask not found: {args.subtask_text!r}", file=sys.stderr)
        if lines:
            print("Available checkboxes in this issue:", file=sys.stderr)
            for line in lines:
                print(f"  {line}", file=sys.stderr)
        else:
            print("No checkboxes found in issue body.", file=sys.stderr)
        sys.exit(1)

    # Replace only the first occurrence (subtask text should be unique)
    updated = body.replace(needle, replacement, 1)
    set_issue_body(args.issue_number, updated)
    print(f"{action}: {args.subtask_text}")


if __name__ == "__main__":
    main()
