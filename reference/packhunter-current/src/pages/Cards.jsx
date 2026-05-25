import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useThemeMode } from '../contexts/ThemeContext'
import {
  Box,
  Typography,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Pagination,
  InputAdornment,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  LinearProgress,
  useTheme,
} from '@mui/material'
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  GridView as GridViewIcon,
  ViewList as ListViewIcon,
  CatchingPokemon as PokeballIcon,
  Star as StarIcon,
  Close as CloseIcon,
  Translate as TranslateIcon,
  Style as CardDatabaseIcon,
  VisibilityOff as MissingIcon,
} from '@mui/icons-material'
import { cards as cardsApi } from '../services/api'
import { useLocalizedCards, getCardDisplayName } from '../hooks/useLocalizedCards'
import { useLukeFzLocale } from '../hooks/useLukeFzLocale' // May 1 2026 — LukeFZ tail-fallback localization
import { useLanguage } from '../contexts/LanguageContext'
import { RARITY_COLORS, SET_NAMES, getSetDisplayName } from '../constants/gameData'
import { getRarityChipTextColor } from '../constants/rarityConfig'
import GlassCard from '../components/GlassCard'
import PageHeader from '../components/PageHeader'
import StickyToolbar from '../components/StickyToolbar'
import { EmptyState } from '../components/EmptyState'
import { CardGridSkeleton } from '../components/LoadingSkeleton'
import { FadeIn, StaggerContainer, StaggerItem } from '../components/Animations'

// Rarity glow colors for card borders/box-shadows
const RARITY_GLOW = {
  'C': 'none',
  'U': '0 0 12px rgba(192, 192, 192, 0.3)',
  'R': '0 0 14px rgba(255, 215, 0, 0.35)',
  'RR': '0 0 16px rgba(255, 215, 0, 0.4)',
  'AR': '0 0 16px rgba(168, 85, 247, 0.4)',
  'SR': '0 0 18px rgba(255, 215, 0, 0.5)',
  'SAR': '0 0 18px rgba(244, 67, 54, 0.5)',
  'IM': '0 0 20px rgba(168, 85, 247, 0.5)',
  'UR': '0 0 22px rgba(255, 215, 0, 0.6)',
  'S': '0 0 16px rgba(192, 192, 192, 0.4)',
  'SSR': '0 0 20px rgba(192, 192, 192, 0.5)',
  'P': 'none',
}

const RARITY_GLOW_HOVER = {
  'C': 'none',
  'U': '0 0 20px rgba(192, 192, 192, 0.5)',
  'R': '0 0 24px rgba(255, 215, 0, 0.5)',
  'RR': '0 0 26px rgba(255, 215, 0, 0.6)',
  'AR': '0 0 26px rgba(168, 85, 247, 0.6)',
  'SR': '0 0 28px rgba(255, 215, 0, 0.7)',
  'SAR': '0 0 28px rgba(244, 67, 54, 0.7)',
  'IM': '0 0 30px rgba(168, 85, 247, 0.7)',
  'UR': '0 0 32px rgba(255, 215, 0, 0.8)',
  'S': '0 0 24px rgba(192, 192, 192, 0.6)',
  'SSR': '0 0 28px rgba(192, 192, 192, 0.7)',
  'P': 'none',
}

// Rarity icon CDN URL
const RARITY_ICON_CDN = 'https://raw.githubusercontent.com/flibustier/pokemon-tcg-pocket-database/main/dist/images/rarities/'

// Rarity icon configuration: { image, count, label }
const RARITY_ICONS = {
  'C': { image: 'diamond.webp', count: 1, label: 'Common' },
  'U': { image: 'diamond.webp', count: 2, label: 'Uncommon' },
  'R': { image: 'diamond.webp', count: 3, label: 'Rare' },
  'RR': { image: 'diamond.webp', count: 4, label: 'Double Rare' },
  'AR': { image: 'star.webp', count: 1, label: 'Art Rare' },
  'SR': { image: 'star.webp', count: 2, label: 'Super Rare' },
  'SAR': { image: 'star.webp', count: 2, label: 'Special Art', special: true },
  'IM': { image: 'star.webp', count: 3, label: 'Immersive Rare' },
  'UR': { image: 'crown.webp', count: 1, label: 'Crown Rare' },
  'S': { image: 'shiny-star.webp', count: 1, label: 'Shiny' },
  'SSR': { image: 'shiny-star.webp', count: 2, label: 'Shiny Super Rare' },
  'P': { image: null, count: 0, label: 'Promo' },
}

