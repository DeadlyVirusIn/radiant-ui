/**
 * Date formatting utilities - displays dates in user's local timezone
 */

/**
 * Format a date string to local date only
 * @param {string|Date} dateStr - UTC date string from server
 * @param {string} fallback - Text to show if date is null/invalid
 * @returns {string} Formatted local date
 */
export function formatDate(dateStr, fallback = 'Never') {
  if (!dateStr) return fallback
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return fallback

  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

/**
 * Format a date string to local date and time
 * @param {string|Date} dateStr - UTC date string from server
 * @param {string} fallback - Text to show if date is null/invalid
 * @returns {string} Formatted local date and time
 */
export function formatDateTime(dateStr, fallback = 'Never') {
  if (!dateStr) return fallback
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return fallback

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Format a date string to local time only
 * @param {string|Date} dateStr - UTC date string from server
 * @param {string} fallback - Text to show if date is null/invalid
 * @returns {string} Formatted local time
 */
export function formatTime(dateStr, fallback = '--:--') {
  if (!dateStr) return fallback
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return fallback

  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * Format a date as relative time (e.g., "2 hours ago", "Yesterday")
 * @param {string|Date} dateStr - UTC date string from server
 * @param {string} fallback - Text to show if date is null/invalid
 * @returns {string} Relative time string
 */
export function formatRelative(dateStr, fallback = 'Never') {
  if (!dateStr) return fallback
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return fallback

  const now = new Date()
  const diffMs = now - date
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffSecs < 60) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`

  // For older dates, show the actual date
  return formatDate(dateStr)
}

/**
 * Format date with smart display - relative for recent, absolute for older
 * @param {string|Date} dateStr - UTC date string from server
 * @param {string} fallback - Text to show if date is null/invalid
 * @returns {string} Smart formatted date
 */
export function formatSmart(dateStr, fallback = 'Never') {
  if (!dateStr) return fallback
  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return fallback

  const now = new Date()
  const diffMs = now - date
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  // Less than 24 hours - show relative
  if (diffHours < 24) {
    return formatRelative(dateStr)
  }

  // Same year - show month/day + time
  if (date.getFullYear() === now.getFullYear()) {
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  // Different year - show full date
  return formatDateTime(dateStr)
}

// Alias for compatibility
export const formatRelativeTime = formatRelative;
