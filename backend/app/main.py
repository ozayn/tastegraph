from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import admin, health, ratings, recommendations, watchlist
from app.core.config import get_cors_origins, settings

app = FastAPI(title=settings.APP_NAME)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_cors_origins(),
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(admin.router)
app.include_router(ratings.router)
app.include_router(recommendations.router)
app.include_router(watchlist.router)


@app.get("/")
def root():
    return {"message": settings.APP_NAME, "docs": "/docs"}
