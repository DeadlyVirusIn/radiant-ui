/**
 * HuntStatsContext — Single source of truth for hunt stats across the entire WebUI.
 *
 * REPLACES: Independent /api/hunt/stats polling in GlobalStatusBar, Sidebar, HuntMonitor, Dashboard.
 * GUARANTEES: ONE fetch per interval per tab. ALL consumers see the SAME data instance.
 *
 * Architecture:
 * - Polls /api/hunt/stats at configurable interval (30s default, 3s fast mode)
 * - Reference-counted fast polling: requestFastPolling() / releaseFastPolling()
 * - Normalization layer maps raw API fields to canonical names (PPM field mismatch fix)
 * - AbortController + sequence ID prevents stale overwrite from out-of-order responses
 * - Preserves last good data on fetch failure (no UI thrash)
 * - Exposes: data, loading, error, fetchedAt, ageMs, isStale, requestFastPolling, releaseFastPolling
 *
 * NON-GOALS: Does NOT compute page-specific derived state (ppmHistory, deltaSnapshots, containerMetrics).
 * Those stay in HuntMonitor as consumer-side derivations from data._raw.
 */

import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react'

const HuntStatsContext = createContext(null)

const SLOW_INTERVAL = 30000 // 30s default
const FAST_INTERVAL = 3000  // 3s when HuntMonitor is active
const STALE_THRESHOLD_SLOW = 90000  // 90s in slow mode
const STALE_THRESHOLD_FAST = 15000  // 15s in fast mode

/**
 * Normalize raw /api/hunt/stats response into canonical shape.
 * This is the ONLY place that maps raw field names to canonical names.
 * NO component should read raw API fields directly.
 */
function normalizeHuntStats(raw) {
  if (!raw) return null
  const s = raw.summary || {}

  return {
    // ── System-level (canonical names) ─────────────────────
    isActive: (s.activeInstances || 0) > 0,
    // PPM: prefer rollingPPM (60s window) → ppm → packsPerMinute (lifetime)
    // This fixes the field mismatch where GlobalStatusBar read summary.ppm
    // and HuntMonitor read summary.rollingPPM — now both read data.ppm
    ppm: parseFloat(s.rollingPPM) || parseFloat(s.ppm) || parseFloat(s.packsPerMinute) || 0,
    lifetimePPM: parseFloat(s.packsPerMinute) || 0,
    totalPacks: s.totalPacks || 0,
    totalGodPacks: s.totalGodPacks || 0,
    liveGodPacks: s.liveGodPacks || 0,
    liveGodPacksByContainer: s.liveGodPacksByContainer || {},
    // Container counts derived from instances[] (backend doesn't have activeContainers field)
    activeContainers: [...new Set((raw.instances || []).filter(i => i.isActive).map(i => i.containerGroup).filter(Boolean))].length || (s.activeInstances > 0 ? 1 : 0),
    totalContainers: [...new Set((raw.instances || []).map(i => i.containerGroup).filter(Boolean))].length || (s.totalInstances > 0 ? 1 : 0),
    activeWorkers: s.activeInstances || 0,
    totalWorkers: s.totalInstances || 0,
    runningTimeMs: s.runningTimeMs || 0,
    huntType: raw.huntType || null,

    // ── Raw data (for advanced consumers like HuntMonitor) ──
    // HuntMonitor needs instances[], perGroupBaseline, recentGodPacks etc.
    // for page-specific derivations (ppmHistory, deltaSnapshots, containerMetrics)
    _raw: raw,
    _summary: s,
  }
}

