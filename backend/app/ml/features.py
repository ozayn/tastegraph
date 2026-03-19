"""Feature pipeline for 8+ likelihood model.

Supports:
- Multi-hot for genres, countries, languages
- One-hot / categorical for decade, title_type
- Binary taste features (favorite_people_match, in_favorite_list)
- Extensible for future expansion
"""

from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.preprocessing import MultiLabelBinarizer

# Artifact paths
ML_ROOT = Path(__file__).resolve().parent.parent.parent / "data" / "ml"
MODELS_DIR = ML_ROOT / "models"
OUTPUTS_DIR = ML_ROOT / "outputs"


def _parse_multi(s: str) -> list[str]:
    """Parse comma-separated string into list of non-empty tokens."""
    if not s or not str(s).strip():
        return []
    return [x.strip() for x in str(s).split(",") if x.strip() and x.strip().upper() != "N/A"]


def _parse_countries(country_str: str | None) -> list[str]:
    """Parse country string; normalize via app logic."""
    from app.services.country_normalize import parse_and_normalize_countries

    if not country_str:
        return []
    return list(parse_and_normalize_countries(country_str))


def build_feature_matrix(
    df: pd.DataFrame,
    genre_mlb: MultiLabelBinarizer | None = None,
    country_mlb: MultiLabelBinarizer | None = None,
    decade_categories: list[str] | None = None,
    title_type_categories: list[str] | None = None,
    fit: bool = True,
) -> tuple[np.ndarray, dict]:
    """Build feature matrix from dataset DataFrame.

    Returns (X, artifacts) where artifacts contains fitted objects for reuse.
    """
    # Genres: multi-hot
    genres_list = df["genres"].apply(lambda x: _parse_multi(x) if pd.notna(x) else []).tolist()
    if fit or genre_mlb is None:
        genre_mlb = MultiLabelBinarizer(sparse_output=False)
        genre_mat = genre_mlb.fit_transform(genres_list)
    else:
        genre_mat = genre_mlb.transform(genres_list)

    # Countries: multi-hot (from metadata)
    countries_list = df["country"].apply(lambda x: _parse_countries(x) if pd.notna(x) else []).tolist()
    if fit or country_mlb is None:
        country_mlb = MultiLabelBinarizer(sparse_output=False)
        country_mat = country_mlb.fit_transform(countries_list)
    else:
        country_mat = country_mlb.transform(countries_list)

    # Decade: one-hot
    decades = df["decade"].fillna("").astype(str)
    if decade_categories is None:
        decade_categories = sorted([d for d in decades.unique() if d])
    decade_mat = np.array([[1 if d == c else 0 for c in decade_categories] for d in decades])

    # Title type: one-hot
    tt = df["title_type"].fillna("").astype(str)
    if title_type_categories is None:
        title_type_categories = sorted([t for t in tt.unique() if t])
    tt_mat = np.array([[1 if t == c else 0 for c in title_type_categories] for t in tt])

    # Binary taste features
    fav_people = df["favorite_people_match"].fillna(False).astype(int).values[:, np.newaxis]
    in_fav_list = df["in_favorite_list"].fillna(False).astype(int).values[:, np.newaxis]

    # Year as numeric (normalized)
    year = df["year"].fillna(0).astype(float).values[:, np.newaxis]
    year = np.clip(year, 1900, 2030)  # cap outliers

    X = np.hstack([genre_mat, country_mat, decade_mat, tt_mat, fav_people, in_fav_list, year])

    artifacts = {
        "genre_mlb": genre_mlb,
        "country_mlb": country_mlb,
        "decade_categories": decade_categories,
        "title_type_categories": title_type_categories,
    }
    return X, artifacts
