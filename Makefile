.PHONY: run-backend run-frontend run

run-backend:
	cd backend && ./.venv/bin/uvicorn app.main:app --reload --port 8000

run-frontend:
	cd frontend && npm run dev

run:
	cd backend && ./.venv/bin/uvicorn app.main:app --reload --port 8000 & \
	cd frontend && npm run dev