// Rarity icon component
const RarityIcon = ({ rarityCode, size = 16, showLabel = false }) => {
  const config = RARITY_ICONS[rarityCode]
  if (!config || !config.image) {
    return <span>{config?.label || rarityCode}</span>
  }

  const icons = []
  for (let i = 0; i < config.count; i++) {
    icons.push(
      <img
        key={i}
        src={`${RARITY_ICON_CDN}${config.image}`}
        alt=""
        style={{
          width: size,
          height: size,
          marginRight: i < config.count - 1 ? 2 : 0,
          verticalAlign: 'middle',
          filter: config.special ? 'hue-rotate(30deg) saturate(1.5)' : undefined
        }}
      />
    )
  }

  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
      {icons}
      {showLabel && <span style={{ marginLeft: 4 }}>{config.label}</span>}
    </Box>
  )
}

// Rarity display names (text fallback)
const RARITY_DISPLAY = {
  'C': 'Common',
  'U': 'Uncommon',
  'R': 'Rare',
  'RR': 'Double Rare',
  'AR': 'Art Rare',
  'SR': 'Super Rare',
  'SAR': 'Special Art Rare',
  'IM': 'Immersive Rare',
  'UR': 'Crown Rare',
  'S': 'Shiny',
  'SSR': 'Shiny Super Rare',
  'P': 'Promo',
}

// Rarity sort order (for dropdown) - BEST to WORST - based on actual database values
const RARITY_SORT_ORDER = [
  'UR',                // Crown Rare - BEST
  'IM',                // Immersive Rare (★★★)
  'SSR',               // Shiny Super Rare (✧✧)
  'S',                 // Shiny (✧)
  'SR',                // Super Rare (★★)
  'SAR',               // Special Art Rare (★★)
  'AR',                // Art Rare (★)
  'RR',                // Double Rare (◇◇◇◇)
  'R',                 // Rare (◇◇◇)
  'U',                 // Uncommon (◇◇)
  'C',                 // Common (◇) - WORST
  'P',                 // Promo
]

// Helper to sort rarities
const sortRarities = (rarities) => {
  return [...rarities].sort((a, b) => {
    const indexA = RARITY_SORT_ORDER.indexOf(a.rarity_code)
    const indexB = RARITY_SORT_ORDER.indexOf(b.rarity_code)
    // If not found in sort order, put at end
    const orderA = indexA === -1 ? 999 : indexA
    const orderB = indexB === -1 ? 999 : indexB
    return orderA - orderB
  })
}

