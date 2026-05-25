/**
 * useCachedFetch - SWR-like data fetching with caching
 *
 * Features:
 * - Automatic caching with TTL
 * - Stale-while-revalidate pattern
 * - Deduplication of requests
 * - Revalidation on focus
 * - Optimistic updates via mutate
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'

// Global cache store
const cache = new Map()
const fetchingMap = new Map()

// Default cache duration: 5 minutes
const DEFAULT_CACHE_DURATION = 5 * 60 * 1000

/**
 * Get cached data
 */
export function getCachedData(key) {
  const entry = cache.get(key)
  if (!entry) return null
  return entry
}

/**
 * Set cached data
 */
export function setCachedData(key, data, ttl = DEFAULT_CACHE_DURATION) {
  cache.set(key, {
    data,
    timestamp: Date.now(),
    ttl,
  })
}

/**
 * Invalidate cache by key or pattern
 */
export function invalidateCache(keyOrPattern) {
  if (typeof keyOrPattern === 'string') {
    cache.delete(keyOrPattern)
  } else if (keyOrPattern instanceof RegExp) {
    for (const key of cache.keys()) {
      if (keyOrPattern.test(key)) {
        cache.delete(key)
      }
    }
  }
}

/**
 * Clear all cache
 */
export function clearCache() {
  cache.clear()
}

/**
 * Main hook
 */
export function useCachedFetch(key, fetcher, options = {}) {
  const {
    ttl = DEFAULT_CACHE_DURATION,
    revalidateOnFocus = true,
    revalidateOnReconnect = true,
    dedupingInterval = 2000,
    fallbackData,
    onSuccess,
    onError,
    enabled = true,
  } = options

  // Get initial data from cache
  const initialData = useMemo(() => {
    const cached = getCachedData(key)
    if (cached) return cached.data
    return fallbackData ?? null
  }, [key, fallbackData])

  const [data, setData] = useState(initialData)
  const [error, setError] = useState(null)
  const [isValidating, setIsValidating] = useState(!initialData && enabled)

  const lastFetchRef = useRef(0)
  const mountedRef = useRef(true)

  // Check if cached data is stale
  const isStale = useMemo(() => {
    const cached = getCachedData(key)
    if (!cached) return true
    return Date.now() - cached.timestamp > cached.ttl
  }, [key, data])

  // Revalidate function
  const revalidate = useCallback(async (force = false) => {
    if (!enabled) return

    const now = Date.now()

    // Check deduping
    if (!force && now - lastFetchRef.current < dedupingInterval) {
      return
    }

    // Check if another request is in flight
    if (fetchingMap.get(key)) {
      return
    }

    lastFetchRef.current = now
    fetchingMap.set(key, true)
    setIsValidating(true)

    try {
      const freshData = await fetcher()

      if (mountedRef.current) {
        setData(freshData)
        setCachedData(key, freshData, ttl)
        setError(null)
        onSuccess?.(freshData)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err)
        onError?.(err)
      }
    } finally {
      fetchingMap.delete(key)
      if (mountedRef.current) {
        setIsValidating(false)
      }
    }
  }, [key, fetcher, ttl, dedupingInterval, enabled, onSuccess, onError])

  // Mutate function for optimistic updates
  const mutate = useCallback(async (newData, shouldRevalidate = true) => {
    if (typeof newData === 'function') {
      const updated = newData(data)
      setData(updated)
      setCachedData(key, updated, ttl)
    } else if (newData !== undefined) {
      setData(newData)
      setCachedData(key, newData, ttl)
    }

    if (shouldRevalidate) {
      await revalidate(true)
    }
  }, [key, data, ttl, revalidate])

  // Initial fetch
  useEffect(() => {
    mountedRef.current = true

    if (enabled && (!data || isStale)) {
      revalidate()
    }

    return () => {
      mountedRef.current = false
    }
  }, [key, enabled])

  // Revalidate on focus
  useEffect(() => {
    if (!revalidateOnFocus) return

    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        revalidate()
      }
    }

    document.addEventListener('visibilitychange', handleFocus)
    window.addEventListener('focus', handleFocus)

    return () => {
      document.removeEventListener('visibilitychange', handleFocus)
      window.removeEventListener('focus', handleFocus)
    }
  }, [revalidate, revalidateOnFocus])

  // Revalidate on reconnect
  useEffect(() => {
    if (!revalidateOnReconnect) return

    const handleOnline = () => {
      revalidate()
    }

    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('online', handleOnline)
    }
  }, [revalidate, revalidateOnReconnect])

  return {
    data,
    error,
    isLoading: !data && !error && isValidating,
    isValidating,
    isStale,
    mutate,
    revalidate,
  }
}

/**
 * Prefetch data into cache
 */
export async function prefetch(key, fetcher, ttl = DEFAULT_CACHE_DURATION) {
  try {
    const data = await fetcher()
    setCachedData(key, data, ttl)
    return data
  } catch (error) {
    console.error('Prefetch failed:', key, error)
    return null
  }
}

/**
 * Hook for prefetching on hover
 */
export function usePrefetch() {
  const prefetchedRef = useRef(new Set())

  const prefetchOnce = useCallback(async (key, fetcher, ttl) => {
    if (prefetchedRef.current.has(key)) return

    prefetchedRef.current.add(key)
    await prefetch(key, fetcher, ttl)
  }, [])

  return { prefetch: prefetchOnce }
}

export default useCachedFetch
