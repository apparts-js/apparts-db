#!/usr/bin/env python3
"""Resolve PR review comments using GitHub's native resolve feature when available,
falling back to a ✅ reply otherwise.

Usage:
  python resolve_review_comments.py <pr_number> resolve-all
      Resolves every open review comment thread natively if possible,
      or posts a ✅ reply as fallback.

  python resolve_review_comments.py <pr_number> resolve <comment_id>
      Posts a ✅ reply to a specific review comment (REST fallback only).
"""

import argparse
import json
import os
import subprocess
import sys
import tempfile


def run(cmd, stdin_data=None, check=False):
    result = subprocess.run(
        cmd, shell=True,
        input=stdin_data, capture_output=True, text=True
    )
    if check and result.returncode != 0:
        print(f"Command failed: {cmd}\n{result.stderr}", file=sys.stderr)
        sys.exit(1)
    return result.stdout.strip(), result.returncode, result.stderr.strip()


def get_repo():
    out, _, _ = run("gh repo view --json nameWithOwner -q .nameWithOwner")
    return out


def run_graphql(query, **variables):
    """Run a GraphQL query/mutation via gh api graphql using a temp file for the payload.

    Returns parsed JSON dict on success, None on failure.
    """
    payload = {"query": query}
    if variables:
        payload["variables"] = variables

    with tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False) as f:
        json.dump(payload, f)
        tmp = f.name

    try:
        out, code, err = run(f"gh api graphql --input {tmp}")
        if code != 0:
            print(f"GraphQL request failed: {err}", file=sys.stderr)
            return None
        data = json.loads(out)
        if data.get("errors"):
            print(f"GraphQL errors: {data['errors']}", file=sys.stderr)
            return None
        return data
    except (json.JSONDecodeError, OSError) as e:
        print(f"GraphQL processing error: {e}", file=sys.stderr)
        return None
    finally:
        os.unlink(tmp)


def get_unresolved_threads(pr_number, repo):
    """Fetch unresolved review threads via GraphQL.

    Returns list of thread dicts or None if GraphQL is unavailable.
    """
    owner, repo_name = repo.split("/")
    threads = []
    cursor = None

    while True:
        after_clause = f', after: "{cursor}"' if cursor else ''
        query = f'''
        query($owner: String!, $repo: String!, $pr: Int!) {{
          repository(owner: $owner, name: $repo) {{
            pullRequest(number: $pr) {{
              reviewThreads(first: 100{after_clause}) {{
                pageInfo {{ hasNextPage endCursor }}
                nodes {{
                  id
                  isResolved
                  comments(first: 1) {{
                    nodes {{
                      databaseId
                      author {{ login }}
                    }}
                  }}
                }}
              }}
            }}
          }}
        }}
        '''

        result = run_graphql(query, owner=owner, repo=repo_name, pr=pr_number)
        if result is None:
            return None

        data = result["data"]["repository"]["pullRequest"]["reviewThreads"]
        for thread in data["nodes"]:
            if not thread["isResolved"]:
                threads.append(thread)

        page_info = data["pageInfo"]
        if not page_info["hasNextPage"]:
            break
        cursor = page_info["endCursor"]

    return threads


def resolve_thread_graphql(thread_id):
    """Resolve a single review thread via GraphQL. Returns True on success."""
    mutation = '''
    mutation($threadId: ID!) {
      resolveReviewThread(input: {threadId: $threadId}) {
        thread { id isResolved }
      }
    }
    '''
    result = run_graphql(mutation, threadId=thread_id)
    if result is None:
        return False
    thread = result.get("data", {}).get("resolveReviewThread", {}).get("thread", {})
    return thread.get("isResolved", False)


