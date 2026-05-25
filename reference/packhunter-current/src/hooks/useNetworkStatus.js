/**
 * useNetworkStatus - Network connectivity detection hook
 *
 * Features:
 * - Online/offline detection
 * - Connection quality detection (if available)
 * - Slow connection warnings
 */

import { useState, useEffect, useCallback } from 'react'

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const [connectionType, setConnectionType] = useState(null)
  const [effectiveType, setEffectiveType] = useState(null)
  const [downlink, setDownlink] = useState(null)
  const [rtt, setRtt] = useState(null)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Network Information API (if available)
    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection

    if (connection) {
      const updateConnectionInfo = () => {
        setConnectionType(connection.type)
        setEffectiveType(connection.effectiveType)
        setDownlink(connection.downlink)
        setRtt(connection.rtt)
      }

      updateConnectionInfo()
      connection.addEventListener('change', updateConnectionInfo)

      return () => {
        connection.removeEventListener('change', updateConnectionInfo)
        window.removeEventListener('online', handleOnline)
        window.removeEventListener('offline', handleOffline)
      }
    }

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Determine if connection is slow
  const isSlowConnection = effectiveType === '2g' || effectiveType === 'slow-2g' || (rtt && rtt > 500)

  // Connection quality rating
  const connectionQuality = (() => {
    if (!isOnline) return 'offline'
    if (effectiveType === '4g' || downlink > 5) return 'excellent'
    if (effectiveType === '3g' || downlink > 1) return 'good'
    if (effectiveType === '2g' || downlink > 0.5) return 'fair'
    return 'poor'
  })()

  return {
    isOnline,
    connectionType,
    effectiveType,
    downlink,
    rtt,
    isSlowConnection,
    connectionQuality,
  }
}

/**
 * useOnlineCallback - Execute callback when back online
 */
export function useOnlineCallback(callback, deps = []) {
  const { isOnline } = useNetworkStatus()
  const [wasOffline, setWasOffline] = useState(false)

  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true)
    } else if (wasOffline && isOnline) {
      callback()
      setWasOffline(false)
    }
  }, [isOnline, wasOffline, callback, ...deps])
}

export default useNetworkStatus
