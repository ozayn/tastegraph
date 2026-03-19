"""Feature pipeline for 8+ likelihood model.

Supports:
- Multi-hot for genres, countries (with min-support to reduce sparse noise)
- One-hot / categorical for decade, title_type
- Binary taste features (favorite_people_match, in_favorite_list)
- Extensible for future expansion
"""

from collections import Counter
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.preprocessing import MultiLabelBinarizer

# Artifact paths
ML_ROOT = Path(__file__).resolve().parent.parent.parent / "data" / "ml"
MODELS_DIR = ML_ROOT / "models"
OUTPUTS_DIR = ML_ROOT / "outputs"

# Min support: only include categories with at least this many titles (reduces sparse/noisy coefficients)
MIN_COUNTRY_SUPPORT = 5
MIN_GENRE_SUPPORT = 3
MIN_DECADE_SUPPORT = 3
MIN_TITLE_TYPE_SUPPORT = 3


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


def _filter_to_known(items: list[str], known: set[str]) -> list[str]:
    """Filter items to only those seen during fit. Avoids unknown-class warnings."""
    return [x for x in items if x in known]


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
    When fit=False, filters unseen categories to avoid transform warnings.
    """
    # Genres: multi-hot (min-support to reduce sparse noise)
    genres_list = df["genres"].apply(lambda x: _parse_multi(x) if pd.notna(x) else []).tolist()
    if fit or genre_mlb is None:
        genre_counts = Counter()
        for g in genres_list:
            for x in g:
                genre_counts[x] += 1
        supported_genres = {g for g, c in genre_counts.items() if c >= MIN_GENRE_SUPPORT}
        genres_list = [[x for x in g if x in supported_genres] for g in genres_list]
        genre_mlb = MultiLabelBinarizer(sparse_output=False)
        genre_mat = genre_mlb.fit_transform(genres_list)
    else:
        known_genres = set(genre_mlb.classes_)
        genres_list = [_filter_to_known(g, known_genres) for g in genres_list]
        genre_mat = genre_mlb.transform(genres_list)

    # Countries: multi-hot (min-support to reduce sparse/noisy country coefficients)
    countries_list = df["country"].apply(lambda x: _parse_countries(x) if pd.notna(x) else []).tolist()
    if fit or country_mlb is None:
        country_counts = Counter()
        for c in countries_list:
            for x in c:
                country_counts[x] += 1
        supported_countries = {c for c, n in country_counts.items() if n >= MIN_COUNTRY_SUPPORT}
        countries_list = [[x for x in c if x in supported_countries] for c in countries_list]
        country_mlb = MultiLabelBinarizer(sparse_output=False)
        country_mat = country_mlb.fit_transform(countries_list)
    else:
        known_countries = set(country_mlb.classes_)
        countries_list = [_filter_to_known(c, known_countries) for c in countries_list]
        country_mat = country_mlb.transform(countries_list)

    # Decade: one-hot (min-support)
    decades = df["decade"].fillna("").astype(str)
    if decade_categories is None:
        dec_counts = decades.value_counts()
        decade_categories = sorted([d for d in dec_counts.index if d and dec_counts[d] >= MIN_DECADE_SUPPORT])
    decade_mat = np.array([[1 if d == c else 0 for c in decade_categories] for d in decades])

    # Title type: one-hot (min-support)
    tt = df["title_type"].fillna("").astype(str)
    if title_type_categories is None:
        tt_counts = tt.value_counts()
        title_type_categories = sorted([t for t in tt_counts.index if t and tt_counts[t] >= MIN_TITLE_TYPE_SUPPORT])
    tt_mat = np.array([[1 if t == c else 0 for c in title_type_categories] for t in tt])

    # Binary taste features
    fav_people = df["favorite_people_match"].fillna(False).astype(int).values[:, np.newaxis]
    in_fav_list = df["in_favorite_list"].fillna(False).astype(int).values[:, np.newaxis]

    # Year as numeric (normalized)
    year = df["year"].fillna(0).astype(float).values[:, np.newaxis]
    year = np.clip(year, 1900, 2030)  # cap outliers

    X = np.hstack([genre_mat, country_mat, decade_mat, tt_mat, fav_people, in_fav_list, year])

    # Feature names for interpretability (same order as columns)
    genre_names = [f"genre:{c}" for c in genre_mlb.classes_]
    country_names = [f"country:{c}" for c in country_mlb.classes_]
    decade_names = [f"decade:{c}" for c in decade_categories]
    tt_names = [f"title_type:{c}" for c in title_type_categories]
    feature_names = genre_names + country_names + decade_names + tt_names + ["favorite_people_match", "in_favorite_list", "year"]

    artifacts = {
        "genre_mlb": genre_mlb,
        "country_mlb": country_mlb,
        "decade_categories": decade_categories,
        "title_type_categories": title_type_categories,
        "feature_names": feature_names,
    }
    return X, artifacts
