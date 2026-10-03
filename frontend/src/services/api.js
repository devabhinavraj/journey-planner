import { accessibilityNeedLabel, selectedPreferenceLabels } from '../config/accessibility.js'

export const BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  })

  if (!response.ok) {
    let message = `Backend request failed with status ${response.status}`
    try {
      const body = await response.json()
      message = body?.detail || message
    } catch {
      // Keep the status-based message when the backend sends no JSON body.
    }
    throw new ApiError(message, response.status)
  }

  return response.json()
}

function toNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function toBoolean(value) {
  return typeof value === 'boolean' ? value : null
}

export function formatCoordinates(latitude, longitude) {
  const lat = toNumber(latitude)
  const lon = toNumber(longitude)
  if (lat === null || lon === null) return 'Coordinates unavailable'
  return `${lat.toFixed(5)}, ${lon.toFixed(5)}`
}

function normalizeRoute(route) {
  if (!route) return null
  return {
    distance_km: toNumber(route.distance_km),
    duration_min: toNumber(route.duration_min),
    source: route.source || 'unavailable'
  }
}

function normalizeWeather(weather) {
  if (!weather) {
    return { temperature: null, rain: null, condition: 'Unknown', status: 'Unknown', source: 'unavailable' }
  }
  return {
    temperature: toNumber(weather.temperature),
    rain: weather.rain ?? null,
    condition: weather.condition || 'Unknown',
    status: weather.status || 'Unknown',
    source: weather.source || 'backend'
  }
}

export function normalizePlace(place, context = {}) {
  const latitude = toNumber(place.latitude ?? place.lat)
  const longitude = toNumber(place.longitude ?? place.lon)
  const route = normalizeRoute(place.route)
  const score = toNumber(place.score ?? place.accessibility_score)
  const activeBarriers = Number(place.active_barriers || 0)
  const weather = context.weather || normalizeWeather(place.weather)
  const distance = route?.distance_km ?? toNumber(place.distance_km ?? place.distance)
  const duration = route?.duration_min ?? toNumber(place.duration_min ?? place.duration)

  return {
    ...place,
    id: place.id,
    name: place.name || 'Unnamed place',
    description: place.description || '',
    latitude,
    longitude,
    lat: latitude,
    lon: longitude,
    location: place.location || formatCoordinates(latitude, longitude),
    source: place.source || 'backend',
    route,
    distance,
    duration,
    accessibilityScore: score,
    matchScore: score,
    score,
    recommendationReasons: Array.isArray(place.recommendation_reasons) ? place.recommendation_reasons : [],
    crowdLevel: place.crowd_level || null,
    weather: weather.condition,
    weatherStatus: weather.status,
    weatherTemp: weather.temperature === null ? null : `${weather.temperature} C`,
    wheelchairAccessible: toBoolean(place.wheelchair_accessible),
    accessibleToilet: toBoolean(place.accessible_toilet),
    lowStairs: toBoolean(place.low_stairs),
    liftAvailable: toBoolean(place.lift_available),
    assistanceAvailable: toBoolean(place.assistance_available),
    visualAccessibility: toBoolean(place.visual_accessibility),
    hearingAccessibility: toBoolean(place.hearing_accessibility),
    cognitiveAccessibility: toBoolean(place.cognitive_accessibility),
    ageFriendly: toBoolean(place.age_friendly),
    activeBarriers,
    temporaryBarriers: activeBarriers > 0
      ? [{ type: 'Active report', note: `${activeBarriers} active backend barrier report${activeBarriers > 1 ? 's' : ''}` }]
      : []
  }
}

function normalizeReport(report) {
  return {
    ...report,
    type: report.barrier_type || report.type || 'Other',
    destinationName: report.destination_name || report.destinationName || report.location || 'Unknown place',
    location: report.location || 'No location detail',
    photoName: report.photo_name || report.photoName || null,
    updated: report.updated || 'Just now'
  }
}

function sortPlaces(places, sortBy) {
  const sorted = [...places]
  const crowdRank = { Low: 0, Medium: 1, High: 2 }
  const weatherRank = { Clear: 0, Good: 0, Cloudy: 1, 'Not Clear': 2, Poor: 2, Unknown: 3 }

  switch (sortBy) {
    case 'nearest':
      sorted.sort((a, b) => (a.distance ?? Number.POSITIVE_INFINITY) - (b.distance ?? Number.POSITIVE_INFINITY))
      break
    case 'crowd':
      sorted.sort((a, b) => (crowdRank[a.crowdLevel] ?? 9) - (crowdRank[b.crowdLevel] ?? 9))
      break
    case 'weather':
      sorted.sort((a, b) => (weatherRank[a.weatherStatus] ?? weatherRank[a.weather] ?? 9) - (weatherRank[b.weatherStatus] ?? weatherRank[b.weather] ?? 9))
      break
    case 'assistance':
      sorted.sort((a, b) => Number(b.assistanceAvailable === true) - Number(a.assistanceAvailable === true))
      break
    case 'accessibility':
    default:
      sorted.sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
      break
  }

  return sorted
}

