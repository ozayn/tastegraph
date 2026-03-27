"""BritBox provider pipeline: catalog pool, watchlist exclusion, series filter, taste signals."""

from __future__ import annotations

from unittest.mock import patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.models.base import Base
from app.models.imdb_rating import IMDbRating
from app.models.imdb_watchlist_item import IMDbWatchlistItem
from app.models.title_metadata import TitleMetadata
from app.services import provider_catalog as pc
from app.services.taste_signals import load_taste_signals, load_taste_signals_for_provider_catalog


def test_normalize_catalog_imdb_id():
    assert pc._normalize_catalog_imdb_id("tt1234567") == "tt1234567"
    assert pc._normalize_catalog_imdb_id("TT1234567") == "tt1234567"
    assert pc._normalize_catalog_imdb_id("1234567") == "tt1234567"
    assert pc._normalize_catalog_imdb_id(None) is None


def test_catalog_jw_counts_with_imdb_matches_fixture():
    s, m = pc._catalog_jw_counts_with_imdb(MINI_CATALOG)
    assert s == 3 and m == 1


def test_britbox_uk_catalog_bonus_conditional():
    assert (
        pc._britbox_uk_catalog_bonus(
            is_britbox=True,
            country="United Kingdom",
            strong_countries={"United Kingdom"},
        )
        == 3
    )
    assert (
        pc._britbox_uk_catalog_bonus(
            is_britbox=True,
            country="United Kingdom",
            strong_countries=set(),
        )
        == 0
    )
    assert (
        pc._britbox_uk_catalog_bonus(
            is_britbox=True,
            country="United States",
            strong_countries={"United Kingdom"},
        )
        == 0
    )
    assert (
        pc._britbox_uk_catalog_bonus(
            is_britbox=False,
            country="United Kingdom",
            strong_countries={"United Kingdom"},
        )
        == 0
    )


def test_provider_high_fit_total_is_fit_plus_boost_once():
    """Favorite ROLE_WEIGHT sum is added once (not doubled vs old fit + boost*2)."""
    assert pc._provider_high_fit_total(10, 1.5) == 11.5
    assert pc._provider_high_fit_total(5, 10.0) == 15.0


MINI_CATALOG = {
    "provider_clear_name": "BritBox",
    "fetched_at": "2025-01-01T00:00:00+00:00",
    "stats": {"total": 5},
    "titles": [
        {"imdb_id": "ttSHOW1", "object_type": "SHOW", "title": "Series One"},
        {"imdb_id": "ttSHOW2", "object_type": "SHOW", "title": "Series Two"},
        {"imdb_id": "ttMOVIE1", "object_type": "MOVIE", "title": "A Film"},
        {"imdb_id": "ttSHOW3", "object_type": "SHOW", "title": "Series Three"},
    ],
}


def _meta(
    iid: str,
    genres: str = "Drama",
    country: str | None = "United Kingdom",
    year: int | None = 2020,
) -> TitleMetadata:
    return TitleMetadata(
        imdb_title_id=iid,
        title=iid,
        title_type="series",
        year=year,
        genres=genres,
        country=country,
    )


@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()


def test_watchlist_genres_merge_into_provider_signals(db_session):
    """Watchlist rows contribute genre/decade patterns for scoring, without being the rec pool."""
    db_session.add(
        IMDbWatchlistItem(
            imdb_title_id="ttWLONLY",
            position=1,
            genres="KrakenGenre",
            year=2015,
        )
    )
    db_session.commit()

    base = load_taste_signals(db_session)
    merged = load_taste_signals_for_provider_catalog(db_session)

    assert "KrakenGenre" not in base["strong_genres"]
    assert "KrakenGenre" in merged["strong_genres"]
    assert "2010s" in merged["strong_decades"]


@patch.object(pc, "load_catalog", return_value=MINI_CATALOG)
def test_high_fit_excludes_watchlist_and_movies_default_show(mock_load, db_session):
    """Candidates are catalog ∩ metadata, series only; watchlist titles dropped from results."""
    for m in (
        _meta("ttSHOW1"),
        _meta("ttSHOW2"),
        _meta("ttMOVIE1", genres="Action"),
        _meta("ttSHOW3"),
        _meta("ttNOTINCATALOG"),  # metadata but not in provider catalog snapshot
    ):
        db_session.add(m)
    db_session.add(
        IMDbWatchlistItem(
            imdb_title_id="ttSHOW2",
            position=1,
            genres="Drama",
            year=2020,
        )
    )
    db_session.commit()

    out = pc.get_provider_high_fit(db_session, limit=20, title_type="show")
    ids = {x["imdb_title_id"] for x in out["items"]}

    assert "ttSHOW2" not in ids  # on watchlist
    assert "ttMOVIE1" not in ids  # movie
    assert "ttNOTINCATALOG" not in ids  # not in catalog
    assert "ttSHOW1" in ids and "ttSHOW3" in ids
    assert out["catalog_stats"].get("excluded_watchlist") == 1


