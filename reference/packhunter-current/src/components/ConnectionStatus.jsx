/**
 * ConnectionStatus - Shows WebSocket connection status in the UI
 * Displays a small indicator showing if real-time updates are working
 *
 * 2026-04-14: previous version read from the legacy `getSocket()` shim on
 * first mount. Child useEffects run before the parent SocketProvider's
 * useEffect, so `getSocket()` returned null, status was pinned to
 * 'disconnected', and the component never subscribed to a later socket.
 * The main socket was actually connected — only this indicator was stuck.
 *
 * Fix: consume the reactive status from `useSocket()` directly (same
 * context SocketProvider maintains). No race, no polling, no early-return
 * trap.
 */

import { useEffect, useRef, useState } from 'react'
import { Box, Tooltip, Chip, Snackbar, Alert, Fade, useTheme } from '@mui/material'
import WifiIcon from '@mui/icons-material/Wifi'
import WifiOffIcon from '@mui/icons-material/WifiOff'
import SyncIcon from '@mui/icons-material/Sync'
import { useSocket, ConnectionStatus as SocketStatus } from '../contexts/SocketContext'

// Map SocketContext's richer state machine onto the 3-state UI vocabulary
// this component already renders (connected / connecting / disconnected).
function mapStatus(contextStatus) {
  switch (contextStatus) {
    case SocketStatus.CONNECTED:    return 'connected'
    case SocketStatus.CONNECTING:   return 'connecting'
    case SocketStatus.RECONNECTING: return 'connecting'
    case SocketStatus.ERROR:        return 'disconnected'
    case SocketStatus.DISCONNECTED: return 'disconnected'
    default:                         return 'connecting'
  }
}

export function ConnectionStatus({ showLabel = false, size = 'small' }) {
  const theme = useTheme()
  const { status: contextStatus } = useSocket()
  const status = mapStatus(contextStatus)

  // "Reconnected" success toast — fire once when we transition back to
  // connected after having been disconnected.
  const [showReconnectAlert, setShowReconnectAlert] = useState(false)
  const wasDisconnectedRef = useRef(false)
  useEffect(() => {
    if (status === 'disconnected') {
      wasDisconnectedRef.current = true
    } else if (status === 'connected' && wasDisconnectedRef.current) {
      setShowReconnectAlert(true)
      wasDisconnectedRef.current = false
    }
  }, [status])

  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          color: 'success',
          icon: <WifiIcon sx={{ fontSize: size === 'small' ? 14 : 18 }} />,
          label: 'Connected',
          tooltip: 'Real-time updates active',
          dotColor: theme.palette.success.main,
        }
      case 'disconnected':
        return {
          color: 'error',
          icon: <WifiOffIcon sx={{ fontSize: size === 'small' ? 14 : 18 }} />,
          label: 'Disconnected',
          tooltip: 'Real-time updates unavailable - reconnecting...',
          dotColor: theme.palette.error.main,
        }
      case 'connecting':
      default:
        return {
          color: 'warning',
          icon: <SyncIcon sx={{ fontSize: size === 'small' ? 14 : 18, animation: 'spin 1s linear infinite', '@keyframes spin': { '0%': { transform: 'rotate(0deg)' }, '100%': { transform: 'rotate(360deg)' } } }} />,
          label: 'Connecting',
          tooltip: 'Connecting to server...',
          dotColor: theme.palette.warning.main,
        }
    }
  }

  const config = getStatusConfig()

  // Simple dot indicator (minimal)
  if (!showLabel) {
    return (
      <>
        <Tooltip title={config.tooltip} arrow>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              cursor: 'default',
            }}
          >
            <Box
              sx={{
                width: size === 'small' ? 8 : 10,
                height: size === 'small' ? 8 : 10,
                borderRadius: '50%',
                bgcolor: config.dotColor,
                boxShadow: `0 0 ${size === 'small' ? 4 : 6}px ${config.dotColor}`,
                transition: 'all 0.3s ease',
              }}
            />
          </Box>
        </Tooltip>

        {/* Reconnection success toast */}
        <Snackbar
          open={showReconnectAlert}
          autoHideDuration={3000}
          onClose={() => setShowReconnectAlert(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          TransitionComponent={Fade}
        >
          <Alert
            severity="success"
            onClose={() => setShowReconnectAlert(false)}
            sx={{ minWidth: 200 }}
          >
            Reconnected to server
          </Alert>
        </Snackbar>
      </>
    )
  }

  // Chip with label (verbose)
  return (
    <>
      <Tooltip title={config.tooltip} arrow>
        <Chip
          icon={config.icon}
          label={config.label}
          color={config.color}
          size={size}
          variant="outlined"
          sx={{
            '& .MuiChip-icon': {
              color: 'inherit',
            },
          }}
        />
      </Tooltip>

      {/* Reconnection success toast */}
      <Snackbar
        open={showReconnectAlert}
        autoHideDuration={3000}
        onClose={() => setShowReconnectAlert(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        TransitionComponent={Fade}
      >
        <Alert
          severity="success"
          onClose={() => setShowReconnectAlert(false)}
          sx={{ minWidth: 200 }}
        >
          Reconnected to server
        </Alert>
      </Snackbar>
    </>
  )
}

export default ConnectionStatus
