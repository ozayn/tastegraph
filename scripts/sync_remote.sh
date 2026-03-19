#!/usr/bin/env bash
# Import ratings, watchlist, and metadata to deployed backend.
# Run from project root: ./scripts/sync_remote.sh
# Loads REMOTE_API_URL and ADMIN_IMPORT_TOKEN from .env.sync, .env, or shell. No sourcing needed.

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Load REMOTE_API_URL and ADMIN_IMPORT_TOKEN from env files (missing files are ignored)
_load_env() {
  local f="$1" v
  [[ -f "$f" ]] || return 0
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
  echo "Imports ratings, watchlist, and metadata to deployed backend. Requires:"
  echo "  REMOTE_API_URL     - Backend URL (e.g. https://yourapp-backend.railway.app)"
  echo "  ADMIN_IMPORT_TOKEN - Token from backend env"
  echo ""
  echo "Add to .env.sync or .env at project root, or set in shell. No sourcing needed."
  exit 1
}

[[ -n "${REMOTE_API_URL:-}" ]] || { echo "Error: REMOTE_API_URL is not set"; usage; }
[[ -n "${ADMIN_IMPORT_TOKEN:-}" ]] || { echo "Error: ADMIN_IMPORT_TOKEN is not set"; usage; }

export REMOTE_API_URL ADMIN_IMPORT_TOKEN

echo "Importing ratings..."
"${ROOT}/scripts/import_remote.sh" ratings
echo ""
echo "Importing watchlist..."
"${ROOT}/scripts/import_remote.sh" watchlist
echo ""
echo "Exporting local metadata..."
"${ROOT}/scripts/export_metadata_local.sh"
echo ""
echo "Importing metadata..."
"${ROOT}/scripts/import_remote.sh" metadata
echo ""
if [[ -f "${ROOT}/data/favorite_people.csv" ]]; then
  echo "Importing favorites..."
  "${ROOT}/scripts/import_remote.sh" favorites
  echo ""
else
  echo "Skipping favorites (data/favorite_people.csv not found)."
  echo ""
fi
echo "Sync complete."