export async function getPlaces({ query = '' } = {}) {
  const params = new URLSearchParams()
  if (query.trim()) params.set('query', query.trim())
  const path = params.toString() ? `/places?${params.toString()}` : '/places'
  const data = await apiRequest(path)
  return (data.places || []).map((place) => normalizePlace(place))
}

export async function recommendJourney({ query = '', need = null, preferences = {}, sortBy = 'accessibility', location = null }) {
  const payload = {
    destination: query.trim(),
    accessibility_needs: need ? [accessibilityNeedLabel(need)] : [],
    preferences: selectedPreferenceLabels(preferences)
  }

  if (location && typeof location.lat === 'number' && typeof location.lon === 'number') {
    payload.current_location = {
      latitude: location.lat,
      longitude: location.lon
    }
  }

  const data = await apiRequest('/recommend', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  const weather = normalizeWeather(data.weather)
  const places = (data.recommendations || []).map((place) => normalizePlace(place, { weather }))
  return sortPlaces(places, sortBy)
}

export async function getRoute(id) {
  const place = await apiRequest(`/places/${encodeURIComponent(id)}`)
  return normalizePlace(place)
}

export async function getPlaceRoute(id, location) {
  if (!location || typeof location.lat !== 'number' || typeof location.lon !== 'number') return null
  const params = new URLSearchParams({ latitude: String(location.lat), longitude: String(location.lon) })
  const data = await apiRequest(`/places/${encodeURIComponent(id)}/route?${params.toString()}`)
  return normalizeRoute(data.route)
}

export async function submitBarrierReport(report) {
  const payload = {
    place_id: report.place_id ?? null,
    barrier_type: report.barrier_type || report.type,
    description: report.description,
    confidence: report.confidence || 'Medium',
    reported_by: report.reported_by || 'Frontend User',
    destination_name: report.destination_name || report.destinationName || report.location || null,
    location: report.location || null,
    photo_name: report.photo_name || report.photoName || null
  }
  const saved = await apiRequest('/barriers', {
    method: 'POST',
    body: JSON.stringify(payload)
  })
  return normalizeReport(saved)
}

export async function getBarrierReports() {
  const data = await apiRequest('/barriers')
  return (data.barriers || []).map(normalizeReport)
}

export async function getBarrierStatus(id) {
  const report = await apiRequest(`/barriers/${encodeURIComponent(id)}`)
  return normalizeReport(report)
}

export async function reverseGeocode(location) {
  if (!location || typeof location.lat !== 'number' || typeof location.lon !== 'number') return null
  return apiRequest('/location/reverse', {
    method: 'POST',
    body: JSON.stringify({ latitude: location.lat, longitude: location.lon, accuracy: location.accuracy || 'precise' })
  })
}

export async function getRouteTransport(place) {
  if (!place || typeof place.lat !== 'number' || typeof place.lon !== 'number') {
    return { cabsAvailable: false, busAvailable: false, cabCount: 0, busStopCount: 0 }
  }
  const { getNearbyTransport } = await import('./liveSearch.js')
  return getNearbyTransport(place.lat, place.lon)
}

/**
 * Fetch nearby tourist attractions, museums, historic sites and viewpoints
 * from the backend /tourist-places endpoint (which uses the Overpass API).
 *
 * @param {{ lat: number, lon: number }} location - user's coordinates
 * @param {{ radius?: number, limit?: number }} options
 * @returns {Promise<Array>} normalized place objects
 */
export async function getNearbyTouristPlaces(location, { radius = 10000, limit = 30 } = {}) {
  if (!location || typeof location.lat !== 'number' || typeof location.lon !== 'number') {
    return []
  }
  const params = new URLSearchParams({
    lat: String(location.lat),
    lon: String(location.lon),
    radius: String(radius),
    limit: String(limit)
  })
  const data = await apiRequest(`/tourist-places?${params.toString()}`)
  return (data.places || []).map((p) =>
    normalizePlace({
      ...p,
      // Map backend field names to frontend normalizer expectations
      latitude: p.latitude,
      longitude: p.longitude,
      source: 'overpass',
      description: p.description || `Tourist ${p.type || 'attraction'}`,
      distance_km: p.distance_km
    })
  )
}