#!/usr/bin/env bash
# Import ratings + watchlist to deployed backend, then verify. Run from project root.
# Env: REMOTE_API_URL, ADMIN_IMPORT_TOKEN

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Load REMOTE_API_URL and ADMIN_IMPORT_TOKEN from env files
_load_env() {
  local f="$1" v
  [[ -f "$f" ]] || return
  while IFS= read -r line; do
    if [[ "$line" =~ ^REMOTE_API_URL= ]]; then
      v="${line#REMOTE_API_URL=}"; v="${v%\"}"; v="${v#\"}"
      REMOTE_API_URL="$v"
    elif [[ "$line" =~ ^ADMIN_IMPORT_TOKEN= ]]; then
      v="${line#ADMIN_IMPORT_TOKEN=}"; v="${v%\"}"; v="${v#\"}"
      ADMIN_IMPORT_TOKEN="$v"
    fi
  done < "$f"
}
_load_env "${ROOT}/.env.sync"
_load_env "${ROOT}/.env"

usage() {
  echo "Usage: $0"
  echo ""
  echo "Imports ratings + watchlist to deployed backend and verifies. Requires:"
  echo "  REMOTE_API_URL     - Backend URL (e.g. https://yourapp-backend.railway.app)"
  echo "  ADMIN_IMPORT_TOKEN - Token from backend env"
  echo ""
  echo "Set in shell, or add to .env.sync or .env at project root. Run from project root."
  exit 1
}

[[ -n "${REMOTE_API_URL:-}" ]] || { echo "Error: REMOTE_API_URL is not set"; usage; }
[[ -n "${ADMIN_IMPORT_TOKEN:-}" ]] || { echo "Error: ADMIN_IMPORT_TOKEN is not set"; usage; }

echo "--- Importing ratings ---"
"${ROOT}/scripts/import_remote.sh" ratings
echo ""
echo "--- Importing watchlist ---"
"${ROOT}/scripts/import_remote.sh" watchlist
echo ""
echo "--- Verification ---"
URL="${REMOTE_API_URL%/}"
echo "ratings/import-status:"
curl -sS "$URL/ratings/import-status"
echo ""
echo ""
echo "watchlist/import-status:"
curl -sS "$URL/watchlist/import-status"
echo ""
echo ""
echo "recommendations/simple?limit=3:"
curl -sS "$URL/recommendations/simple?limit=3"
echo ""
echo ""
echo "recommendations/watchlist-simple?limit=3:"
curl -sS "$URL/recommendations/watchlist-simple?limit=3"
echo ""
