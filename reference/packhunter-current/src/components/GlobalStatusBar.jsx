/**
 * GlobalStatusBar — 32px persistent bar at the top of every page.
 * Shows: hunt status, combined PPM, live GP count, bot status, Wonder Pick stamina.
 * Derives from existing Socket.IO events — zero new API calls.
 *
 * Mounted in App.jsx above the main content area.
 * Only visible for premium users (hunt data is premium-only).
 */

import { useState, useEffect } from 'react'
import { Box, Typography, useTheme, useMediaQuery } from '@mui/material'
import {
  Speed as HuntIcon,
  FiberManualRecord as DotIcon,
  Star as GpIcon,
  SmartToy as BotIcon,
} from '@mui/icons-material'
import { getSocket } from '../services/socket'
import { useHuntStats } from '../contexts/HuntStatsContext'

// Compact status item
function StatusItem({ icon, label, value, color, show = true }) {
  const theme = useTheme()
  if (!show) return null
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      {icon}
      <Typography
        variant="caption"
        sx={{
          fontSize: '0.7rem',
          fontWeight: 600,
          color: color || theme.palette.text.secondary,
          whiteSpace: 'nowrap',
          fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        }}
      >
        {label ? `${label}: ` : ''}{value}
      </Typography>
    </Box>
  )
}

export default function GlobalStatusBar({ user }) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const isDark = theme.palette.mode === 'dark'
  const isPremium = user?.subscriptionTier === 'premium' || user?.subscriptionTier === 'admin'

  // Consume shared hunt stats from context (NO independent polling)
  const { data: huntStats } = useHuntStats()
  const [botStatus, setBotStatus] = useState(null)

  // Derive display values from canonical context data
  const huntData = huntStats ? {
    ppm: huntStats.ppm,
    activeContainers: huntStats.activeContainers,
    totalContainers: huntStats.totalContainers,
    activeWorkers: huntStats.activeWorkers,
  } : null
  const liveGPs = huntStats?.liveGodPacks || 0

  // Listen for bot status from socket
  useEffect(() => {
    if (!isPremium) return
    const socket = getSocket()
    if (!socket) return

    const handleBotStatus = (data) => {
      setBotStatus({
        running: data.running || data.isRunning || false,
        count: data.activeBots || data.count || 0,
      })
    }

    socket.on('bot_status', handleBotStatus)
    socket.on('botmanager_status', handleBotStatus)
    return () => {
      socket.off('bot_status', handleBotStatus)
      socket.off('botmanager_status', handleBotStatus)
    }
  }, [isPremium])

  // Don't render for non-premium or if no data yet
  if (!isPremium) return null

  const isHuntActive = huntData && huntData.activeContainers > 0
  const ppmColor = !huntData ? theme.palette.text.disabled
    : huntData.ppm > 200 ? theme.palette.success.main
    : huntData.ppm > 50 ? theme.palette.warning.main
    : huntData.ppm > 0 ? theme.palette.error.main
    : theme.palette.text.disabled

  return (
    <Box
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 32,
        zIndex: theme.zIndex.appBar + 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: isMobile ? 1.5 : 3,
        px: 2,
        bgcolor: isDark ? 'rgba(15,17,23,0.95)' : 'rgba(245,247,250,0.95)',
        backdropFilter: 'blur(8px)',
        borderBottom: `1px solid ${isDark ? 'rgba(124,138,255,0.1)' : 'rgba(0,0,0,0.06)'}`,
      }}
    >
      {/* Hunt Status */}
      <StatusItem
        icon={<DotIcon sx={{ fontSize: 8, color: isHuntActive ? theme.palette.success.main : theme.palette.text.disabled }} />}
        value={isHuntActive
          ? `${huntData.activeContainers}/${huntData.totalContainers} hunts`
          : 'No hunt'
        }
        color={isHuntActive ? theme.palette.text.primary : theme.palette.text.disabled}
      />

      {/* PPM */}
      {isHuntActive && (
        <StatusItem
          icon={<HuntIcon sx={{ fontSize: 12, color: ppmColor }} />}
          value={`${Math.round(huntData.ppm)} live ppm`}
          color={ppmColor}
        />
      )}

      {/* Live GPs */}
      {liveGPs > 0 && (
        <StatusItem
          icon={<GpIcon sx={{ fontSize: 12, color: theme.palette.warning.main }} />}
          value={`${liveGPs} live`}
          color={theme.palette.warning.main}
        />
      )}

      {/* Bot Status */}
      {!isMobile && botStatus && (
        <StatusItem
          icon={<BotIcon sx={{ fontSize: 12, color: botStatus.running ? theme.palette.success.main : theme.palette.text.disabled }} />}
          value={botStatus.running ? `Bot: ${botStatus.count}` : 'Bot: off'}
          color={botStatus.running ? theme.palette.success.main : theme.palette.text.disabled}
        />
      )}
    </Box>
  )
}
