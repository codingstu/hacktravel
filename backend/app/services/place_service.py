"""Place detail service — fetch place info from Wikipedia + generate map links.

Uses Wikipedia REST API (free, no key needed) to get:
- Place summary / description
- Thumbnail image URL
- Coordinates-based Google Maps deeplink

For "reviews" — we use the tips from the preset data as insider tips.
"""
from __future__ import annotations

import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_WIKI_API = "https://zh.wikipedia.org/api/rest_v1"
_WIKI_SEARCH = "https://zh.wikipedia.org/w/api.php"
_HTTP_TIMEOUT = 8.0


async def fetch_place_detail(
    place_name: str,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
) -> dict:
    """Fetch place detail from Wikipedia.

    Returns dict with:
      - description: str
      - image_url: str | None
      - wiki_url: str | None
      - map_url: str | None
    """
    result = {
        "name": place_name,
        "description": "",
        "image_url": None,
        "wiki_url": None,
        "map_url": None,
    }

    # Build Google Maps URL
    if latitude and longitude:
        result["map_url"] = (
            f"https://www.google.com/maps/search/?api=1"
            f"&query={latitude},{longitude}"
        )
    else:
        result["map_url"] = (
            f"https://www.google.com/maps/search/?api=1"
            f"&query={httpx.URL(place_name)}"
        )

    # Try Wikipedia REST API — summary endpoint
    try:
        async with httpx.AsyncClient(timeout=_HTTP_TIMEOUT) as client:
            # First try direct page summary
            summary = await _fetch_wiki_summary(client, place_name)
            if summary:
                result["description"] = summary.get("extract", "")
                thumb = summary.get("thumbnail", {})
                if thumb and thumb.get("source"):
                    result["image_url"] = thumb["source"]
                titles = summary.get("titles", {})
                if titles and titles.get("canonical"):
                    result["wiki_url"] = (
                        f"https://zh.wikipedia.org/wiki/{titles['canonical']}"
                    )
                return result

            # Fallback: search + get first result summary
            search_title = await _search_wiki(client, place_name)
            if search_title:
                summary = await _fetch_wiki_summary(client, search_title)
                if summary:
                    result["description"] = summary.get("extract", "")
                    thumb = summary.get("thumbnail", {})
                    if thumb and thumb.get("source"):
                        result["image_url"] = thumb["source"]
                    titles = summary.get("titles", {})
                    if titles and titles.get("canonical"):
                        result["wiki_url"] = (
                            f"https://zh.wikipedia.org/wiki/{titles['canonical']}"
                        )

    except Exception as exc:
        logger.warning("Wikipedia fetch failed for %s: %s", place_name, exc)

    return result


async def _fetch_wiki_summary(
    client: httpx.AsyncClient, title: str
) -> Optional[dict]:
    """Fetch Wikipedia page summary via REST API."""
    import urllib.parse
    encoded = urllib.parse.quote(title.replace(" ", "_"), safe="")
    url = f"{_WIKI_API}/page/summary/{encoded}"
    try:
        resp = await client.get(url, headers={"Accept": "application/json"})
        if resp.status_code == 200:
            data = resp.json()
            if data.get("type") == "standard" or data.get("extract"):
                return data
    except Exception as exc:
        logger.debug("Wiki summary failed for %s: %s", title, exc)
    return None


async def _search_wiki(client: httpx.AsyncClient, query: str) -> Optional[str]:
    """Search Wikipedia for a page title matching the query."""
    params = {
        "action": "query",
        "list": "search",
        "srsearch": query,
        "srlimit": "1",
        "format": "json",
    }
    try:
        resp = await client.get(_WIKI_SEARCH, params=params)
        if resp.status_code == 200:
            data = resp.json()
            results = data.get("query", {}).get("search", [])
            if results:
                return results[0]["title"]
    except Exception as exc:
        logger.debug("Wiki search failed for %s: %s", query, exc)
    return None
