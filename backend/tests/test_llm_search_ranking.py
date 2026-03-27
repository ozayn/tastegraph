"""LLM search ranking tie-break helpers (year vs imdb id when scores tie)."""

from app.services import llm_search as ls


def test_llm_search_rank_year_tiebreak_prefers_newer():
    assert ls._llm_search_rank_year_tiebreak_key(2020) < ls._llm_search_rank_year_tiebreak_key(1990)


def test_llm_search_rank_year_tiebreak_missing_year_sorts_after_dated():
    assert ls._llm_search_rank_year_tiebreak_key(2000) < ls._llm_search_rank_year_tiebreak_key(None)


def test_year_int_for_llm_search_ranking_bounds():
    assert ls._year_int_for_llm_search_ranking(2020) == 2020
    assert ls._year_int_for_llm_search_ranking(1869) is None
    assert ls._year_int_for_llm_search_ranking(2036) is None
