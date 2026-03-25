"""Fetch BritBox Amazon Channel (US) catalog from JustWatch for prototype provider recommendations.

Usage:
    cd backend && python -m app.scripts.fetch_britbox_catalog

Options:
    --list-providers   Show all US providers matching "brit" and exit
    --max-pages N      Max pagination pages (default 30, ~3000 titles)

Saves catalog to data/britbox/catalog.json (workspace root).
"""

import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

JUSTWATCH_GRAPHQL = "https://apis.justwatch.com/graphql"

CATALOG_DIR = Path(__file__).resolve().parent.parent.parent.parent / "data" / "britbox"
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

BRITBOX_KEYWORDS = ["britbox amazon channel", "britbox"]


def _graphql(client: httpx.Client, query: str, variables: dict) -> dict:
    resp = client.post(JUSTWATCH_GRAPHQL, json={"query": query, "variables": variables})
    resp.raise_for_status()
    data = resp.json()
    if "errors" in data:
        raise RuntimeError(f"GraphQL errors: {data['errors']}")
    return data["data"]


def find_britbox_package(client: httpx.Client) -> dict | None:
    data = _graphql(client, PACKAGES_QUERY, {"country": "US", "platform": "WEB"})
    packages = data.get("packages", [])
    for kw in BRITBOX_KEYWORDS:
        for pkg in packages:
            if kw == (pkg.get("clearName") or "").lower():
                return pkg
    for kw in BRITBOX_KEYWORDS:
        for pkg in packages:
            if kw in (pkg.get("clearName") or "").lower():
                return pkg
    return None


def list_britbox_providers(client: httpx.Client) -> list[dict]:
    data = _graphql(client, PACKAGES_QUERY, {"country": "US", "platform": "WEB"})
    return [p for p in data.get("packages", []) if "brit" in (p.get("clearName") or "").lower()]


def fetch_titles(client: httpx.Client, tech_name: str, max_pages: int = 30) -> list[dict]:
    titles = []
    after = None

    for page in range(max_pages):
        variables = {
            "country": "US",
            "language": "en",
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
            providers = list_britbox_providers(client)
            if not providers:
                print("No providers matching 'brit' found in US.")
            else:
                for p in providers:
                    print(f"  {p['clearName']}  tech={p['technicalName']}  id={p['packageId']}")
            return

        print("Discovering BritBox package on JustWatch (US)...")
        pkg = find_britbox_package(client)
        if not pkg:
            print("ERROR: Could not find BritBox in JustWatch US providers.")
            providers = list_britbox_providers(client)
            if providers:
                print("Partial matches:")
                for p in providers:
                    print(f"  {p['clearName']}  tech={p['technicalName']}")
            else:
                print("No 'brit*' providers found at all. JustWatch API may have changed.")
            sys.exit(1)

        print(f"Found: {pkg['clearName']} (tech={pkg['technicalName']}, id={pkg['packageId']})")
        print(f"Fetching titles (max {max_pages} pages of 100)...")

        titles = fetch_titles(client, pkg["technicalName"], max_pages=max_pages)

    with_imdb = [t for t in titles if t.get("imdb_id")]
    movies = [t for t in titles if t.get("object_type") == "MOVIE"]
    shows = [t for t in titles if t.get("object_type") == "SHOW"]

    catalog = {
        "provider": "britbox-us",
        "provider_clear_name": pkg["clearName"],
        "provider_technical_name": pkg["technicalName"],
        "fetched_at": datetime.now(timezone.utc).isoformat(),
        "source": "justwatch_graphql",
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
