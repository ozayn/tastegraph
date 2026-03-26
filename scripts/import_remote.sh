#!/usr/bin/env bash
# Upload IMDb CSVs to deployed backend. Run from project root.
# Env: REMOTE_API_URL, ADMIN_IMPORT_TOKEN
#
# Usage:
#   ./scripts/import_remote.sh ratings [--upsert]
#   ./scripts/import_remote.sh watchlist
#   ./scripts/import_remote.sh metadata [--overwrite]
#   ./scripts/import_remote.sh favorites [path]
#   ./scripts/import_remote.sh favorite-list [path]
#
# --upsert (ratings): update remote rows when CSV differs from DB (parity sync).
# --overwrite (metadata): replace mapped columns from CSV on existing rows (parity sync).

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Load REMOTE_API_URL and ADMIN_IMPORT_TOKEN from env files (avoids sourcing values with spaces)
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

RATINGS_FILE="${ROOT}/data/imdb/ratings.csv"
WATCHLIST_FILE="${ROOT}/data/imdb/watchlist.csv"
METADATA_FILE="${ROOT}/data/imdb/title_metadata.csv"
FAVORITES_FILE="${ROOT}/data/imdb/favorite_people.csv"
FAVORITE_LIST_FILE="${ROOT}/data/imdb/favorite_list.csv"

usage() {
  echo "Usage: $0 ratings [--upsert] | watchlist | metadata [--overwrite] | favorites [path] | favorite-list [path]"
  echo ""
  echo "Uploads CSV to deployed backend. Requires:"
  echo "  REMOTE_API_URL     - Backend URL (e.g. https://yourapp-backend.railway.app)"
  echo "  ADMIN_IMPORT_TOKEN - Token from backend env"
  echo ""
  echo "  --upsert      (ratings only) update existing titles when values differ"
  echo "  --overwrite   (metadata only) replace fields from CSV on existing rows"
  echo ""
  echo "Set in shell, or add to .env.sync or .env at project root. Default files: data/imdb/*.csv"
  exit 1
}

if [[ -z "${REMOTE_API_URL:-}" ]]; then
  echo "Error: REMOTE_API_URL is not set"
  usage
fi

if [[ -z "${ADMIN_IMPORT_TOKEN:-}" ]]; then
  echo "Error: ADMIN_IMPORT_TOKEN is not set"
  usage
fi

SUBCMD="${1:-}"
[[ -n "$SUBCMD" ]] || usage
shift

case "$SUBCMD" in
  ratings)
    FILE="$RATINGS_FILE"
    ENDPOINT="/admin/import/ratings"
    ;;
  watchlist)
    FILE="$WATCHLIST_FILE"
    ENDPOINT="/admin/import/watchlist"
    ;;
  metadata)
    FILE="$METADATA_FILE"
    ENDPOINT="/admin/import/title-metadata"
    ;;
  favorites)
    FILE="$FAVORITES_FILE"
    ENDPOINT="/admin/import/favorite-people"
    ;;
  favorite-list)
    FILE="$FAVORITE_LIST_FILE"
    ENDPOINT="/admin/import/favorite-list"
    ;;
  *)
    echo "Error: invalid subcommand '${SUBCMD}'"
    usage
    ;;
esac

UPSERT=0
OVERWRITE=0
PATH_OVERRIDE=""
while [[ $# -gt 0 ]]; do
  case $1 in
    --upsert)
      UPSERT=1
      shift
      ;;
    --overwrite)
      OVERWRITE=1
      shift
      ;;
    *)
      if [[ "$SUBCMD" == "favorites" || "$SUBCMD" == "favorite-list" ]]; then
        PATH_OVERRIDE="$1"
        shift
      else
        echo "Error: unknown option or argument '$1'"
        usage
      fi
      ;;
  esac
done

if [[ "$SUBCMD" == "favorites" || "$SUBCMD" == "favorite-list" ]] && [[ -n "$PATH_OVERRIDE" ]]; then
  FILE="$PATH_OVERRIDE"
fi

if [[ "$UPSERT" -eq 1 && "$SUBCMD" != "ratings" ]]; then
  echo "Error: --upsert is only valid for ratings"
  exit 1
fi
if [[ "$OVERWRITE" -eq 1 && "$SUBCMD" != "metadata" ]]; then
  echo "Error: --overwrite is only valid for metadata"
  exit 1
fi

if [[ ! -f "$FILE" ]]; then
  echo "Error: file not found: $FILE"
  exit 1
fi

BASE="${REMOTE_API_URL%/}${ENDPOINT}"
QUERY=""
if [[ "$UPSERT" -eq 1 ]]; then
  QUERY="upsert=true"
fi
if [[ "$OVERWRITE" -eq 1 ]]; then
  QUERY="overwrite=true"
fi
if [[ -n "$QUERY" ]]; then
  URL="${BASE}?${QUERY}"
else
  URL="$BASE"
fi

_print_response() {
  if command -v jq &>/dev/null; then
    echo "$1" | jq .
  else
    echo "$1"
  fi
}

BODY=$(curl -sS -f -X POST "$URL" \
  -H "X-Admin-Import-Token: $ADMIN_IMPORT_TOKEN" \
  -F "file=@$FILE")
_print_response "$BODY"
