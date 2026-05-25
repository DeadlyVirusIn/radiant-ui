/**
 * CommandPalette - Quick navigation and search (Cmd+K / Ctrl+K)
 *
 * Usage:
 *   <CommandPalette />
 *
 * Features:
 * - Quick navigation to any page
 * - Search across pages and actions
 * - Keyboard navigation (arrows, enter, escape)
 * - Recent searches
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Dialog,
  DialogContent,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Chip,
  InputAdornment,
  Divider,
} from '@mui/material'
import {
  Search as SearchIcon,
  Home as HomeIcon,
  Link as LinkIcon,
  SmartToy as BotIcon,
  CatchingPokemon as PokeballIcon,
  Style as StyleIcon,
  CardGiftcard as PackIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
  Analytics as AnalyticsIcon,
  SportsEsports as BattleIcon,
  Inventory as InventoryIcon,
  Schedule as ScheduleIcon,
  AutoAwesome as WonderIcon,
  LocalFireDepartment as StaminaIcon,
  ShoppingCart as ShopIcon,
  Leaderboard as LeaderboardIcon,
  EmojiEvents as AchievementIcon,
  Event as EventIcon,
  BarChart as StatsIcon,
  TrendingUp as TrendingIcon,
  History as HistoryIcon,
  Keyboard as KeyboardIcon,
} from '@mui/icons-material'
import { motion, AnimatePresence } from 'framer-motion'

// Navigation items with icons
const navigationItems = [
  { path: '/', label: 'Dashboard', icon: HomeIcon, keywords: ['home', 'main', 'overview'] },
  { path: '/hunt', label: 'Hunt Monitor', icon: PokeballIcon, keywords: ['god pack', 'hunting', 'monitor'] },
  { path: '/godpacks', label: 'God Pack Gallery', icon: StyleIcon, keywords: ['gallery', 'collection', 'god'] },
  { path: '/cards', label: 'Cards', icon: StyleIcon, keywords: ['collection', 'deck'] },
  { path: '/tracker', label: 'Card Tracker', icon: InventoryIcon, keywords: ['track', 'inventory'] },
  { path: '/analytics', label: 'Account Analytics', icon: AnalyticsIcon, keywords: ['stats', 'data'] },
  { path: '/battles', label: 'Battle History', icon: BattleIcon, keywords: ['pvp', 'fight'] },
  { path: '/solo-battle', label: 'Solo Battle', icon: BattleIcon, keywords: ['pve', 'single'] },
  { path: '/event-battle', label: 'Event Battle', icon: EventIcon, keywords: ['special', 'limited'] },
  { path: '/open-pack', label: 'Open Pack', icon: PackIcon, keywords: ['pack', 'open', 'booster'] },
  { path: '/wonder-pick', label: 'Wonder Pick', icon: WonderIcon, keywords: ['random', 'pick'] },
  { path: '/pack-sim', label: 'Pack Simulator', icon: PackIcon, keywords: ['simulate', 'test'] },
  { path: '/friends', label: 'Friends', icon: PeopleIcon, keywords: ['social', 'trade'] },
  { path: '/auto-gift', label: 'Auto Gift', icon: PackIcon, keywords: ['gift', 'automatic'] },
  { path: '/accounts', label: 'Link Accounts', icon: LinkIcon, keywords: ['add', 'connect'] },
  { path: '/bot', label: 'Bot Control', icon: BotIcon, keywords: ['automation', 'run'] },
  { path: '/missions', label: 'Missions', icon: AchievementIcon, keywords: ['daily', 'weekly', 'task'] },
  { path: '/presents', label: 'Present Box', icon: PackIcon, keywords: ['gift', 'reward'] },
  { path: '/scheduler', label: 'Automation Scheduler', icon: ScheduleIcon, keywords: ['schedule', 'auto'] },
  { path: '/stamina', label: 'Stamina Dashboard', icon: StaminaIcon, keywords: ['energy', 'refill'] },
  { path: '/shop', label: 'Item Shop', icon: ShopIcon, keywords: ['buy', 'purchase', 'store'] },
  { path: '/pvp', label: 'PvP Rankings', icon: LeaderboardIcon, keywords: ['rank', 'ladder'] },
  { path: '/achievements', label: 'Achievements', icon: AchievementIcon, keywords: ['trophy', 'reward'] },
  { path: '/events', label: 'Events', icon: EventIcon, keywords: ['special', 'limited'] },
  { path: '/resources', label: 'Resource Dashboard', icon: StatsIcon, keywords: ['coins', 'gems'] },
  { path: '/battle-stats', label: 'Battle Stats', icon: StatsIcon, keywords: ['statistics', 'win rate'] },
  { path: '/trade-analytics', label: 'Trade Analytics', icon: TrendingIcon, keywords: ['trade', 'exchange'] },
  { path: '/settings', label: 'Settings', icon: SettingsIcon, keywords: ['config', 'preferences'] },
  { path: '/profile', label: 'Profile', icon: PeopleIcon, keywords: ['user', 'account'] },
]

// Recent searches storage key
const RECENT_KEY = 'command-palette-recent'
const MAX_RECENT = 5

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recent, setRecent] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    } catch {
      return []
    }
  })
  const inputRef = useRef(null)
  const navigate = useNavigate()

  // Filter items based on query
  const filteredItems = useMemo(() => {
    if (!query.trim()) {
      // Show recent items first, then popular pages
      const recentPaths = recent.map(r => r.path)
      const recentItems = recent.map(r => navigationItems.find(n => n.path === r.path)).filter(Boolean)
      const otherItems = navigationItems.filter(n => !recentPaths.includes(n.path)).slice(0, 6)
      return { recent: recentItems, results: otherItems }
    }

    const lowerQuery = query.toLowerCase()
    const results = navigationItems.filter(item => {
      const labelMatch = item.label.toLowerCase().includes(lowerQuery)
      const keywordMatch = item.keywords.some(k => k.includes(lowerQuery))
      return labelMatch || keywordMatch
    })

    return { recent: [], results }
  }, [query, recent])

  const allItems = [...filteredItems.recent, ...filteredItems.results]

  // Keyboard shortcut to open
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd+K (Mac) or Ctrl+K (Windows)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(true)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Focus input when dialog opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    } else {
      setQuery('')
      setSelectedIndex(0)
    }
  }, [open])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => Math.min(prev + 1, allItems.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => Math.max(prev - 1, 0))
        break
      case 'Home':
        e.preventDefault()
        setSelectedIndex(0)
        break
      case 'End':
        e.preventDefault()
        setSelectedIndex(Math.max(allItems.length - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (allItems[selectedIndex]) {
          handleSelect(allItems[selectedIndex])
        }
        break
      case 'Escape':
        setOpen(false)
        break
    }
  }, [allItems, selectedIndex])

  // Handle item selection
  const handleSelect = useCallback((item) => {
    // Add to recent
    const newRecent = [
      { path: item.path, label: item.label },
      ...recent.filter(r => r.path !== item.path)
    ].slice(0, MAX_RECENT)
    setRecent(newRecent)
    localStorage.setItem(RECENT_KEY, JSON.stringify(newRecent))

    // Navigate and close
    navigate(item.path)
    setOpen(false)
  }, [navigate, recent])

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      maxWidth="sm"
      fullWidth
      aria-label="Command palette"
      PaperProps={{
        sx: {
          position: 'fixed',
          top: '20%',
          borderRadius: 2,
          maxHeight: '60vh',
        },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        <TextField
          inputRef={inputRef}
          fullWidth
          placeholder="Search pages... (type to filter)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          role="combobox"
          aria-label="Search pages"
          aria-expanded={allItems.length > 0}
          aria-controls="command-palette-listbox"
          aria-activedescendant={allItems[selectedIndex] ? `cmd-item-${selectedIndex}` : undefined}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <Chip
                  size="small"
                  label="ESC"
                  sx={{ fontSize: '0.7rem', height: 20 }}
                />
              </InputAdornment>
            ),
            sx: {
              '& fieldset': { border: 'none' },
              borderBottom: '1px solid',
              borderColor: 'divider',
              borderRadius: 0,
            },
          }}
          sx={{ '& .MuiInputBase-root': { py: 1.5, px: 2 } }}
        />

        <List id="command-palette-listbox" role="listbox" aria-label="Search results" sx={{ py: 1, maxHeight: 400, overflow: 'auto' }}>
          {filteredItems.recent.length > 0 && (
            <>
              <ListItem sx={{ py: 0.5, px: 2 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <HistoryIcon sx={{ fontSize: 14 }} /> Recent
                </Typography>
              </ListItem>
              {filteredItems.recent.map((item, index) => (
                <CommandItem
                  key={item.path}
                  id={`cmd-item-${index}`}
                  item={item}
                  selected={index === selectedIndex}
                  onClick={() => handleSelect(item)}
                />
              ))}
              <Divider sx={{ my: 1 }} />
            </>
          )}

          {filteredItems.results.length > 0 ? (
            <>
              {!query && filteredItems.recent.length > 0 && (
                <ListItem sx={{ py: 0.5, px: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    All Pages
                  </Typography>
                </ListItem>
              )}
              {filteredItems.results.map((item, index) => (
                <CommandItem
                  key={item.path}
                  id={`cmd-item-${index + filteredItems.recent.length}`}
                  item={item}
                  selected={index + filteredItems.recent.length === selectedIndex}
                  onClick={() => handleSelect(item)}
                />
              ))}
            </>
          ) : query && (
            <ListItem sx={{ justifyContent: 'center', py: 4 }}>
              <Typography color="text.secondary">
                No results for "{query}"
              </Typography>
            </ListItem>
          )}
        </List>

        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            px: 2,
            py: 1,
            borderTop: '1px solid',
            borderColor: 'divider',
            bgcolor: 'action.hover',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <KeyboardIcon sx={{ fontSize: 14 }} /> Navigate
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Enter to select
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            Ctrl+K to open
          </Typography>
        </Box>
      </DialogContent>
    </Dialog>
  )
}

// Individual command item
function CommandItem({ item, selected, onClick, id }) {
  const Icon = item.icon

  return (
    <ListItem disablePadding id={id} role="option" aria-selected={selected}>
      <ListItemButton
        selected={selected}
        onClick={onClick}
        sx={{
          py: 1,
          px: 2,
          '&.Mui-selected': {
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            '& .MuiListItemIcon-root': {
              color: 'primary.contrastText',
            },
            '&:hover': {
              bgcolor: 'primary.dark',
            },
          },
        }}
      >
        <ListItemIcon sx={{ minWidth: 36 }}>
          <Icon fontSize="small" />
        </ListItemIcon>
        <ListItemText
          primary={item.label}
          primaryTypographyProps={{ fontSize: '0.9rem' }}
        />
        <Typography variant="caption" color="text.secondary" sx={{ opacity: selected ? 0.8 : 0.6 }}>
          {item.path}
        </Typography>
      </ListItemButton>
    </ListItem>
  )
}

export default CommandPalette
