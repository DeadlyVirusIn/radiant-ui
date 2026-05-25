/**
 * OfflineBanner - Network status notification component
 *
 * Features:
 * - Shows banner when offline
 * - Shows reconnected notification
 * - Retry button
 * - Slow connection warning
 */

import { useState, useEffect } from 'react'
import {
  Snackbar,
  Alert,
  Button,
  Slide,
  Box,
  Typography,
  LinearProgress,
} from '@mui/material'
import WifiOffIcon from '@mui/icons-material/WifiOff'
import WifiIcon from '@mui/icons-material/Wifi'
import RefreshIcon from '@mui/icons-material/Refresh'
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt'
import SignalCellular1BarIcon from '@mui/icons-material/SignalCellular1Bar'
import { useNetworkStatus } from '../hooks/useNetworkStatus'

function SlideTransition(props) {
  return <Slide {...props} direction="down" />
}

export function OfflineBanner() {
  const { isOnline, isSlowConnection, connectionQuality } = useNetworkStatus()
  const [wasOffline, setWasOffline] = useState(false)
  const [showReconnected, setShowReconnected] = useState(false)
  const [showSlowWarning, setShowSlowWarning] = useState(false)

  // Track offline state changes
  useEffect(() => {
    if (!isOnline) {
      setWasOffline(true)
      setShowSlowWarning(false)
    } else if (wasOffline) {
      setShowReconnected(true)
      setWasOffline(false)
      // Auto-hide reconnected message
      const timer = setTimeout(() => setShowReconnected(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [isOnline, wasOffline])

  // Show slow connection warning (debounced)
  useEffect(() => {
    if (isSlowConnection && isOnline) {
      const timer = setTimeout(() => setShowSlowWarning(true), 2000)
      return () => clearTimeout(timer)
    } else {
      setShowSlowWarning(false)
    }
  }, [isSlowConnection, isOnline])

  return (
    <>
      {/* Offline alert - persistent until online */}
      <Snackbar
        open={!isOnline}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        TransitionComponent={SlideTransition}
        sx={{ top: { xs: 56, sm: 64 } }} // Below app bar
      >
        <Alert
          severity="error"
          icon={<WifiOffIcon />}
          action={
            <Button
              color="inherit"
              size="small"
              onClick={() => window.location.reload()}
              startIcon={<RefreshIcon />}
            >
              Retry
            </Button>
          }
          sx={{
            width: '100%',
            maxWidth: 500,
            boxShadow: 3,
          }}
        >
          <Box>
            <Typography variant="subtitle2" fontWeight="bold">
              You're offline
            </Typography>
            <Typography variant="body2">
              Check your internet connection. Some features may not work.
            </Typography>
          </Box>
        </Alert>
      </Snackbar>

      {/* Reconnected notification */}
      <Snackbar
        open={showReconnected}
        autoHideDuration={3000}
        onClose={() => setShowReconnected(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        TransitionComponent={SlideTransition}
        sx={{ top: { xs: 56, sm: 64 } }}
      >
        <Alert
          severity="success"
          icon={<WifiIcon />}
          onClose={() => setShowReconnected(false)}
          sx={{ boxShadow: 3 }}
        >
          Back online! Connection restored.
        </Alert>
      </Snackbar>

      {/* Slow connection warning */}
      <Snackbar
        open={showSlowWarning}
        autoHideDuration={8000}
        onClose={() => setShowSlowWarning(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        TransitionComponent={SlideTransition}
        sx={{ top: { xs: 56, sm: 64 } }}
      >
        <Alert
          severity="warning"
          icon={<SignalCellular1BarIcon />}
          onClose={() => setShowSlowWarning(false)}
          sx={{ boxShadow: 3 }}
        >
          <Box>
            <Typography variant="subtitle2" fontWeight="bold">
              Slow connection detected
            </Typography>
            <Typography variant="body2">
              Some features may load slower than usual.
            </Typography>
          </Box>
        </Alert>
      </Snackbar>
    </>
  )
}

/**
 * ConnectionQualityIndicator - Shows current connection quality
 * For use in status bars or footers
 */
export function ConnectionQualityIndicator({ showLabel = true }) {
  const { isOnline, connectionQuality, effectiveType } = useNetworkStatus()

  const getIcon = () => {
    if (!isOnline) return <WifiOffIcon fontSize="small" color="error" />
    if (connectionQuality === 'excellent' || connectionQuality === 'good') {
      return <SignalCellularAltIcon fontSize="small" color="success" />
    }
    return <SignalCellular1BarIcon fontSize="small" color="warning" />
  }

  const getLabel = () => {
    if (!isOnline) return 'Offline'
    if (connectionQuality === 'excellent') return 'Excellent'
    if (connectionQuality === 'good') return 'Good'
    if (connectionQuality === 'fair') return 'Fair'
    return 'Poor'
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {getIcon()}
      {showLabel && (
        <Typography variant="caption" color="text.secondary">
          {getLabel()}
          {effectiveType && ` (${effectiveType.toUpperCase()})`}
        </Typography>
      )}
    </Box>
  )
}

export default OfflineBanner
