"""Admin endpoints for CSV import. Protected by ADMIN_IMPORT_TOKEN."""

import tempfile
from pathlib import Path

from fastapi import APIRouter, Depends, Header, HTTPException, Query, UploadFile

from app.core.config import settings
from app.core.database import SessionLocal
from app.imports.favorite_list import import_favorite_list_from_csv
from app.imports.favorite_people import import_favorite_people_from_csv
from app.imports.ratings import import_ratings_from_csv
from app.imports.title_metadata import import_title_metadata_from_csv
from app.imports.watchlist import import_watchlist_from_csv

router = APIRouter(prefix="/admin", tags=["admin"])


def _verify_admin_token(token: str | None) -> None:
    """Reject if token missing or wrong. Never log the token."""
    expected = settings.ADMIN_IMPORT_TOKEN
    if not expected:
        raise HTTPException(status_code=503, detail="Admin import not configured")
    if not token or not token.strip():
        raise HTTPException(status_code=401, detail="Missing admin import token")
    if token.strip() != expected:
        raise HTTPException(status_code=403, detail="Invalid admin import token")


async def _require_admin_token(
    x_admin_import_token: str | None = Header(None, alias="X-Admin-Import-Token"),
) -> None:
    """FastAPI dependency: verify X-Admin-Import-Token header."""
    _verify_admin_token(x_admin_import_token)


@router.post("/import/ratings")
async def admin_import_ratings(
    file: UploadFile,
    upsert: bool = Query(
        False,
        description="If true, update existing rows when CSV values differ (parity sync).",
    ),
    mirror: bool = Query(
        False,
        description="If true, delete ratings not in the CSV after upsert (full export parity).",
    ),
    _: None = Depends(_require_admin_token),
):
    """Import IMDb ratings from uploaded ratings.csv. Requires X-Admin-Import-Token header."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload must be a CSV file")

    content = await file.read()
    with tempfile.NamedTemporaryFile(
        mode="wb", suffix=".csv", delete=False
    ) as tmp:
        tmp.write(content)
        tmp_path = Path(tmp.name)

    try:
        db = SessionLocal()
        try:
            inserted, updated, skipped, errors, deleted = import_ratings_from_csv(
                db, tmp_path, upsert=upsert, mirror=mirror
            )
            return {
                "inserted": inserted,
                "updated": updated,
                "skipped": skipped,
                "errors": errors,
                "deleted": deleted,
                "upsert": upsert,
                "mirror": mirror,
            }
        finally:
            db.close()
    finally:
        tmp_path.unlink(missing_ok=True)


@router.post("/import/watchlist")
async def admin_import_watchlist(
    file: UploadFile,
    mirror: bool = Query(
        False,
        description="If true, delete watchlist rows not in the CSV (export parity).",
    ),
    _: None = Depends(_require_admin_token),
):
    """Import IMDb watchlist from uploaded watchlist.csv. Requires X-Admin-Import-Token header."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload must be a CSV file")

    content = await file.read()
    with tempfile.NamedTemporaryFile(
        mode="wb", suffix=".csv", delete=False
    ) as tmp:
        tmp.write(content)
        tmp_path = Path(tmp.name)

    try:
        db = SessionLocal()
        try:
            inserted, updated, errors, deleted = import_watchlist_from_csv(
                db, tmp_path, mirror=mirror
            )
            return {
                "inserted": inserted,
                "updated": updated,
                "errors": errors,
                "deleted": deleted,
                "mirror": mirror,
            }
        finally:
            db.close()
    finally:
        tmp_path.unlink(missing_ok=True)


@router.post("/import/title-metadata")
async def admin_import_title_metadata(
    file: UploadFile,
    overwrite: bool = Query(
        False,
        description="If true, replace all mapped CSV columns on existing rows (parity sync).",
    ),
    _: None = Depends(_require_admin_token),
):
    """Import title metadata from uploaded CSV. Requires X-Admin-Import-Token header."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload must be a CSV file")

    content = await file.read()
    with tempfile.NamedTemporaryFile(
        mode="wb", suffix=".csv", delete=False
    ) as tmp:
        tmp.write(content)
        tmp_path = Path(tmp.name)

    try:
        db = SessionLocal()
        try:
            inserted, updated = import_title_metadata_from_csv(
                db, tmp_path, overwrite=overwrite
            )
            return {
                "inserted": inserted,
                "updated": updated,
                "overwrite": overwrite,
            }
        finally:
            db.close()
    finally:
        tmp_path.unlink(missing_ok=True)


@router.post("/import/favorite-list")
async def admin_import_favorite_list(
    file: UploadFile,
    _: None = Depends(_require_admin_token),
):
    """Import favorite list from uploaded CSV. Idempotent sync: inserts missing, deletes removed. IMDb list export format. Requires X-Admin-Import-Token header."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload must be a CSV file")

    content = await file.read()
    with tempfile.NamedTemporaryFile(
        mode="wb", suffix=".csv", delete=False
    ) as tmp:
        tmp.write(content)
        tmp_path = Path(tmp.name)

    try:
        db = SessionLocal()
        try:
            inserted, deleted, updated, errors = import_favorite_list_from_csv(
                db, tmp_path
            )
            return {
                "inserted": inserted,
                "deleted": deleted,
                "updated": updated,
                "errors": errors,
            }
        finally:
            db.close()
    finally:
        tmp_path.unlink(missing_ok=True)


@router.post("/import/favorite-people")
async def admin_import_favorite_people(
    file: UploadFile,
    _: None = Depends(_require_admin_token),
):
    """Import favorite people from uploaded CSV. Idempotent sync: inserts missing, deletes removed. Requires X-Admin-Import-Token header."""
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Upload must be a CSV file")

    content = await file.read()
    with tempfile.NamedTemporaryFile(
        mode="wb", suffix=".csv", delete=False
    ) as tmp:
        tmp.write(content)
        tmp_path = Path(tmp.name)

    try:
        db = SessionLocal()
        try:
            inserted, deleted, errors, format_detected = import_favorite_people_from_csv(db, tmp_path)
            return {
                "inserted": inserted,
                "deleted": deleted,
                "errors": errors,
                "format": "imdb" if format_detected == "imdb" else "simple",
            }
        finally:
            db.close()
    finally:
        tmp_path.unlink(missing_ok=True)
