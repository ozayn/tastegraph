"""Pre-ranking recommendation pool filters."""

from app.services.recommendation_filters import (
    any_recommendation_filter_active,
    parse_decade_bounds,
    pool_row_matches_filters,
    title_metadata_matches_pool_filters,
)
from app.models.title_metadata import TitleMetadata


def test_parse_decade_bounds():
    assert parse_decade_bounds(None) is None
    assert parse_decade_bounds("2020s") == (2020, 2029)
    assert parse_decade_bounds("2020") == (2020, 2029)
    assert parse_decade_bounds("2015") == (2010, 2019)


def test_any_recommendation_filter_active():
    assert not any_recommendation_filter_active(
        decade_bounds=None, year_min=None, country_contains=None, ref_genres=None
    )
    assert any_recommendation_filter_active(
        decade_bounds=(2020, 2029), year_min=None, country_contains=None, ref_genres=None
    )
    assert any_recommendation_filter_active(
        decade_bounds=None, year_min=2020, country_contains=None, ref_genres=None
    )
    assert any_recommendation_filter_active(
        decade_bounds=None, year_min=None, country_contains="uk", ref_genres=None
    )
    assert any_recommendation_filter_active(
        decade_bounds=None, year_min=None, country_contains=None, ref_genres={"drama"}
    )
    assert any_recommendation_filter_active(
        decade_bounds=None,
        year_min=None,
        country_contains=None,
        ref_genres=None,
        genre_substrings=("noir",),
    )


def test_pool_row_decade_and_year_min():
    assert pool_row_matches_filters(
        year=2023,
        genres_csv="Drama",
        country="United Kingdom",
        decade_bounds=(2020, 2029),
        year_min=None,
        country_contains=None,
        ref_genres=None,
    )
    assert not pool_row_matches_filters(
        year=2015,
        genres_csv="Drama",
        country="United Kingdom",
        decade_bounds=(2020, 2029),
        year_min=None,
        country_contains=None,
        ref_genres=None,
    )
    assert not pool_row_matches_filters(
        year=None,
        genres_csv="Drama",
        country="United Kingdom",
        decade_bounds=(2020, 2029),
        year_min=None,
        country_contains=None,
        ref_genres=None,
    )
    assert not pool_row_matches_filters(
        year=2010,
        genres_csv="Drama",
        country="United Kingdom",
        decade_bounds=None,
        year_min=2015,
        country_contains=None,
        ref_genres=None,
    )


def test_pool_row_country_and_genres():
    assert pool_row_matches_filters(
        year=2000,
        genres_csv="Crime, Drama",
        country="United Kingdom",
        decade_bounds=None,
        year_min=None,
        country_contains="kingdom",
        ref_genres=None,
    )
    assert not pool_row_matches_filters(
        year=2000,
        genres_csv="Crime, Drama",
        country="United States",
        decade_bounds=None,
        year_min=None,
        country_contains="kingdom",
        ref_genres=None,
    )
    assert pool_row_matches_filters(
        year=2000,
        genres_csv="Crime, Drama",
        country="United States",
        decade_bounds=None,
        year_min=None,
        country_contains=None,
        ref_genres={"crime", "comedy"},
    )
    assert not pool_row_matches_filters(
        year=2000,
        genres_csv="Drama",
        country="United States",
        decade_bounds=None,
        year_min=None,
        country_contains=None,
        ref_genres={"crime"},
    )


def test_pool_row_genre_substrings():
    assert pool_row_matches_filters(
        year=2000,
        genres_csv="Crime, Drama, Thriller",
        country="United States",
        decade_bounds=None,
        year_min=None,
        country_contains=None,
        ref_genres=None,
        genre_substrings=("thriller",),
    )
    assert not pool_row_matches_filters(
        year=2000,
        genres_csv="Crime, Drama",
        country="United States",
        decade_bounds=None,
        year_min=None,
        country_contains=None,
        ref_genres=None,
        genre_substrings=("sci-fi",),
    )


def test_pool_row_genre_substrings_or():
    assert pool_row_matches_filters(
        year=2000,
        genres_csv="Crime, Drama",
        country="United States",
        decade_bounds=None,
        year_min=None,
        country_contains=None,
        ref_genres=None,
        genre_substrings=("sci-fi", "drama"),
    )
    assert not pool_row_matches_filters(
        year=2000,
        genres_csv="Crime, Drama",
        country="United States",
        decade_bounds=None,
        year_min=None,
        country_contains=None,
        ref_genres=None,
        genre_substrings=("sci-fi", "horror"),
    )


def test_title_metadata_matches_pool_filters():
    meta = TitleMetadata(
        imdb_title_id="tt1",
        title="T",
        title_type="series",
        year=2021,
        genres="Drama",
        country="United Kingdom",
    )
    assert title_metadata_matches_pool_filters(
        meta,
        {},
        decade_bounds=(2020, 2029),
        year_min=None,
        country_contains=None,
        ref_genres=None,
    )
    meta_no_year = TitleMetadata(
        imdb_title_id="tt2",
        title="T",
        title_type="series",
        year=None,
        genres="Drama",
        country="United Kingdom",
    )
    assert title_metadata_matches_pool_filters(
        meta_no_year,
        {"year": 1999},
        decade_bounds=(2020, 2029),
        year_min=None,
        country_contains=None,
        ref_genres=None,
    ) is False
