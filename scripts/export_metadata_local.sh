#!/usr/bin/env bash
# Export local TitleMetadata to data/imdb/title_metadata.csv. Run from project root.

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENV="${ROOT}/backend/.venv"
OUTPUT="${ROOT}/data/imdb/title_metadata.csv"

if [[ ! -d "$VENV" ]]; then
  echo "Error: backend/.venv not found"
  exit 1
fi

cd "${ROOT}/backend" && "${VENV}/bin/python" -m app.scripts.export_title_metadata "$OUTPUT"