export function HuntStatsProvider({ children, enabled = true }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [fetchedAt, setFetchedAt] = useState(null)
  const [ageMs, setAgeMs] = useState(null)

  // Fast polling reference count
  const fastConsumers = useRef(0)
  const [isFastMode, setIsFastMode] = useState(false)

  // Stale overwrite protection
  const fetchSeq = useRef(0)       // Monotonic sequence ID
  const abortRef = useRef(null)    // AbortController for in-flight request
  const intervalRef = useRef(null)

  // ── Core fetch ────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    if (!enabled) return

    // Increment sequence and abort previous request
    const seq = ++fetchSeq.current
    if (abortRef.current) {
      try { abortRef.current.abort() } catch {}
    }
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch('/api/hunt/stats', {
        credentials: 'include',
        signal: controller.signal,
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const raw = await res.json()

      // Stale overwrite guard: only apply if this is still the latest request
      if (seq !== fetchSeq.current) return // A newer request was started — discard

      const normalized = normalizeHuntStats(raw)
      setData(normalized)
      setFetchedAt(Date.now())
      setError(null)
    } catch (err) {
      if (err.name === 'AbortError') return // Expected — request was superseded
      if (seq !== fetchSeq.current) return  // Stale

      // Keep last good data, just mark the error
      setError(err.message)
      // Don't clear data — preserve last known state
    } finally {
      setLoading(false)
    }
  }, [enabled])

  // ── Polling scheduler ─────────────────────────────────────
  useEffect(() => {
    if (!enabled) return

    // Clear existing interval
    if (intervalRef.current) clearInterval(intervalRef.current)

    const interval = isFastMode ? FAST_INTERVAL : SLOW_INTERVAL

    // Fetch immediately on mode change (prevents stale gap on fast→slow transition)
    fetchStats()

    intervalRef.current = setInterval(fetchStats, interval)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [enabled, isFastMode, fetchStats])

  // ── Age timer (ticks every 1s for freshness display) ──────
  useEffect(() => {
    if (!fetchedAt) return
    setAgeMs(Date.now() - fetchedAt)
    const timer = setInterval(() => setAgeMs(Date.now() - fetchedAt), 1000)
    return () => clearInterval(timer)
  }, [fetchedAt])

  // ── Fast polling control (reference-counted) ──────────────
  const requestFastPolling = useCallback(() => {
    fastConsumers.current += 1
    if (fastConsumers.current === 1) {
      setIsFastMode(true) // Triggers interval change effect
    }
  }, [])

  const releaseFastPolling = useCallback(() => {
    fastConsumers.current = Math.max(0, fastConsumers.current - 1)
    if (fastConsumers.current === 0) {
      setIsFastMode(false)
    }
  }, [])

  // ── Staleness ─────────────────────────────────────────────
  const staleThreshold = isFastMode ? STALE_THRESHOLD_FAST : STALE_THRESHOLD_SLOW
  const isStale = !fetchedAt || (ageMs != null && ageMs > staleThreshold) || !!error

  // ── Memoized context value (prevent unnecessary re-renders) ──
  const value = useMemo(() => ({
    data,
    loading,
    error,
    fetchedAt,
    ageMs,
    isStale,
    isFastMode,
    source: 'poll',
    requestFastPolling,
    releaseFastPolling,
    refetch: fetchStats,
  }), [data, loading, error, fetchedAt, ageMs, isStale, isFastMode, requestFastPolling, releaseFastPolling, fetchStats])

  return (
    <HuntStatsContext.Provider value={value}>
      {children}
    </HuntStatsContext.Provider>
  )
}

/**
 * Hook to consume hunt stats from the shared context.
 * ALL components must use this instead of direct fetch('/api/hunt/stats').
 */
export function useHuntStats() {
  const ctx = useContext(HuntStatsContext)
  if (!ctx) {
    // Return safe defaults when outside provider (e.g., login page)
    return {
      data: null,
      loading: false,
      error: null,
      fetchedAt: null,
      ageMs: null,
      isStale: true,
      isFastMode: false,
      source: 'none',
      requestFastPolling: () => {},
      releaseFastPolling: () => {},
      refetch: () => {},
    }
  }
  return ctx
}

export default HuntStatsContext
