"""DEPRECATED — do not use for normal workflow.

JustWatch ``popularTitles`` + ``packages=[britbox]`` does **not** return a BritBox-only catalog
(the API ignores the filter; see commit history / docs). Kept only as a reference implementation.

Run instead: ``python -m app.scripts.fetch_britbox_catalog`` (Watchmode).

----

Fetch BritBox (US) catalog from JustWatch GraphQL for prototype provider recommendations.

.. warning::
    JustWatch's public GraphQL ``popularTitles`` query accepts a ``TitleFilter.packages``
    list, but **that filter is not reliably applied**. For the US ``britbox`` package, the API
    currently returns the **same ~200k-title popular catalog** as an unfiltered request (same
    ``totalCount`` and same leading titles as the global feed). Netflix's ``nfx`` filter *does*
    narrow results (~7k titles). This script **refuses to save** a snapshot when the filter is
    clearly a no-op, so we do not ship a bogus "BritBox catalog".

    There is **no separate "BritBox Amazon Channel"** package in the US ``WEB`` package list
    today—only **BritBox** (``technicalName=britbox``) and **Britbox Apple TV Channel**
    (``appletvbritbox``). For a trustworthy BritBox-specific list you likely need another source
    (e.g. JustWatch Content Partner API with a contract token, or a provider-supplied feed).

Usage:
    cd backend && python -m app.scripts.fetch_britbox_catalog

Options:
    --list-providers   Show all US WEB providers matching "brit" and exit
    --max-pages N      Max pagination pages (default 30, ~3000 titles)

Saves catalog to data/britbox/catalog.json (workspace root).
"""

from __future__ import annotations

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

JUSTWATCH_GRAPHQL = "https://apis.justwatch.com/graphql"

# Market and surface (must match what the site uses for US browsing).
DEFAULT_COUNTRY = "US"
DEFAULT_LANGUAGE = "en"
DEFAULT_PLATFORM = "WEB"

# Strict BritBox package identity (US / WEB). Do not fuzzy-match other "brit*" strings.
BRITBOX_PACKAGE_TECHNICAL_NAME = "britbox"
BRITBOX_ALLOWED_CLEAR_NAMES = frozenset({"BritBox"})

# If filtered popularTitles totalCount is above this fraction of the unfiltered US catalog, the
# packages filter is almost certainly not applied (BritBox currently ~100% of baseline).
MAX_FILTERED_TO_BASELINE_RATIO = 0.25
# Absolute cap: no single streaming add-on should match a huge fraction of all JW titles.
MAX_FILTERED_TOTAL_ABSOLUTE = 25_000

CATALOG_DIR = Path(__file__).resolve().parent.parent.parent / "data" / "britbox"
CATALOG_PATH = CATALOG_DIR / "catalog.json"

PACKAGES_QUERY = """
query GetPackages($country: Country!, $platform: Platform!) {
  packages(country: $country, platform: $platform) {
    clearName
    technicalName
    packageId
  }
}
"""

TITLES_QUERY = """
query GetPopularTitles(
  $country: Country!
  $language: Language!
  $first: Int!
  $filter: TitleFilter
  $after: String
) {
  popularTitles(
    country: $country
    first: $first
    after: $after
    filter: $filter
    sortBy: POPULAR
    sortRandomSeed: 0
  ) {
    totalCount
    pageInfo {
      endCursor
      hasNextPage
    }
    edges {
      node {
        id
        objectId
        objectType
        content(country: $country, language: $language) {
          title
          originalReleaseYear
          shortDescription
          externalIds {
            imdbId
          }
          posterUrl
          genres {
            shortName
          }
        }
      }
    }
  }
}
"""

# Minimal query for filter sanity checks (small payload).
POPULAR_TITLES_PEEK_QUERY = """
query PeekPopularTitles(
  $country: Country!
  $language: Language!
  $first: Int!
  $filter: TitleFilter
) {
  popularTitles(
    country: $country
    first: $first
    filter: $filter
    sortBy: POPULAR
    sortRandomSeed: 0
  ) {
    totalCount
    edges {
      node {
        content(country: $country, language: $language) {
          title
        }
      }
    }
  }
}
"""


def _graphql(client: httpx.Client, query: str, variables: dict) -> dict:
    resp = client.post(JUSTWATCH_GRAPHQL, json={"query": query, "variables": variables})
    resp.raise_for_status()
    data = resp.json()
    if "errors" in data:
        raise RuntimeError(f"GraphQL errors: {data['errors']}")
    return data["data"]


def _peek_popular_titles(
    client: httpx.Client,
    *,
    country: str,
    language: str,
    filter_: dict | None,
    first: int = 8,
) -> tuple[int, list[str]]:
    data = _graphql(
        client,
        POPULAR_TITLES_PEEK_QUERY,
        {"country": country, "language": language, "first": first, "filter": filter_},
    )
    block = data.get("popularTitles") or {}
    total = int(block.get("totalCount") or 0)
    titles: list[str] = []
    for edge in block.get("edges") or []:
        node = edge.get("node") or {}
        content = node.get("content") or {}
        t = content.get("title")
        if t:
            titles.append(str(t))
    return total, titles


