/**
 * MobileBottomNav — quick-access task bar (mobile only).
 *
 * Mobile gate: useMediaQuery(theme.breakpoints.down('md')). Above md the
 * component returns null. The Sidebar (hamburger drawer) remains the
 * single source of truth for full navigation.
 *
 * Bottom ribbon — exactly 5, hard-coded:
 *   Home | Hunt | Friends | Wonder Pick | More
 *
 * More sheet — Phase 16 adaptive layout:
 *   ⭐ Pinned        (max 4, user-toggled)
 *   🔥 Suggested     (top non-pinned by adaptive score)
 *   📦 More          (everything else, default order)
 *
 * The adaptive score is computed ONCE on drawer open and cached for the
 * session. This eliminates flicker — items don't reshuffle while the
 * sheet is open. Stability threshold prevents tiny score deltas from
 * reordering items at all.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Paper, BottomNavigation, BottomNavigationAction, Box, Drawer, Typography,
  List, ListItemButton, ListItemIcon, ListItemText, IconButton, Tooltip,
  useMediaQuery, useTheme,
} from '@mui/material'
import {
  Home as HomeIcon,
  CatchingPokemon as HuntIcon,
  People as FriendsIcon,
  AutoAwesome as WonderIcon,
  MoreHoriz as MoreIcon,
  Close as CloseIcon,
  Star as StarFilledIcon,
  StarBorder as StarOutlineIcon,
  RestartAlt as ResetIcon,
  // More-menu icons
  Checklist as TrackerIcon,
  SwapHoriz as TradeIcon,
  CardGiftcard as GiftIcon,
  SmartToy as BotHubIcon,
} from '@mui/icons-material'
import { motion } from 'framer-motion'
import {
  PIN_MAX,
  readUsage, readPinned, recordClick, togglePin, resetShortcuts,
  buildMoreSections, writePinned,
} from '../utils/mobileNavUsage'

// ── Single source of truth for the mobile bottom-nav footprint ──
// Consumed by App.jsx (CSS variable wiring) and the theme's
// CssBaseline overrides. Safe-area-inset is added separately at
// consume time so non-iOS browsers degrade cleanly to base offset.
//
// The shell calculates `--mobile-nav-offset` as:
//   MOBILE_BOTTOM_NAV_HEIGHT_PX
// + MOBILE_BOTTOM_NAV_BUFFER_PX
// + env(safe-area-inset-bottom, 0px)
//
// HEIGHT must match the BottomNavigation `height` prop below.
// BUFFER reserves breathing room above the last visible content so
// taps on the final card/header/control are unobstructed.
export const MOBILE_BOTTOM_NAV_HEIGHT_PX = 64
export const MOBILE_BOTTOM_NAV_BUFFER_PX = 32
import { hydratePinned, saveToServer, saveToServerNow } from '../utils/userNavPrefs'
import useIsMobileDevice from '../hooks/useIsMobileDevice'

/* Bottom ribbon — exactly 5, fixed. Admin items are NEVER added here. */
const BOTTOM_NAV = [
  { path: '/',            label: 'Home',        Icon: HomeIcon    },
  { path: '/hunt',        label: 'Hunt',        Icon: HuntIcon    },
  { path: '/friends',     label: 'Friends',     Icon: FriendsIcon },
  { path: '/wonder-pick', label: 'Wonder Pick', Icon: WonderIcon  },
  // 'more' is a control, not a route.
]

/* More sheet — high-value shortcuts only. Adaptive ordering happens
 * across THESE items only. Adding more is intentional product scope —
 * not a default. */
const MORE_ITEMS = [
  { path: '/tracker',      label: 'Tracker',  Icon: TrackerIcon },
  { path: '/card-request', label: 'Trade',    Icon: TradeIcon   },
  { path: '/auto-gift',    label: 'Gift',     Icon: GiftIcon    },
  { path: '/bot-hub',      label: 'Bot Hub',  Icon: BotHubIcon  },
]

