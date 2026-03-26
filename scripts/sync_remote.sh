#!/usr/bin/env bash
# Import ratings, watchlist, and metadata to deployed backend.
# Run from project root: ./scripts/sync_remote.sh [--parity]
# Loads REMOTE_API_URL and ADMIN_IMPORT_TOKEN from .env.sync, .env, or shell. No sourcing needed.
#
# Default: legacy-safe imports (new ratings rows only; metadata fill-missing only).
# --parity: ratings upsert + metadata overwrite so remote matches local export/recommendations better.

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

PARITY=0
for arg in "$@"; do
  case "$arg" in
    --parity)
      PARITY=1
      ;;
    -h|--help)
      echo "Usage: $0 [--parity]"
      echo ""
      echo "  (no flags)  Insert-only ratings, fill-only metadata (safe default)."
      echo "  --parity    Upsert ratings + overwrite metadata from local CSV export (recommended for parity)."
      echo ""
      echo "Requires REMOTE_API_URL and ADMIN_IMPORT_TOKEN (.env.sync or .env)."
      exit 0
      ;;
    *)
      echo "Error: unknown option '$arg' (use --help)"
      exit 1
      ;;
  esac
done

usage() {
  echo "Usage: $0 [--parity]"
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

if [[ "$PARITY" -eq 1 ]]; then
  echo "Parity sync: ratings --upsert, metadata --overwrite (remote will match local CSV export)."
  echo ""
fi

echo "Importing ratings..."
if [[ "$PARITY" -eq 1 ]]; then
  "${ROOT}/scripts/import_remote.sh" ratings --upsert
else
  "${ROOT}/scripts/import_remote.sh" ratings
fi
echo ""
echo "Importing watchlist..."
"${ROOT}/scripts/import_remote.sh" watchlist
echo ""
echo "Exporting local metadata..."
"${ROOT}/scripts/export_metadata_local.sh"
echo ""
echo "Importing metadata..."
if [[ "$PARITY" -eq 1 ]]; then
  "${ROOT}/scripts/import_remote.sh" metadata --overwrite
else
  "${ROOT}/scripts/import_remote.sh" metadata
fi
echo ""
if [[ -f "${ROOT}/data/imdb/favorite_people.csv" ]]; then
  echo "Importing favorites..."
  "${ROOT}/scripts/import_remote.sh" favorites
  echo ""
else
  echo "Skipping favorites (data/imdb/favorite_people.csv not found)."
  echo ""
fi
if [[ -f "${ROOT}/data/imdb/favorite_list.csv" ]]; then
  echo "Importing favorite list..."
  "${ROOT}/scripts/import_remote.sh" favorite-list
  echo ""
else
  echo "Skipping favorite list (data/imdb/favorite_list.csv not found)."
  echo ""
fi
if [[ "$PARITY" -eq 1 ]]; then
  echo "Parity sync complete. Check inserted/updated/skipped in the JSON summaries above."
else
  echo "Sync complete (legacy mode). Use --parity for upsert + metadata overwrite."
fi
