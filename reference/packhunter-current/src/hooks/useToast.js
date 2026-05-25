/**
 * useToast Hook - Standardized toast notifications
 */

import { useState, useCallback, useEffect } from 'react'

const DEFAULT_DURATION = 4000

export function useToast() {
  const [toasts, setToasts] = useState([])

  // Remove toast by id
  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  // Add toast
  const addToast = useCallback((message, severity = 'info', duration = DEFAULT_DURATION) => {
    const id = Date.now() + Math.random()
    const toast = { id, message, severity, duration }
    setToasts(prev => [...prev, toast])

    // Auto-remove after duration
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration)
    }

    return id
  }, [removeToast])

  // Convenience methods
  const success = useCallback((message, duration) => addToast(message, 'success', duration), [addToast])
  const error = useCallback((message, duration) => addToast(message, 'error', duration), [addToast])
  const warning = useCallback((message, duration) => addToast(message, 'warning', duration), [addToast])
  const info = useCallback((message, duration) => addToast(message, 'info', duration), [addToast])

  // Clear all toasts
  const clearAll = useCallback(() => setToasts([]), [])

  return {
    toasts,
    addToast,
    removeToast,
    clearAll,
    success,
    error,
    warning,
    info,
  }
}

export default useToast