@patch.object(pc, "load_catalog", return_value=MINI_CATALOG)
def test_only_catalog_ids_can_appear(mock_load, db_session):
    """Titles with TitleMetadata but absent from catalog JSON are never candidates."""
    db_session.add(_meta("ttSHOW1"))
    db_session.add(_meta("ttGHOST", genres="Horror"))
    db_session.commit()

    out = pc.get_provider_high_fit(db_session, limit=20, title_type="all")
    ids = {x["imdb_title_id"] for x in out["items"]}
    assert "ttGHOST" not in ids
    assert "ttSHOW1" in ids


@patch.object(pc, "load_catalog", return_value=MINI_CATALOG)
def test_title_type_all_retains_movies_when_allowed(mock_load, db_session):
    """Explicit title_type=all includes MOVIE catalog entries (still not watchlist)."""
    db_session.add(_meta("ttSHOW1"))
    db_session.add(_meta("ttMOVIE1", genres="Comedy"))
    db_session.commit()

    out = pc.get_provider_high_fit(db_session, limit=20, title_type="all")
    ids = {x["imdb_title_id"] for x in out["items"]}
    assert "ttMOVIE1" in ids
    assert "ttSHOW1" in ids


@patch.object(pc, "load_catalog", return_value=MINI_CATALOG)
def test_rated_titles_excluded_by_default(mock_load, db_session):
    db_session.add(_meta("ttSHOW1"))
    db_session.add(_meta("ttSHOW3"))
    db_session.add(
        IMDbRating(
            imdb_title_id="ttSHOW1",
            user_rating=9,
            title="S1",
            genres="Drama",
            year=2020,
        )
    )
    db_session.commit()

    out = pc.get_provider_high_fit(db_session, limit=20, title_type="show", exclude_rated=True)
    ids = {x["imdb_title_id"] for x in out["items"]}
    assert "ttSHOW1" not in ids
    assert "ttSHOW3" in ids


E2E_OVERLAP_CATALOG = {
    "provider_clear_name": "BritBox",
    "fetched_at": "2025-01-01T00:00:00+00:00",
    "stats": {"total": 3},
    "titles": [
        {"imdb_id": "ttOVERLAP", "object_type": "SHOW", "title": "On watchlist and catalog"},
        {"imdb_id": "ttPEER", "object_type": "SHOW", "title": "Peer series"},
        {"imdb_id": "ttMOVIE", "object_type": "MOVIE", "title": "Catalog movie"},
    ],
}


@patch.object(pc, "load_catalog", return_value=E2E_OVERLAP_CATALOG)
def test_e2e_catalog_title_on_watchlist_taste_not_pool_series_default(mock_load, db_session):
    """Sanity: same title in BritBox snapshot + IMDb watchlist influences taste, is not recommended, movies omitted."""
    db_session.add(_meta("ttOVERLAP", genres="Mystery"))
    db_session.add(_meta("ttPEER", genres="Mystery"))
    db_session.add(_meta("ttMOVIE", genres="Mystery"))
    db_session.add(
        IMDbWatchlistItem(
            imdb_title_id="ttOVERLAP",
            position=1,
            genres="Mystery",
            year=2010,
        )
    )
    db_session.commit()

    sig = load_taste_signals_for_provider_catalog(db_session)
    assert "Mystery" in sig["strong_genres"]

    out = pc.get_provider_high_fit(db_session, limit=20)
    assert out.get("error") is None
    assert "items" in out
    ids = {x["imdb_title_id"] for x in out["items"]}

    assert "ttOVERLAP" not in ids
    assert "ttPEER" in ids
    assert "ttMOVIE" not in ids
    assert out["catalog_stats"].get("excluded_watchlist") == 1

    peer = next(x for x in out["items"] if x["imdb_title_id"] == "ttPEER")
    assert "Mystery" in peer["explanation"]["matched_genres"]

    for item in out["items"]:
        assert "movie" not in (item.get("title_type") or "").lower()


TIE_CATALOG = {
    "provider_clear_name": "BritBox",
    "fetched_at": "2025-01-01T00:00:00+00:00",
    "stats": {"total": 2},
    "titles": [
        {"imdb_id": "ttZebra", "object_type": "SHOW", "title": "Z"},
        {"imdb_id": "ttApple", "object_type": "SHOW", "title": "A"},
    ],
}


