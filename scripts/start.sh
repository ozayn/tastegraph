#!/usr/bin/env bash
# Start backend (FastAPI) and frontend (Next.js) for local development.
# Usage: ./scripts/start.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${ROOT}/backend"
FRONTEND_DIR="${ROOT}/frontend"
VENV_PYTHON="${BACKEND_DIR}/.venv/bin/python"
ENV_FILE="${BACKEND_DIR}/.env"

BACKEND_PID=""
FRONTEND_PID=""
SHUTTING_DOWN=0

die() {
  echo "Error: $*" >&2
  exit 1
}

shutdown() {
  local exit_code="${1:-0}"
  if [[ "${SHUTTING_DOWN}" -eq 1 ]]; then
    return
  fi
  SHUTTING_DOWN=1

  trap - INT TERM EXIT

  echo ""
  echo "Stopping TasteGraph..."

  if [[ -n "${FRONTEND_PID}" ]] && kill -0 "${FRONTEND_PID}" 2>/dev/null; then
    kill "${FRONTEND_PID}" 2>/dev/null || true
    wait "${FRONTEND_PID}" 2>/dev/null || true
  fi

  if [[ -n "${BACKEND_PID}" ]] && kill -0 "${BACKEND_PID}" 2>/dev/null; then
    kill "${BACKEND_PID}" 2>/dev/null || true
    wait "${BACKEND_PID}" 2>/dev/null || true
  fi

  echo "Done."
  exit "${exit_code}"
}

on_signal() {
  shutdown 130
}

trap on_signal INT TERM

[[ -d "${BACKEND_DIR}" ]] || die "backend/ not found (run from repo root or use ./scripts/start.sh)"
[[ -d "${FRONTEND_DIR}" ]] || die "frontend/ not found"
[[ -x "${VENV_PYTHON}" ]] || die "backend/.venv not found. Create it with:
  cd backend && python -m venv .venv && ./.venv/bin/pip install -r requirements.txt"
command -v npm >/dev/null 2>&1 || die "npm not found in PATH"
[[ -f "${FRONTEND_DIR}/package.json" ]] || die "frontend/package.json not found"

if [[ -f "${ENV_FILE}" ]]; then
  echo "Using ${ENV_FILE} (loaded by the API via app.core.config.Settings)"
else
  echo "Note: ${ENV_FILE} not found (backend will use defaults / process env)"
fi

echo "Starting backend on http://localhost:8000 ..."
(
  cd "${BACKEND_DIR}"
  exec "${VENV_PYTHON}" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
) &
BACKEND_PID=$!

echo "Starting frontend on http://localhost:3000 ..."
(
  cd "${FRONTEND_DIR}"
  exec npm run dev -- --port 3000
) &
FRONTEND_PID=$!

sleep 2

echo ""
echo "TasteGraph running:"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:8000"
echo "  API docs: http://localhost:8000/docs"
echo ""
echo "Press Ctrl+C to stop both."
echo ""

# Wait until either child exits; then tear down the other.
while true; do
  if ! kill -0 "${BACKEND_PID}" 2>/dev/null; then
    wait "${BACKEND_PID}" || shutdown $?
    shutdown 1
  fi
  if ! kill -0 "${FRONTEND_PID}" 2>/dev/null; then
    wait "${FRONTEND_PID}" || shutdown $?
    shutdown 1
  fi
  sleep 1
done
