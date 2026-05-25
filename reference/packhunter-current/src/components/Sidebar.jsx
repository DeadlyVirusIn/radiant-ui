import { useEffect, useState } from 'react'
import { useHuntStats } from '../contexts/HuntStatsContext'
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Typography,
  Tooltip,
  IconButton,
  Avatar,
  Badge,
  Divider,
  useTheme,
} from '@mui/material'
import {
  ExpandLess,
  ExpandMore,
  ChevronLeft as CollapseIcon,
  ChevronRight as ExpandIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
} from '@mui/icons-material'
import { useLocation, useNavigate } from 'react-router-dom'
import { useThemeMode } from '../contexts/ThemeContext'
// 2026-04-20 Phase 4B — Operator Mode filter.
import { useOperatorMode } from '../contexts/OperatorModeContext'
// 2026-04-20 Phase 5 → Phase 5.13 — Favorites panel (formerly Quick
// Access). Drives the star toggle exposed on each leaf nav row below.
import QuickAccessPanel from './QuickAccessPanel'
import { useQuickAccess } from '../contexts/QuickAccessContext'
// Phase 5.13 — local Snackbar for the max-cap message. We don't have
// a global snackbar provider; per-component state matches the existing
// pattern used elsewhere in the codebase.
import { Snackbar, Alert } from '@mui/material'

const SIDEBAR_WIDTH = 260
const SIDEBAR_COLLAPSED = 72

