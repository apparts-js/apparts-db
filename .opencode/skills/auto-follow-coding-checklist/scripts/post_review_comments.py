#!/usr/bin/env python3
"""
Post skill review output (code-review or verify-tests) as inline PR comments.

Usage:
  python post_review_comments.py <pr_number> <review_file> [--label LABEL]

Parses **File:** `path`, line N patterns from the markdown and posts each
finding as an inline comment on the PR diff. Falls back to a general PR
comment for findings with no file reference or where the line isn't
reachable in the diff.
"""

import re
import json
import subprocess
import sys
import os
import tempfile
import argparse
from pathlib import Path


def run(cmd, stdin_data=None):
    result = subprocess.run(
        cmd, shell=True,
        input=stdin_data, capture_output=True, text=True
    )
    return result.stdout.strip(), result.returncode, result.stderr.strip()


def get_pr_head_sha(pr_number):
    out, code, err = run(f"gh pr view {pr_number} --json headRefOid -q .headRefOid")
    if code != 0:
        raise RuntimeError(f"Could not get PR head SHA: {err}")
    return out.strip()


def get_diff_coverage(pr_number):
    """
    Return dict: path -> set of line numbers visible in the PR diff.
    Includes both added lines and unchanged context lines (both are
    valid anchor points for inline review comments).
    """
    out, _, _ = run(f"gh pr diff {pr_number} --patch")
    coverage: dict[str, set[int]] = {}
    current_file = None
    current_line = 0

    for raw in out.splitlines():
        if raw.startswith("+++ b/"):
            current_file = raw[6:]
            coverage.setdefault(current_file, set())
            current_line = 0
        elif raw.startswith(("--- ", "diff ", "index ")):
            continue
        elif raw.startswith("@@") and current_file is not None:
            m = re.search(r"\+(\d+)", raw)
            if m:
                current_line = int(m.group(1)) - 1
        elif current_file is not None:
            if raw.startswith("-"):
                continue  # deleted line — new-file counter doesn't advance
            elif raw.startswith("\\"):
                continue  # "No newline at end of file"
            else:
                current_line += 1
                coverage[current_file].add(current_line)

    return coverage


def parse_findings(text):
    """
    Parse skill markdown output into (summary, findings).

    Each finding: {title, path, line, body}
    body is the full markdown for that finding, ready to post as-is.
    """
    summary = ""
    m = re.search(r"## Summary\s*\n(.*?)(?=\n##|\Z)", text, re.DOTALL)
    if m:
        summary = m.group(1).strip()

    findings = []
    for raw in re.split(r"\n(?=### )", text):
        raw = raw.strip()
        if not raw.startswith("###"):
            continue
        title_m = re.match(r"### (.+)", raw)
        if not title_m:
            continue
        title = title_m.group(1).strip()
        body = raw[len(title_m.group(0)):].strip()

        # Match: **File:** `path/to/file.ts`, line N  (backticks optional)
        file_m = re.search(
            r"\*\*File:\*\*\s+`?([^`\n,]+?)`?(?:,\s*line\s+(\d+))?(?:\s|$)",
            body,
        )

        findings.append({
            "title": title,
            "path": file_m.group(1).strip() if file_m else None,
            "line": int(file_m.group(2)) if file_m and file_m.group(2) else None,
            "body": f"**{title}**\n\n{body}",
        })

    return summary, findings


def post_inline(repo, pr_number, commit_sha, path, line, body):
    """Post a single inline comment. Returns True on success."""
    payload = json.dumps({
        "body": body,
        "commit_id": commit_sha,
        "path": path,
        "line": line,
        "side": "RIGHT",
    })
    _, code, err = run(
        f"gh api repos/{repo}/pulls/{pr_number}/comments --method POST --input -",
        stdin_data=payload,
    )
    if code != 0:
        print(f"  warning: inline comment failed ({path}:{line}): {err}", file=sys.stderr)
    return code == 0


def post_general(pr_number, body):
    """Post a general PR comment via a temp file (avoids shell-escaping issues)."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".md", delete=False) as f:
        f.write(body)
        tmp = f.name
    try:
        _, code, err = run(f"gh pr comment {pr_number} --body-file {tmp}")
        if code != 0:
            print(f"  warning: general comment failed: {err}", file=sys.stderr)
        return code == 0
    finally:
        os.unlink(tmp)


def main():
    parser = argparse.ArgumentParser(
        description="Post review findings as inline PR comments"
    )
    parser.add_argument("pr_number", type=int)
    parser.add_argument("review_file")
    parser.add_argument("--label", default="Review")
    args = parser.parse_args()

    review_file = Path(args.review_file)
    if not review_file.exists():
        print(f"Review file not found: {review_file}", file=sys.stderr)
        return 1

    text = review_file.read_text()
    if not text.strip():
        print("Review file is empty — nothing to post.")
        return 0

    repo, _, err = run("gh repo view --json nameWithOwner -q .nameWithOwner")
    if not repo:
        print(f"Could not determine repo: {err}", file=sys.stderr)
        return 1

    commit_sha = get_pr_head_sha(args.pr_number)
    diff_coverage = get_diff_coverage(args.pr_number)
    summary, findings = parse_findings(text)

    inline_count = 0
    general = []

    for f in findings:
        path, line = f["path"], f["line"]

        if path and line:
            file_lines = diff_coverage.get(path, set())
            if line in file_lines:
                target = line
            elif file_lines:
                # Snap to the nearest visible diff line in the same file
                target = min(file_lines, key=lambda l: abs(l - line))
                f["body"] += (
                    f"\n\n_(Originally flagged at line {line};"
                    f" nearest diff line is {target}.)_"
                )
            else:
                general.append(f)
                continue

            if post_inline(repo, args.pr_number, commit_sha, path, target, f["body"]):
                inline_count += 1
            else:
                general.append(f)

        elif path:
            # No line number — attach to first changed line in the file
            file_lines = sorted(diff_coverage.get(path, set()))
            if file_lines:
                if post_inline(repo, args.pr_number, commit_sha, path, file_lines[0], f["body"]):
                    inline_count += 1
                else:
                    general.append(f)
            else:
                general.append(f)
        else:
            general.append(f)

    # Post summary + any non-inline findings as a single general comment
    if summary or general:
        parts = []
        if summary:
            parts.append(f"## {args.label} — Summary\n\n{summary}")
        if general:
            parts.append("---\n## Findings without a diff anchor\n")
            parts.extend(f["body"] for f in general)
        post_general(args.pr_number, "\n\n".join(parts))

    print(f"{inline_count} inline comment(s), {len(general)} general finding(s) posted.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