function Cards() {
  const theme = useTheme()
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [sets, setSets] = useState([])
  const [rarities, setRarities] = useState([])
  const { language, t } = useLanguage()
  const { isDark } = useThemeMode()

  // Use localized cards hook for multi-language card names
  const { localizedCards, isTranslating, error: translationError } = useLocalizedCards(cards, {
    enabled: language !== 'en', // Only translate if not English
    translateOnLoad: true,
  })

  // May 1 2026 — LukeFZ-backed localization (display-only, additive).
  // Decorates cards with `lukefzLocalizedName` as a tail fallback. When locale
  // is 'en' / unset, hook returns input array unchanged (default preserved).
  const lukefzCards = useLukeFzLocale(
    language !== 'en' && localizedCards.length > 0 ? localizedCards : cards,
    language
  )

  // Use localized cards if available, otherwise use original. LukeFZ decorations
  // are surfaced via `lukefzLocalizedName` for components that want a tail
  // fallback when TCGdex returned canonical (e.g., new cards not yet on TCGdex).
  const displayCards = language !== 'en' && lukefzCards.length > 0 ? lukefzCards : cards

  // Collection stats: { set_code: { total, owned }, _all: { total, owned } }
  const [collectionStats, setCollectionStats] = useState({})

  // Load persisted filters from localStorage
  const getPersistedFilters = () => {
    try {
      const saved = localStorage.getItem('cardsPageFilters')
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  }
  const persistedFilters = getPersistedFilters()

  // Filters (with localStorage persistence)
  const [search, setSearch] = useState(persistedFilters.search || '')
  const [selectedSet, setSelectedSet] = useState(persistedFilters.selectedSet || '')
  const [selectedRarity, setSelectedRarity] = useState(persistedFilters.selectedRarity || '')
  const [selectedType, setSelectedType] = useState(persistedFilters.selectedType || 'all')
  const [showMissingOnly, setShowMissingOnly] = useState(persistedFilters.showMissingOnly || false)

  // Pagination
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // View mode (with localStorage persistence)
  const [viewMode, setViewMode] = useState(persistedFilters.viewMode || 'grid')

  // Persist filters to localStorage when they change
  useEffect(() => {
    const filters = { search, selectedSet, selectedRarity, selectedType, viewMode, showMissingOnly }
    localStorage.setItem('cardsPageFilters', JSON.stringify(filters))
  }, [search, selectedSet, selectedRarity, selectedType, viewMode, showMissingOnly])

  // Card detail dialog
  const [selectedCard, setSelectedCard] = useState(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  // Search debounce
  const [searchTimeout, setSearchTimeout] = useState(null)

  // Compute collection completion for the current set filter (or all)
  const collectionCompletion = useMemo(() => {
    if (Object.keys(collectionStats).length === 0) return null
    const key = selectedSet || '_all'
    const stat = collectionStats[key]
    if (!stat || stat.total === 0) return null
    const percentage = Math.round((stat.owned / stat.total) * 100)
    return { owned: stat.owned, total: stat.total, percentage }
  }, [selectedSet, collectionStats])

  // Load sets, rarities, and collection stats on mount
  useEffect(() => {
    const loadFilters = async () => {
      try {
        const [setsData, raritiesData, statsData] = await Promise.all([
          cardsApi.getSets(),
          cardsApi.getRarities(),
          cardsApi.getCollectionStats(),
        ])
        setSets(setsData.sets || [])
        setRarities(raritiesData.rarities || [])
        setCollectionStats(statsData.stats || {})
      } catch (error) {
        console.error('Failed to load filters:', error)
      }
    }
    loadFilters()
  }, [])

  // Load cards when filters change
  const loadCards = useCallback(async () => {
    setLoading(true)
    try {
      const data = await cardsApi.list({
        page,
        limit: 50,
        set: selectedSet || undefined,
        rarity: selectedRarity || undefined,
        search: search || undefined,
        type: selectedType !== 'all' ? selectedType : undefined,
        missing: showMissingOnly || undefined,
      })
      setCards(data.cards || [])
      setTotalPages(data.pagination?.totalPages || 1)
      setTotal(data.pagination?.total || 0)
    } catch (error) {
      console.error('Failed to load cards:', error)
    } finally {
      setLoading(false)
    }
  }, [page, selectedSet, selectedRarity, search, selectedType, showMissingOnly])

  useEffect(() => {
    loadCards()
  }, [loadCards])

  // Debounced search
  const handleSearchChange = (value) => {
    setSearch(value)
    if (searchTimeout) clearTimeout(searchTimeout)
    setSearchTimeout(
      setTimeout(() => {
        setPage(1)
      }, 300)
    )
  }

  // Handle filter changes
  const handleFilterChange = (setter) => (event) => {
    setter(event.target.value)
    setPage(1)
  }

  // Card click handler
  const handleCardClick = (card) => {
    setSelectedCard(card)
    setDialogOpen(true)
  }

  // Rarity chip with icons and friendly name
  const RarityChip = ({ rarity }) => {
    const displayName = RARITY_DISPLAY[rarity] || 'Common'
    return (
      <Chip
        label={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <RarityIcon rarityCode={rarity} size={12} />
            <span>{displayName}</span>
          </Box>
        }
        size="small"
        sx={{
          backgroundColor: RARITY_COLORS[rarity] || '#666',
          color: getRarityChipTextColor(rarity),
          fontWeight: 600,
          fontSize: '0.65rem',
          height: 20,
          '& .MuiChip-label': { px: 0.75, display: 'flex', alignItems: 'center' },
        }}
      />
    )
  }

  return (
    <FadeIn duration={0.4}>
    <Box>
      {/* ── Collection Progress Hero ───────────────────────────────── */}
      <PageHeader
        icon={<CardDatabaseIcon />}
        title={t('cards.database')}
        subtitle={`${total.toLocaleString()} cards in database`}
        chips={[
          ...(collectionCompletion ? [
            { label: `${collectionCompletion.owned} owned`, color: theme.palette.success.main },
            { label: `${collectionCompletion.total - collectionCompletion.owned} missing`, color: theme.palette.error.main },
            { label: `${collectionCompletion.percentage}%`, color: collectionCompletion.percentage >= 80 ? theme.palette.success.main : collectionCompletion.percentage >= 50 ? theme.palette.warning.main : theme.palette.primary.main },
          ] : []),
          ...(language !== 'en' ? [{
            label: isTranslating ? t('cards.translating') : t('common.translated'),
            color: isTranslating ? theme.palette.warning.main : theme.palette.success.main,
          }] : []),
        ]}
      >
        <GlassCard noPadding sx={{ mt: 2 }}>
          <Box sx={{ px: 2.5, py: 2.5 }}>
            {collectionCompletion ? (
              <>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', mb: 1.5 }}>
                  <Box>
                    <Typography variant="overline" sx={{ color: 'text.secondary', lineHeight: 1.2 }}>
                      {selectedSet
                        ? `${getSetDisplayName({ set_code: selectedSet, set_name: sets.find(s => s.set_code === selectedSet)?.set_name })} Collection`
                        : 'Overall Collection'
                      }
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ color: 'text.secondary', mt: 0.25 }}
                    >
                      {collectionCompletion.owned} of {collectionCompletion.total} cards collected
                    </Typography>
                  </Box>
                  <Typography
                    variant="h3"
                    sx={{
                      fontWeight: 800,
                      lineHeight: 1,
                      letterSpacing: '-0.02em',
                      color: collectionCompletion.percentage >= 80
                        ? theme.palette.success.main
                        : collectionCompletion.percentage >= 50
                          ? theme.palette.warning.main
                          : theme.palette.primary.main,
                    }}
                  >
                    {collectionCompletion.percentage}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={collectionCompletion.percentage}
                  sx={{
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    '& .MuiLinearProgress-bar': {
                      borderRadius: 5,
                      background: collectionCompletion.percentage >= 80
                        ? `linear-gradient(90deg, ${theme.palette.success.main}, ${theme.palette.success.light})`
                        : collectionCompletion.percentage >= 50
                          ? `linear-gradient(90deg, ${theme.palette.warning.main}, ${theme.palette.warning.light})`
                          : `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.primary.light})`,
                    },
                  }}
                />
              </>
            ) : (
              <>
                <Typography variant="overline" sx={{ color: 'text.secondary', mb: 1, display: 'block' }}>
                  Collection Progress
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={0}
                  sx={{ height: 10, borderRadius: 5 }}
                />
              </>
            )}
            {isTranslating && (
              <LinearProgress sx={{ mt: 1, borderRadius: 1 }} />
            )}
          </Box>
        </GlassCard>
      </PageHeader>

      {/* ── Sticky Filter Bar ──────────────────────────────────────── */}
      <StickyToolbar sx={{ mb: 2.5, px: 2, py: 1.5, gap: { xs: 1, md: 1.5 }, flexWrap: 'wrap' }}>
        {/* ─ Group 1: Search ─ */}
        <TextField
          size="small"
          placeholder={t('cards.searchPlaceholder')}
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          sx={{ flex: '1 1 200px', minWidth: 140 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" sx={{ fontSize: 18 }} />
              </InputAdornment>
            ),
            endAdornment: search && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={() => { setSearch(''); setPage(1); }} aria-label="Clear search">
                  <ClearIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />

        {/* Set Filter */}
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>{t('cards.set')}</InputLabel>
          <Select
            value={selectedSet}
            label={t('cards.set')}
            onChange={handleFilterChange(setSelectedSet)}
          >
            <MenuItem value="">{t('cards.allSets')}</MenuItem>
            {sets.map((set) => (
              <MenuItem key={set.set_code} value={set.set_code}>
                {getSetDisplayName(set)}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* ─ Separator ─ */}
        <Box sx={{ width: '1px', height: 24, bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', flexShrink: 0, display: { xs: 'none', md: 'block' } }} />

        {/* ─ Group 2: Rarity ─ */}
        <Box sx={{ display: 'flex', gap: 0.5, overflowX: 'auto', flexShrink: 0, '&::-webkit-scrollbar': { height: 0 } }}>
          <Chip
            label="All"
            size="small"
            onClick={() => { setSelectedRarity(''); setPage(1); }}
            sx={{
              cursor: 'pointer',
              fontWeight: !selectedRarity ? 700 : 600,
              fontSize: '0.65rem',
              height: 24,
              bgcolor: !selectedRarity ? theme.palette.primary.main : 'transparent',
              color: !selectedRarity ? 'white' : 'text.secondary',
              border: `1.5px solid ${!selectedRarity ? theme.palette.primary.main : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
              boxShadow: !selectedRarity ? `0 2px 8px ${theme.palette.primary.main}40` : 'none',
              transition: 'all 0.15s ease',
              '&:hover': {
                bgcolor: !selectedRarity ? theme.palette.primary.dark : `${theme.palette.primary.main}12`,
                transform: 'scale(1.05)',
              },
            }}
          />
          {sortRarities(rarities).map((r) => {
            const isActive = selectedRarity === r.rarity_code
            const rarColor = RARITY_COLORS[r.rarity_code] || theme.palette.primary.main
            return (
              <Chip
                key={r.rarity_code}
                label={<RarityIcon rarityCode={r.rarity_code} size={12} showLabel />}
                size="small"
                onClick={() => { setSelectedRarity(r.rarity_code === selectedRarity ? '' : r.rarity_code); setPage(1); }}
                sx={{
                  cursor: 'pointer',
                  fontWeight: isActive ? 700 : 600,
                  fontSize: '0.65rem',
                  height: 24,
                  bgcolor: isActive ? rarColor : 'transparent',
                  color: isActive ? getRarityChipTextColor(r.rarity_code) : 'text.secondary',
                  border: `1.5px solid ${isActive ? rarColor : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
                  boxShadow: isActive ? `0 2px 8px ${rarColor}40` : 'none',
                  whiteSpace: 'nowrap',
                  transition: 'all 0.15s ease',
                  '& img': {
                    filter: isActive ? 'brightness(2)' : 'none',
                  },
                  '&:hover': {
                    bgcolor: isActive ? rarColor : `${rarColor}15`,
                    transform: 'scale(1.05)',
                  },
                }}
              />
            )
          })}
        </Box>

        {/* ─ Separator ─ */}
        <Box sx={{ width: '1px', height: 24, bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', flexShrink: 0, display: { xs: 'none', md: 'block' } }} />

        {/* ─ Group 3: Display Options ─ */}
        <Chip
          icon={<MissingIcon sx={{ fontSize: 16, color: showMissingOnly ? 'white !important' : 'inherit' }} />}
          label="Missing Only"
          size="small"
          onClick={() => { setShowMissingOnly(!showMissingOnly); setPage(1); }}
          sx={{
            cursor: 'pointer',
            fontWeight: 700,
            fontSize: '0.7rem',
            height: 28,
            flexShrink: 0,
            bgcolor: showMissingOnly ? theme.palette.error.main : 'transparent',
            color: showMissingOnly ? 'white' : 'text.secondary',
            border: `1.5px solid ${showMissingOnly ? theme.palette.error.main : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
            boxShadow: showMissingOnly ? `0 2px 8px ${theme.palette.error.main}40` : 'none',
            '& .MuiChip-icon': {
              color: showMissingOnly ? 'white' : 'inherit',
            },
            transition: 'all 0.2s ease',
            '&:hover': {
              bgcolor: showMissingOnly ? theme.palette.error.dark : `${theme.palette.error.main}12`,
              transform: 'scale(1.03)',
            },
          }}
        />

        {/* Type Filter */}
        <FormControl size="small" sx={{ minWidth: 100 }}>
          <InputLabel>{t('cards.type')}</InputLabel>
          <Select
            value={selectedType}
            label={t('cards.type')}
            onChange={handleFilterChange(setSelectedType)}
          >
            <MenuItem value="all">{t('cards.allTypes')}</MenuItem>
            <MenuItem value="pokemon">{t('cards.pokemon')}</MenuItem>
            <MenuItem value="trainer">{t('cards.trainer')}</MenuItem>
            <MenuItem value="item">{t('cards.item')}</MenuItem>
          </Select>
        </FormControl>

        {/* View Toggle */}
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(e, val) => val && setViewMode(val)}
          size="small"
        >
          <ToggleButton value="grid" aria-label="Grid view">
            <GridViewIcon sx={{ fontSize: 18 }} />
          </ToggleButton>
          <ToggleButton value="list" aria-label="List view">
            <ListViewIcon sx={{ fontSize: 18 }} />
          </ToggleButton>
        </ToggleButtonGroup>
      </StickyToolbar>

      {/* Cards Grid */}
      {loading ? (
        <CardGridSkeleton count={18} />
      ) : displayCards.length === 0 ? (
        <EmptyState
          icon={<PokeballIcon sx={{ fontSize: 64 }} />}
          title={t('cards.noCardsFound')}
          description={t('cards.adjustFilters')}
        />
      ) : viewMode === 'grid' ? (
        <StaggerContainer staggerDelay={0.03}>
          <Grid container spacing={1}>
            {displayCards.map((card) => {
              const glow = RARITY_GLOW[card.rarity_code] || 'none'
              const glowHover = RARITY_GLOW_HOVER[card.rarity_code] || glow
              const isCrown = card.rarity_code === 'UR'
              return (
                <Grid item xs={4} sm={3} md={2} lg={2} xl={1.5} key={card.backend_id}>
                  <StaggerItem>
                    <motion.div
                      whileHover={{ y: -4, scale: 1.02 }}
                      transition={{ duration: 0.2 }}
                    >
                      <Box
                        onClick={() => handleCardClick(card)}
                        sx={{
                          cursor: 'pointer',
                          position: 'relative',
                          // Crown Rare shimmer animation
                          ...(isCrown && {
                            '@keyframes crownShimmer': {
                              '0%, 100%': { boxShadow: '0 0 16px rgba(255, 215, 0, 0.4)' },
                              '50%': { boxShadow: '0 0 28px rgba(255, 215, 0, 0.7)' },
                            },
                          }),
                        }}
                      >
                        {/* Card image with rarity glow */}
                        <Box sx={{
                          position: 'relative', borderRadius: '14px', overflow: 'hidden',
                          // Dim unowned cards
                          ...(!card.owned_count && { opacity: 0.45, filter: 'grayscale(0.4)' }),
                          transition: 'opacity 0.2s ease, filter 0.2s ease',
                          '&:hover': { opacity: 1, filter: 'none' },
                        }}>
                          <Box
                            component="img"
                            src={cardsApi.getImageUrl(card.backend_id, language)}
                            alt={getCardDisplayName(card)}
                            sx={{
                              width: '100%',
                              aspectRatio: '5 / 7',
                              objectFit: 'contain',
                              display: 'block',
                              borderRadius: '14px',
                              boxShadow: glow,
                              transition: 'box-shadow 0.3s ease',
                              '&:hover': { boxShadow: glowHover },
                              ...(isCrown && { animation: 'crownShimmer 2.5s ease-in-out infinite' }),
                            }}
                            onError={(e) => { e.target.src = '/card-placeholder.svg' }}
                          />
                          {/* Owned count badge — top-left corner */}
                          {card.owned_count > 0 && (
                            <Box sx={{
                              position: 'absolute', top: 4, left: 4, minWidth: 20, height: 20,
                              borderRadius: '10px', fontSize: '0.6rem', fontWeight: 800,
                              bgcolor: 'rgba(46, 125, 50, 0.9)', color: '#fff',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              px: 0.5, backdropFilter: 'blur(4px)',
                              boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
                            }}>
                              x{card.owned_count}
                            </Box>
                          )}
                          {/* Promo badge — top-right corner */}
                          {card.is_promo === 1 && (
                            <Box sx={{
                              position: 'absolute', top: 4, right: 4, px: 0.5, py: 0.15,
                              borderRadius: '4px', fontSize: '0.5rem', fontWeight: 800,
                              bgcolor: 'rgba(0, 188, 212, 0.85)', color: '#fff',
                              letterSpacing: '0.05em', lineHeight: 1.3,
                              backdropFilter: 'blur(4px)',
                            }}>
                              PROMO
                            </Box>
                          )}
                          {/* Name + rarity overlay at bottom of image */}
                          <Box
                            sx={{
                              position: 'absolute',
                              bottom: 0,
                              left: 0,
                              right: 0,
                              background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
                              px: 0.75,
                              py: 0.5,
                              pt: 2,
                              borderRadius: '0 0 14px 14px',
                            }}
                          >
                            <Tooltip title={card.localizedName && card.localizedName !== card.card_name ? `EN: ${card.card_name}` : ''}>
                              <Typography
                                variant="caption"
                                sx={{
                                  color: '#fff',
                                  fontWeight: 600,
                                  fontSize: '0.65rem',
                                  display: 'block',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  lineHeight: 1.2,
                                  textShadow: '0 1px 3px rgba(0,0,0,0.5)',
                                }}
                              >
                                {getCardDisplayName(card)}
                              </Typography>
                            </Tooltip>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, mt: 0.15 }}>
                              <RarityIcon rarityCode={card.rarity_code} size={10} />
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.55rem' }}>
                                {card.set_code}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    </motion.div>
                  </StaggerItem>
                </Grid>
              )
            })}
          </Grid>
        </StaggerContainer>
      ) : (
        // List View
        <FadeIn>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {displayCards.map((card) => (
              <GlassCard
                key={card.backend_id}
                noPadding
                sx={{
                  cursor: 'pointer',
                  borderRadius: '14px',
                  transition: 'all 0.2s ease',
                  ...(!card.owned_count && { opacity: 0.5 }),
                  '&:hover': {
                    opacity: 1,
                    transform: 'translateY(-2px)',
                    boxShadow: isDark ? '0 4px 16px rgba(124, 138, 255, 0.12)' : '0 4px 16px rgba(0, 0, 0, 0.1)',
                  },
                }}
              >
                <Box
                  onClick={() => handleCardClick(card)}
                  sx={{
                    p: 2,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  <Box
                    component="img"
                    src={cardsApi.getImageUrl(card.backend_id, language)}
                    alt={getCardDisplayName(card)}
                    sx={{ width: 50, height: 70, objectFit: 'contain' }}
                    onError={(e) => {
                      e.target.src = '/card-placeholder.svg'
                    }}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Tooltip title={card.localizedName && card.localizedName !== card.card_name ? `EN: ${card.card_name}` : ''}>
                      <Typography fontWeight={600}>{getCardDisplayName(card)}</Typography>
                    </Tooltip>
                    <Typography variant="body2" color="text.secondary">
                      {getSetDisplayName(card)} #{card.number}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    {card.owned_count > 0 && (
                      <Chip label={`x${card.owned_count}`} size="small" sx={{
                        height: 18, fontSize: '0.6rem', fontWeight: 700,
                        bgcolor: 'rgba(46, 125, 50, 0.15)', color: theme.palette.success.main,
                        border: `1px solid ${theme.palette.success.main}30`,
                      }} />
                    )}
                    {card.is_promo === 1 && (
                      <Chip label="PROMO" size="small" sx={{
                        height: 18, fontSize: '0.55rem', fontWeight: 700,
                        bgcolor: 'rgba(0, 188, 212, 0.15)', color: '#00bcd4',
                        border: '1px solid rgba(0, 188, 212, 0.3)',
                      }} />
                    )}
                    <RarityChip rarity={card.rarity_code} />
                  </Box>
                </Box>
              </GlassCard>
            ))}
          </Box>
        </FadeIn>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(e, val) => setPage(val)}
            color="primary"
            showFirstButton
            showLastButton
          />
        </Box>
      )}

      {/* Card Detail Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        {selectedCard && (
          <>
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                {getCardDisplayName(selectedCard)}
                <RarityChip rarity={selectedCard.rarity_code} />
                {selectedCard.is_promo === 1 && (
                  <Chip label="PROMO" size="small" sx={{
                    height: 18, fontSize: '0.55rem', fontWeight: 700,
                    bgcolor: 'rgba(0, 188, 212, 0.15)', color: '#00bcd4',
                    border: '1px solid rgba(0, 188, 212, 0.3)',
                  }} />
                )}
              </Box>
              <IconButton onClick={() => setDialogOpen(false)} size="small" aria-label="Close">
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, gap: 3 }}>
                <Box
                  component="img"
                  src={cardsApi.getImageUrl(selectedCard.backend_id, language)}
                  alt={getCardDisplayName(selectedCard)}
                  sx={{
                    width: { xs: '100%', sm: 200 },
                    maxHeight: 300,
                    objectFit: 'contain',
                    borderRadius: 2,
                  }}
                  onError={(e) => {
                    e.target.src = '/card-placeholder.svg'
                  }}
                />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" gutterBottom>
                    {getCardDisplayName(selectedCard)}
                  </Typography>
                  {/* Show English name if viewing translated */}
                  {selectedCard.localizedName && selectedCard.localizedName !== selectedCard.card_name && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      EN: {selectedCard.card_name}
                    </Typography>
                  )}

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography color="text.secondary">{t('cards.set')}</Typography>
                      <Typography fontWeight={500}>
                        {getSetDisplayName(selectedCard)}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography color="text.secondary">{t('cards.number')}</Typography>
                      <Typography fontWeight={500}>#{selectedCard.number}</Typography>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography color="text.secondary">{t('cards.rarity')}</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <RarityIcon rarityCode={selectedCard.rarity_code} size={16} />
                        <Typography fontWeight={500}>
                          {RARITY_DISPLAY[selectedCard.rarity_code] || selectedCard.rarity || selectedCard.rarity_code}
                        </Typography>
                      </Box>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography color="text.secondary">{t('cards.type')}</Typography>
                      <Typography fontWeight={500}>
                        {selectedCard.is_trainer ? t('cards.trainer') : selectedCard.is_item ? t('cards.item') : t('cards.pokemon')}
                      </Typography>
                    </Box>

                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography color="text.secondary">{t('cards.cardId')}</Typography>
                      <Typography fontWeight={500} sx={{ fontSize: '0.8rem' }}>
                        {selectedCard.card_id || selectedCard.backend_id}
                      </Typography>
                    </Box>

                    {selectedCard.packs && (
                      <Box>
                        <Typography color="text.secondary" gutterBottom>
                          {t('cards.availablePacks')}
                        </Typography>
                        <Typography variant="body2">
                          {selectedCard.packs}
                        </Typography>
                      </Box>
                    )}
                  </Box>
                </Box>
              </Box>
            </DialogContent>
          </>
        )}
      </Dialog>
    </Box>
    </FadeIn>
  )
}

export default Cards
