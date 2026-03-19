#!/usr/bin/env bash
# Run metadata enrichment on deployed Railway backend/database.
# Run from project root: ./scripts/enrich_metadata_remote.sh [batch_size]
# Requires: Railway CLI, project linked, OMDB_API_KEY set on Railway backend.

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if ! command -v railway >/dev/null 2>&1; then
  echo "Error: Railway CLI not found. Install: npm i -g @railway/cli"
  exit 1
fi

if [[ -n "${1:-}" ]]; then
  if [[ ! "$1" =~ ^[0-9]+$ ]] || [[ "$1" -lt 1 ]]; then
    echo "Error: batch size must be a positive integer"
    exit 1
  fi
  BATCH="$1"
else
  BATCH=""
fi

echo "Enriching metadata on Railway (batch size: ${BATCH:-default})..."
cd "${ROOT}/backend" && railway run python -m app.scripts.enrich_missing_metadata ${BATCH}

echo "Done."
