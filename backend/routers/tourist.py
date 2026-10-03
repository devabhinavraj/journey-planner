from fastapi import APIRouter, HTTPException, Query
from typing import List, Optional
from pydantic import BaseModel

from backend.services.tourist import fetch_tourist_places

router = APIRouter(tags=["Tourist Places"])


class TouristPlace(BaseModel):
    id: str
    name: str
    latitude: float
    longitude: float
    type: str
    wheelchair: Optional[str] = None
    wheelchair_accessible: Optional[bool] = None
    distance_km: float
    description: Optional[str] = None
    source: str = "overpass"


class TouristPlacesResponse(BaseModel):
    count: int
    lat: float
    lon: float
    radius_km: float
    places: List[TouristPlace]


@router.get("/tourist-places", response_model=TouristPlacesResponse)
def get_tourist_places(
    lat: float = Query(..., description="User latitude", ge=-90, le=90),
    lon: float = Query(..., description="User longitude", ge=-180, le=180),
    radius: int = Query(10000, description="Search radius in metres", ge=500, le=50000),
    limit: int = Query(30, description="Maximum number of results", ge=1, le=100),
):
    """
    Return nearby tourist attractions, museums, viewpoints, galleries,
    historic monuments and parks around the given coordinates, fetched
    live from the OpenStreetMap Overpass API.
    """
    try:
        places = fetch_tourist_places(lat=lat, lon=lon, radius=radius, limit=limit)
        return {
            "count": len(places),
            "lat": lat,
            "lon": lon,
            "radius_km": round(radius / 1000, 1),
            "places": places,
        }
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to fetch tourist places: {str(e)}",
        )
