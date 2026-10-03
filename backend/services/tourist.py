import math
from typing import Any, Dict, List, Optional
import requests

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
USER_AGENT = "AccessibleJourneyPlanner/1.0 (+https://localhost)"


def haversine_distance_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance between two points in kilometers."""
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(r * c, 2)


def fetch_tourist_places(
    lat: float,
    lon: float,
    radius: int = 10000,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """
    Fetch nearby tourist places (attractions, museums, viewpoints, historic sites)
    around a given latitude and longitude using OpenStreetMap Overpass API.
    """
    # Overpass query to find tourist places within the radius (in meters)
    query = f"""
    [out:json][timeout:25];
    (
      node["tourism"~"attraction|museum|viewpoint|gallery|theme_park|zoo|aquarium"](around:{radius},{lat},{lon});
      way["tourism"~"attraction|museum|viewpoint|gallery|theme_park|zoo|aquarium"](around:{radius},{lat},{lon});
      node["historic"~"monument|memorial|castle|fort|ruins|archaeological_site"](around:{radius},{lat},{lon});
      way["historic"~"monument|memorial|castle|fort|ruins|archaeological_site"](around:{radius},{lat},{lon});
    );
    out center tags {limit * 2};
    """

    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "application/json",
    }

    try:
        response = requests.post(
            OVERPASS_URL,
            data=query,
            headers=headers,
            timeout=30,
        )
        response.raise_for_status()
        data = response.json()
    except (requests.RequestException, ValueError, TypeError):
        return []

    elements = data.get("elements", [])
    places = []
    seen_names = set()

    for element in elements:
        tags = element.get("tags", {})
        name = tags.get("name") or tags.get("name:en")
        if not name:
            continue

        normalized_name = name.strip().lower()
        if normalized_name in seen_names:
            continue
        seen_names.add(normalized_name)

        # Get coordinates from node directly or center of way/relation
        place_lat = element.get("lat")
        place_lon = element.get("lon")
        if place_lat is None or place_lon is None:
            center = element.get("center", {})
            place_lat = center.get("lat")
            place_lon = center.get("lon")

        if place_lat is None or place_lon is None:
            continue

        place_lat = float(place_lat)
        place_lon = float(place_lon)
        dist_km = haversine_distance_km(lat, lon, place_lat, place_lon)

        tourism_type = tags.get("tourism") or tags.get("historic") or "attraction"
        wheelchair_val = tags.get("wheelchair")

        wheelchair_accessible: Optional[bool] = None
        if wheelchair_val in ("yes", "designated"):
            wheelchair_accessible = True
        elif wheelchair_val == "no":
            wheelchair_accessible = False

        places.append({
            "id": f"osm-{element.get('id')}",
            "name": name,
            "latitude": place_lat,
            "longitude": place_lon,
            "type": tourism_type,
            "wheelchair": wheelchair_val,
            "wheelchair_accessible": wheelchair_accessible,
            "distance_km": dist_km,
            "description": tags.get("description") or tags.get("opening_hours") or f"Tourist {tourism_type}",
            "source": "overpass",
        })

    # Sort by distance from user
    places.sort(key=lambda p: p["distance_km"])
    return places[:limit]
