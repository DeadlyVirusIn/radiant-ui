import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box,
  TextField,
  Button,
  Typography,
  Alert,
  Tab,
  Tabs,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  InputAdornment,
  IconButton,
  Tooltip,
  useMediaQuery,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import CheckCircleIcon from '@mui/icons-material/CheckCircle'
import InfoIcon from '@mui/icons-material/Info'
import Visibility from '@mui/icons-material/Visibility'
import VisibilityOff from '@mui/icons-material/VisibilityOff'
import DarkModeIcon from '@mui/icons-material/DarkMode'
import LightModeIcon from '@mui/icons-material/LightMode'
import { motion } from 'framer-motion'
import { auth, setToken } from '../services/api'
import { initSocket, initBotSocket } from '../services/socket'
import { useThemeMode } from '../contexts/ThemeContext'

// ---------------------------------------------------------------------------
// Animated gradient keyframes -- injected into <head> once
// ---------------------------------------------------------------------------
const gradientKeyframes = `
@keyframes loginGradientShift {
  0%   { background-position: 0% 50%; }
  50%  { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
`
if (typeof document !== 'undefined') {
  const existing = document.getElementById('login-gradient-keyframes')
  if (!existing) {
    const style = document.createElement('style')
    style.id = 'login-gradient-keyframes'
    style.textContent = gradientKeyframes
    document.head.appendChild(style)
  }
}

// ---------------------------------------------------------------------------
// Decorative floating elements for the branding panel
// ---------------------------------------------------------------------------
function FloatingOrb({ size, top, left, delay, duration, color }) {
  return (
    <motion.div
      initial={{ y: 0, opacity: 0.12 }}
      animate={{ y: [0, -18, 0], opacity: [0.1, 0.24, 0.1] }}
      transition={{ duration: duration || 6, delay: delay || 0, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        position: 'absolute',
        width: size,
        height: size,
        top,
        left,
        borderRadius: '50%',
        background: color || 'rgba(124, 138, 255, 0.12)',
        border: '1px solid rgba(124, 138, 255, 0.15)',
        pointerEvents: 'none',
      }}
    />
  )
}

function FloatingCard({ width, height, top, left, delay, rotate }) {
  return (
    <motion.div
      initial={{ y: 0, rotate: rotate || 0, opacity: 0.08 }}
      animate={{
        y: [0, -12, 0],
        rotate: [(rotate || 0), (rotate || 0) + 3, (rotate || 0)],
        opacity: [0.06, 0.16, 0.06],
      }}
      transition={{ duration: 7, delay: delay || 0, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        position: 'absolute',
        width,
        height,
        top,
        left,
        borderRadius: 8,
        background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.1), rgba(124, 138, 255, 0.06))',
        border: '1px solid rgba(167, 139, 250, 0.12)',
        pointerEvents: 'none',
      }}
    />
  )
}

