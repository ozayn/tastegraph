#!/usr/bin/env bash
# Run migrations + metadata enrichment locally. Run from project root.
# Usage: ./scripts/enrich_metadata_local.sh [batch_size]

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENV="${ROOT}/backend/.venv"

if [[ ! -d "$VENV" ]]; then
  echo "Error: backend/.venv not found. Create it with: cd backend && python -m venv .venv && pip install -r requirements.txt"
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

PYTHON="${VENV}/bin/python"

echo "Running migrations..."
cd "${ROOT}/backend" && "$PYTHON" -m alembic upgrade head

echo "Enriching metadata (batch size: ${BATCH:-default})..."
cd "${ROOT}/backend" && "$PYTHON" -m app.scripts.enrich_missing_metadata ${BATCH}

echo "Done."
