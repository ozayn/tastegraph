"""HEAD-check poster image URLs (Amazon CDN, TMDB images, etc.)."""

import urllib.request

_DEFAULT_TIMEOUT = 5


def is_poster_url_broken(url: str) -> bool:
    """True if URL is missing, or HEAD fails, or status is not 200."""
    if not url or not url.strip():
        return True
    try:
        req = urllib.request.Request(
            url.strip(),
            method="HEAD",
            headers={"User-Agent": "Mozilla/5.0"},
        )
        resp = urllib.request.urlopen(req, timeout=_DEFAULT_TIMEOUT)
        return resp.status != 200
    except Exception:
        return True
