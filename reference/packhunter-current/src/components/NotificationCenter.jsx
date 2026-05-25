import { useState, useEffect, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useOverlay } from '../contexts/OverlayContext'
import {
  Box,
  IconButton,
  Badge,
  Drawer,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  Chip,
  Button,
  Tabs,
  Tab,
} from '@mui/material'
import {
  Notifications as NotificationsIcon,
  Star as StarIcon,
  Warning as WarningIcon,
  Info as InfoIcon,
  CheckCircle as SuccessIcon,
  Delete as DeleteIcon,
  ClearAll as ClearAllIcon,
  Close as CloseIcon,
  PlayArrow as PlayIcon,
  Stop as StopIcon,
  CardGiftcard as DailyIcon,
} from '@mui/icons-material'
import {
  getSocket,
  onGodPackFound,
  offGodPackFound,
  onHuntStatus,
  offHuntStatus,
  onDailyReady,
  offDailyReady,
  onCriticalError,
  offCriticalError,
  onTaskStatus,
  offTaskStatus,
} from '../services/socket'

// Notification types with colors and icons
const notificationConfig = {
  godpack: { icon: StarIcon, color: '#ffd700', label: 'God Pack', priority: 1 },
  hunt: { icon: PlayIcon, color: '#A78BFA', label: 'Hunt', priority: 2 },
  daily: { icon: DailyIcon, color: '#4caf50', label: 'Daily', priority: 3 },
  error: { icon: WarningIcon, color: '#f44336', label: 'Error', priority: 1 },
  info: { icon: InfoIcon, color: '#2196f3', label: 'Info', priority: 4 },
  success: { icon: SuccessIcon, color: '#4caf50', label: 'Success', priority: 3 },
}

