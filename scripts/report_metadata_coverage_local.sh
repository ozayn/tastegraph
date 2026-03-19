#!/usr/bin/env bash
# Run metadata coverage report locally. Run from project root.
# Usage: ./scripts/report_metadata_coverage_local.sh

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENV="${ROOT}/backend/.venv"

if [[ ! -d "$VENV" ]]; then
  echo "Error: backend/.venv not found. Create it with: cd backend && python -m venv .venv && pip install -r requirements.txt"
  exit 1
fi

echo "Reporting metadata coverage..."
cd "${ROOT}/backend" && "${VENV}/bin/python" -m app.scripts.report_metadata_coverage
