import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import PlaceCard from '../components/PlaceCard.jsx'
import { SORT_OPTIONS, ACCESSIBILITY_NEEDS } from '../config/accessibility.js'
import { recommendJourney } from '../services/api.js'
import { NEARBY_CATEGORIES, searchNearbyCategory } from '../services/liveSearch.js'
import { useJourney } from '../context/JourneyContext.jsx'
import { useUserLocation } from '../context/LocationContext.jsx'
import { haversineDistanceKm } from '../services/geo.js'
import { normalizePlace } from '../services/api.js'

function withRealDistance(place, location) {
  if (location && typeof place.lat === 'number' && typeof place.lon === 'number') {
    const km = haversineDistanceKm(location.lat, location.lon, place.lat, place.lon)
    return { ...place, distance: Math.round(km * 10) / 10, distanceIsReal: true }
  }
  return { ...place, distanceIsReal: false }
}

export default function Results() {
  const { query, need, preferences } = useJourney()
  const { location, status: locationStatus } = useUserLocation()
  const [sortBy, setSortBy] = useState('accessibility')
  const [nearbyCategory, setNearbyCategory] = useState(null)
  const [places, setPlaces] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)

    const fetchResults = async () => {
      try {
        let results
        if (nearbyCategory) {
          const livePlaces = await searchNearbyCategory(location, nearbyCategory)
          results = livePlaces.map((p) => normalizePlace(p))
        } else {
          results = await recommendJourney({ query, need, preferences, sortBy, location })
        }

        if (!active) return
        let withDistance = results.map((p) => withRealDistance(p, location))
        if (sortBy === 'nearest' || nearbyCategory) {
          withDistance = [...withDistance].sort((a, b) => a.distance - b.distance)
        }
        setPlaces(withDistance)
        setLoading(false)
      } catch (error) {
        if (!active) return
        console.error('Failed to fetch results:', error)
        setPlaces([])
        setLoading(false)
      }
    }

    fetchResults()
    return () => {
      active = false
    }
  }, [query, need, preferences, sortBy, location, nearbyCategory])

  const needLabel = ACCESSIBILITY_NEEDS.find((n) => n.id === need)?.label

  return (
    <div className="max-w-content mx-auto px-4 py-10">
      <div className="flex flex-col gap-2 mb-8">
        <Link to="/" className="text-sm font-semibold text-teal-700 hover:text-teal-900 w-fit">
          ← Back to search
        </Link>
        <h1 className="font-display text-3xl md:text-4xl font-semibold text-ink-900">
          Recommended Accessible Places
        </h1>
        <p className="text-ink-500">
          {nearbyCategory
            ? `Showing ${NEARBY_CATEGORIES[nearbyCategory].label.toLowerCase()} near you`
            : query
              ? `Results for "${query}"`
              : 'Showing all destinations'}
          {needLabel ? ` · Tailored for ${needLabel} needs` : ''}
        </p>
        <p className="text-xs text-ink-500 flex items-center gap-1.5">
          <span aria-hidden="true">📍</span>
          {locationStatus === 'granted'
            ? 'Distances shown are calculated from your current location.'
            : locationStatus === 'approximate'
              ? 'Precise location unavailable — distances are estimated from your approximate (IP-based) location. Enable location access for exact results.'
              : locationStatus === 'requesting'
                ? 'Getting your location for accurate distances…'
                : 'Location unavailable — showing approximate distances. Enable location access for accurate results.'}
        </p>
      </div>

      <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1" role="group" aria-label="Nearby categories">
        {Object.entries(NEARBY_CATEGORIES).map(([key, cat]) => (
          <button
            key={key}
            type="button"
            aria-pressed={nearbyCategory === key}
            onClick={() => setNearbyCategory((prev) => (prev === key ? null : key))}
            disabled={!location}
            className={`hc-surface shrink-0 rounded-full border-2 px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              nearbyCategory === key
                ? 'border-marigold-600 bg-marigold-600 text-white'
                : 'border-ink-100 bg-white text-ink-700 hover:border-marigold-500'
            }`}
            title={!location ? 'Waiting for your location…' : `${cat.label} near you`}
          >
            <span aria-hidden="true">{cat.icon}</span> {cat.label} near me
          </button>
        ))}
        {/* Tourist Spots — dedicated page backed by the Overpass /tourist-places API */}
        <Link
          to="/nearby-tourist"
          id="nearby-tourist-link"
          className="hc-surface shrink-0 inline-flex items-center gap-1.5 rounded-full border-2 border-teal-600 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-800 hover:bg-teal-100 transition-colors"
          title="Explore all tourist attractions, museums and historic sites near you"
        >
          <span aria-hidden="true">🗺️</span> Tourist Spots near me
        </Link>
      </div>

      <div className="flex items-center gap-3 mb-6 overflow-x-auto pb-1" role="group" aria-label="Sort results">
        {SORT_OPTIONS.map((opt) => (
          <button
            key={opt.id}
            type="button"
            aria-pressed={sortBy === opt.id}
            onClick={() => setSortBy(opt.id)}
            disabled={Boolean(nearbyCategory)}
            className={`hc-surface shrink-0 rounded-full border-2 px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              sortBy === opt.id
                ? 'border-teal-700 bg-teal-700 text-white'
                : 'border-ink-100 bg-white text-ink-700 hover:border-teal-600'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" aria-live="polite" aria-busy="true">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-96 rounded-xl2 bg-ink-100/50 animate-pulse" />
          ))}
        </div>
      ) : places.length === 0 ? (
        <div className="text-center py-20 border-2 border-dashed border-ink-100 rounded-xl2">
          <p className="text-xl font-semibold text-ink-900 mb-2">No matching destinations</p>
          <p className="text-ink-500 mb-6">
            {nearbyCategory
              ? 'No results found nearby — try a different category or search a place instead.'
              : 'Try clearing a filter or searching a different place.'}
          </p>
          <Link to="/" className="text-teal-700 font-semibold hover:text-teal-900">
            ← Start a new search
          </Link>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" aria-live="polite">
          {places.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
        </div>
      )}
    </div>
  )
}
