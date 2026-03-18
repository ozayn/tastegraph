from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health
from app.core.config import settings

app = FastAPI(title=settings.APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET"],
)

app.include_router(health.router, tags=["health"])


@app.get("/")
def root():
    return {"message": settings.APP_NAME, "docs": "/docs"}
