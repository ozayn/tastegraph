"""Title embeddings for semantic similarity. Artifact-file storage, lazy load.

Uses sentence-transformers all-MiniLM-L6-v2 (384 dim). Embed: title + " " + plot.
Fallback to metadata-only when embeddings missing.
"""

from pathlib import Path
from typing import cast

import numpy as np

# Artifact paths
EMBEDDINGS_ROOT = Path(__file__).resolve().parent.parent.parent / "data" / "embeddings"
ARTIFACT_PATH = EMBEDDINGS_ROOT / "title_embeddings.npz"

# Lazy-loaded state
_ids: list[str] | None = None
_vectors: np.ndarray | None = None
_id_to_idx: dict[str, int] | None = None


def _load_artifact() -> bool:
    """Load embeddings from artifact. Returns True if loaded, False if missing."""
    global _ids, _vectors, _id_to_idx
    if _ids is not None:
        return True
    if not ARTIFACT_PATH.exists():
        return False
    try:
        data = np.load(ARTIFACT_PATH, allow_pickle=True)
        ids_arr = data["ids"]
        _ids = [str(x) for x in ids_arr]
        _vectors = data["vectors"].astype(np.float32)
        _id_to_idx = {tid: i for i, tid in enumerate(_ids)}
        return True
    except Exception:
        return False


def get_embedding(imdb_title_id: str | None) -> np.ndarray | None:
    """Get embedding vector for a title. Returns None if not found or not loaded."""
    if not imdb_title_id or not imdb_title_id.strip():
        return None
    if not _load_artifact():
        return None
    idx = _id_to_idx.get(imdb_title_id.strip())
    if idx is None:
        return None
    return cast(np.ndarray, _vectors[idx].copy())


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity between two vectors. Returns value in [-1, 1], typically [0, 1] for text."""
    a = np.asarray(a, dtype=np.float64)
    b = np.asarray(b, dtype=np.float64)
    n_a = np.linalg.norm(a)
    n_b = np.linalg.norm(b)
    if n_a == 0 or n_b == 0:
        return 0.0
    return float(np.dot(a, b) / (n_a * n_b))


def embedding_similarity_score(ref_emb: np.ndarray | None, cand_emb: np.ndarray | None, weight: float = 2.5) -> float:
    """Compute contribution to total score from embedding similarity. Returns 0 if either missing."""
    if ref_emb is None or cand_emb is None:
        return 0.0
    sim = cosine_similarity(ref_emb, cand_emb)
    # sim typically in [0, 1] for text; scale to score contribution
    return max(0.0, sim) * weight


def is_available() -> bool:
    """True if embeddings are loaded and usable."""
    return _load_artifact()
