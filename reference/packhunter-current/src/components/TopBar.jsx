import {
  AppBar,
  Toolbar,
  Box,
  Typography,
  IconButton,
  Tooltip,
  Chip,
  Avatar,
  Menu,
  MenuItem,
  ListItemIcon,
  Switch,
  Divider,
  useTheme,
} from '@mui/material'
import {
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  Menu as MenuIcon,
  CatchingPokemon as PokeballIcon,
  Person as PersonIcon,
  Settings as SettingsIcon,
  Logout as LogoutIcon,
  KeyboardArrowDown,
  // 2026-04-20 Phase 2 — "My Accounts" entry in the profile menu.
  Link as AccountsIcon,
  // 2026-04-20 Phase 4B — Operator Mode toggle icon.
  Tune as OperatorModeIcon,
} from '@mui/icons-material'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useThemeMode } from '../contexts/ThemeContext'
import { useOperatorMode } from '../contexts/OperatorModeContext'
import LanguageSelector from './LanguageSelector'
import NotificationCenter from './NotificationCenter'
import SystemHealthDot from './SystemHealthDot'
import ConnectionStatus from './ConnectionStatus'
import InstallAppButton from './InstallAppButton'

const TopBar = ({ user, onLogout, onMenuToggle, showMenuButton, sidebarWidth, statusBarOffset = 0 }) => {
  const [anchorEl, setAnchorEl] = useState(null)
  const { isDark, toggleTheme } = useThemeMode()
  const navigate = useNavigate()
  const theme = useTheme()
  const { operatorMode, toggleOperatorMode } = useOperatorMode()

  const accentColor = theme.palette.primary.main

  return (
    <AppBar
      position="fixed"
      elevation={0}
      sx={{
        // Top offset = existing GlobalStatusBar offset PLUS the iOS
        // safe-area-inset-top. Previously the AppBar sat at a fixed
        // `statusBarOffset`px which matched the DOM status bar but
        // ignored the hardware notch/dynamic-island in PWA standalone.
        // `env(safe-area-inset-top)` resolves to 0 in normal browser
        // chrome and to the real inset (39–47px) when viewport-fit=cover
        // is active and the app is installed to home screen.
        top: `calc(${statusBarOffset || 0}px + env(safe-area-inset-top, 0px))`,
        ml: showMenuButton ? 0 : `${sidebarWidth}px`,
        width: showMenuButton ? '100%' : `calc(100% - ${sidebarWidth}px)`,
        transition: 'width 0.2s ease, margin-left 0.2s ease',
      }}
    >
      <Toolbar sx={{ justifyContent: 'space-between', minHeight: { xs: 56, sm: 64 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {showMenuButton && (
            <IconButton
              onClick={onMenuToggle}
              aria-label="Open navigation menu"
              // Explicit 44×44 minimum tap target (WCAG 2.5.5 AAA and
              // Apple HIG). MUI's default medium IconButton is 40×40
              // which is below iOS guidance. Keeping it fixed-size so
              // safe-area + notch can't shrink the hit region.
              sx={{
                color: 'text.primary',
                mr: 1,
                width: 44, height: 44,
                // Visible ring on focus-visible so keyboard users can
                // land on the right target.
                '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
              }}
            >
              <MenuIcon />
            </IconButton>
          )}
          {/* Mobile logo - only when sidebar is hidden */}
          {showMenuButton && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: 28,
                  height: 28,
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${accentColor} 50%, #fff 50%)`,
                  border: `2px solid ${isDark ? '#374151' : '#d1d5db'}`,
                  position: 'relative',
                  flexShrink: 0,
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#fff',
                    border: `2px solid ${isDark ? '#374151' : '#d1d5db'}`,
                  },
                }}
              />
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 700,
                  display: { xs: 'none', sm: 'block' },
                  color: 'text.primary',
                  '& span': { color: accentColor },
                }}
              >
                Pack<span>Hunter</span>
              </Typography>
            </Box>
          )}
        </Box>

        {/* Right side items */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 0.5, sm: 1 } }}>
          <Box sx={{ display: { xs: 'none', sm: 'block' } }}>
            <LanguageSelector />
          </Box>

          <Tooltip title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}>
            <IconButton
              onClick={toggleTheme}
              size="small"
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              sx={{ color: 'text.secondary', '&:hover': { color: accentColor } }}
            >
              {isDark ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
          </Tooltip>

          <InstallAppButton variant="subtle" />
          <SystemHealthDot />
          <ConnectionStatus />
          <NotificationCenter />

          <Chip
            icon={<PokeballIcon sx={{ color: `${accentColor} !important`, fontSize: 16 }} />}
            label={`${user?.linkedAccounts || 0} accts`}
            size="small"
            sx={{
              display: { xs: 'none', md: 'flex' },
              background: isDark ? 'rgba(124, 138, 255, 0.1)' : 'rgba(92, 106, 196, 0.08)',
              color: 'text.primary',
              fontWeight: 500,
              fontSize: 12,
              height: 28,
            }}
          />

          <Tooltip title="Account settings">
            <IconButton
              onClick={(e) => setAnchorEl(e.currentTarget)}
              aria-label="Account settings"
              sx={{ p: 0.5, '&:hover': { background: isDark ? 'rgba(124, 138, 255, 0.1)' : 'rgba(0,0,0,0.04)' } }}
            >
              <Avatar
                sx={{
                  width: 30,
                  height: 30,
                  background: `linear-gradient(135deg, ${accentColor}, ${theme.palette.secondary.light})`,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {user?.username?.charAt(0).toUpperCase()}
              </Avatar>
              <KeyboardArrowDown sx={{ color: 'text.secondary', fontSize: 16 }} />
            </IconButton>
          </Tooltip>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
            PaperProps={{
              sx: {
                mt: 1,
                minWidth: 200,
              },
            }}
          >
            <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <Typography variant="subtitle2" fontWeight={600}>
                {user?.username}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user?.email || 'No email set'}
              </Typography>
            </Box>
            <MenuItem onClick={() => { setAnchorEl(null); navigate('/profile'); }}>
              <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
              Profile
            </MenuItem>
            {/*
              2026-04-20 Phase 2 — "My Accounts" relocated here from
              the Hunt sidebar group. Route (/accounts) is unchanged;
              only the entry point moved. Rationale: linking device /
              game accounts is a profile/onboarding action, not a
              per-hunt task.
            */}
            <MenuItem onClick={() => { setAnchorEl(null); navigate('/accounts'); }}>
              <ListItemIcon><AccountsIcon fontSize="small" /></ListItemIcon>
              My Accounts
            </MenuItem>
            <MenuItem onClick={() => { setAnchorEl(null); navigate('/settings'); }}>
              <ListItemIcon><SettingsIcon fontSize="small" /></ListItemIcon>
              Settings
            </MenuItem>
            {/*
              2026-04-20 Phase 4B — Operator Mode toggle.
              UI-only: hides the admin "Platform" tier of the sidebar
              so day-to-day triage only shows Operations + Integrity.
              Preference persists to localStorage; no auth/role change.
              Only exposed to admins (the groups it hides are admin-only).
            */}
            {user?.isAdmin && (
              <>
                <Divider sx={{ my: 0.5 }} />
                <MenuItem
                  onClick={(e) => { e.stopPropagation(); toggleOperatorMode(); }}
                  sx={{ justifyContent: 'space-between' }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <ListItemIcon><OperatorModeIcon fontSize="small" /></ListItemIcon>
                    <Box>
                      <Typography variant="body2">Operator Mode</Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                        Hide Platform tier
                      </Typography>
                    </Box>
                  </Box>
                  <Switch
                    edge="end"
                    size="small"
                    checked={!!operatorMode}
                    onChange={toggleOperatorMode}
                    // Allow the Switch to swallow the click so the
                    // outer MenuItem's onClick doesn't double-toggle.
                    onClick={(e) => e.stopPropagation()}
                    inputProps={{ 'aria-label': 'Operator Mode toggle' }}
                  />
                </MenuItem>
                <Divider sx={{ my: 0.5 }} />
              </>
            )}
            <MenuItem onClick={() => { setAnchorEl(null); onLogout(); }} sx={{ color: 'error.main' }}>
              <ListItemIcon><LogoutIcon fontSize="small" color="error" /></ListItemIcon>
              Logout
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  )
}

export default TopBar