const Sidebar = ({ navGroups: rawGroups, user, hasTier, onClose, mobileOpen, variant, onExpandedChange }) => {
  const [expanded, setExpanded] = useState(true)
  const [openSections, setOpenSections] = useState({})
  const location = useLocation()
  const navigate = useNavigate()
  const { isDark } = useThemeMode()
  const theme = useTheme()
  const { operatorMode } = useOperatorMode()
  // Phase 5.13 — Favorites star toggle on each leaf nav row.
  const { isPinned, tryPin, unpin, MAX_PINNED } = useQuickAccess()
  const [favSnack, setFavSnack] = useState({ open: false, message: '', severity: 'info' })

  const handleFavoriteToggle = (path, label, e) => {
    if (e) e.stopPropagation()
    if (!path) return
    if (isPinned(path)) {
      unpin(path)
      return
    }
    const result = tryPin(path, label)
    if (!result?.ok && result?.reason === 'max-cap') {
      setFavSnack({
        open: true,
        message: `You can pin up to ${MAX_PINNED} favorites. Remove one to add another.`,
        severity: 'info',
      })
    }
  }

  // 2026-04-20 Phase 4B — Operator Mode sidebar filter.
  // Purely UI: when the toggle is ON we suppress the "Platform" admin
  // group (Users / Observability / Audit Log / Activity Logs) so the
  // sidebar collapses to just Operations + Integrity for incident
  // triage. All admin routes remain reachable via URL and via the
  // full sidebar when the toggle is flipped back off.
  const navGroups = operatorMode
    ? (rawGroups || []).filter(g => g.id !== 'admin-platform')
    : rawGroups

  // Consume shared hunt stats from context (NO independent polling)
  const { data: huntStats } = useHuntStats()
  const huntActive = huntStats?.isActive || false

  const isMobile = variant === 'temporary'
  const width = isMobile ? SIDEBAR_WIDTH : (expanded ? SIDEBAR_WIDTH : SIDEBAR_COLLAPSED)

  const toggleSection = (groupId) => {
    if (!expanded && !isMobile) {
      // If collapsed, expand sidebar first
      setExpanded(true)
      onExpandedChange?.(true)
      setOpenSections(prev => ({ ...prev, [groupId]: true }))
      return
    }
    setOpenSections(prev => ({ ...prev, [groupId]: !prev[groupId] }))
  }

  const handleNavClick = (path) => {
    navigate(path)
    if (isMobile && onClose) onClose()
  }

  // Match a nav item's path to the current URL. Items that carry a
  // query string (e.g. /admin/users?tab=hunters) highlight only when
  // both pathname AND relevant query match.
  const matchesCurrent = (itemPath) => {
    if (!itemPath) return false
    const [p, qs] = itemPath.split('?')
    if (location.pathname !== p) return false
    if (!qs) return true
    const want = new URLSearchParams(qs)
    const have = new URLSearchParams(location.search)
    for (const [k, v] of want) {
      if (have.get(k) !== v) return false
    }
    return true
  }

  const isActive = (path) => matchesCurrent(path)
  const isGroupActive = (group) => {
    if (group.path) return matchesCurrent(group.path)
    return group.items?.some(item => matchesCurrent(item.path))
  }

  // Auto-expand groups whose current child is active. On mobile, other
  // groups stay collapsed so the sidebar isn't a wall of items.
  useEffect(() => {
    const next = {}
    for (const group of navGroups || []) {
      if (group.items && isGroupActive(group)) next[group.id] = true
    }
    setOpenSections(prev => ({ ...prev, ...next }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search])

  const accentColor = theme.palette.primary.main

  // ── 2026-04-20 Phase 2 — recursive nav item renderer ─────────────
  // Supports a second nesting level so the admin "Operations" group
  // can host "Hunts" as a sub-group with its own children, and the
  // user "Play" group can host a "Wallet" sub-group. Top-level groups
  // still render via the explicit code paths below for visual
  // continuity (dot badge on Hunt, etc.); this helper handles depth
  // ≥ 1 (anything inside a group's items[]).
  //
  // Depth controls left indent (depth 1 ≈ ml:3, depth 2 ≈ ml:6).
  // Expansion state is keyed by composite `parentKey::text` so each
  // nested branch tracks its own open/closed state.
  const renderNavItem = (item, depth, parentKey) => {
    // Tier-gated children — silently drop when user lacks tier.
    if (item.tiers && !hasTier(...item.tiers)) return null

    const nodeKey   = `${parentKey}::${item.text}`
    const hasChildren = Array.isArray(item.items) && item.items.length > 0
    const itemActive = item.path ? isActive(item.path) : false
    const branchActive = hasChildren
      ? item.items.some(c => c.path ? isActive(c.path) : false)
      : false
    const active = itemActive || branchActive
    const indentMl = depth * 3

    // ── Leaf (link) ──
    if (item.path && !hasChildren) {
      // Phase 5.13 — Favorites star toggle. Star button only renders
      // when the sidebar is expanded (collapsed icon-only mode has
      // no horizontal room) and on leaves (sub-groups can't be pinned).
      const showStar = expanded || isMobile
      const pinned = showStar && isPinned(item.path)
      return (
        <ListItemButton
          key={item.path || nodeKey}
          onClick={() => handleNavClick(item.path)}
          sx={{
            // 2026-04-20 Phase 3 UX polish — nested paddings:
            //   depth 1: py: 1.25 (10px)
            //   depth 2: py: 1    (8px)
            mx: 1,
            my: 0.15,
            ml: indentMl,
            py: depth === 1 ? 1.25 : 1,
            borderRadius: 2,
            minHeight: depth === 1 ? 38 : 34,
            px: 2, position: 'relative',
            bgcolor: active
              ? (isDark ? 'rgba(124, 138, 255, 0.12)' : 'rgba(92, 106, 196, 0.08)')
              : 'transparent',
            color: active ? accentColor : 'text.secondary',
            transition: 'background-color 0.15s ease, color 0.15s ease',
            '&:hover': {
              bgcolor: isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(92, 106, 196, 0.06)',
              // Phase 5.13 — star button reveals on row hover. Pinned
              // items keep the filled star visible at full opacity.
              '.nav-fav-action': { opacity: 1 },
            },
            '&::before': active ? {
              content: '""', position: 'absolute', left: 0,
              top: '20%', bottom: '20%', width: 3,
              borderRadius: '0 4px 4px 0', bgcolor: accentColor,
            } : {},
            '& .nav-fav-action': {
              opacity: pinned ? 1 : 0,
              transition: 'opacity 0.15s ease',
            },
          }}
        >
          <ListItemIcon sx={{
            minWidth: 0, mr: 1.5, justifyContent: 'center',
            color: active ? accentColor : 'text.secondary',
            // Phase 3 polish — all nested icons locked at 18 for a
            // consistent lucide-ish scan. Depth-2 used to render 16
            // which read as "disabled".
            '& svg': { fontSize: 18 },
          }}>
            {item.icon}
          </ListItemIcon>
          <ListItemText
            primary={item.text}
            primaryTypographyProps={{
              fontSize: depth === 1 ? 13 : 12.5,
              fontWeight: active ? 600 : 400,
            }}
          />
          {showStar && (
            <Tooltip title={pinned ? 'Unpin from Favorites' : 'Pin to Favorites'}>
              <IconButton
                className="nav-fav-action"
                size="small"
                aria-label={pinned ? `Unpin ${item.text} from Favorites` : `Pin ${item.text} to Favorites`}
                onClick={(e) => handleFavoriteToggle(item.path, item.text, e)}
                sx={{
                  p: 0.25,
                  ml: 0.5,
                  color: pinned ? theme.palette.warning.main : 'text.secondary',
                  '&:hover': {
                    color: pinned ? theme.palette.warning.dark : theme.palette.warning.main,
                    bgcolor: 'transparent',
                  },
                }}
              >
                {pinned
                  ? <StarIcon       sx={{ fontSize: 14 }} />
                  : <StarBorderIcon sx={{ fontSize: 14 }} />}
              </IconButton>
            </Tooltip>
          )}
        </ListItemButton>
      )
    }

    // ── Branch (group with sub-items, depth ≥ 1) ──
    return (
      <Box key={nodeKey}>
        <ListItemButton
          onClick={() => toggleSection(nodeKey)}
          sx={{
            mx: 1,
            my: 0.15,
            ml: indentMl,
            py: depth === 1 ? 1.25 : 1,
            borderRadius: 2,
            minHeight: depth === 1 ? 38 : 34,
            px: 2,
            color: active ? accentColor : 'text.secondary',
            transition: 'background-color 0.15s ease, color 0.15s ease',
            '&:hover': {
              bgcolor: isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(92, 106, 196, 0.06)',
            },
          }}
        >
          <ListItemIcon sx={{
            minWidth: 0, mr: 1.5, justifyContent: 'center',
            color: active ? accentColor : 'text.secondary',
            '& svg': { fontSize: 18 },
          }}>
            {item.icon}
          </ListItemIcon>
          <ListItemText
            primary={item.text}
            primaryTypographyProps={{
              fontSize: depth === 1 ? 13 : 12.5,
              fontWeight: active ? 600 : 500,
            }}
          />
          {openSections[nodeKey]
            ? <ExpandLess sx={{ fontSize: 16, color: 'text.secondary' }} />
            : <ExpandMore sx={{ fontSize: 16, color: 'text.secondary' }} />}
        </ListItemButton>
        <Collapse in={!!openSections[nodeKey]} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {item.items
              .filter(c => !c.tiers || hasTier(...c.tiers))
              .map(c => renderNavItem(c, depth + 1, nodeKey))}
          </List>
        </Collapse>
      </Box>
    )
  }

  // Auto-expand nested branches whose descendants include the active
  // route. The top-level auto-expand already runs via the earlier
  // useEffect; this handles depth-2 sections.
  useEffect(() => {
    const next = {}
    for (const group of navGroups || []) {
      if (!Array.isArray(group.items)) continue
      for (const item of group.items) {
        if (!Array.isArray(item.items)) continue
        const groupKey = `${group.id}::${item.text}`
        const hit = item.items.some(c => c.path && matchesCurrent(c.path))
        if (hit) next[groupKey] = true
      }
    }
    if (Object.keys(next).length > 0) {
      setOpenSections(prev => ({ ...prev, ...next }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, location.search])

  const sidebarContent = (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: expanded || isMobile ? 2 : 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: expanded || isMobile ? 'space-between' : 'center',
          minHeight: 64,
        }}
      >
        {(expanded || isMobile) && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: `linear-gradient(135deg, ${accentColor} 50%, #fff 50%)`,
                border: `3px solid ${isDark ? '#374151' : '#d1d5db'}`,
                position: 'relative',
                flexShrink: 0,
                '&::after': {
                  content: '""',
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#fff',
                  border: `2px solid ${isDark ? '#374151' : '#d1d5db'}`,
                },
              }}
            />
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                letterSpacing: '-0.5px',
                fontSize: '1.1rem',
                color: 'text.primary',
                '& span': { color: accentColor },
              }}
            >
              Pack<span>Hunter</span>
            </Typography>
          </Box>
        )}
        {!isMobile && (
          <IconButton
            onClick={() => {
              const next = !expanded
              setExpanded(next)
              onExpandedChange?.(next)
            }}
            size="small"
            aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
            sx={{
              color: 'text.secondary',
              '&:hover': { color: accentColor },
            }}
          >
            {expanded ? <CollapseIcon /> : <ExpandIcon />}
          </IconButton>
        )}
      </Box>

      <Divider sx={{ borderColor: isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0,0,0,0.06)' }} />

      {/* Navigation */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 1 }}>
        {/*
          2026-04-20 Phase 5 — Quick Access (Recent + Pinned).
          Purely additive. Panel is silent when both lists are empty
          AND silent when sidebar is collapsed to icons (no space for
          labels). Respects Operator Mode via its own internal filter.
        */}
        <QuickAccessPanel
          navGroups={navGroups}
          expanded={expanded}
          isMobile={isMobile}
          onNavigate={isMobile ? onClose : undefined}
        />
        <List component="nav" aria-label="Main navigation" disablePadding>
          {/*
            2026-04-20 Phase 3 UX polish — insert a "SYSTEM" section
            header immediately before the first admin-* group. Uppercase,
            muted, small — gives visual separation between user features
            and system/admin controls without changing structure.
          */}
          {navGroups.map((group, idx) => {
            const groupActive = isGroupActive(group)
            const isFirstAdmin =
              group.id.startsWith('admin-') &&
              (idx === 0 || !navGroups[idx - 1].id.startsWith('admin-'))

            return (
              <Box key={group.id}>
                {isFirstAdmin && (expanded || isMobile) && (
                  <Box sx={{ px: 2.5, pt: 2, pb: 0.75 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: 'text.disabled',
                      }}
                    >
                      System
                    </Typography>
                  </Box>
                )}
                {isFirstAdmin && !expanded && !isMobile && (
                  <Divider sx={{ mx: 1.5, my: 1, borderColor: isDark ? 'rgba(124, 138, 255, 0.06)' : 'rgba(0,0,0,0.05)' }} />
                )}
                {group.path ? (
                  // Direct link item
                  <Tooltip title={!expanded && !isMobile ? group.text : ''} placement="right">
                    <ListItemButton
                      onClick={() => handleNavClick(group.path)}
                      sx={{
                        // 2026-04-20 Phase 3 UX polish — top-level
                        // padding 12px 16px (py: 1.5, px: 2) +
                        // margin 2px so rows don't glue to the edge.
                        mx: 1,
                        my: 0.25,
                        py: 1.5,
                        borderRadius: 2,
                        minHeight: 44,
                        justifyContent: expanded || isMobile ? 'initial' : 'center',
                        px: expanded || isMobile ? 2 : 1.5,
                        position: 'relative',
                        bgcolor: groupActive
                          ? (isDark ? 'rgba(124, 138, 255, 0.12)' : 'rgba(92, 106, 196, 0.08)')
                          : 'transparent',
                        color: groupActive ? accentColor : 'text.secondary',
                        transition: 'background-color 0.15s ease, color 0.15s ease',
                        '&:hover': {
                          bgcolor: isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(92, 106, 196, 0.06)',
                        },
                        // Left accent bar on active items — wider + fuller
                        // height than before so the active state reads
                        // immediately (Phase 3 polish).
                        '&::before': groupActive ? {
                          content: '""',
                          position: 'absolute',
                          left: 0,
                          top: '15%',
                          bottom: '15%',
                          width: 3,
                          borderRadius: '0 4px 4px 0',
                          bgcolor: accentColor,
                        } : {},
                      }}
                    >
                      <ListItemIcon
                        sx={{
                          minWidth: 0,
                          mr: expanded || isMobile ? 1.5 : 0,
                          justifyContent: 'center',
                          color: groupActive ? accentColor : 'text.secondary',
                          // Phase 3: top-level icon size unified at 20
                          // (down from 22) so user + admin tiers feel
                          // tonally consistent without shrinking to 18
                          // which looked fragile at top-level weight.
                          '& svg': { fontSize: 20 },
                        }}
                      >
                        {group.icon}
                      </ListItemIcon>
                      {(expanded || isMobile) && (
                        <ListItemText
                          primary={group.text}
                          primaryTypographyProps={{
                            fontSize: 14,
                            fontWeight: groupActive ? 600 : 500,
                          }}
                        />
                      )}
                    </ListItemButton>
                  </Tooltip>
                ) : (
                  // Group with sub-items
                  <>
                    <Tooltip title={!expanded && !isMobile ? group.text : ''} placement="right">
                      <ListItemButton
                        onClick={() => toggleSection(group.id)}
                        sx={{
                          // Phase 3 polish — mirror the direct-link
                          // padding/transition spec so top-level rows
                          // read uniformly whether they navigate or expand.
                          mx: 1,
                          my: 0.25,
                          py: 1.5,
                          borderRadius: 2,
                          minHeight: 44,
                          justifyContent: expanded || isMobile ? 'initial' : 'center',
                          px: expanded || isMobile ? 2 : 1.5,
                          color: groupActive ? accentColor : 'text.secondary',
                          transition: 'background-color 0.15s ease, color 0.15s ease',
                          '&:hover': {
                            bgcolor: isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(92, 106, 196, 0.06)',
                          },
                        }}
                      >
                        <ListItemIcon
                          sx={{
                            minWidth: 0,
                            mr: expanded || isMobile ? 1.5 : 0,
                            justifyContent: 'center',
                            color: groupActive ? accentColor : 'text.secondary',
                            '& svg': { fontSize: 20 },
                          }}
                        >
                          {group.id === 'hunt' && huntActive ? (
                            <Badge
                              variant="dot"
                              overlap="circular"
                              sx={{ '& .MuiBadge-badge': { bgcolor: theme.palette.success.main, width: 8, height: 8, minWidth: 8, borderRadius: '50%' } }}
                            >
                              {group.icon}
                            </Badge>
                          ) : group.icon}
                        </ListItemIcon>
                        {(expanded || isMobile) && (
                          <>
                            <ListItemText
                              primary={group.text}
                              primaryTypographyProps={{
                                fontSize: 14,
                                fontWeight: groupActive ? 600 : 500,
                              }}
                            />
                            {openSections[group.id] ? (
                              <ExpandLess sx={{ fontSize: 18, color: 'text.secondary' }} />
                            ) : (
                              <ExpandMore sx={{ fontSize: 18, color: 'text.secondary' }} />
                            )}
                          </>
                        )}
                      </ListItemButton>
                    </Tooltip>

                    {(expanded || isMobile) && (
                      <Collapse in={openSections[group.id]} timeout="auto" unmountOnExit>
                        <List component="div" disablePadding>
                          {/*
                            2026-04-20 Phase 2 — children are now rendered
                            via the recursive helper so a child can itself
                            be a group with its own items[] (2-level nesting).
                            Leaf children still render identically to
                            pre-fix behavior.
                          */}
                          {group.items
                            .filter(item => !item.tiers || hasTier(...item.tiers))
                            .map(item => renderNavItem(item, 1, group.id))}
                        </List>
                      </Collapse>
                    )}
                  </>
                )}
              </Box>
            )
          })}
        </List>
      </Box>

      {/* User info at bottom */}
      <Divider sx={{ borderColor: isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0,0,0,0.06)' }} />
      <Box
        sx={{
          p: expanded || isMobile ? 2 : 1,
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          justifyContent: expanded || isMobile ? 'flex-start' : 'center',
        }}
      >
        <Avatar
          sx={{
            width: 32,
            height: 32,
            background: `linear-gradient(135deg, ${accentColor}, ${theme.palette.secondary.light})`,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {user?.username?.charAt(0).toUpperCase()}
        </Avatar>
        {(expanded || isMobile) && (
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {user?.username}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {user?.subscriptionTier || 'free'}
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  )

  // For mobile/tablet: temporary drawer
  if (isMobile) {
    return (
      <>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={onClose}
          aria-label="Main navigation"
          ModalProps={{ keepMounted: true }}
          PaperProps={{
            sx: {
              width: SIDEBAR_WIDTH,
              bgcolor: isDark ? 'rgba(17, 24, 39, 0.95)' : theme.palette.background.paper,
              backdropFilter: 'blur(16px)',
              WebkitBackdropFilter: 'blur(16px)',
              borderRight: isDark ? '1px solid rgba(124, 138, 255, 0.08)' : '1px solid rgba(0,0,0,0.06)',
            },
          }}
        >
          {sidebarContent}
        </Drawer>
        {/* Phase 5.13 — max-cap Snackbar for the Favorites star toggle. */}
        <Snackbar
          open={favSnack.open}
          autoHideDuration={3500}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          onClose={() => setFavSnack({ ...favSnack, open: false })}
        >
          <Alert
            severity={favSnack.severity}
            variant="filled"
            onClose={() => setFavSnack({ ...favSnack, open: false })}
            sx={{ fontWeight: 500 }}
          >
            {favSnack.message}
          </Alert>
        </Snackbar>
      </>
    )
  }

  // For desktop: permanent drawer
  return (
    <>
    <Drawer
      variant="permanent"
      sx={{
        width,
        flexShrink: 0,
        transition: 'width 0.2s ease',
        '& .MuiDrawer-paper': {
          width,
          transition: 'width 0.2s ease',
          overflowX: 'hidden',
          bgcolor: isDark ? 'rgba(17, 24, 39, 0.6)' : 'rgba(255, 255, 255, 0.8)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderRight: isDark ? '1px solid rgba(124, 138, 255, 0.06)' : '1px solid rgba(0,0,0,0.06)',
        },
      }}
    >
      {sidebarContent}
    </Drawer>
    {/* Phase 5.13 — max-cap Snackbar for the Favorites star toggle. */}
    <Snackbar
      open={favSnack.open}
      autoHideDuration={3500}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      onClose={() => setFavSnack({ ...favSnack, open: false })}
    >
      <Alert
        severity={favSnack.severity}
        variant="filled"
        onClose={() => setFavSnack({ ...favSnack, open: false })}
        sx={{ fontWeight: 500 }}
      >
        {favSnack.message}
      </Alert>
    </Snackbar>
    </>
  )
}

export { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED }
export default Sidebar