def validate_popular_titles_package_filter(
    client: httpx.Client,
    *,
    country: str,
    language: str,
    package_technical_name: str,
    package_label: str,
) -> None:
    """Abort if ``popularTitles`` clearly ignores ``packages`` for this provider (BritBox case)."""
    baseline_total, baseline_titles = _peek_popular_titles(
        client, country=country, language=language, filter_=None
    )
    filtered_total, filtered_titles = _peek_popular_titles(
        client,
        country=country,
        language=language,
        filter_={"packages": [package_technical_name]},
    )
    _, netflix_titles = _peek_popular_titles(
        client, country=country, language=language, filter_={"packages": ["nfx"]}
    )

    ratio = filtered_total / baseline_total if baseline_total else 1.0

    print(
        f"  Filter check: unfiltered totalCount={baseline_total}, "
        f"with packages=[{package_technical_name}] totalCount={filtered_total} "
        f"(ratio={ratio:.3f})"
    )
    print(f"  Sample titles (unfiltered, first {len(baseline_titles)}): {baseline_titles}")
    print(f"  Sample titles (filtered,   first {len(filtered_titles)}): {filtered_titles}")
    print(f"  Sample titles (Netflix control nfx, first {len(netflix_titles)}): {netflix_titles}")

    bad_ratio = ratio > MAX_FILTERED_TO_BASELINE_RATIO
    bad_absolute = filtered_total > MAX_FILTERED_TOTAL_ABSOLUTE
    same_as_baseline = baseline_titles and baseline_titles == filtered_titles
    control_differs = netflix_titles and netflix_titles != baseline_titles

    if (bad_ratio or bad_absolute) and same_as_baseline and control_differs:
        raise RuntimeError(
            f"JustWatch popularTitles is not constraining to {package_label!r}: "
            f"filtered totalCount ({filtered_total}) matches the full catalog (~{baseline_total}), "
            f"and the first titles are identical to the unfiltered feed while Netflix's filter "
            f"returns a different slice. The saved JSON would not be BritBox-specific. "
            f"Use a different data source or wait for a JustWatch API fix."
        )

    if bad_ratio or bad_absolute:
        raise RuntimeError(
            f"Refusing to save: packages=[{package_technical_name}] still returns "
            f"{filtered_total} titles (>{MAX_FILTERED_TOTAL_ABSOLUTE} or "
            f">{MAX_FILTERED_TO_BASELINE_RATIO:.0%} of unfiltered). "
            f"That is not a plausible single-provider catalog for {package_label}."
        )


def resolve_britbox_us_package(client: httpx.Client, *, country: str, platform: str) -> dict:
    """Return the US BritBox WEB package dict, or raise if missing or ambiguous."""
    data = _graphql(client, PACKAGES_QUERY, {"country": country, "platform": platform})
    packages = data.get("packages", [])
    matches = [
        p
        for p in packages
        if (p.get("technicalName") or "") == BRITBOX_PACKAGE_TECHNICAL_NAME
        and (p.get("clearName") or "") in BRITBOX_ALLOWED_CLEAR_NAMES
    ]
    if not matches:
        raise RuntimeError(
            f"No BritBox package with technicalName={BRITBOX_PACKAGE_TECHNICAL_NAME!r} and "
            f"clearName in {sorted(BRITBOX_ALLOWED_CLEAR_NAMES)!r} for country={country!r} "
            f"platform={platform!r}. Run with --list-providers to inspect JW packages."
        )
    if len(matches) > 1:
        raise RuntimeError(f"Ambiguous BritBox packages in JW response: {matches!r}")
    return matches[0]


def list_britbox_providers(client: httpx.Client, *, country: str, platform: str) -> list[dict]:
    data = _graphql(client, PACKAGES_QUERY, {"country": country, "platform": platform})
    return [p for p in data.get("packages", []) if "brit" in (p.get("clearName") or "").lower()]


def fetch_titles(
    client: httpx.Client,
    tech_name: str,
    *,
    country: str,
    language: str,
    max_pages: int = 30,
) -> list[dict]:
    titles = []
    after = None

    for page in range(max_pages):
        variables = {
            "country": country,
            "language": language,
            "first": 100,
            "after": after,
            "filter": {"packages": [tech_name]},
        }

        data = _graphql(client, TITLES_QUERY, variables)
        popular = data.get("popularTitles", {})
        edges = popular.get("edges", [])
        page_info = popular.get("pageInfo", {})
        total = popular.get("totalCount", 0)

        for edge in edges:
            node = edge.get("node", {})
            content = node.get("content", {})
            ext = content.get("externalIds", {}) or {}
            genres = content.get("genres") or []

            titles.append({
                "justwatch_id": node.get("id"),
                "imdb_id": ext.get("imdbId") or None,
                "title": content.get("title"),
                "year": content.get("originalReleaseYear"),
                "object_type": node.get("objectType"),
                "genres": [g.get("shortName", "") for g in genres if g.get("shortName")],
                "poster_url": content.get("posterUrl"),
            })

        print(f"  Page {page + 1}: +{len(edges)} titles (total: {len(titles)}/{total})")

        if not page_info.get("hasNextPage") or not edges:
            break
        after = page_info.get("endCursor")
        time.sleep(0.4)

    return titles