function PokeballDecor({ size, top, left, delay }) {
  return (
    <motion.div
      initial={{ y: 0, rotate: 0, opacity: 0.08 }}
      animate={{ y: [0, -14, 0], rotate: [0, 15, 0], opacity: [0.06, 0.18, 0.06] }}
      transition={{ duration: 8, delay: delay || 0, repeat: Infinity, ease: 'easeInOut' }}
      style={{ position: 'absolute', width: size, height: size, top, left, pointerEvents: 'none' }}
    >
      <svg viewBox="0 0 100 100" width="100%" height="100%" fill="none">
        <circle cx="50" cy="50" r="48" stroke="rgba(124,138,255,0.2)" strokeWidth="2" />
        <line x1="2" y1="50" x2="98" y2="50" stroke="rgba(124,138,255,0.2)" strokeWidth="2" />
        <circle cx="50" cy="50" r="14" stroke="rgba(124,138,255,0.25)" strokeWidth="2" />
        <circle cx="50" cy="50" r="7" fill="rgba(124,138,255,0.12)" />
      </svg>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Theme-aware style builders
// ---------------------------------------------------------------------------
function getStyles(isDark) {
  const accent = isDark ? '#7C8AFF' : '#5C6AC4'
  const accentLight = isDark ? '#A78BFA' : '#7C3AED'
  const textPrimary = isDark ? '#E4E4E7' : '#1E293B'
  const textSecondary = isDark ? '#A1A1AA' : '#64748B'

  const glassCardSx = {
    background: isDark ? 'rgba(26, 32, 53, 0.85)' : 'rgba(255, 255, 255, 0.92)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.12)' : 'rgba(92, 106, 196, 0.15)'}`,
    borderRadius: '20px',
    p: { xs: 3, sm: 4 },
    boxShadow: isDark
      ? '0 24px 64px rgba(0, 0, 0, 0.4)'
      : '0 16px 48px rgba(0, 0, 0, 0.08)',
  }

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      color: textPrimary,
      '& fieldset': { borderColor: isDark ? 'rgba(124, 138, 255, 0.15)' : 'rgba(92, 106, 196, 0.2)' },
      '&:hover fieldset': { borderColor: isDark ? 'rgba(124, 138, 255, 0.3)' : 'rgba(92, 106, 196, 0.4)' },
      '&.Mui-focused fieldset': { borderColor: accent },
    },
    '& .MuiInputLabel-root': { color: textSecondary },
    '& .MuiInputLabel-root.Mui-focused': { color: accent },
  }

  const tabsSx = {
    '& .MuiTabs-indicator': {
      backgroundColor: accent,
      height: 3,
      borderRadius: '3px 3px 0 0',
    },
    '& .MuiTab-root': {
      textTransform: 'none',
      fontWeight: 600,
      fontSize: '0.95rem',
      '&.Mui-selected': { color: textPrimary },
    },
  }

  const submitBtnSx = {
    mt: 3,
    py: 1.4,
    fontSize: '1rem',
    fontWeight: 600,
    background: `linear-gradient(135deg, ${accent}, ${accentLight})`,
    color: '#fff',
    border: 'none',
    borderRadius: '12px',
    textTransform: 'none',
    boxShadow: isDark ? '0 4px 16px rgba(124, 138, 255, 0.3)' : '0 4px 16px rgba(92, 106, 196, 0.25)',
    '&:hover': {
      background: isDark
        ? 'linear-gradient(135deg, #8B97FF, #B49CFC)'
        : 'linear-gradient(135deg, #6B79D4, #8B52F7)',
      boxShadow: isDark ? '0 6px 24px rgba(124, 138, 255, 0.45)' : '0 6px 24px rgba(92, 106, 196, 0.35)',
    },
    '&.Mui-disabled': {
      background: isDark ? 'rgba(124, 138, 255, 0.25)' : 'rgba(92, 106, 196, 0.2)',
      color: isDark ? 'rgba(228, 228, 231, 0.5)' : 'rgba(30, 41, 59, 0.4)',
    },
  }

  const featureBoxSx = {
    mt: 3,
    p: 2.5,
    background: isDark ? 'rgba(26, 32, 53, 0.7)' : 'rgba(255, 255, 255, 0.8)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.1)' : 'rgba(92, 106, 196, 0.12)'}`,
    borderRadius: '16px',
  }

  return { glassCardSx, inputSx, tabsSx, submitBtnSx, featureBoxSx, accent, accentLight, textPrimary, textSecondary }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
function Login({ onLogin }) {
  const [tab, setTab] = useState(0) // 0 = login, 1 = register
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [email, setEmail] = useState('')
  const [kofiEmail, setKofiEmail] = useState('')
  const [discordUsername, setDiscordUsername] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const muiTheme = useTheme()
  const isDesktop = useMediaQuery(muiTheme.breakpoints.up('md'))
  const { isDark, toggleTheme } = useThemeMode()
  const { glassCardSx, inputSx, tabsSx, submitBtnSx, featureBoxSx, accent, textPrimary, textSecondary } = getStyles(isDark)

  // ---- submit handler (unchanged) ----
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setErrorMessage('')
    setLoading(true)

    // Validation for register
    if (tab === 1) {
      if (password !== confirmPassword) {
        setError('Passwords do not match')
        setLoading(false)
        return
      }
      if (!kofiEmail.trim() && !discordUsername.trim()) {
        setError('Either Ko-fi email or Discord username is required for verification')
        setLoading(false)
        return
      }
      if (!email.trim()) {
        setError('Email address is required')
        setLoading(false)
        return
      }
    }

    try {
      let data
      if (tab === 0) {
        // Login
        data = await auth.login(username, password)
      } else {
        // Register - either kofiEmail or discordUsername required for verification
        data = await auth.register(username, password, email, kofiEmail || null, discordUsername || null)
        if (data.token) {
          setToken(data.token)
        }
      }

      if (data.error) {
        setError(data.error)
        if (data.message) {
          setErrorMessage(data.message)
        }
      } else if (data.user) {
        initSocket(data.user.id)
        initBotSocket(data.user.id)
        onLogin(data.user)
        navigate('/')
      }
    } catch (err) {
      setError(err.message || 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  // ---- shared form content ----
  const formContent = (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    >
      <Box sx={glassCardSx}>
        {/* Theme toggle - top right of card */}
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: -1, mr: -1, mb: -1 }}>
          <Tooltip title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}>
            <IconButton onClick={toggleTheme} size="small" sx={{ color: textSecondary }}>
              {isDark ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>

        {/* Mobile-only compact branding */}
        {!isDesktop && (
          <Box sx={{ textAlign: 'center', mb: 2 }}>
            <Typography
              variant="overline"
              sx={{
                color: accent,
                fontWeight: 600,
                letterSpacing: 2,
                fontSize: '0.7rem',
              }}
            >
              TCG Pocket
            </Typography>
          </Box>
        )}

        {/* Dynamic heading */}
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            color: textPrimary,
            mb: 0.5,
            textAlign: isDesktop ? 'left' : 'center',
          }}
        >
          {tab === 0 ? 'Welcome Back' : 'Create Account'}
        </Typography>
        <Typography
          variant="body2"
          sx={{ color: textSecondary, mb: 3, textAlign: isDesktop ? 'left' : 'center' }}
        >
          {tab === 0
            ? 'Sign in to manage your collection'
            : 'Set up your account to get started'}
        </Typography>

        {/* Tabs */}
        <Tabs value={tab} onChange={(e, v) => setTab(v)} centered sx={{ mb: 3, ...tabsSx }}>
          <Tab label="Login" />
          <Tab label="Register" />
        </Tabs>

        {/* Error alert */}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight="bold">{error}</Typography>
            {errorMessage && (
              <Typography variant="body2" sx={{ mt: 0.5 }}>{errorMessage}</Typography>
            )}
          </Alert>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            margin="normal"
            required
            autoFocus
            helperText={tab === 1 ? 'Choose a username for logging in' : ''}
            sx={inputSx}
            // Phase 5.4 hotfix — iOS Safari throws "The string did not
            // match the expected pattern" on the password field when
            // it can't tell if the form is login vs register. Telling
            // it which is which (autoComplete="username" + the matching
            // current-password / new-password below) disables Safari's
            // strong-password enforcement on the login flow.
            inputProps={{
              autoComplete: 'username',
              autoCapitalize: 'none',
              autoCorrect: 'off',
              spellCheck: 'false',
            }}
          />
          {tab === 1 && (
            <>
              <TextField
                fullWidth
                label="Ko-fi Email (optional)"
                type="email"
                value={kofiEmail}
                onChange={(e) => setKofiEmail(e.target.value)}
                margin="normal"
                helperText="Optional if Discord username is provided"
                sx={inputSx}
              />
              <TextField
                fullWidth
                label="Email address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                margin="normal"
                required
                helperText="For account recovery (can be different from Ko-fi email)"
                sx={inputSx}
              />
              <TextField
                fullWidth
                label="Discord Username"
                value={discordUsername}
                onChange={(e) => setDiscordUsername(e.target.value)}
                margin="normal"
                helperText="Required for subscription verification (must match your Discord name)"
                sx={inputSx}
              />
            </>
          )}
          <TextField
            fullWidth
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            margin="normal"
            required
            sx={inputSx}
            // Phase 5.4 hotfix — autoComplete tells iOS Safari which
            // flow this field belongs to. login = current-password
            // (no strong-password rule); register = new-password
            // (allows strong-password autofill). Without this iOS
            // mis-classifies and rejects the typed value with
            // "The string did not match the expected pattern".
            inputProps={{
              autoComplete: tab === 0 ? 'current-password' : 'new-password',
            }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="toggle password visibility"
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                    size="small"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
          {tab === 1 && (
            <TextField
              fullWidth
              label="Confirm password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              margin="normal"
              required
              error={confirmPassword && password !== confirmPassword}
              helperText={confirmPassword && password !== confirmPassword ? "Passwords don't match" : ''}
              sx={inputSx}
            />
          )}
          <Button
            fullWidth
            type="submit"
            variant="contained"
            size="large"
            disabled={loading}
            sx={submitBtnSx}
          >
            {loading ? (
              <CircularProgress size={24} sx={{ color: 'rgba(255,255,255,0.8)' }} />
            ) : tab === 0 ? (
              'Login'
            ) : (
              'Create Account'
            )}
          </Button>
        </form>
      </Box>

      {/* Feature info box - only shown on Register tab */}
      {tab === 1 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15, ease: 'easeOut' }}
        >
          <Box sx={featureBoxSx}>
            <Typography
              variant="subtitle1"
              fontWeight="bold"
              sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1, color: textPrimary }}
            >
              <CheckCircleIcon color="success" fontSize="small" />
              What you can do with this site:
            </Typography>
            <List dense disablePadding>
              {[
                'Accept friend requests 24/7',
                'Check & Pick from Wonderpick',
                'Open packs',
                'Receive daily gifts (5 tickets)',
                'Track your card collection',
              ].map((text) => (
                <ListItem key={text} disableGutters sx={{ py: 0.25 }}>
                  <ListItemIcon sx={{ minWidth: 28 }}>
                    <CheckCircleIcon color="success" fontSize="small" />
                  </ListItemIcon>
                  <ListItemText
                    primary={text}
                    primaryTypographyProps={{ sx: { color: textPrimary } }}
                  />
                </ListItem>
              ))}
            </List>

            <Divider sx={{ my: 1.5, borderColor: isDark ? 'rgba(124, 138, 255, 0.1)' : 'rgba(92, 106, 196, 0.1)' }} />

            <Typography
              variant="subtitle1"
              fontWeight="bold"
              sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1, color: textPrimary }}
            >
              <InfoIcon color="info" fontSize="small" />
              Registration notes:
            </Typography>
            <List dense disablePadding>
              <ListItem disableGutters sx={{ py: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 28 }}>
                  <InfoIcon color="info" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Paid subscription required (1 month access)"
                  primaryTypographyProps={{ variant: 'body2', sx: { color: textPrimary } }}
                />
              </ListItem>
              <ListItem disableGutters sx={{ py: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 28 }}>
                  <InfoIcon color="info" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Use the email from your Ko-fi purchase"
                  secondary="This verifies your subscription"
                  primaryTypographyProps={{ variant: 'body2', sx: { color: textPrimary } }}
                  secondaryTypographyProps={{ variant: 'caption', sx: { color: textSecondary } }}
                />
              </ListItem>
              <ListItem disableGutters sx={{ py: 0.25 }}>
                <ListItemIcon sx={{ minWidth: 28 }}>
                  <InfoIcon color="info" fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary="Discord username is optional"
                  secondary="Add it later for hunt notifications"
                  primaryTypographyProps={{ variant: 'body2', sx: { color: textPrimary } }}
                  secondaryTypographyProps={{ variant: 'caption', sx: { color: textSecondary } }}
                />
              </ListItem>
            </List>
          </Box>
        </motion.div>
      )}
    </motion.div>
  )

  // =========================================================================
  // DESKTOP -- split layout: left branding | right form
  // =========================================================================
  if (isDesktop) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', background: isDark ? '#0B0F19' : '#F0F2F8' }}>
        {/* ---- Left branding panel ---- */}
        <Box
          sx={{
            flex: '0 0 45%',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: isDark
              ? 'linear-gradient(135deg, #0B0F19 0%, #111827 30%, #1A2035 60%, #0B0F19 100%)'
              : 'linear-gradient(135deg, #E8EAFC 0%, #F0F2F8 30%, #E0E4F8 60%, #E8EAFC 100%)',
            backgroundSize: '300% 300%',
            animation: 'loginGradientShift 12s ease infinite',
          }}
        >
          {/* Radial glow */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(ellipse at 50% 40%, rgba(124,138,255,0.08) 0%, transparent 70%)',
              pointerEvents: 'none',
            }}
          />

          {/* Floating decorations */}
          <FloatingOrb size={90} top="8%" left="12%" delay={0} duration={7} />
          <FloatingOrb size={50} top="22%" left="72%" delay={1.5} duration={5.5} color="rgba(167,139,250,0.1)" />
          <FloatingOrb size={35} top="65%" left="18%" delay={2.8} duration={6.5} color="rgba(167,139,250,0.08)" />
          <FloatingOrb size={65} top="75%" left="68%" delay={0.8} duration={8} />

          <FloatingCard width={80} height={110} top="30%" left="8%" delay={1} rotate={-12} />
          <FloatingCard width={60} height={85} top="55%" left="78%" delay={2.2} rotate={8} />

          <PokeballDecor size={70} top="12%" left="60%" delay={0.5} />
          <PokeballDecor size={45} top="82%" left="40%" delay={3} />

          {/* Branding text */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2, ease: 'easeOut' }}
            style={{ position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 40px' }}
          >
            <Typography
              variant="overline"
              sx={{
                color: accent,
                fontWeight: 600,
                letterSpacing: 3,
                fontSize: '0.75rem',
                mb: 1.5,
                display: 'block',
              }}
            >
              Pack Hunter
            </Typography>
            <Typography
              variant="h3"
              sx={{ fontWeight: 700, color: textPrimary, mb: 2, lineHeight: 1.2 }}
            >
              TCG Pocket
            </Typography>
            <Typography
              variant="body1"
              sx={{ color: textSecondary, maxWidth: 320, mx: 'auto', lineHeight: 1.6 }}
            >
              Manage your collection, accept friend requests,
              open packs, and track your cards -- all in one place.
            </Typography>
          </motion.div>

          {/* Bottom accent line */}
          <Box
            sx={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 2,
              background:
                'linear-gradient(90deg, transparent, rgba(124,138,255,0.3), rgba(167,139,250,0.2), transparent)',
            }}
          />
        </Box>

        {/* ---- Right form panel ---- */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isDark ? '#0B0F19' : '#F8F9FC',
            py: 4,
            px: 3,
            overflowY: 'auto',
          }}
        >
          <Box sx={{ maxWidth: 460, width: '100%' }}>
            {formContent}
          </Box>
        </Box>
      </Box>
    )
  }

  // =========================================================================
  // MOBILE -- single column
  // =========================================================================
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: isDark
          ? 'linear-gradient(135deg, #0B0F19 0%, #111827 50%, #0F172A 100%)'
          : 'linear-gradient(135deg, #F0F2F8 0%, #F8F9FC 50%, #EEF0F6 100%)',
        py: 4,
        px: 2,
      }}
    >
      <Box sx={{ maxWidth: 460, width: '100%' }}>
        {formContent}
      </Box>
    </Box>
  )
}

export default Login
