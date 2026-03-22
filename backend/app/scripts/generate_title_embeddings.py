"""Generate title embeddings for semantic similarity. Saves to data/embeddings/title_embeddings.npz.

Usage:
  cd backend && python -m app.scripts.generate_title_embeddings [--limit N]

Embeds: title + " " + plot (or title only if plot missing). Uses sentence-transformers all-MiniLM-L6-v2.
Only includes titles present in ratings or watchlist. Re-run after metadata updates.
"""

import argparse
import sys
from pathlib import Path

import numpy as np
from sqlalchemy import select

from app.core.database import SessionLocal
from app.models.imdb_rating import IMDbRating
from app.models.imdb_watchlist_item import IMDbWatchlistItem
from app.models.title_metadata import TitleMetadata


def _build_embed_text(title: str | None, plot: str | None) -> str | None:
    """Build text for embedding: title + plot. Returns None if title empty."""
    t = (title or "").strip()
    if not t:
        return None
    p = (plot or "").strip()
    if p:
        return f"{t} {p}"
    return t


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate title embeddings for semantic similarity")
    parser.add_argument("--limit", type=int, default=0, help="Max titles to embed (0 = no limit)")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        # Titles in ratings or watchlist that have metadata with at least a title
        rated_ids = set(db.scalars(select(IMDbRating.imdb_title_id)).all())
        watchlist_ids = set(db.scalars(select(IMDbWatchlistItem.imdb_title_id)).all())
        relevant_ids = rated_ids | watchlist_ids
        if not relevant_ids:
            print("No titles in ratings or watchlist. Run import first.")
            return

        rows = (
            db.query(TitleMetadata.imdb_title_id, TitleMetadata.title, TitleMetadata.plot)
            .filter(
                TitleMetadata.imdb_title_id.in_(relevant_ids),
                TitleMetadata.title.isnot(None),
                TitleMetadata.title != "",
            )
            .all()
        )

        if args.limit > 0:
            rows = rows[: args.limit]

        texts: list[tuple[str, str]] = []
        for imdb_id, title, plot in rows:
            text = _build_embed_text(title, plot)
            if text:
                texts.append((imdb_id, text))

        if not texts:
            print("No titles with enough text to embed.")
            return

        print(f"Embedding {len(texts)} titles...")
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError:
            print("Install sentence-transformers: pip install sentence-transformers")
            raise SystemExit(1)

        model = SentenceTransformer("all-MiniLM-L6-v2")
        ids = [t[0] for t in texts]
        embed_texts = [t[1] for t in texts]
        vectors = model.encode(embed_texts, show_progress_bar=True, convert_to_numpy=True)

        # data/embeddings relative to backend root
        backend_root = Path(__file__).resolve().parent.parent.parent
        out_dir = backend_root / "data" / "embeddings"
        out_dir.mkdir(parents=True, exist_ok=True)
        out_path = out_dir / "title_embeddings.npz"
        np.savez(out_path, ids=np.array(ids, dtype=object), vectors=vectors.astype(np.float32))
        print(f"Saved to {out_path} ({len(ids)} titles, dim {vectors.shape[1]})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