/* Defensive duplicate filter — pinned cannot include ribbon items either,
 * because togglePin's validPaths is taken from this same SAFE_MORE_ITEMS. */
const RIBBON_PATHS = new Set(BOTTOM_NAV.map(b => b.path))
const SAFE_MORE_ITEMS = MORE_ITEMS.filter(item => {
  if (RIBBON_PATHS.has(item.path)) {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn(`[MobileBottomNav] dropped More item "${item.label}" — duplicates ribbon path ${item.path}`)
    }
    return false
  }
  return true
})
const VALID_MORE_PATHS = SAFE_MORE_ITEMS.map(i => i.path)

/* ────────────────────────────────────────────────────────────────────
 * Component
 * ──────────────────────────────────────────────────────────────────── */
export function MobileBottomNav() {
  const theme = useTheme()
  // Phase 24 Part 2 — unify viewport + physical-device signals so a phone
  // in desktop-request mode (narrow UA string, wide CSS viewport) still
  // gets the mobile nav. Either signal alone is enough.
  const isMobileViewport = useMediaQuery(theme.breakpoints.down('md'))
  const isPhysicalMobile = useIsMobileDevice()
  const isMobile = isMobileViewport || isPhysicalMobile
  const navigate = useNavigate()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  // Adaptive state — read from localStorage. Sections are cached for the
  // session (recomputed only when the drawer opens) so items don't shuffle
  // mid-interaction.
  const [pinned, setPinned] = useState(readPinned)
  const [usage, setUsage]   = useState(readUsage)
  const [sections, setSections] = useState(() =>
    buildMoreSections(SAFE_MORE_ITEMS, { pinned: readPinned(), usage: readUsage() })
  )

  // Phase 17 — hydrate pinned shortcuts from server once on mount.
  // Falls back silently to local cache on any failure (offline, 401,
  // 5xx, abort). Server takes priority when non-empty; otherwise local
  // is promoted up so first-login on a fresh device doesn't lose pins.
  useEffect(() => {
    let cancelled = false
    hydratePinned().then(serverPins => {
      if (cancelled) return
      // Only update state if hydration actually changed something —
      // avoids a no-op rerender that could rebuild sections.
      const cur = readPinned()
      const same = cur.length === serverPins.length && cur.every((p, i) => p === serverPins[i])
      if (same) return
      writePinned(serverPins)
      setPinned(serverPins)
      setSections(buildMoreSections(SAFE_MORE_ITEMS, { pinned: serverPins, usage: readUsage() }))
    }).catch(() => { /* silent — local cache wins */ })
    return () => { cancelled = true }
  }, [])

  // Mobile-only gate — desktop / tablet (md+) get nothing from this file.
  if (!isMobile) return null

  const currentPath = location.pathname
  const ribbonMatch = BOTTOM_NAV.find(n => n.path === currentPath)
  const bottomValue = ribbonMatch ? ribbonMatch.path : 'more'

  /* Re-read state + recompute sections on each drawer OPEN.
   * Stable-while-open = no flicker; fresh-on-open = adapts over time. */
  const openMore = useCallback(() => {
    const u = readUsage()
    const p = readPinned()
    setUsage(u); setPinned(p)
    setSections(buildMoreSections(SAFE_MORE_ITEMS, { pinned: p, usage: u }))
    setMoreOpen(true)
  }, [])

  const handleBottomChange = (_e, value) => {
    if (value === 'more') { openMore(); return }
    navigate(value)
  }

  /* Record the click + navigate. We do NOT recompute sections here so the
   * sheet doesn't reshuffle as the user is leaving — they'll see the new
   * order on their next open. */
  const handleNavTo = useCallback((path) => {
    recordClick(path)
    setMoreOpen(false)
    navigate(path)
  }, [navigate])

  const handleTogglePin = useCallback((path, evt) => {
    evt?.stopPropagation()
    const nextPinned = togglePin(path, { validPaths: VALID_MORE_PATHS })
    setPinned(nextPinned)
    // Recompute sections immediately so the UI reflects the pin without
    // closing/reopening the sheet.
    setSections(buildMoreSections(SAFE_MORE_ITEMS, { pinned: nextPinned, usage }))
    // Phase 17 — debounced cross-device sync. Failures fall back to local.
    saveToServer(nextPinned)
  }, [usage])

  const handleReset = useCallback((evt) => {
    evt?.stopPropagation()
    resetShortcuts()
    const u = {}; const p = []
    setUsage(u); setPinned(p)
    setSections(buildMoreSections(SAFE_MORE_ITEMS, { pinned: p, usage: u }))
    // Phase 17 — push the empty pin set up immediately so other devices reflect the reset.
    saveToServerNow(p)
  }, [])

  const isPinned = useCallback((path) => pinned.includes(path), [pinned])
  const pinFull  = pinned.length >= PIN_MAX

  return (
    <>
      <Paper
        component={motion.div}
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        sx={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          zIndex: 1200, borderRadius: '16px 16px 0 0',
          overflow: 'hidden', boxShadow: '0 -4px 20px rgba(0,0,0,0.1)',
        }}
        elevation={8}
      >
        <BottomNavigation
          value={bottomValue}
          onChange={handleBottomChange}
          showLabels
          aria-label="Mobile navigation"
          sx={{
            // height MUST equal MOBILE_BOTTOM_NAV_HEIGHT_PX exported above.
            // Drift here breaks every page's bottom-reserve calculation.
            height: MOBILE_BOTTOM_NAV_HEIGHT_PX,
            '& .MuiBottomNavigationAction-root': {
              minWidth: 'auto', padding: '6px 0',
              '&.Mui-selected': { color: 'primary.main' },
            },
            '& .MuiBottomNavigationAction-label': {
              fontSize: '0.65rem',
              '&.Mui-selected': { fontSize: '0.7rem', fontWeight: 600 },
            },
          }}
        >
          {BOTTOM_NAV.map(({ path, label, Icon }) => (
            <BottomNavigationAction
              key={path}
              value={path}
              label={label}
              icon={<NavIcon Icon={Icon} active={currentPath === path} />}
            />
          ))}
          <BottomNavigationAction
            value="more"
            label="More"
            icon={<NavIcon Icon={MoreIcon} active={!ribbonMatch} />}
          />
        </BottomNavigation>

        <Box sx={{ height: 'env(safe-area-inset-bottom, 0px)', bgcolor: 'background.paper' }} />
      </Paper>

      <Drawer
        anchor="bottom"
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        PaperProps={{
          sx: {
            borderRadius: '16px 16px 0 0',
            pb: 'calc(96px + env(safe-area-inset-bottom, 0px))',
          },
        }}
      >
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider',
        }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={600}>Quick access</Typography>
            <Typography variant="caption" color="text.secondary">
              Use the menu (☰) for the full app.
            </Typography>
          </Box>
          <IconButton size="small" onClick={() => setMoreOpen(false)} aria-label="Close more menu">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* ⭐ Pinned — user intent, always first. Hidden when empty. */}
        <Section title="⭐ Pinned" items={sections.pinned}
                 currentPath={currentPath}
                 isPinned={isPinned} pinFull={pinFull}
                 onNavTo={handleNavTo} onTogglePin={handleTogglePin} />

        {/* 🔥 Suggested — top non-pinned by score. Hidden when empty. */}
        {sections.suggested.length > 0 && (
          <Section title="🔥 Suggested" items={sections.suggested}
                   currentPath={currentPath}
                   isPinned={isPinned} pinFull={pinFull}
                   onNavTo={handleNavTo} onTogglePin={handleTogglePin}
                   divider={sections.pinned.length > 0} />
        )}

        {/* 📦 More — everything else in default order. Hidden when empty. */}
        {sections.remaining.length > 0 && (
          <Section title="📦 More" items={sections.remaining}
                   currentPath={currentPath}
                   isPinned={isPinned} pinFull={pinFull}
                   onNavTo={handleNavTo} onTogglePin={handleTogglePin}
                   divider />
        )}

        {/* Reset shortcuts — clears localStorage + resets to default order. */}
        <Box sx={{ px: 2, py: 1, mt: 0.5, borderTop: 1, borderColor: 'divider' }}>
          <Tooltip title="Clear pins + usage data and restore default order">
            <ListItemButton
              onClick={handleReset}
              sx={{ borderRadius: 1, py: 0.75, minHeight: 36 }}
            >
              <ListItemIcon sx={{ minWidth: 30 }}>
                <ResetIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              </ListItemIcon>
              <ListItemText
                primary="Reset shortcuts"
                primaryTypographyProps={{ fontSize: '0.8rem', color: 'text.secondary' }}
              />
            </ListItemButton>
          </Tooltip>
        </Box>
      </Drawer>

      <Box sx={{ height: 80 }} />
    </>
  )
}

