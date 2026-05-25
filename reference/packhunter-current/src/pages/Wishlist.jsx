import { useState, useEffect, useCallback } from 'react'
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
  InputAdornment,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  Alert,
  CircularProgress,
  ToggleButtonGroup,
  ToggleButton,
  CardMedia,
  Card,
  CardContent,
  Tooltip,
  Collapse,
} from '@mui/material'
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  FavoriteBorder as WishlistIcon,
  DeleteSweep as ClearAllIcon,
  Person as MainIcon,
  PersonOutline as AltIcon,
  ViewList as FlatIcon,
  Category as GroupedIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material'
import { wishlist as wishlistApi } from '../services/api'
import { RARITY_COLORS, RARITY_NAMES, SET_NAMES } from '../constants/gameData'
import PageHeader from '../components/PageHeader'
import { EmptyState } from '../components/EmptyState'
import { FadeIn } from '../components/Animations'

const RARITY_OPTIONS = [
  { value: '', label: 'All Rarities' },
  { value: 'C', label: 'Common' },
  { value: 'U', label: 'Uncommon' },
  { value: 'R', label: 'Rare' },
  { value: 'RR', label: 'Double Rare' },
  { value: 'AR', label: 'Art Rare' },
  { value: 'SR', label: 'Super Rare' },
  { value: 'SAR', label: 'Special Art Rare' },
  { value: 'IM', label: 'Immersive' },
  { value: 'UR', label: 'Crown Rare' },
  { value: 'S', label: 'Shiny' },
  { value: 'SSR', label: 'Shiny Super Rare' },
]

const SET_OPTIONS = [
  { value: '', label: 'All Sets' },
  ...Object.entries(SET_NAMES).map(([code, name]) => ({ value: code, label: name })),
]

// Rarity display order: highest rarity first
const RARITY_ORDER = ['UR', 'IM', 'SAR', 'SR', 'AR', 'RR', 'R', 'U', 'C', 'S', 'SSR', 'P']

const PLACEHOLDER_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI4MCIgZmlsbD0iIzFhMWEyZSIvPjx0ZXh0IHg9IjEwMCIgeT0iMTQwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNjY2IiBmb250LXNpemU9IjE0Ij5ObyBJbWFnZTwvdGV4dD48L3N2Zz4='

