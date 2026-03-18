.PHONY: run run-backend run-frontend stop status

run:
	@(trap 'kill 0' INT TERM; \
		(cd backend && ./.venv/bin/uvicorn app.main:app --reload --port 8000) & \
		(cd frontend && npm run dev) & \
		sleep 2; \
		echo ""; \
		echo "TasteGraph running:"; \
		echo "  Frontend: http://localhost:3000"; \
		echo "  Backend:  http://localhost:8000"; \
		echo ""; \
		echo "Press Ctrl+C to stop both."; \
		echo ""; \
		wait)

run-backend:
	cd backend && ./.venv/bin/uvicorn app.main:app --reload --port 8000

run-frontend:
	cd frontend && npm run dev

stop:
	@echo "Stopping TasteGraph..."
	@pid=$$(lsof -ti:8000 2>/dev/null); [ -n "$$pid" ] && kill $$pid || true
	@pid=$$(lsof -ti:3000 2>/dev/null); [ -n "$$pid" ] && kill $$pid || true
	@echo "Done."

status:
	@echo "Port 3000 (frontend): $$(lsof -ti:3000 >/dev/null 2>&1 && echo 'in use' || echo 'not in use')"
	@echo "Port 8000 (backend):  $$(lsof -ti:8000 >/dev/null 2>&1 && echo 'in use' || echo 'not in use')"