// Format time ago
const formatTimeAgo = (date) => {
  const now = new Date()
  const diff = now - new Date(date)
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days}d ago`
  if (hours > 0) return `${hours}h ago`
  if (minutes > 0) return `${minutes}m ago`
  return 'Just now'
}

// Sound manager for god pack alerts
const playGodPackSound = (volume = 50) => {
  try {
    // Create oscillator for a triumphant sound
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    const gainNode = audioContext.createGain()
    gainNode.gain.value = volume / 100 * 0.3

    // Play ascending notes
    const notes = [523.25, 659.25, 783.99, 1046.50] // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      const osc = audioContext.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.connect(gainNode)
      gainNode.connect(audioContext.destination)
      osc.start(audioContext.currentTime + i * 0.15)
      osc.stop(audioContext.currentTime + i * 0.15 + 0.2)
    })
  } catch (e) {
    console.error('Failed to play sound:', e)
  }
}

// Browser notification helper
const showBrowserNotification = (title, body, type = 'info') => {
  if ('Notification' in window && Notification.permission === 'granted') {
    const icon = type === 'godpack' ? '/gold-star.png' : '/pokeball.png'
    const notification = new Notification(title, {
      body,
      icon,
      badge: '/pokeball.png',
      tag: type, // Prevents duplicate notifications of same type
      requireInteraction: type === 'godpack', // God packs stay until dismissed
    })

    // Auto close after 10 seconds (except god packs)
    if (type !== 'godpack') {
      setTimeout(() => notification.close(), 10000)
    }

    return notification
  }
  return null
}

function NotificationCenter() {
  // Phase 25D — open/close state now flows through OverlayContext so
  // two side-drawers (notifications + hamburger sidebar) can't coexist
  // visibly. Opening one auto-closes the other; at most one named
  // overlay is ever active.
  const overlay = useOverlay('notifications')
  const open = overlay.isOpen
  const setOpen = useCallback((v) => (v ? overlay.open() : overlay.close()), [overlay])
  // Close the drawer whenever the route changes — prevents the case
  // where a user opens notifications, taps a link inside (or uses
  // browser back), and the drawer stays stuck open over the new page.
  const location = useLocation()
  useEffect(() => {
    if (open) overlay.close()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])
  const [notifications, setNotifications] = useState([])
  const [settings, setSettings] = useState({
    godPackAlerts: true,
    errorAlerts: true,
    huntStatusAlerts: true,
    dailyReminders: true,
    browserNotifications: false,
    soundAlerts: false,
    soundVolume: 50,
  })
  const [activeTab, setActiveTab] = useState(0)
  const addedIdsRef = useRef(new Set())

  // Load settings from localStorage
  useEffect(() => {
    const loadSettings = () => {
      const savedSettings = localStorage.getItem('userSettings')
      if (savedSettings) {
        try {
          const parsed = JSON.parse(savedSettings)
          setSettings(prev => ({ ...prev, ...parsed }))
        } catch (e) {
          console.error('Failed to load notification settings:', e)
        }
      }
    }

    loadSettings()
    // Also listen for storage changes (when settings are updated in Settings page)
    window.addEventListener('storage', loadSettings)
    return () => window.removeEventListener('storage', loadSettings)
  }, [])

  // Load notifications from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('webui_notifications')
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        // Ensure parsed is an array before using it
        if (Array.isArray(parsed)) {
          setNotifications(parsed)
          parsed.forEach(n => addedIdsRef.current.add(n.id))
        } else {
          setNotifications([])
        }
      } catch (e) {
        setNotifications([])
      }
    }
  }, [])

  // Save notifications to localStorage
  useEffect(() => {
    localStorage.setItem('webui_notifications', JSON.stringify(notifications))
  }, [notifications])

  const unreadCount = notifications.filter((n) => !n.read).length

  // Add notification helper
  const addNotification = useCallback((type, title, message, extra = {}) => {
    const id = extra.id || Date.now()

    // Deduplicate by ID
    if (addedIdsRef.current.has(id)) {
      return
    }
    addedIdsRef.current.add(id)

    const newNotification = {
      id,
      type,
      title,
      message,
      timestamp: new Date().toISOString(),
      read: false,
      ...extra,
    }

    setNotifications((prev) => [newNotification, ...prev.slice(0, 99)]) // Keep max 100

    // Handle browser notification
    if (settings.browserNotifications) {
      showBrowserNotification(title, message, type)
    }

    // Handle sound alert for god packs
    if (type === 'godpack' && settings.soundAlerts) {
      playGodPackSound(settings.soundVolume)
    }

    return newNotification
  }, [settings])

  // Socket event handlers
  useEffect(() => {
    const socket = getSocket()
    if (!socket) return

    // God Pack found handler
    const handleGodPackFound = (data) => {
      if (!settings.godPackAlerts) return

      const title = 'GOD PACK FOUND!'
      const message = data.packType
        ? `Found in ${data.packType}! Account: ${data.accountName || 'Unknown'}`
        : `Account: ${data.accountName || 'Unknown'}`

      addNotification('godpack', title, message, {
        id: `godpack_${data.timestamp || Date.now()}`,
        packType: data.packType,
        accountId: data.accountId,
      })
    }

    // Hunt status handler
    const handleHuntStatus = (data) => {
      if (!settings.huntStatusAlerts) return

      const isStarting = data.status === 'started' || data.status === 'running'
      const title = isStarting ? 'Hunt Started' : 'Hunt Stopped'
      const message = data.message || `Hunt ${data.status} for ${data.packMode || 'packs'}`

      addNotification('hunt', title, message, {
        id: `hunt_${data.timestamp || Date.now()}`,
        status: data.status,
      })
    }

    // Daily ready handler
    const handleDailyReady = (data) => {
      if (!settings.dailyReminders) return

      addNotification('daily', 'Daily Rewards Ready', data.message || 'Your daily rewards are ready to claim!', {
        id: `daily_${data.timestamp || Date.now()}`,
      })
    }

    // Critical error handler
    const handleCriticalError = (data) => {
      if (!settings.errorAlerts) return

      addNotification('error', 'Critical Error', data.message || 'An error occurred', {
        id: `error_${data.timestamp || Date.now()}`,
        errorCode: data.code,
      })
    }

    // Task completion handler
    const handleTaskStatus = (data) => {
      if (data.status === 'completed') {
        // Check for god pack in task result
        if (data.result?.isGodPack) {
          handleGodPackFound({
            packType: data.result.packType,
            accountName: data.accountName,
            timestamp: Date.now(),
          })
        }
      } else if (data.status === 'error' && settings.errorAlerts) {
        addNotification('error', 'Task Error', data.message || `Task failed: ${data.taskType}`, {
          id: `task_error_${data.taskId || Date.now()}`,
        })
      }
    }

    // Subscribe to events
    onGodPackFound(handleGodPackFound)
    onHuntStatus(handleHuntStatus)
    onDailyReady(handleDailyReady)
    onCriticalError(handleCriticalError)
    onTaskStatus(handleTaskStatus)

    return () => {
      offGodPackFound(handleGodPackFound)
      offHuntStatus(handleHuntStatus)
      offDailyReady(handleDailyReady)
      offCriticalError(handleCriticalError)
      offTaskStatus(handleTaskStatus)
    }
  }, [settings, addNotification])

  const handleOpen = () => {
    setOpen(true)
    // Mark all as read when opening
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read: true }))
    )
  }

  const handleClear = (id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    addedIdsRef.current.delete(id)
  }

  const handleClearAll = () => {
    setNotifications([])
    addedIdsRef.current.clear()
  }

  // Expose addNotification globally
  useEffect(() => {
    window.addNotification = addNotification
    return () => {
      delete window.addNotification
    }
  }, [addNotification])

  // Filter notifications by tab
  const filteredNotifications = activeTab === 0
    ? notifications
    : notifications.filter(n => {
        if (activeTab === 1) return n.type === 'godpack'
        if (activeTab === 2) return n.type === 'hunt' || n.type === 'daily'
        if (activeTab === 3) return n.type === 'error'
        return true
      })

  return (
    <>
      <IconButton
        onClick={handleOpen}
        aria-label={`Open notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        sx={{
          color: 'text.secondary',
          '&:hover': { color: 'text.primary' },
        }}
      >
        <Badge badgeContent={unreadCount} color="error" max={99}>
          <NotificationsIcon />
        </Badge>
      </IconButton>

      <Drawer
        anchor="right"
        open={open}
        onClose={() => setOpen(false)}
        aria-label="Notifications"
        PaperProps={{
          sx: { width: 400, maxWidth: '100%' },
        }}
      >
        <Box sx={{ p: 2, pt: 'calc(16px + env(safe-area-inset-top, 0px))' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1 }}>
            <Typography variant="h6" fontWeight={600}>
              Notifications
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              {notifications.length > 0 && (
                <Button
                  size="small"
                  startIcon={<ClearAllIcon />}
                  onClick={handleClearAll}
                  color="error"
                >
                  Clear All
                </Button>
              )}
              {/* Explicit close affordance — users on mobile often
                  don't realise they can dismiss a drawer by tapping
                  the backdrop. Stacking order places this after
                  Clear All so one-handed operation keeps the close
                  button within thumb reach on the right edge. */}
              <IconButton
                aria-label="Close notifications"
                onClick={() => setOpen(false)}
                sx={{ width: 44, height: 44 }}
              >
                <CloseIcon />
              </IconButton>
            </Box>
          </Box>

          <Tabs
            value={activeTab}
            onChange={(e, v) => setActiveTab(v)}
            sx={{ mb: 2 }}
            variant="scrollable"
            scrollButtons="auto"
          >
            <Tab label={`All (${notifications.length})`} />
            <Tab
              label="God Packs"
              icon={<StarIcon sx={{ fontSize: 16, color: '#ffd700' }} />}
              iconPosition="start"
              sx={{ minHeight: 48 }}
            />
            <Tab label="Activity" />
            <Tab label="Errors" />
          </Tabs>

          <Divider sx={{ mb: 2 }} />

          {filteredNotifications.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <NotificationsIcon sx={{ fontSize: 48, color: 'grey.400', mb: 1 }} />
              <Typography color="text.secondary">
                {activeTab === 0 ? 'No notifications yet' : 'No notifications in this category'}
              </Typography>
            </Box>
          ) : (
            <List disablePadding sx={{ maxHeight: 'calc(100vh - 220px)', overflow: 'auto' }}>
              {filteredNotifications.map((notification) => {
                const config = notificationConfig[notification.type] || notificationConfig.info
                const Icon = config.icon

                return (
                  <ListItem
                    key={notification.id}
                    sx={{
                      borderRadius: 1,
                      mb: 1,
                      background: notification.read
                        ? 'transparent'
                        : notification.type === 'godpack'
                          ? 'rgba(255, 215, 0, 0.1)'
                          : 'rgba(233, 30, 99, 0.05)',
                      border: '1px solid',
                      borderColor: notification.read
                        ? 'divider'
                        : notification.type === 'godpack'
                          ? '#ffd700'
                          : 'primary.light',
                      animation: notification.type === 'godpack' && !notification.read
                        ? 'pulse 2s infinite'
                        : 'none',
                      '@keyframes pulse': {
                        '0%': { boxShadow: '0 0 0 0 rgba(255, 215, 0, 0.4)' },
                        '70%': { boxShadow: '0 0 0 10px rgba(255, 215, 0, 0)' },
                        '100%': { boxShadow: '0 0 0 0 rgba(255, 215, 0, 0)' },
                      },
                      '@media (prefers-reduced-motion: reduce)': {
                        animation: 'none !important',
                      },
                    }}
                    secondaryAction={
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => handleClear(notification.id)}
                        aria-label="Delete notification"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    }
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <Icon sx={{ color: config.color }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography variant="subtitle2" fontWeight={600}>
                            {notification.title}
                          </Typography>
                          <Chip
                            label={config.label}
                            size="small"
                            sx={{
                              height: 18,
                              fontSize: '0.65rem',
                              background: config.color,
                              color: notification.type === 'godpack' ? '#000' : 'white',
                            }}
                          />
                        </Box>
                      }
                      secondary={
                        <>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                            {notification.message}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatTimeAgo(notification.timestamp)}
                          </Typography>
                        </>
                      }
                    />
                  </ListItem>
                )
              })}
            </List>
          )}
        </Box>
      </Drawer>
    </>
  )
}

export default NotificationCenter
