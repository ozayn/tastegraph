from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health
from app.core.config import settings
from app.core.database import Base, engine

from app.models import User  # noqa: F401 - register model


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title=settings.APP_NAME, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET"],
)

app.include_router(health.router, tags=["health"])


@app.get("/")
def root():
    return {"message": settings.APP_NAME, "docs": "/docs"}