def resolve_all_graphql(pr_number, repo):
    """Resolve all unresolved review threads via GraphQL.

    Returns (resolved_count, failed_thread_rest_ids) or None if GraphQL is unavailable.
    """
    threads = get_unresolved_threads(pr_number, repo)
    if threads is None:
        return None

    resolved = 0
    failed_rest_ids = []

    for thread in threads:
        first_comment = thread.get("comments", {}).get("nodes", [{}])[0]
        rest_id = first_comment.get("databaseId")

        if resolve_thread_graphql(thread["id"]):
            resolved += 1
        elif rest_id:
            failed_rest_ids.append(rest_id)

    return resolved, failed_rest_ids


def get_comments(pr_number, repo):
    """Get all review comments on a PR via REST API."""
    out, code, _ = run(f"gh api repos/{repo}/pulls/{pr_number}/comments")
    if code != 0 or not out:
        return []
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return []


def get_my_login():
    out, _, _ = run("gh api user -q .login")
    return out


def reply_to_comment(pr_number, repo, comment_id, body):
    """Post a reply to a review comment via REST API."""
    payload = json.dumps({"body": body})
    _, code, err = run(
        f"gh api repos/{repo}/pulls/{pr_number}/comments/{comment_id}/replies --method POST --input -",
        stdin_data=payload,
    )
    if code != 0:
        print(f"  Failed to reply to comment {comment_id}: {err}", file=sys.stderr)
        return False
    return True


def resolve_all_rest(pr_number, repo):
    """Fallback: post ✅ reply to every top-level review comment that hasn't been resolved by us."""
    comments = get_comments(pr_number, repo)
    if not comments:
        print("No review comments found.")
        return 0

    my_login = get_my_login()
    top_level = [c for c in comments if c.get("in_reply_to_id") is None]
    replies = [c for c in comments if c.get("in_reply_to_id") is not None]

    resolved = 0
    for parent in top_level:
        parent_id = parent["id"]

        already_resolved = any(
            r["in_reply_to_id"] == parent_id
            and r.get("user", {}).get("login") == my_login
            and "✅" in r["body"]
            for r in replies
        )
        if already_resolved:
            continue

        if reply_to_comment(pr_number, repo, parent_id, "✅ Fixed"):
            resolved += 1

    return resolved


def resolve_specific_rest(pr_number, repo, comment_ids):
    """Post ✅ reply to specific review comment IDs."""
    resolved = 0
    for cid in comment_ids:
        if reply_to_comment(pr_number, repo, cid, "✅ Fixed"):
            resolved += 1
    return resolved


def resolve_all(pr_number, repo):
    """Resolve all open review comments: try GraphQL native resolve first, fall back to ✅ replies."""
    graphql_result = resolve_all_graphql(pr_number, repo)

    if graphql_result is None:
        print("Native resolve unavailable, falling back to ✅ replies.")
        return resolve_all_rest(pr_number, repo)

    resolved, failed_ids = graphql_result

    if failed_ids:
        print(f"Resolved {resolved} thread(s) natively, falling back to ✅ for {len(failed_ids)}.")
        resolved += resolve_specific_rest(pr_number, repo, failed_ids)
    else:
        print(f"Resolved {resolved} thread(s) natively.")

    return resolved


def resolve_one(pr_number, repo, comment_id):
    """Reply ✅ to a specific comment (REST fallback only)."""
    if reply_to_comment(pr_number, repo, comment_id, "✅ Fixed"):
        print(f"Resolved comment {comment_id}.")
        return 1
    return 0


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pr_number", type=int)
    parser.add_argument("command", choices=["resolve-all", "resolve"])
    parser.add_argument("comment_id", type=int, nargs="?")
    args = parser.parse_args()

    repo = get_repo()

    if args.command == "resolve-all":
        resolve_all(args.pr_number, repo)
    elif args.command == "resolve":
        if args.comment_id is None:
            print("ERROR: comment_id is required for 'resolve'", file=sys.stderr)
            sys.exit(1)
        resolve_one(args.pr_number, repo, args.comment_id)


if __name__ == "__main__":
    main()