export default function Wishlist() {
  const theme = useTheme()
  const [wishlistCards, setWishlistCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [listType, setListType] = useState('main')
  const [imageErrors, setImageErrors] = useState({})

  // Search dialog state
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchRarity, setSearchRarity] = useState('')
  const [searchSet, setSearchSet] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [addingCard, setAddingCard] = useState(null)
  const [parsedRarity, setParsedRarity] = useState(null)

  // View mode: 'flat' (default list) or 'grouped' (by rarity)
  const [viewMode, setViewMode] = useState('flat')
  const [collapsedGroups, setCollapsedGroups] = useState({})

  // Clear dialog
  const [clearDialogOpen, setClearDialogOpen] = useState(false)

  const loadWishlist = useCallback(async () => {
    try {
      setLoading(true)
      const data = await wishlistApi.list(listType)
      setWishlistCards(data.cards || [])
      setError(null)
    } catch (err) {
      setError('Failed to load wishlist')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [listType])

  useEffect(() => {
    loadWishlist()
  }, [loadWishlist])

  const handleSearch = useCallback(async () => {
    if (!searchQuery || searchQuery.length < 2) return
    try {
      setSearching(true)
      const data = await wishlistApi.search(searchQuery, searchRarity, searchSet, listType)
      setSearchResults(data.cards || [])
      setParsedRarity(data.parsed_rarity || null)
    } catch (err) {
      console.error('Search failed:', err)
    } finally {
      setSearching(false)
    }
  }, [searchQuery, searchRarity, searchSet, listType])

  const handleAddCard = async (card) => {
    try {
      setAddingCard(card.card_id)
      await wishlistApi.add(card.card_id, card.card_name, card.rarity_code, card.set_code, undefined, undefined, listType)
      setSearchResults(prev => prev.filter(c => c.card_id !== card.card_id))
      await loadWishlist()
    } catch (err) {
      console.error('Failed to add card:', err)
    } finally {
      setAddingCard(null)
    }
  }

  const handleRemoveCard = async (cardId) => {
    try {
      await wishlistApi.remove(cardId, listType)
      setWishlistCards(prev => prev.filter(c => c.card_id !== cardId))
    } catch (err) {
      console.error('Failed to remove card:', err)
    }
  }

  const handleClearAll = async () => {
    try {
      await wishlistApi.clear(listType)
      setWishlistCards([])
      setClearDialogOpen(false)
    } catch (err) {
      console.error('Failed to clear wishlist:', err)
    }
  }

  const handleListTypeChange = (_, newType) => {
    if (newType !== null) {
      setListType(newType)
      setImageErrors({})
    }
  }

  const handleViewModeChange = (_, newMode) => {
    if (newMode !== null) setViewMode(newMode)
  }

  const toggleGroup = (rarityCode) => {
    setCollapsedGroups(prev => ({ ...prev, [rarityCode]: !prev[rarityCode] }))
  }

  // Group wishlist cards by rarity, sorted by RARITY_ORDER
  const groupedCards = (() => {
    if (viewMode !== 'grouped' || wishlistCards.length === 0) return []
    const groups = {}
    wishlistCards.forEach(card => {
      const code = card.rarity_code || card.rarity || 'Unknown'
      if (!groups[code]) groups[code] = []
      groups[code].push(card)
    })
    // Sort groups by RARITY_ORDER; unknown rarities go at end
    return Object.entries(groups).sort(([a], [b]) => {
      const ai = RARITY_ORDER.indexOf(a)
      const bi = RARITY_ORDER.indexOf(b)
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi)
    })
  })()

  const getCardImageUrl = (card) => {
    const id = card.card_id || card.backend_id
    if (imageErrors[id]) return PLACEHOLDER_IMAGE
    return `/api/cards/${id}/image?v=5`
  }

  const handleImageError = (cardId) => {
    setImageErrors(prev => ({ ...prev, [cardId]: true }))
  }

  const getRarityColor = (rarity) => RARITY_COLORS[rarity] || '#999'

  return (
    <Box>
      <PageHeader
        title="Wishlist"
        subtitle={`${wishlistCards.length} card${wishlistCards.length !== 1 ? 's' : ''} on your ${listType} wishlist`}
        icon={<WishlistIcon />}
      />

      {/* Rarity count summary — scan what you're chasing at a glance */}
      {wishlistCards.length > 0 && (() => {
        const counts = {}
        wishlistCards.forEach(c => {
          const r = c.rarity_code || c.rarity || '?'
          counts[r] = (counts[r] || 0) + 1
        })
        const rarityOrder = ['IM', 'SAR', 'SR', 'AR', 'RR', 'R', 'U', 'C', 'P']
        const rarityColors = { IM: '#FFD700', SAR: '#FF6B6B', SR: '#FF9F43', AR: '#54A0FF', RR: '#A78BFA', R: '#34D399', U: '#6B7280', C: '#9CA3AF', P: '#EC4899' }
        const sorted = Object.entries(counts).sort((a, b) => {
          const ai = rarityOrder.indexOf(a[0]), bi = rarityOrder.indexOf(b[0])
          return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
        })
        return (
          <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            {sorted.map(([rarity, count]) => (
              <Chip
                key={rarity}
                label={`${count} ${rarity}`}
                size="small"
                sx={{
                  fontWeight: 700, fontSize: '0.7rem', height: 24,
                  bgcolor: `${rarityColors[rarity] || '#6B7280'}15`,
                  color: rarityColors[rarity] || '#6B7280',
                  border: `1px solid ${rarityColors[rarity] || '#6B7280'}30`,
                }}
              />
            ))}
            <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600 }}>
              = {wishlistCards.length} cards
            </Typography>
          </Box>
        )
      })()}

      {/* Alt/Main Toggle + Action buttons — sticky filter bar */}
      <Box sx={{
        display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap', alignItems: 'center',
        position: 'sticky', top: { xs: 120, sm: 128 }, zIndex: 10,
        py: 1, mx: -1.5, px: 1.5,
        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(15,17,23,0.85)' : 'rgba(245,247,250,0.85)',
        backdropFilter: 'blur(8px)',
        borderRadius: '8px',
      }}>
        <ToggleButtonGroup
          value={listType}
          exclusive
          onChange={handleListTypeChange}
          size="small"
        >
          <ToggleButton value="main" sx={{ px: 2 }}>
            <MainIcon sx={{ mr: 0.5, fontSize: 18 }} />
            Main
          </ToggleButton>
          <ToggleButton value="alt" sx={{ px: 2 }}>
            <AltIcon sx={{ mr: 0.5, fontSize: 18 }} />
            Alt
          </ToggleButton>
        </ToggleButtonGroup>

        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={handleViewModeChange}
          size="small"
        >
          <ToggleButton value="flat" sx={{ px: 1.5 }}>
            <FlatIcon sx={{ mr: 0.5, fontSize: 18 }} />
            Flat
          </ToggleButton>
          <ToggleButton value="grouped" sx={{ px: 1.5 }}>
            <GroupedIcon sx={{ mr: 0.5, fontSize: 18 }} />
            Grouped
          </ToggleButton>
        </ToggleButtonGroup>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setSearchOpen(true)}
        >
          Add Cards
        </Button>
        {wishlistCards.length > 0 && (
          <Button
            variant="outlined"
            color="error"
            startIcon={<ClearAllIcon />}
            onClick={() => setClearDialogOpen(true)}
          >
            Clear All
          </Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* Wishlist cards — visual grid with card images */}
      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
          <CircularProgress />
        </Box>
      ) : wishlistCards.length === 0 ? (
        <EmptyState
          icon={<WishlistIcon sx={{ fontSize: 72, color: 'secondary.main', opacity: 0.8 }} />}
          title={`Your ${listType} wishlist is empty`}
          description="Track the cards you need most. Wishlist cards are protected during friend cleanup and highlighted in God Pack results. Start by adding your first card!"
          action={
            <Button
              variant="contained"
              size="large"
              startIcon={<AddIcon />}
              onClick={() => setSearchOpen(true)}
              sx={{
                px: 4,
                py: 1.25,
                borderRadius: 3,
                fontWeight: 700,
                fontSize: '1rem',
                background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                '&:hover': {
                  background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.dark})`,
                  transform: 'translateY(-1px)',
                  boxShadow: 4,
                },
                transition: 'all 0.2s ease',
              }}
            >
              Add Your First Card
            </Button>
          }
        />
      ) : viewMode === 'grouped' ? (
        /* Grouped by rarity view */
        <FadeIn>
          {groupedCards.map(([rarityCode, cards]) => {
            const rarityColor = getRarityColor(rarityCode)
            const rarityName = RARITY_NAMES[rarityCode] || rarityCode
            const isCollapsed = !!collapsedGroups[rarityCode]

            return (
              <Box key={rarityCode} sx={{ mb: 3 }}>
                {/* Collapsible group header */}
                <Box
                  onClick={() => toggleGroup(rarityCode)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    px: 2.5,
                    py: 1.5,
                    borderRadius: 2,
                    cursor: 'pointer',
                    borderLeft: `5px solid ${rarityColor}`,
                    bgcolor: rarityColor + '14',
                    transition: 'all 0.2s ease',
                    '&:hover': {
                      bgcolor: rarityColor + '22',
                      transform: 'translateX(2px)',
                    },
                  }}
                >
                  {isCollapsed ? (
                    <ExpandMoreIcon sx={{ color: rarityColor, fontSize: 28 }} />
                  ) : (
                    <ExpandLessIcon sx={{ color: rarityColor, fontSize: 28 }} />
                  )}
                  <Typography variant="h6" fontWeight={700} sx={{ color: rarityColor === '#000000' ? 'text.primary' : rarityColor, flex: 1 }}>
                    {rarityName}
                  </Typography>
                  <Chip
                    label={`${cards.length} card${cards.length !== 1 ? 's' : ''}`}
                    size="small"
                    sx={{
                      bgcolor: rarityColor,
                      color: rarityColor === '#000000' ? '#ffd700' : 'white',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      height: 26,
                      minWidth: 40,
                      letterSpacing: 0.3,
                    }}
                  />
                </Box>

                {/* Collapsible card grid */}
                <Collapse in={!isCollapsed} timeout="auto">
                  <Grid container spacing={2} sx={{ mt: 0.5 }}>
                    {cards.map((card) => {
                      const cardRarityCode = card.rarity_code || card.rarity
                      const cardRarityColor = getRarityColor(cardRarityCode)
                      const cardRarityName = RARITY_NAMES[cardRarityCode] || cardRarityCode
                      const cardId = card.card_id || card.backend_id

                      return (
                        <Grid item xs={6} sm={4} md={3} lg={2.4} key={card.id}>
                          <Card
                            sx={{
                              height: '100%',
                              display: 'flex',
                              flexDirection: 'column',
                              position: 'relative',
                              borderRadius: '14px',
                              transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                              borderTop: `3px solid ${cardRarityColor}`,
                              cursor: 'pointer',
                              '&:hover': {
                                transform: 'translateY(-6px)',
                                boxShadow: `0 12px 24px rgba(0,0,0,0.15), 0 0 0 1px ${cardRarityColor}30`,
                              },
                            }}
                          >
                            <IconButton
                              size="small"
                              onClick={() => handleRemoveCard(cardId)}
                              sx={{
                                position: 'absolute',
                                top: 4,
                                right: 4,
                                zIndex: 2,
                                bgcolor: 'rgba(0,0,0,0.6)',
                                color: 'white',
                                '&:hover': { bgcolor: 'error.main' },
                              }}
                            >
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                            <Chip
                              label={cardRarityCode}
                              size="small"
                              sx={{
                                position: 'absolute',
                                top: 8,
                                left: 8,
                                zIndex: 2,
                                bgcolor: cardRarityColor,
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: '0.7rem',
                                height: 22,
                              }}
                            />
                            <CardMedia
                              component="img"
                              image={getCardImageUrl(card)}
                              alt={card.card_name || cardId}
                              onError={() => handleImageError(cardId)}
                              sx={{
                                height: 200,
                                objectFit: 'contain',
                                bgcolor: 'grey.900',
                                p: 1,
                              }}
                            />
                            <CardContent sx={{ flexGrow: 1, py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
                              <Tooltip title={card.card_name || cardId} placement="top">
                                <Typography variant="subtitle2" fontWeight="bold" noWrap>
                                  {card.card_name || cardId}
                                </Typography>
                              </Tooltip>
                              <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                                <Chip
                                  label={cardRarityName}
                                  size="small"
                                  sx={{
                                    bgcolor: cardRarityColor + '22',
                                    color: cardRarityColor,
                                    fontWeight: 600,
                                    fontSize: '0.65rem',
                                    height: 20,
                                  }}
                                />
                                {card.set_code && (
                                  <Chip
                                    label={card.set_name || SET_NAMES[card.set_code] || card.set_code}
                                    size="small"
                                    variant="outlined"
                                    sx={{ fontSize: '0.65rem', height: 20 }}
                                  />
                                )}
                                {card.priority && card.priority !== 'medium' && (
                                  <Chip
                                    label={card.priority}
                                    size="small"
                                    color={card.priority === 'high' ? 'error' : 'default'}
                                    sx={{ fontSize: '0.65rem', height: 20 }}
                                  />
                                )}
                              </Box>
                              {card.notes && (
                                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }} noWrap>
                                  {card.notes}
                                </Typography>
                              )}
                            </CardContent>
                          </Card>
                        </Grid>
                      )
                    })}
                  </Grid>
                </Collapse>
              </Box>
            )
          })}
        </FadeIn>
      ) : (
        /* Flat view (original) */
        <FadeIn>
          <Grid container spacing={2}>
            {wishlistCards.map((card) => {
              const rarityCode = card.rarity_code || card.rarity
              const rarityColor = getRarityColor(rarityCode)
              const rarityName = RARITY_NAMES[rarityCode] || rarityCode
              const cardId = card.card_id || card.backend_id

              return (
                <Grid item xs={6} sm={4} md={3} lg={2.4} key={card.id}>
                  <Card
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                      borderRadius: '14px',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      borderTop: `3px solid ${rarityColor}`,
                      cursor: 'pointer',
                      '&:hover': {
                        transform: 'translateY(-6px)',
                        boxShadow: `0 12px 24px rgba(0,0,0,0.15), 0 0 0 1px ${rarityColor}30`,
                      },
                    }}
                  >
                    {/* Delete button overlay */}
                    <IconButton
                      size="small"
                      onClick={() => handleRemoveCard(cardId)}
                      sx={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        zIndex: 2,
                        bgcolor: 'rgba(0,0,0,0.6)',
                        color: 'white',
                        '&:hover': { bgcolor: 'error.main' },
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>

                    {/* Rarity badge overlay */}
                    <Chip
                      label={rarityCode}
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 8,
                        left: 8,
                        zIndex: 2,
                        bgcolor: rarityColor,
                        color: 'white',
                        fontWeight: 'bold',
                        fontSize: '0.7rem',
                        height: 22,
                      }}
                    />

                    {/* Card Image */}
                    <CardMedia
                      component="img"
                      image={getCardImageUrl(card)}
                      alt={card.card_name || cardId}
                      onError={() => handleImageError(cardId)}
                      sx={{
                        height: 200,
                        objectFit: 'contain',
                        bgcolor: 'grey.900',
                        p: 1,
                      }}
                    />

                    {/* Card Info */}
                    <CardContent sx={{ flexGrow: 1, py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
                      <Tooltip title={card.card_name || cardId} placement="top">
                        <Typography variant="subtitle2" fontWeight="bold" noWrap>
                          {card.card_name || cardId}
                        </Typography>
                      </Tooltip>

                      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                        <Chip
                          label={rarityName}
                          size="small"
                          sx={{
                            bgcolor: rarityColor + '22',
                            color: rarityColor,
                            fontWeight: 600,
                            fontSize: '0.65rem',
                            height: 20,
                          }}
                        />
                        {card.set_code && (
                          <Chip
                            label={card.set_name || SET_NAMES[card.set_code] || card.set_code}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.65rem', height: 20 }}
                          />
                        )}
                        {card.priority && card.priority !== 'medium' && (
                          <Chip
                            label={card.priority}
                            size="small"
                            color={card.priority === 'high' ? 'error' : 'default'}
                            sx={{ fontSize: '0.65rem', height: 20 }}
                          />
                        )}
                      </Box>
                      {card.notes && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }} noWrap>
                          {card.notes}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>
              )
            })}
          </Grid>
        </FadeIn>
      )}

      {/* Search & Add Dialog */}
      <Dialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Search Cards to Add ({listType === 'main' ? 'Main' : 'Alt'} Wishlist)</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
            <TextField
              placeholder='Search card name... (e.g. "armarouge super rare")'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              size="small"
              sx={{ flex: 1, minWidth: 200 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
                endAdornment: searchQuery && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => { setSearchQuery(''); setSearchResults([]); setParsedRarity(null) }}>
                      <ClearIcon fontSize="small" />
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>Rarity</InputLabel>
              <Select value={searchRarity} onChange={(e) => setSearchRarity(e.target.value)} label="Rarity">
                {RARITY_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 130 }}>
              <InputLabel>Set</InputLabel>
              <Select value={searchSet} onChange={(e) => setSearchSet(e.target.value)} label="Set">
                {SET_OPTIONS.map(o => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
              </Select>
            </FormControl>
            <Button variant="contained" onClick={handleSearch} disabled={searching || !searchQuery || searchQuery.length < 2}>
              {searching ? <CircularProgress size={20} /> : 'Search'}
            </Button>
          </Box>

          {/* Smart search feedback */}
          {parsedRarity && !searchRarity && (
            <Alert severity="info" sx={{ mt: 1, py: 0 }} icon={false}>
              <Typography variant="caption">
                Auto-detected rarity: <strong>{RARITY_NAMES[parsedRarity] || parsedRarity} ({parsedRarity})</strong>
              </Typography>
            </Alert>
          )}

          {/* Search results — visual with card images */}
          <Box sx={{ mt: 2, maxHeight: 500, overflow: 'auto' }}>
            {searchResults.length === 0 && !searching && searchQuery.length >= 2 && (
              <Typography color="text.secondary" textAlign="center" sx={{ py: 3 }}>
                No cards found. Try a different search.
              </Typography>
            )}
            <Grid container spacing={1.5}>
              {searchResults.map((card) => {
                const rarityColor = getRarityColor(card.rarity_code)
                return (
                  <Grid item xs={6} sm={4} md={3} key={card.card_id}>
                    <Card
                      sx={{
                        position: 'relative',
                        borderRadius: '12px',
                        borderTop: `3px solid ${rarityColor}`,
                        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                        '&:hover': { transform: 'translateY(-3px)', boxShadow: `0 8px 20px rgba(0,0,0,0.12)` },
                      }}
                    >
                      {/* Rarity badge */}
                      <Chip
                        label={card.rarity_code}
                        size="small"
                        sx={{
                          position: 'absolute',
                          top: 6,
                          left: 6,
                          zIndex: 2,
                          bgcolor: rarityColor,
                          color: 'white',
                          fontWeight: 'bold',
                          fontSize: '0.65rem',
                          height: 20,
                        }}
                      />

                      <CardMedia
                        component="img"
                        image={getCardImageUrl(card)}
                        alt={card.card_name}
                        onError={() => handleImageError(card.card_id)}
                        sx={{
                          height: 160,
                          objectFit: 'contain',
                          bgcolor: 'grey.900',
                          p: 0.5,
                        }}
                      />

                      <CardContent sx={{ py: 0.75, px: 1, '&:last-child': { pb: 0.75 } }}>
                        <Typography variant="caption" fontWeight="bold" noWrap display="block">
                          {card.card_name}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mt: 0.25 }}>
                          <Chip
                            label={RARITY_NAMES[card.rarity_code] || card.rarity_code}
                            size="small"
                            sx={{
                              bgcolor: rarityColor + '22',
                              color: rarityColor,
                              fontWeight: 600,
                              fontSize: '0.6rem',
                              height: 18,
                            }}
                          />
                          {card.set_code && (
                            <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                              {SET_NAMES[card.set_code] || card.set_code}
                            </Typography>
                          )}
                        </Box>
                        <Button
                          size="small"
                          variant="outlined"
                          fullWidth
                          startIcon={addingCard === card.card_id ? <CircularProgress size={12} /> : <AddIcon />}
                          disabled={addingCard === card.card_id}
                          onClick={() => handleAddCard(card)}
                          sx={{ mt: 0.5, fontSize: '0.7rem', py: 0.25 }}
                        >
                          Add
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                )
              })}
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSearchOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Clear confirmation dialog */}
      <Dialog open={clearDialogOpen} onClose={() => setClearDialogOpen(false)}>
        <DialogTitle>Clear {listType === 'main' ? 'Main' : 'Alt'} Wishlist?</DialogTitle>
        <DialogContent>
          <Typography>
            This will remove all {wishlistCards.length} cards from your {listType} wishlist. This cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleClearAll} color="error" variant="contained">
            Clear All
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
