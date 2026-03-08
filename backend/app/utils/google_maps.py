"""Google Maps deeplink generation utility.

Aligned with blueprint Section 5:
- Format: https://www.google.com/maps/dir/?api=1&origin=A&destination=B&waypoints=C|D|E&travelmode=transit
- Waypoints limit: ~10 per URL, auto-split for longer routes.
- Prefer lat/lng coordinates for precision; fallback to place name.
"""
from __future__ import annotations

from urllib.parse import quote

from app.core.config import settings
from app.models.itinerary import Place

_BASE_URL = "https://www.google.com/maps/dir/"


def _place_to_param(place: Place) -> str:
    """Convert a Place to a Maps URL parameter.

    Prefer coordinates for accuracy; fallback to name encoding.
    """
    if place.latitude is not None and place.longitude is not None:
        return f"{place.latitude},{place.longitude}"
    return quote(place.name)


def build_google_maps_url(
    places: list[Place],
    travel_mode: str = "transit",
) -> str:
    """Build a single Google Maps Directions URL.

    If waypoints exceed the limit, only the first segment URL is returned.
    Caller should use `build_google_maps_urls` for multi-segment.
    """
    if len(places) < 2:
        return ""

    origin = _place_to_param(places[0])
    destination = _place_to_param(places[-1])
    waypoints = places[1:-1]

    limit = settings.GOOGLE_MAPS_WAYPOINT_LIMIT
    wp_params = [_place_to_param(p) for p in waypoints[:limit]]

    url = f"{_BASE_URL}?api=1&origin={origin}&destination={destination}&travelmode={travel_mode}"
    if wp_params:
        url += "&waypoints=" + "|".join(wp_params)

    return url


def build_google_maps_urls(
    places: list[Place],
    travel_mode: str = "transit",
) -> list[str]:
    """Build multiple Google Maps URLs if waypoints exceed the limit.

    Splits the route into segments that respect the waypoint cap.
    Each segment's destination becomes the next segment's origin.
    """
    if len(places) < 2:
        return []

    limit = settings.GOOGLE_MAPS_WAYPOINT_LIMIT
    urls: list[str] = []

    # Each segment: 1 origin + up to `limit` waypoints + 1 destination = limit + 2 places
    segment_size = limit + 2
    i = 0

    while i < len(places) - 1:
        end = min(i + segment_size, len(places))
        segment = places[i:end]
        if len(segment) >= 2:
            urls.append(build_google_maps_url(segment, travel_mode))
        i = end - 1  # overlap: last place of prev segment = first of next

    return urls