@patch.object(pc, "load_taste_signals_for_provider_catalog")
@patch.object(pc, "load_catalog", return_value=TIE_CATALOG)
def test_high_fit_tie_break_lexicographic(mock_load, mock_sig, db_session):
    """Equal scores and same year: order by imdb_title_id ascending."""
    mock_sig.return_value = {
        "strong_genres": {"Drama"},
        "strong_countries": set(),
        "strong_decades": {"2020s"},
        "strong_directors": set(),
        "favorite_list_ids": set(),
    }
    db_session.add(_meta("ttZebra"))
    db_session.add(_meta("ttApple"))
    db_session.commit()

    out = pc.get_provider_high_fit(db_session, limit=10)
    assert [x["imdb_title_id"] for x in out["items"]] == ["ttApple", "ttZebra"]


YEAR_TIE_CATALOG = {
    "provider_clear_name": "BritBox",
    "fetched_at": "2025-01-01T00:00:00+00:00",
    "stats": {"total": 2},
    "titles": [
        {"imdb_id": "ttA_Old", "object_type": "SHOW", "title": "Older"},
        {"imdb_id": "ttZ_New", "object_type": "SHOW", "title": "Newer"},
    ],
}


@patch.object(pc, "load_taste_signals_for_provider_catalog")
@patch.object(pc, "load_catalog", return_value=YEAR_TIE_CATALOG)
def test_high_fit_tie_break_prefers_newer_year(mock_load, mock_sig, db_session):
    """Equal totals: newer release year ranks before older (imdb id lex order alone would put ttA first)."""
    mock_sig.return_value = {
        "strong_genres": {"Drama"},
        "strong_countries": set(),
        "strong_decades": {"2020s"},
        "strong_directors": set(),
        "favorite_list_ids": set(),
    }
    db_session.add(_meta("ttA_Old", year=2000))
    db_session.add(_meta("ttZ_New", year=2020))
    db_session.commit()

    out = pc.get_provider_high_fit(db_session, limit=10)
    assert [x["imdb_title_id"] for x in out["items"]] == ["ttZ_New", "ttA_Old"]


UK_VS_US_CATALOG = {
    "provider_clear_name": "BritBox",
    "fetched_at": "2025-01-01T00:00:00+00:00",
    "stats": {"total": 2},
    "titles": [
        {"imdb_id": "ttA_US", "object_type": "SHOW", "title": "US show"},
        {"imdb_id": "ttZ_UK", "object_type": "SHOW", "title": "UK show"},
    ],
}


@patch.object(pc, "load_taste_signals_for_provider_catalog")
@patch.object(pc, "load_catalog", return_value=UK_VS_US_CATALOG)
def test_uk_catalog_bonus_requires_strong_country(mock_load, mock_sig, db_session):
    """Without UK taste: lexicographic tie-break (ttA_US first). With UK lift + UK show: bonus overrides."""
    db_session.add(_meta("ttA_US", country="United States"))
    db_session.add(_meta("ttZ_UK", country="United Kingdom"))
    db_session.commit()
    base_sig = {
        "strong_genres": {"Drama"},
        "strong_decades": set(),
        "strong_directors": set(),
        "favorite_list_ids": set(),
    }

    mock_sig.return_value = {**base_sig, "strong_countries": set()}
    out_no_uk = pc.get_provider_high_fit(db_session, limit=10)
    assert [x["imdb_title_id"] for x in out_no_uk["items"]] == ["ttA_US", "ttZ_UK"]

    mock_sig.return_value = {**base_sig, "strong_countries": {"United Kingdom"}}
    out_yes_uk = pc.get_provider_high_fit(db_session, limit=10)
    assert [x["imdb_title_id"] for x in out_yes_uk["items"]] == ["ttZ_UK", "ttA_US"]


SINGLE_SHOW_CATALOG = {
    "provider_clear_name": "BritBox",
    "fetched_at": "2025-01-01T00:00:00+00:00",
    "stats": {"total": 1},
    "titles": [{"imdb_id": "ttONE", "object_type": "SHOW", "title": "One"}],
}


@patch.object(pc, "compute_favorite_boost", return_value=(2.0, []))
@patch.object(pc, "score_title_by_taste_signals", return_value=(4, {}))
@patch.object(pc, "load_taste_signals_for_provider_catalog")
@patch.object(pc, "load_catalog", return_value=SINGLE_SHOW_CATALOG)
def test_favorite_boost_applied_once_via_total_helper(
    mock_load, mock_sig, mock_score, mock_boost, db_session
):
    mock_sig.return_value = {
        "strong_genres": set(),
        "strong_countries": set(),
        "strong_decades": set(),
        "strong_directors": set(),
        "favorite_list_ids": set(),
    }
    db_session.add(_meta("ttONE"))
    db_session.commit()

    with patch.object(pc, "_provider_high_fit_total", wraps=pc._provider_high_fit_total) as spy:
        pc.get_provider_high_fit(db_session, limit=5)
        spy.assert_called_with(4, 2.0)
