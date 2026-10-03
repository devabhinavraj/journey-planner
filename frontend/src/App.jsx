import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import Home from './pages/Home.jsx'
import Results from './pages/Results.jsx'
import RoutePage from './pages/Route.jsx'
import ReportBarrier from './pages/ReportBarrier.jsx'
import BarrierStatus from './pages/BarrierStatus.jsx'
import NearbyTouristPlaces from './pages/NearbyTouristPlaces.jsx'

export default function App() {
  return (
    <div className="min-h-screen flex flex-col">
      <a href="#main-content" className="skip-link sr-only-focusable">
        Skip to main content
      </a>
      <Navbar />
      <main id="main-content" className="flex-1">
        <ErrorBoundary>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/explore" element={<Results />} />
            <Route path="/route/:id" element={<RoutePage />} />
            <Route path="/report-barrier" element={<ReportBarrier />} />
            <Route path="/barrier-status" element={<BarrierStatus />} />
            <Route path="/nearby-tourist" element={<NearbyTouristPlaces />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </main>
      <Footer />
    </div>
  )
}

function NotFound() {
  return (
    <div className="max-w-content mx-auto px-4 py-24 text-center">
      <p className="font-mono text-marigold-600 font-semibold mb-2">404</p>
      <h1 className="font-display text-3xl font-semibold text-ink-900 mb-3">Page not found</h1>
      <p className="text-ink-500">The page you are looking for does not exist.</p>
    </div>
  )
}