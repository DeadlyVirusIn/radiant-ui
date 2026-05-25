import { useState, useRef, useCallback, useEffect } from 'react'

/**
 * Shared hook for stamina heal actions across EventBattle, WonderPick, StaminaDashboard.
 *
 * @param {Function} healApiFn  - async (chargersAmount, vcAmount) => Promise<any>
 * @param {Function} refreshFn  - callback to refresh data after heal
 * @param {number}   [delay=1000] - ms to wait before refresh
 * @returns {{ healLoading, handleHeal }}
 *   healLoading: boolean
 *   handleHeal: (chargersAmount, vcAmount) => Promise<{ success: boolean, error?: string }>
 */
export default function useHealAction(healApiFn, refreshFn, delay = 1000) {
  const [healLoading, setHealLoading] = useState(false)
  const timerRef = useRef(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleHeal = useCallback(async (chargersAmount, vcAmount) => {
    try {
      setHealLoading(true)
      await healApiFn(chargersAmount, vcAmount)
      // Delay refresh so the server state settles
      timerRef.current = setTimeout(() => {
        refreshFn()
      }, delay)
      return { success: true }
    } catch (err) {
      return { success: false, error: err.message }
    } finally {
      setHealLoading(false)
    }
  }, [healApiFn, refreshFn, delay])

  return { healLoading, handleHeal }
}