function Section({ title, items, currentPath, isPinned, pinFull, onNavTo, onTogglePin, divider = false }) {
  if (!items || items.length === 0) return null
  return (
    <Box sx={{ pt: divider ? 0.5 : 0, borderTop: divider ? 1 : 0, borderColor: 'divider' }}>
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ px: 2, pt: 1.25, pb: 0.25, display: 'block', fontWeight: 700, letterSpacing: 0.5 }}
      >
        {title}
      </Typography>
      <List dense disablePadding>
        {items.map(item => {
          const active = currentPath === item.path
          const pinned = isPinned(item.path)
          const pinDisabled = !pinned && pinFull
          return (
            <ListItemButton
              key={item.path}
              onClick={() => onNavTo(item.path)}
              selected={active}
              sx={{
                px: 2, py: 1.25,
                minHeight: 48,
                '&.Mui-selected': { bgcolor: 'action.selected' },
              }}
            >
              <ListItemIcon sx={{ minWidth: 36 }}>
                <item.Icon fontSize="small" color={active ? 'primary' : 'inherit'} />
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontSize: '0.95rem',
                  fontWeight: active ? 600 : 400,
                  color: active ? 'primary.main' : 'inherit',
                }}
              />
              <Tooltip
                title={pinned ? 'Unpin' : pinDisabled ? `Pinned slots full (${PIN_MAX} max)` : 'Pin'}
                enterDelay={400}
              >
                <span>
                  <IconButton
                    edge="end" size="small"
                    aria-label={pinned ? 'Unpin shortcut' : 'Pin shortcut'}
                    onClick={(e) => onTogglePin(item.path, e)}
                    disabled={pinDisabled}
                    sx={{ width: 44, height: 44 }}
                  >
                    {pinned
                      ? <StarFilledIcon fontSize="small" sx={{ color: 'warning.main' }} />
                      : <StarOutlineIcon fontSize="small" />}
                  </IconButton>
                </span>
              </Tooltip>
            </ListItemButton>
          )
        })}
      </List>
    </Box>
  )
}

function NavIcon({ Icon, active }) {
  return (
    <motion.div
      animate={{ scale: active ? 1.1 : 1, y: active ? -2 : 0 }}
      transition={{ duration: 0.2 }}
    >
      <Icon sx={{ fontSize: 24, color: active ? 'primary.main' : 'text.secondary' }} />
    </motion.div>
  )
}

/**
 * useMobileNav — preserved from prior versions. Other components rely on
 * `bottomPadding` to add room for the fixed bar. Unchanged.
 */
export function useMobileNav() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  return { isMobile, bottomPadding: isMobile ? 80 : 0 }
}

export default MobileBottomNav