def main():
    CATALOG_DIR.mkdir(parents=True, exist_ok=True)
    max_pages = 30

    args = sys.argv[1:]
    if "--max-pages" in args:
        idx = args.index("--max-pages")
        max_pages = int(args[idx + 1])

    headers = {"User-Agent": "TasteGraph/0.1 (prototype)"}

    with httpx.Client(timeout=30.0, headers=headers) as client:
        if "--list-providers" in args:
            providers = list_britbox_providers(
                client, country=DEFAULT_COUNTRY, platform=DEFAULT_PLATFORM
            )
            if not providers:
                print(
                    f"No providers matching 'brit' in clearName for "
                    f"country={DEFAULT_COUNTRY} platform={DEFAULT_PLATFORM}."
                )
            else:
                print(
                    f"JustWatch GraphQL {JUSTWATCH_GRAPHQL}\n"
                    f"  country={DEFAULT_COUNTRY}  platform={DEFAULT_PLATFORM}\n"
                    f"  (popularTitles may still ignore packages=[...] for some providers—"
                    f"run a full fetch to validate.)\n"
                )
                for p in providers:
                    cn = (p.get("clearName") or "").strip()
                    print(f"  {cn!r}  tech={p['technicalName']}  packageId={p['packageId']}")
            return

        print(
            f"JustWatch GraphQL: {JUSTWATCH_GRAPHQL}\n"
            f"  country={DEFAULT_COUNTRY}  language={DEFAULT_LANGUAGE}  platform={DEFAULT_PLATFORM}\n"
            f"  query: popularTitles + TitleFilter.packages=[technicalName]\n"
        )
        print("Resolving BritBox package (strict id + clearName match)...")
        try:
            pkg = resolve_britbox_us_package(
                client, country=DEFAULT_COUNTRY, platform=DEFAULT_PLATFORM
            )
        except RuntimeError as e:
            print(f"ERROR: {e}")
            providers = list_britbox_providers(
                client, country=DEFAULT_COUNTRY, platform=DEFAULT_PLATFORM
            )
            if providers:
                print("Packages with 'brit' in clearName:")
                for p in providers:
                    print(f"  {p['clearName']!r}  tech={p['technicalName']}  id={p['packageId']}")
            sys.exit(1)

        print(
            f"Selected package: clearName={pkg['clearName']!r}  "
            f"technicalName={pkg['technicalName']!r}  packageId={pkg['packageId']}"
        )
        print("Validating that popularTitles honors the packages filter...")
        try:
            validate_popular_titles_package_filter(
                client,
                country=DEFAULT_COUNTRY,
                language=DEFAULT_LANGUAGE,
                package_technical_name=pkg["technicalName"],
                package_label=pkg["clearName"],
            )
        except RuntimeError as e:
            print(f"\nFETCH ABORTED: {e}\n")
            print(
                "The on-disk catalog was not updated. "
                "BritBox recommendations need a provider-specific source other than "
                "this JustWatch popularTitles feed."
            )
            sys.exit(1)

        print(f"Fetching titles (max {max_pages} pages of 100)...")
        titles = fetch_titles(
            client,
            pkg["technicalName"],
            country=DEFAULT_COUNTRY,
            language=DEFAULT_LANGUAGE,
            max_pages=max_pages,
        )

    with_imdb = [t for t in titles if t.get("imdb_id")]
    movies = [t for t in titles if t.get("object_type") == "MOVIE"]
    shows = [t for t in titles if t.get("object_type") == "SHOW"]

    catalog = {
        "provider": "britbox-us",
        "provider_clear_name": pkg["clearName"],
        "provider_technical_name": pkg["technicalName"],
        "provider_package_id": pkg["packageId"],
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "source": "justwatch_graphql",
        "justwatch": {
            "graphql_endpoint": JUSTWATCH_GRAPHQL,
            "country": DEFAULT_COUNTRY,
            "language": DEFAULT_LANGUAGE,
            "platform": DEFAULT_PLATFORM,
            "query": "popularTitles",
            "title_filter": {"packages": [pkg["technicalName"]]},
        },
        "stats": {
            "total": len(titles),
            "with_imdb_id": len(with_imdb),
            "without_imdb_id": len(titles) - len(with_imdb),
            "movies": len(movies),
            "shows": len(shows),
        },
        "titles": titles,
    }

    CATALOG_PATH.write_text(json.dumps(catalog, indent=2, ensure_ascii=False))
    print(f"\nSaved {len(titles)} titles to {CATALOG_PATH}")
    print(f"  Movies: {len(movies)}, Shows: {len(shows)}")
    print(f"  With IMDb ID: {len(with_imdb)}, Without: {len(titles) - len(with_imdb)}")


if __name__ == "__main__":
    main()
