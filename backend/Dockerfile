FROM python:3.12-slim

WORKDIR /app

# Production / Railway: core deps only (no Playwright — see requirements-imdb-browser.txt + docs for local use).
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Use $PORT for Railway; defaults to 8000 for local Docker
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
