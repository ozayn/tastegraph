from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import health, ratings, recommendations, watchlist
from app.core.config import settings

app = FastAPI(title=settings.APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET", "POST"],
)

app.include_router(health.router)
app.include_router(ratings.router)
app.include_router(recommendations.router)
app.include_router(watchlist.router)


@app.get("/")
def root():
    return {"message": settings.APP_NAME, "docs": "/docs"}
