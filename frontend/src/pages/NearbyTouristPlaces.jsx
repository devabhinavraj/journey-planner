import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import PlaceCard from '../components/PlaceCard.jsx'
import { useUserLocation } from '../context/LocationContext.jsx'
import { getNearbyTouristPlaces } from '../services/api.js'

const RADIUS_OPTIONS = [
  { value: 2000, label: '2 km' },
  { value: 5000, label: '5 km' },
  { value: 10000, label: '10 km' },
  { value: 20000, label: '20 km' },
  { value: 50000, label: '50 km' }
]

const TYPE_ICONS = {
  attraction: '🏛️',
  museum: '🏺',
  viewpoint: '🔭',
  gallery: '🖼️',
  theme_park: '🎡',
  zoo: '🦁',
  aquarium: '🐠',
  monument: '🗿',
  memorial: '🕍',
  castle: '🏰',
  fort: '🏯',
  ruins: '🏚️',
  archaeological_site: '⛏️',
  historic: '📜',
  default: '📍'
}

function TypeBadge({ type }) {
  const icon = TYPE_ICONS[type] || TYPE_ICONS.default
  const label = type ? type.replace(/_/g, ' ') : 'attraction'
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-marigold-50 border border-marigold-200 px-2.5 py-0.5 text-xs font-semibold text-marigold-700 capitalize">
      <span aria-hidden="true">{icon}</span>
      {label}
    </span>
  )
}

function StatCard({ icon, value, label }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-white border border-ink-100 shadow-soft px-5 py-4 min-w-[100px]">
      <span className="text-2xl" aria-hidden="true">{icon}</span>
      <span className="text-2xl font-bold text-ink-900 leading-none">{value}</span>
      <span className="text-xs text-ink-500 text-center">{label}</span>
    </div>
  )
}

