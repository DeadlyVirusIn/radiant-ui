/**
 * QuickAccessPanel — 2026-04-20 Phase 5 → Phase 5.13 (Favorites).
 *
 * Renders the "Favorites" section at the top of the sidebar (Phase
 * 5.13). The auto-tracked Recent section is gone — favorites are
 * 100% user-controlled now via star toggles on each nav row.
 *
 * Hidden entirely when:
 *   - the sidebar is collapsed (icon-only mode — no room for labels)
 *   - the user has no pinned routes AND the sidebar is mobile (avoids
 *     wasting vertical space on the drawer)
 *
 * On desktop expanded: when no favorites exist, render an empty-state
 * line "Star pages to add them here." so users discover the affordance.
 *
 * CONSERVATIVE CONTRACT:
 *   - does NOT mutate navGroups
 *   - does NOT reorder / hide existing nav items
 *   - does NOT introduce new routes — every entry is a path the user
 *     explicitly pinned via the star toggle
 *   - Operator Mode aware: Platform paths are hidden at render time
 *     when operatorMode is ON. Storage is not touched.
 *   - Route validation: pinned entries are filtered against navGroups
 *     each render. Stale localStorage entries (renamed/removed routes)
 *     are silently skipped — never crash the panel.
 */

import { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  IconButton,
  Tooltip,
  Divider,
  useTheme,
} from '@mui/material';
import {
  Star as StarIcon,
  Close as UnpinIcon,
  Bookmark as FavoritesIcon,
} from '@mui/icons-material';
import { useQuickAccess } from '../contexts/QuickAccessContext';
import { useOperatorMode } from '../contexts/OperatorModeContext';
import { useThemeMode } from '../contexts/ThemeContext';

// Closed set of admin-platform paths hidden when Operator Mode is ON.
const PLATFORM_PATHS = new Set([
  '/admin/users',
  '/admin/observability',
  '/admin/audit-log',
  '/admin/activity-logs',
]);

/**
 * Walk navGroups recursively + return a Map<path, label> of every
 * route the user is currently authorized to navigate to. Used to:
 *   1. resolve fresh labels for pinned entries (in case the source
 *      navGroups label changed)
 *   2. validate that pinned paths still exist + remain authorized
 *
 * Caller passes the Sidebar's already-tier-filtered navGroups, so
 * any unauthorized routes are inherently absent from this map.
 */
function buildAuthorizedPathMap(navGroups) {
  const m = new Map();
  function walk(items) {
    for (const it of items || []) {
      if (it.path && it.text) m.set(it.path, it.text);
      if (Array.isArray(it.items)) walk(it.items);
    }
  }
  walk(navGroups);
  return m;
}

export default function QuickAccessPanel({ navGroups, expanded, isMobile, onNavigate }) {
  const theme = useTheme();
  const { isDark } = useThemeMode();
  const location = useLocation();
  const navigate = useNavigate();
  const { pinned, unpin } = useQuickAccess();
  const { operatorMode } = useOperatorMode();

  const authorizedPaths = useMemo(() => buildAuthorizedPathMap(navGroups), [navGroups]);

  // Phase 5.13 — filter pinned entries:
  //   1. Drop unauthorized / removed routes (not in authorizedPaths).
  //   2. Drop Operator-Mode-hidden Platform paths.
  //   3. Refresh label from authorizedPaths (so renamed routes
  //      surface the new name without requiring re-pin).
  const visiblePinned = pinned
    .filter(e => authorizedPaths.has(e.path))
    .filter(e => !(operatorMode && PLATFORM_PATHS.has(e.path)))
    .map(e => ({
      ...e,
      label: authorizedPaths.get(e.path) || e.label,
    }));

  // Hide entirely when the sidebar is collapsed to icons.
  if (!expanded && !isMobile) return null;

  // Hide on mobile when empty (drawer real estate is precious; users
  // can still pin from the desktop sidebar).
  if (isMobile && visiblePinned.length === 0) return null;

  const handleClick = (path) => {
    navigate(path);
    if (typeof onNavigate === 'function') onNavigate();
  };

  const rowStyles = (active) => ({
    mx: 1,
    my: 0.1,
    borderRadius: 2,
    minHeight: 32,
    px: 2,
    ml: 2,
    position: 'relative',
    bgcolor: active
      ? (isDark ? 'rgba(124, 138, 255, 0.12)' : 'rgba(92, 106, 196, 0.08)')
      : 'transparent',
    color: active ? theme.palette.primary.main : 'text.secondary',
    transition: 'background-color 0.15s ease, color 0.15s ease',
    '&:hover': {
      bgcolor: isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(92, 106, 196, 0.06)',
      '.qa-action': { opacity: 1 },
    },
    '& .qa-action': { opacity: 0.3, transition: 'opacity 0.15s ease' },
  });

  return (
    <Box sx={{ pt: 0.5, pb: 0.75 }}>
      {/* Section header — Phase 5.13 renames "Quick Access" → "Favorites" */}
      <Box sx={{ px: 2.5, pt: 0.5, pb: 0.5, display: 'flex', alignItems: 'center', gap: 0.75 }}>
        <FavoritesIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
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
          Favorites
        </Typography>
      </Box>

      {visiblePinned.length > 0 ? (
        <List component="div" disablePadding dense>
          {visiblePinned.map(item => (
            <ListItemButton
              key={`pin-${item.path}`}
              onClick={() => handleClick(item.path)}
              sx={rowStyles(location.pathname === item.path)}
            >
              <StarIcon sx={{ fontSize: 14, color: theme.palette.warning.main, mr: 1, flexShrink: 0 }} />
              <ListItemText
                primary={item.label || item.path}
                primaryTypographyProps={{
                  fontSize: 12.5,
                  fontWeight: location.pathname === item.path ? 600 : 400,
                  noWrap: true,
                }}
              />
              <Tooltip title="Unpin">
                <IconButton
                  className="qa-action"
                  size="small"
                  aria-label={`Unpin ${item.label || item.path}`}
                  onClick={(e) => { e.stopPropagation(); unpin(item.path); }}
                  sx={{ p: 0.25, ml: 0.5 }}
                >
                  <UnpinIcon sx={{ fontSize: 14 }} />
                </IconButton>
              </Tooltip>
            </ListItemButton>
          ))}
        </List>
      ) : (
        // Phase 5.13 — empty state. Tells the user how to populate the
        // section without auto-populating from history.
        <Box sx={{ px: 3, py: 1 }}>
          <Typography variant="caption" sx={{ color: 'text.disabled', fontStyle: 'italic', lineHeight: 1.5 }}>
            Star pages to add them here.
          </Typography>
        </Box>
      )}

      <Divider sx={{ mt: 1, mx: 1.5, borderColor: isDark ? 'rgba(124, 138, 255, 0.06)' : 'rgba(0,0,0,0.05)' }} />
    </Box>
  );
}
