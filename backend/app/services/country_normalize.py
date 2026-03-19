"""Country normalization for options and filtering. Preserves historical values (West Germany, Soviet Union)."""

_VARIANT_TO_CANONICAL = {
    "UK": "United Kingdom",
    "USA": "United States",
}


def _canonical_to_variants() -> dict[str, list[str]]:
    """Reverse map: canonical -> list of variants (for filtering)."""
    out: dict[str, list[str]] = {}
    for v, c in _VARIANT_TO_CANONICAL.items():
        out.setdefault(c, [c]).append(v)
    for c in out:
        out[c] = list(dict.fromkeys(out[c]))  # dedupe, keep order
    return out


_CANONICAL_TO_VARIANTS = _canonical_to_variants()


def _is_empty(s: str) -> bool:
    return not s or not s.strip() or s.strip().upper() == "N/A"


def normalize_country(raw: str) -> str | None:
    """Normalize for display. Returns None if empty/N/A."""
    s = (raw or "").strip()
    if _is_empty(s):
        return None
    return _VARIANT_TO_CANONICAL.get(s, s)


def parse_and_normalize_countries(country_str: str | None) -> set[str]:
    """Parse comma-separated country string, normalize, exclude empty/N/A. Returns set of canonical names."""
    out: set[str] = set()
    if not country_str:
        return out
    for part in country_str.split(","):
        s = part.strip()
        if _is_empty(s):
            continue
        canonical = _VARIANT_TO_CANONICAL.get(s, s)
        out.add(canonical)
    return out


def filter_variants_for_country(canonical: str) -> list[str]:
    """Return variants to match when filtering by this country (e.g. UK and United Kingdom for United Kingdom)."""
    return _CANONICAL_TO_VARIANTS.get(canonical, [canonical])
