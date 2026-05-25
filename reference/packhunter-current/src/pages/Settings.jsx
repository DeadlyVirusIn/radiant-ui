import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Box,
  Typography,
  Switch,
  FormControl,
  Select,
  MenuItem,
  Button,
  Alert,
  Snackbar,
  Slider,
  TextField,
  Chip,
  useTheme,
  useMediaQuery,
  Collapse,
} from '@mui/material'
import {
  Settings as SettingsIcon,
  Notifications as NotificationsIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  VolumeUp as SoundIcon,
  VolumeOff as MuteIcon,
  Palette as ThemeIcon,
  Language as LanguageIcon,
  Storage as StorageIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  CardGiftcard as PackIcon,
  Star as GodPackIcon,
  Error as ErrorIcon,
  CheckCircle as SuccessIcon,
  Info as InfoIcon,
  Lock as LockIcon,
  Visibility as VisibilityIcon,
  VisibilityOff as VisibilityOffIcon,
  ExpandMore as ExpandMoreIcon,
  Warning as WarningIcon,
} from '@mui/icons-material'
import { IconButton, InputAdornment, CircularProgress } from '@mui/material'
import api from '../services/api'
import { useThemeMode } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'
import { useConfirmDialog } from '../components/ConfirmDialog'
import SettingRow from '../components/SettingRow'
import { FadeIn } from '../components/Animations'
import { FormPageSkeleton } from '../components/skeletons/PageSkeletons'
import PageHeader from '../components/PageHeader'

// Available packs for default selection
const PACK_OPTIONS = [
  { id: 'CRIMSON_BLAZE', name: 'Crimson Blaze (B1a)' },
  { id: 'BLAZIKEN', name: 'Blaziken' },
  { id: 'GYARADOS', name: 'Gyarados' },
  { id: 'ALTARIA', name: 'Altaria' },
  { id: 'HOOH', name: 'Ho-Oh' },
  { id: 'LUGIA', name: 'Lugia' },
  { id: 'RAYQUAZA', name: 'Rayquaza' },
  { id: 'KYOGRE', name: 'Kyogre' },
  { id: 'RANDOM', name: 'Random' },
]

// Sidebar categories
const CATEGORIES = [
  { id: 'notifications', label: 'Notifications', icon: <NotificationsIcon /> },
  { id: 'preferences', label: 'Preferences', icon: <ThemeIcon /> },
  { id: 'security', label: 'Security', icon: <LockIcon /> },
  { id: 'kofi', label: 'Ko-fi', icon: <PackIcon /> },
  { id: 'storage', label: 'Storage', icon: <StorageIcon /> },
  { id: 'danger', label: 'Danger Zone', icon: <WarningIcon /> },
]

