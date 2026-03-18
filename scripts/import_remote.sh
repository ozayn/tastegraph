#!/usr/bin/env bash
# Upload IMDb CSVs to deployed backend. Run from project root.
# Env: REMOTE_API_URL, ADMIN_IMPORT_TOKEN

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Load REMOTE_API_URL and ADMIN_IMPORT_TOKEN from env files (avoids sourcing values with spaces)
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
_load_env "${ROOT}/backend/.env"
_load_env "${ROOT}/.env"

RATINGS_FILE="${ROOT}/data/imdb/ratings.csv"
WATCHLIST_FILE="${ROOT}/data/imdb/watchlist.csv"

usage() {
  echo "Usage: $0 ratings|watchlist"
  echo ""
  echo "Uploads IMDb CSV to deployed backend. Requires:"
  echo "  REMOTE_API_URL     - Backend URL (e.g. https://yourapp-backend.railway.app)"
  echo "  ADMIN_IMPORT_TOKEN - Token from backend env"
  echo ""
  echo "Default files: data/imdb/ratings.csv, data/imdb/watchlist.csv"
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

case "${1:-}" in
  ratings)
    FILE="$RATINGS_FILE"
    ENDPOINT="/admin/import/ratings"
    ;;
  watchlist)
    FILE="$WATCHLIST_FILE"
    ENDPOINT="/admin/import/watchlist"
    ;;
  *)
    echo "Error: invalid argument '${1:-}'. Use 'ratings' or 'watchlist'"
    usage
    ;;
esac

if [[ ! -f "$FILE" ]]; then
  echo "Error: file not found: $FILE"
  exit 1
fi

URL="${REMOTE_API_URL%/}${ENDPOINT}"
curl -sS -X POST "$URL" \
  -H "X-Admin-Import-Token: $ADMIN_IMPORT_TOKEN" \
  -F "file=@$FILE"
