#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 6 ]; then
  echo "Usage: $0 <pr-number> <commit-id> <path> <line> <side> <body>"
  exit 1
fi

PR_NUMBER="$1"
COMMIT_ID="$2"
FILE_PATH="$3"
LINE="$4"
SIDE="$5"
BODY="$6"

jq -n \
  --arg commit_id "$COMMIT_ID" \
  --arg path "$FILE_PATH" \
  --argjson line "$LINE" \
  --arg side "$SIDE" \
  --arg body "$BODY" \
  '{
    commit_id: $commit_id,
    path: $path,
    body: $body,
    line: $line,
    side: $side,
    subject_type: "line"
  }' | gh api "repos/{owner}/{repo}/pulls/${PR_NUMBER}/comments" --input -
