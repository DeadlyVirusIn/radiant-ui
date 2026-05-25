/**
 * useRecoveryStatus — shared 30s-poll hook for /admin/recovery/container-status.
 *
 * 2026-04-24 (C1) — introduced so HuntMonitor's top pill and
 * OpsHealthSummary's sub-pill both consume the SAME recovery payload
 * and compute a unified verdict via mergeHealthVerdicts(). Prior to
 * this, OpsHealthSummary fetched independently and the two surfaces
 * could disagree — creating the "header says Healthy / sub-pill says
 * 1 unhealthy" trust-breaking UI state.
 *
 * Returns { recovery, loading, refresh }. Hidden for non-admins via
 * `opts.enabled = isAdmin`. Poll cadence matches OpsHealthSummary's
 * previous 30s cadence so behavior is equivalent for the sub-pill.
 */

import { useCallback, useEffect, useState } from 'react'
import { fetchWithAuth } from '../services/api'

const DEFAULT_POLL_MS = 30_000

export function useRecoveryStatus({ enabled = true, pollMs = DEFAULT_POLL_MS } = {}) {
  const [recovery, setRecovery] = useState(null)
  const [loading, setLoading]   = useState(true)

  const refresh = useCallback(async () => {
    try {
      const r = await fetchWithAuth('/admin/recovery/container-status')
      if (r.ok) setRecovery(await r.json())
    } catch {
      // Silent — consumers should fall back gracefully when recovery is null.
    }
  }, [])

  useEffect(() => {
    if (!enabled) { setLoading(false); return }
    let cancelled = false
    refresh().finally(() => { if (!cancelled) setLoading(false) })
    const t = setInterval(refresh, pollMs)
    return () => { cancelled = true; clearInterval(t) }
  }, [enabled, pollMs, refresh])

  return { recovery, loading, refresh }
}

export default useRecoveryStatus