export default function NearbyTouristPlaces() {
  const { location, status: locationStatus } = useUserLocation()
  const [radius, setRadius] = useState(10000)
  const [places, setPlaces] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [fetched, setFetched] = useState(false)
  const [sortBy, setSortBy] = useState('distance')
  const [filterType, setFilterType] = useState('all')
  const activeRef = useRef(true)

  const fetchPlaces = useCallback(async () => {
    if (!location) return
    activeRef.current = true
    setLoading(true)
    setError(null)
    try {
      const results = await getNearbyTouristPlaces(location, { radius, limit: 50 })
      if (!activeRef.current) return
      setPlaces(results)
      setFetched(true)
    } catch (err) {
      if (!activeRef.current) return
      setError('Could not fetch tourist places. Please try again.')
      setPlaces([])
    } finally {
      if (activeRef.current) setLoading(false)
    }
  }, [location, radius])

  useEffect(() => {
    if (location) fetchPlaces()
    return () => { activeRef.current = false }
  }, [fetchPlaces, location])

  // Derive available types for filter chips
  const availableTypes = ['all', ...Array.from(new Set(places.map((p) => p.type).filter(Boolean)))]

  // Filter + sort
  const visiblePlaces = [...places]
    .filter((p) => filterType === 'all' || p.type === filterType)
    .sort((a, b) => {
      if (sortBy === 'distance') return (a.distance ?? 99999) - (b.distance ?? 99999)
      if (sortBy === 'name') return (a.name || '').localeCompare(b.name || '')
      return 0
    })

  const countByType = places.reduce((acc, p) => {
    const t = p.type || 'other'
    acc[t] = (acc[t] || 0) + 1
    return acc
  }, {})

  const locationLabel = location?.name || (location ? `${location.lat?.toFixed(4)}, ${location.lon?.toFixed(4)}` : 'your location')

  return (
    <div className="max-w-content mx-auto px-4 py-10">
      {/* Header */}
      <div className="flex flex-col gap-2 mb-8">
        <Link to="/explore" className="text-sm font-semibold text-teal-700 hover:text-teal-900 w-fit">
          ← Back to explore
        </Link>
        <h1 className="font-display text-3xl md:text-4xl font-semibold text-ink-900">
          🗺️ Nearby Tourist Places
        </h1>
        <p className="text-ink-500 text-sm max-w-2xl">
          Live results from OpenStreetMap near{' '}
          <span className="font-semibold text-ink-700">{locationLabel}</span>
          {' '}— attractions, museums, viewpoints, historic sites and more.
        </p>

        {/* Location status banner */}
        <div
          role="status"
          aria-live="polite"
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold w-fit mt-1 ${
            locationStatus === 'granted'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : locationStatus === 'requesting'
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          <span aria-hidden="true">
            {locationStatus === 'granted' ? '📍' : locationStatus === 'requesting' ? '⏳' : '⚠️'}
          </span>
          {locationStatus === 'granted'
            ? 'Using your precise location'
            : locationStatus === 'requesting'
              ? 'Getting your location…'
              : 'Location unavailable — enable location access for real results'}
        </div>
      </div>

      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Radius selector */}
        <div className="flex items-center gap-2">
          <label htmlFor="radius-select" className="text-sm font-semibold text-ink-700 whitespace-nowrap">
            Search radius:
          </label>
          <select
            id="radius-select"
            value={radius}
            onChange={(e) => setRadius(Number(e.target.value))}
            className="hc-surface rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-800 font-semibold focus:outline-none focus:ring-2 focus:ring-marigold-500"
          >
            {RADIUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-ink-700">Sort:</span>
          {['distance', 'name'].map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={sortBy === s}
              onClick={() => setSortBy(s)}
              className={`hc-surface rounded-full border-2 px-3 py-1 text-xs font-semibold transition-colors ${
                sortBy === s
                  ? 'border-teal-700 bg-teal-700 text-white'
                  : 'border-ink-100 bg-white text-ink-700 hover:border-teal-600'
              }`}
            >
              {s === 'distance' ? '📏 Nearest' : '🔤 Name'}
            </button>
          ))}
        </div>

        {/* Refresh */}
        <button
          type="button"
          id="refresh-tourist-places"
          onClick={fetchPlaces}
          disabled={loading || !location}
          className="ml-auto hc-surface inline-flex items-center gap-2 rounded-xl border border-marigold-300 bg-marigold-50 px-4 py-2 text-sm font-bold text-marigold-700 hover:bg-marigold-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <span aria-hidden="true" className={loading ? 'animate-spin' : ''}>🔄</span>
          {loading ? 'Searching…' : 'Refresh'}
        </button>
      </div>

      {/* Type filter chips */}
      {fetched && availableTypes.length > 1 && (
        <div className="flex flex-wrap gap-2 mb-6" role="group" aria-label="Filter by place type">
          {availableTypes.map((type) => {
            const icon = type === 'all' ? '🗺️' : (TYPE_ICONS[type] || TYPE_ICONS.default)
            const count = type === 'all' ? places.length : (countByType[type] || 0)
            return (
              <button
                key={type}
                type="button"
                aria-pressed={filterType === type}
                onClick={() => setFilterType(type)}
                className={`hc-surface shrink-0 inline-flex items-center gap-1.5 rounded-full border-2 px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${
                  filterType === type
                    ? 'border-marigold-600 bg-marigold-600 text-white'
                    : 'border-ink-100 bg-white text-ink-700 hover:border-marigold-500'
                }`}
              >
                <span aria-hidden="true">{icon}</span>
                {type === 'all' ? 'All' : type.replace(/_/g, ' ')}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${filterType === type ? 'bg-white/20' : 'bg-ink-100'}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* Stats row */}
      {fetched && !loading && places.length > 0 && (
        <div className="flex flex-wrap gap-3 mb-8">
          <StatCard icon="🏛️" value={places.length} label="places found" />
          <StatCard icon="📏" value={`${radius / 1000} km`} label="search radius" />
          {places[0]?.distance != null && (
            <StatCard icon="🚶" value={`${places[0].distance} km`} label="closest place" />
          )}
          <StatCard
            icon="♿"
            value={places.filter((p) => p.wheelchairAccessible === true).length}
            label="wheelchair accessible"
          />
        </div>
      )}

      {/* Location unavailable */}
      {locationStatus !== 'granted' && locationStatus !== 'requesting' && (
        <div className="text-center py-20 border-2 border-dashed border-amber-200 rounded-xl bg-amber-50">
          <p className="text-4xl mb-4" aria-hidden="true">📍</p>
          <p className="text-xl font-semibold text-ink-900 mb-2">Location access needed</p>
          <p className="text-ink-500 max-w-sm mx-auto">
            Please enable location access in your browser so we can show tourist places near you.
          </p>
        </div>
      )}

      {/* Requesting */}
      {locationStatus === 'requesting' && (
        <div className="text-center py-20">
          <p className="text-4xl mb-4 animate-pulse" aria-hidden="true">📡</p>
          <p className="text-xl font-semibold text-ink-900 mb-2">Getting your location…</p>
          <p className="text-ink-500">Please allow location access when prompted.</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 mb-6 flex items-center gap-3">
          <span className="text-2xl" aria-hidden="true">⚠️</span>
          <div>
            <p className="font-semibold text-red-800">{error}</p>
            <p className="text-sm text-red-600">The Overpass API may be temporarily busy. Try again in a moment.</p>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" aria-live="polite" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-80 rounded-xl2 bg-ink-100/50 animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && fetched && visiblePlaces.length === 0 && !error && (
        <div className="text-center py-20 border-2 border-dashed border-ink-100 rounded-xl">
          <p className="text-4xl mb-4" aria-hidden="true">🔭</p>
          <p className="text-xl font-semibold text-ink-900 mb-2">No tourist places found nearby</p>
          <p className="text-ink-500 mb-6">
            {filterType !== 'all'
              ? `No "${filterType.replace(/_/g, ' ')}" spots found. Try clearing the filter.`
              : 'Try increasing the search radius using the selector above.'}
          </p>
          {filterType !== 'all' && (
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className="text-teal-700 font-semibold hover:text-teal-900"
            >
              Show all types
            </button>
          )}
        </div>
      )}

      {/* Results grid */}
      {!loading && visiblePlaces.length > 0 && (
        <>
          <p className="text-sm text-ink-500 mb-4" aria-live="polite">
            Showing <strong>{visiblePlaces.length}</strong>
            {filterType !== 'all' ? ` "${filterType.replace(/_/g, ' ')}"` : ''} place{visiblePlaces.length !== 1 ? 's' : ''}{' '}
            within <strong>{radius / 1000} km</strong> of your location
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" aria-live="polite">
            {visiblePlaces.map((place) => (
              <PlaceCard key={place.id} place={place} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