function Settings({ user }) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const { isDark, toggleTheme } = useThemeMode()
  const { language, setLanguage, t } = useLanguage()
  const { confirm, ConfirmDialogComponent } = useConfirmDialog()

  // Active category for sidebar
  const [activeCategory, setActiveCategory] = useState('notifications')

  // Section refs for scrolling
  const sectionRefs = useRef({})

  // Settings state
  const [settings, setSettings] = useState({
    godPackAlerts: true,
    errorAlerts: true,
    huntStatusAlerts: true,
    dailyReminders: true,
    browserNotifications: false,
    soundAlerts: false,
    soundVolume: 50,
    defaultPack: 'CRIMSON_BLAZE',
    autoRefreshInterval: 30,
    cardsPerPage: 50,
    showCardImages: true,
    compactMode: false,
  })

  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })
  const [savedIndicator, setSavedIndicator] = useState(false)

  // Password change state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  })
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  // Ko-fi email linking state
  const [kofiEmail, setKofiEmail] = useState('')
  const [kofiEmailSaved, setKofiEmailSaved] = useState('')
  const [kofiLoading, setKofiLoading] = useState(false)

  // Danger zone collapsed
  const [dangerOpen, setDangerOpen] = useState(false)

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('userSettings')
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings)
        setSettings(prev => ({ ...prev, ...parsed }))
      } catch (e) {
        console.error('Failed to load settings:', e)
      }
    }
  }, [])

  // Load Ko-fi email from server
  useEffect(() => {
    const loadKofiEmail = async () => {
      try {
        const data = await api.auth.getMe()
        if (data.user?.kofiVerifiedEmail) {
          setKofiEmail(data.user.kofiVerifiedEmail)
          setKofiEmailSaved(data.user.kofiVerifiedEmail)
        }
      } catch (e) {
        console.error('Failed to load Ko-fi email:', e)
      }
    }
    loadKofiEmail()
  }, [])

  // Auto-save with debounce
  const saveTimeoutRef = useRef(null)
  const autoSave = useCallback((newSettings) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => {
      try {
        localStorage.setItem('userSettings', JSON.stringify(newSettings))
        setSavedIndicator(true)
        setTimeout(() => setSavedIndicator(false), 2000)
      } catch (e) {
        console.error('Auto-save failed:', e)
      }
    }, 600)
  }, [])

  // Handle setting change with auto-save
  const handleChange = (key, value) => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    autoSave(newSettings)
  }

  // Request browser notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        handleChange('browserNotifications', true)
        setSnackbar({ open: true, message: 'Browser notifications enabled!', severity: 'success' })
        new Notification('Pack Hunter', {
          body: 'Browser notifications are now enabled!',
          icon: '/icons/icon-192x192.png'
        })
      } else {
        setSnackbar({ open: true, message: 'Notification permission denied', severity: 'warning' })
      }
    } else {
      setSnackbar({ open: true, message: 'Browser notifications not supported', severity: 'error' })
    }
  }

  // Clear all cached data
  const clearCache = async () => {
    const confirmed = await confirm({
      title: 'Clear Cache?',
      message: 'This will remove all cached data including your saved preferences and history. Your login will be preserved.',
      confirmText: 'Clear Cache',
      confirmColor: 'warning',
      variant: 'warning',
    })

    if (confirmed) {
      const keysToKeep = ['token', 'user']
      const allKeys = Object.keys(localStorage)
      allKeys.forEach(key => {
        if (!keysToKeep.includes(key)) {
          localStorage.removeItem(key)
        }
      })
      setSnackbar({ open: true, message: 'Cache cleared successfully!', severity: 'success' })
    }
  }

  // Reset to defaults
  const resetToDefaults = async () => {
    const confirmed = await confirm({
      title: 'Reset to Defaults?',
      message: 'This will reset all settings to their default values and save immediately.',
      confirmText: 'Reset',
      confirmColor: 'warning',
      variant: 'warning',
    })

    if (confirmed) {
      const defaults = {
        godPackAlerts: true,
        errorAlerts: true,
        huntStatusAlerts: true,
        dailyReminders: true,
        browserNotifications: false,
        soundAlerts: false,
        soundVolume: 50,
        defaultPack: 'CRIMSON_BLAZE',
        autoRefreshInterval: 30,
        cardsPerPage: 50,
        showCardImages: true,
        compactMode: false,
      }
      setSettings(defaults)
      localStorage.setItem('userSettings', JSON.stringify(defaults))
      setSavedIndicator(true)
      setTimeout(() => setSavedIndicator(false), 2000)
      setSnackbar({ open: true, message: 'Settings reset to defaults', severity: 'info' })
    }
  }

  // Calculate storage usage
  const getStorageUsage = () => {
    let total = 0
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        total += localStorage.getItem(key).length * 2
      }
    }
    return (total / 1024).toFixed(2)
  }

  // Handle password change
  const handlePasswordChange = async () => {
    setPasswordError('')

    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      setPasswordError('All fields are required')
      return
    }

    if (passwordData.newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters')
      return
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }

    setPasswordLoading(true)
    try {
      await api.auth.changePassword(passwordData.currentPassword, passwordData.newPassword)
      setSnackbar({ open: true, message: 'Password changed successfully!', severity: 'success' })
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error) {
      const message = error.message || 'Failed to change password'
      setPasswordError(message)
      setSnackbar({ open: true, message, severity: 'error' })
    } finally {
      setPasswordLoading(false)
    }
  }

  // Handle Ko-fi email save
  const handleKofiEmailSave = async () => {
    if (!kofiEmail || kofiEmail === kofiEmailSaved) return
    setKofiLoading(true)
    try {
      const result = await api.auth.updateKofiEmail(kofiEmail)
      setKofiEmailSaved(kofiEmail)
      const msg = result.subscriptionLinked
        ? 'Ko-fi email linked and subscription synced!'
        : 'Ko-fi email linked successfully'
      setSnackbar({ open: true, message: msg, severity: 'success' })
    } catch (error) {
      const message = error.message || 'Failed to link Ko-fi email'
      setSnackbar({ open: true, message, severity: 'error' })
    } finally {
      setKofiLoading(false)
    }
  }

  // Scroll to section
  const scrollToSection = (categoryId) => {
    setActiveCategory(categoryId)
    const el = sectionRefs.current[categoryId]
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Sidebar nav item
  const NavItem = ({ cat, active }) => (
    <Box
      onClick={() => scrollToSection(cat.id)}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1.25,
        borderRadius: '10px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        bgcolor: active
          ? isDark ? 'rgba(124, 138, 255, 0.12)' : 'rgba(99, 102, 241, 0.08)'
          : 'transparent',
        color: active ? 'primary.main' : 'text.secondary',
        fontWeight: active ? 600 : 400,
        borderLeft: active ? `3px solid ${theme.palette.primary.main}` : '3px solid transparent',
        '&:hover': {
          bgcolor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
          color: 'text.primary',
        },
        '& svg': { fontSize: 20 },
      }}
    >
      {cat.icon}
      <Typography variant="body2" sx={{ fontWeight: 'inherit' }}>
        {cat.label}
      </Typography>
    </Box>
  )

  // Section header
  const SectionHeader = ({ id, icon, title, description }) => (
    <Box
      ref={(el) => { sectionRefs.current[id] = el }}
      sx={{ mb: 2, scrollMarginTop: '80px' }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
        <Box sx={{ color: 'primary.main', display: 'flex', '& svg': { fontSize: 22 } }}>
          {icon}
        </Box>
        <Typography variant="h6" sx={{ fontWeight: 700, fontSize: '1.05rem' }}>
          {title}
        </Typography>
      </Box>
      {description && (
        <Typography variant="caption" color="text.secondary" sx={{ ml: 4.5 }}>
          {description}
        </Typography>
      )}
    </Box>
  )

  return (
    <FadeIn>
    <Box>
      {/* Header */}
      <PageHeader
        icon={<SettingsIcon />}
        title="Settings"
        subtitle="Customize your experience"
        accent={theme.palette.secondary.main}
        action={
          <Chip
            label="Saved"
            icon={<SuccessIcon />}
            color="success"
            size="small"
            variant="outlined"
            sx={{
              opacity: savedIndicator ? 1 : 0,
              transform: savedIndicator ? 'translateY(0)' : 'translateY(-4px)',
              transition: 'opacity 0.3s, transform 0.3s',
              pointerEvents: 'none',
            }}
          />
        }
      />

      {/* Mobile category selector */}
      {isMobile && (
        <FormControl fullWidth size="small" sx={{ mb: 3 }}>
          <Select
            value={activeCategory}
            onChange={(e) => scrollToSection(e.target.value)}
            sx={{
              borderRadius: '12px',
              bgcolor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
            }}
          >
            {CATEGORIES.map(cat => (
              <MenuItem key={cat.id} value={cat.id}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ color: 'text.secondary', display: 'flex', '& svg': { fontSize: 18 } }}>{cat.icon}</Box>
                  {cat.label}
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}

      <Box sx={{ display: 'flex', gap: 4 }}>
        {/* Sidebar — desktop only */}
        {!isMobile && (
          <Box
            sx={{
              width: 220,
              flexShrink: 0,
              position: 'sticky',
              top: 80,
              alignSelf: 'flex-start',
              display: 'flex',
              flexDirection: 'column',
              gap: 0.5,
              py: 1,
              px: 0.5,
              borderRadius: '14px',
              border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
              bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
            }}
          >
            {CATEGORIES.map(cat => (
              <NavItem key={cat.id} cat={cat} active={activeCategory === cat.id} />
            ))}
          </Box>
        )}

        {/* Content panel */}
        <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>

          {/* ── Notifications ── */}
          <Box>
            <SectionHeader
              id="notifications"
              icon={<NotificationsIcon />}
              title="Notifications"
              description="Configure alerts and notification preferences"
            />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <SettingRow
                icon={<GodPackIcon sx={{ color: theme.palette.warning.main }} />}
                label="God Pack Alerts"
                description="Get notified when a god pack is found"
                control={
                  <Switch
                    checked={settings.godPackAlerts}
                    onChange={(e) => handleChange('godPackAlerts', e.target.checked)}
                    color="primary"
                  />
                }
              />
              <SettingRow
                icon={<ErrorIcon sx={{ color: theme.palette.error.main }} />}
                label="Error Alerts"
                description="Get notified about critical errors"
                control={
                  <Switch
                    checked={settings.errorAlerts}
                    onChange={(e) => handleChange('errorAlerts', e.target.checked)}
                    color="primary"
                  />
                }
              />
              <SettingRow
                icon={<InfoIcon sx={{ color: theme.palette.info.main }} />}
                label="Hunt Status Alerts"
                description="Get notified when hunts start or stop"
                control={
                  <Switch
                    checked={settings.huntStatusAlerts}
                    onChange={(e) => handleChange('huntStatusAlerts', e.target.checked)}
                    color="primary"
                  />
                }
              />
              <SettingRow
                icon={<SuccessIcon sx={{ color: theme.palette.success.main }} />}
                label="Daily Reminders"
                description="Remind to claim daily rewards"
                control={
                  <Switch
                    checked={settings.dailyReminders}
                    onChange={(e) => handleChange('dailyReminders', e.target.checked)}
                    color="primary"
                  />
                }
              />
              <SettingRow
                icon={<NotificationsIcon />}
                label="Browser Notifications"
                description={settings.browserNotifications ? 'Enabled' : 'Click to enable'}
                control={
                  settings.browserNotifications ? (
                    <Chip label="Enabled" color="success" size="small" />
                  ) : (
                    <Button size="small" variant="outlined" onClick={requestNotificationPermission}>
                      Enable
                    </Button>
                  )
                }
              />
              <SettingRow
                icon={settings.soundAlerts ? <SoundIcon /> : <MuteIcon />}
                label="Sound Alerts"
                description="Play sound for god packs"
                control={
                  <Switch
                    checked={settings.soundAlerts}
                    onChange={(e) => handleChange('soundAlerts', e.target.checked)}
                    color="primary"
                  />
                }
              />
              {settings.soundAlerts && (
                <SettingRow
                  label="Volume"
                  description={`${settings.soundVolume}%`}
                  control={
                    <Box sx={{ width: 120 }}>
                      <Slider
                        value={settings.soundVolume}
                        onChange={(e, val) => handleChange('soundVolume', val)}
                        valueLabelDisplay="auto"
                        min={0}
                        max={100}
                        size="small"
                      />
                    </Box>
                  }
                />
              )}
            </Box>
          </Box>

          {/* ── Preferences ── */}
          <Box>
            <SectionHeader
              id="preferences"
              icon={<ThemeIcon />}
              title="Preferences"
              description="Display, language, and default settings"
            />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <SettingRow
                icon={isDark ? <DarkModeIcon /> : <LightModeIcon />}
                label="Dark Mode"
                description={isDark ? 'Dark theme active' : 'Light theme active'}
                control={
                  <Switch
                    checked={isDark}
                    onChange={toggleTheme}
                    color="primary"
                  />
                }
              />
              <SettingRow
                icon={<LanguageIcon />}
                label="Language"
                control={
                  <FormControl size="small" sx={{ minWidth: 110 }}>
                    <Select
                      value={language}
                      onChange={(e) => setLanguage(e.target.value)}
                      sx={{ borderRadius: '8px' }}
                    >
                      <MenuItem value="en">English</MenuItem>
                      <MenuItem value="zh-TW">繁體中文</MenuItem>
                      <MenuItem value="ja">日本語</MenuItem>
                      <MenuItem value="ko">한국어</MenuItem>
                    </Select>
                  </FormControl>
                }
              />
              <SettingRow
                icon={<PackIcon />}
                label="Default Pack"
                description="For pack opening and hunts"
                control={
                  <FormControl size="small" sx={{ minWidth: 140 }}>
                    <Select
                      value={settings.defaultPack}
                      onChange={(e) => handleChange('defaultPack', e.target.value)}
                      sx={{ borderRadius: '8px' }}
                    >
                      {PACK_OPTIONS.map(pack => (
                        <MenuItem key={pack.id} value={pack.id}>
                          {pack.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                }
              />
              <SettingRow
                icon={<RefreshIcon />}
                label="Auto Refresh"
                description="Dashboard refresh interval"
                control={
                  <FormControl size="small" sx={{ minWidth: 80 }}>
                    <Select
                      value={settings.autoRefreshInterval}
                      onChange={(e) => handleChange('autoRefreshInterval', e.target.value)}
                      sx={{ borderRadius: '8px' }}
                    >
                      <MenuItem value={15}>15s</MenuItem>
                      <MenuItem value={30}>30s</MenuItem>
                      <MenuItem value={60}>60s</MenuItem>
                      <MenuItem value={0}>Off</MenuItem>
                    </Select>
                  </FormControl>
                }
              />
              <SettingRow
                label="Cards Per Page"
                description="Number of cards to display"
                control={
                  <FormControl size="small" sx={{ minWidth: 80 }}>
                    <Select
                      value={settings.cardsPerPage}
                      onChange={(e) => handleChange('cardsPerPage', e.target.value)}
                      sx={{ borderRadius: '8px' }}
                    >
                      <MenuItem value={25}>25</MenuItem>
                      <MenuItem value={50}>50</MenuItem>
                      <MenuItem value={100}>100</MenuItem>
                      <MenuItem value={200}>200</MenuItem>
                    </Select>
                  </FormControl>
                }
              />
              <SettingRow
                label="Show Card Images"
                description="Display card artwork in lists"
                control={
                  <Switch
                    checked={settings.showCardImages}
                    onChange={(e) => handleChange('showCardImages', e.target.checked)}
                    color="primary"
                  />
                }
              />
              <SettingRow
                label="Compact Mode"
                description="Reduce spacing and padding"
                control={
                  <Switch
                    checked={settings.compactMode}
                    onChange={(e) => handleChange('compactMode', e.target.checked)}
                    color="primary"
                  />
                }
              />
            </Box>
          </Box>

          {/* ── Security ── */}
          <Box>
            <SectionHeader
              id="security"
              icon={<LockIcon />}
              title="Account Security"
              description="Change your password"
            />
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                p: 2.5,
                borderRadius: '14px',
                border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
                bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
              }}
            >
              <TextField
                label="Current Password"
                type={showPasswords.current ? 'text' : 'password'}
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                fullWidth
                size="small"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
                        edge="end"
                        size="small"
                        aria-label={showPasswords.current ? 'Hide current password' : 'Show current password'}
                      >
                        {showPasswords.current ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                label="New Password"
                type={showPasswords.new ? 'text' : 'password'}
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                fullWidth
                size="small"
                helperText="Minimum 6 characters"
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
                        edge="end"
                        size="small"
                        aria-label={showPasswords.new ? 'Hide new password' : 'Show new password'}
                      >
                        {showPasswords.new ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                label="Confirm New Password"
                type={showPasswords.confirm ? 'text' : 'password'}
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                fullWidth
                size="small"
                error={passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword}
                helperText={
                  passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword
                    ? 'Passwords do not match'
                    : ''
                }
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
                        edge="end"
                        size="small"
                        aria-label={showPasswords.confirm ? 'Hide confirm password' : 'Show confirm password'}
                      >
                        {showPasswords.confirm ? <VisibilityOffIcon /> : <VisibilityIcon />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />

              {passwordError && (
                <Alert severity="error" sx={{ py: 0 }}>
                  {passwordError}
                </Alert>
              )}

              <Button
                variant="contained"
                onClick={handlePasswordChange}
                disabled={passwordLoading || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                startIcon={passwordLoading ? <CircularProgress size={20} color="inherit" /> : <LockIcon />}
                sx={{
                  borderRadius: '10px',
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  '&:hover': { background: `linear-gradient(135deg, ${theme.palette.primary.dark || theme.palette.primary.main}, ${theme.palette.secondary.dark || theme.palette.secondary.main})` },
                }}
              >
                {passwordLoading ? 'Changing...' : 'Change Password'}
              </Button>
            </Box>
          </Box>

          {/* ── Ko-fi ── */}
          <Box>
            <SectionHeader
              id="kofi"
              icon={<PackIcon />}
              title="Ko-fi Subscription"
              description="Link your Ko-fi email to sync your subscription"
            />
            <Box
              sx={{
                p: 2.5,
                borderRadius: '14px',
                border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
                bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
              }}
            >
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Link the email you used for your Ko-fi purchase to ensure your subscription is properly matched.
              </Typography>

              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <TextField
                  label="Ko-fi Email"
                  type="email"
                  value={kofiEmail}
                  onChange={(e) => setKofiEmail(e.target.value)}
                  fullWidth
                  size="small"
                  placeholder="your-email@example.com"
                  helperText={kofiEmailSaved ? `Currently linked: ${kofiEmailSaved}` : 'Not yet linked'}
                />
                <Button
                  variant="contained"
                  onClick={handleKofiEmailSave}
                  disabled={kofiLoading || !kofiEmail || kofiEmail === kofiEmailSaved}
                  sx={{
                    minWidth: 80,
                    mt: 0.25,
                    borderRadius: '10px',
                    background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                    '&:hover': { background: `linear-gradient(135deg, ${theme.palette.primary.dark || theme.palette.primary.main}, ${theme.palette.secondary.dark || theme.palette.secondary.main})` },
                  }}
                  startIcon={kofiLoading ? <CircularProgress size={16} color="inherit" /> : null}
                >
                  {kofiLoading ? '...' : 'Save'}
                </Button>
              </Box>
            </Box>
          </Box>

          {/* ── Storage ── */}
          <Box>
            <SectionHeader
              id="storage"
              icon={<StorageIcon />}
              title="Storage"
              description="Local storage usage"
            />
            <Box
              sx={{
                p: 2.5,
                borderRadius: '14px',
                border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
                bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
                textAlign: 'center',
              }}
            >
              <Typography variant="h4" fontWeight={700} color="primary">
                {getStorageUsage()} KB
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Local Storage Used
              </Typography>
            </Box>
          </Box>

          {/* ── Danger Zone ── */}
          <Box ref={(el) => { sectionRefs.current['danger'] = el }} sx={{ scrollMarginTop: '80px' }}>
            <Box
              onClick={() => setDangerOpen(!dangerOpen)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                px: 2,
                py: 1.5,
                borderRadius: '12px',
                border: `1px solid ${isDark ? 'rgba(244, 67, 54, 0.2)' : 'rgba(244, 67, 54, 0.15)'}`,
                bgcolor: isDark ? 'rgba(244, 67, 54, 0.05)' : 'rgba(244, 67, 54, 0.03)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  bgcolor: isDark ? 'rgba(244, 67, 54, 0.08)' : 'rgba(244, 67, 54, 0.05)',
                },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <WarningIcon sx={{ color: theme.palette.error.main, fontSize: 22 }} />
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: theme.palette.error.main }}>
                    Danger Zone
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Destructive actions — cannot be undone
                  </Typography>
                </Box>
              </Box>
              <ExpandMoreIcon
                sx={{
                  color: 'text.secondary',
                  transform: dangerOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.3s',
                }}
              />
            </Box>

            <Collapse in={dangerOpen}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1.5 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2,
                    px: 2,
                    py: 1.5,
                    borderRadius: '12px',
                    border: `1px solid ${isDark ? 'rgba(255, 152, 0, 0.15)' : 'rgba(255, 152, 0, 0.12)'}`,
                    bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
                  }}
                >
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Reset to Defaults
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Reset all settings to their default values
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    color="warning"
                    startIcon={<RefreshIcon />}
                    onClick={resetToDefaults}
                    sx={{ borderRadius: '8px', flexShrink: 0 }}
                  >
                    Reset
                  </Button>
                </Box>

                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 2,
                    px: 2,
                    py: 1.5,
                    borderRadius: '12px',
                    border: `1px solid ${isDark ? 'rgba(244, 67, 54, 0.15)' : 'rgba(244, 67, 54, 0.12)'}`,
                    bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
                  }}
                >
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      Clear Cache
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Remove all cached data (login is preserved)
                    </Typography>
                  </Box>
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={clearCache}
                    sx={{ borderRadius: '8px', flexShrink: 0 }}
                  >
                    Clear
                  </Button>
                </Box>
              </Box>
            </Collapse>
          </Box>

        </Box>
      </Box>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Confirm Dialog */}
      {ConfirmDialogComponent}
    </Box>
    </FadeIn>
  )
}

export default Settings
