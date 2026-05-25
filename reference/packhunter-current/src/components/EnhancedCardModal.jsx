import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Chip,
  Button,
  Divider,
  Grid,
  Tooltip,
  LinearProgress,
  Stack,
  useTheme,
} from '@mui/material'
import {
  Close as CloseIcon,
  Favorite as FavoriteIcon,
  FavoriteBorder as FavoriteBorderIcon,
  SwapHoriz as TradeIcon,
  ContentCopy as CopyIcon,
  Star as StarIcon,
  CheckCircle as OwnedIcon,
  Cancel as NotOwnedIcon,
  AutoAwesome as ShinyIcon,
  ThreeDRotation as FlipIcon,
} from '@mui/icons-material'
import { useThemeMode } from '../contexts/ThemeContext'

// Rarity colors
const rarityColors = {
  common: { bg: '#9e9e9e', text: '#fff' },
  uncommon: { bg: '#4caf50', text: '#fff' },
  rare: { bg: '#2196f3', text: '#fff' },
  'double rare': { bg: '#9c27b0', text: '#fff' },
  'art rare': { bg: '#ff9800', text: '#fff' },
  'super rare': { bg: '#f44336', text: '#fff' },
  'special art rare': { bg: '#e91e63', text: '#fff' },
  'immersive': { bg: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', text: '#fff' },
  'crown rare': { bg: 'linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)', text: '#000' },
}

// Type colors for cards
const typeColors = {
  fire: '#F08030',
  water: '#6890F0',
  grass: '#78C850',
  electric: '#F8D030',
  psychic: '#F85888',
  fighting: '#C03028',
  darkness: '#705848',
  metal: '#B8B8D0',
  dragon: '#7038F8',
  fairy: '#EE99AC',
  colorless: '#A8A878',
}

function EnhancedCardModal({ open, onClose, card, owned = false, onWishlistToggle, onTradeToggle, isWishlisted = false, isForTrade = false }) {
  const [isFlipped, setIsFlipped] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)
  const [cardDetails, setCardDetails] = useState(null)
  const [loadingDetails, setLoadingDetails] = useState(false)
  const { isDark } = useThemeMode()
  const theme = useTheme()

  useEffect(() => {
    // Reset flip state when card changes
    setIsFlipped(false)
    setImageLoaded(false)
    setCardDetails(null)
  }, [card])

  // Fetch full card details (including stock counts) when modal opens
  useEffect(() => {
    if (open && card && (card.backend_id || card.card_id)) {
      const cardId = card.backend_id || card.card_id
      setLoadingDetails(true)

      fetch(`/api/cards/${cardId}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })
        .then(res => res.json())
        .then(data => {
          if (data.card) {
            setCardDetails(data.card)
          }
        })
        .catch(err => console.error('Failed to fetch card details:', err))
        .finally(() => setLoadingDetails(false))
    }
  }, [open, card])

  if (!card) return null

  // Merge card prop with fetched details (details take priority)
  const displayCard = cardDetails ? { ...card, ...cardDetails } : card

  const handleMouseMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    setMousePosition({ x, y })
  }

  const handleMouseEnter = () => setIsHovering(true)
  const handleMouseLeave = () => {
    setIsHovering(false)
    setMousePosition({ x: 0.5, y: 0.5 })
  }

  // Calculate 3D rotation based on mouse position
  const rotateX = isHovering ? (mousePosition.y - 0.5) * -20 : 0
  const rotateY = isHovering ? (mousePosition.x - 0.5) * 20 : 0

  const rarityStyle = rarityColors[displayCard.rarity?.toLowerCase()] || rarityColors.common
  const typeColor = typeColors[displayCard.type?.toLowerCase()] || typeColors.colorless

  const handleCopyId = () => {
    navigator.clipboard.writeText(displayCard.card_id || displayCard.backend_id || displayCard.id)
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      PaperProps={{
        sx: {
          background: isDark
            ? 'linear-gradient(135deg, #111827 0%, #0F172A 100%)'
            : 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
          borderRadius: 3,
          overflow: 'hidden',
          minWidth: { xs: '90vw', md: 700 },
        },
      }}
    >
      <Box sx={{ position: 'absolute', top: 8, right: 8, zIndex: 10 }}>
        <IconButton onClick={onClose} aria-label="Close card details" sx={{ color: isDark ? '#fff' : '#333' }}>
          <CloseIcon />
        </IconButton>
      </Box>

      <DialogContent sx={{ p: 0 }}>
        <Grid container>
          {/* Card Image Section with 3D Effect */}
          <Grid item xs={12} md={5}>
            <Box
              sx={{
                p: 3,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                minHeight: 400,
                background: isDark
                  ? 'radial-gradient(circle at center, #2d2d44 0%, #111827 100%)'
                  : 'radial-gradient(circle at center, #fff 0%, #f0f0f0 100%)',
              }}
            >
              <Box
                sx={{
                  perspective: '1000px',
                  width: 250,
                  height: 350,
                }}
              >
                <Box
                  onMouseMove={handleMouseMove}
                  onMouseEnter={handleMouseEnter}
                  onMouseLeave={handleMouseLeave}
                  onClick={() => setIsFlipped(!isFlipped)}
                  sx={{
                    width: '100%',
                    height: '100%',
                    position: 'relative',
                    transformStyle: 'preserve-3d',
                    transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: isFlipped
                      ? 'rotateY(180deg)'
                      : `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
                    cursor: 'pointer',
                    '&:hover': {
                      '& .card-shine': {
                        opacity: 1,
                      },
                    },
                  }}
                >
                  {/* Front of card */}
                  <Box
                    sx={{
                      position: 'absolute',
                      width: '100%',
                      height: '100%',
                      backfaceVisibility: 'hidden',
                      borderRadius: 2,
                      overflow: 'hidden',
                      boxShadow: isHovering
                        ? '0 25px 50px rgba(0,0,0,0.5), 0 0 30px rgba(124, 138, 255, 0.3)'
                        : '0 10px 30px rgba(0,0,0,0.3)',
                      transition: 'box-shadow 0.3s ease',
                    }}
                  >
                    {!imageLoaded && (
                      <Box sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isDark ? '#2d2d44' : '#e0e0e0',
                      }}>
                        <Typography color="text.secondary">Loading...</Typography>
                      </Box>
                    )}
                    <img
                      src={`/api/cards/${displayCard.backend_id || displayCard.card_id || displayCard.id}/image?v=5`}
                      alt={displayCard.name || displayCard.card_name}
                      onLoad={() => setImageLoaded(true)}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: imageLoaded ? 'block' : 'none',
                      }}
                    />
                    {/* Shine effect */}
                    <Box
                      className="card-shine"
                      sx={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: `linear-gradient(
                          ${105 + (mousePosition.x - 0.5) * 90}deg,
                          transparent 40%,
                          rgba(255,255,255,0.2) 50%,
                          transparent 60%
                        )`,
                        opacity: 0,
                        transition: 'opacity 0.3s ease',
                        pointerEvents: 'none',
                      }}
                    />
                    {/* Owned indicator */}
                    {owned && (
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          background: 'rgba(76, 175, 80, 0.9)',
                          borderRadius: '50%',
                          p: 0.5,
                        }}
                      >
                        <OwnedIcon sx={{ color: '#fff', fontSize: 20 }} />
                      </Box>
                    )}
                  </Box>

                  {/* Back of card */}
                  <Box
                    sx={{
                      position: 'absolute',
                      width: '100%',
                      height: '100%',
                      backfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                      borderRadius: 2,
                      overflow: 'hidden',
                      background: 'linear-gradient(135deg, #1a237e 0%, #311b92 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
                    }}
                  >
                    <Box sx={{ textAlign: 'center', p: 3 }}>
                      <Box
                        sx={{
                          width: 80,
                          height: 80,
                          borderRadius: '50%',
                          background: `linear-gradient(135deg, ${theme.palette.primary.main} 50%, #fff 50%)`,
                          border: '4px solid #fff',
                          mx: 'auto',
                          mb: 2,
                          position: 'relative',
                          '&::after': {
                            content: '""',
                            position: 'absolute',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            background: '#fff',
                            border: '3px solid #333',
                          },
                        }}
                      />
                      <Typography variant="h6" sx={{ color: '#fff', fontWeight: 700 }}>
                        TCGP
                      </Typography>
                      <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                        Click to flip
                      </Typography>
                    </Box>
                  </Box>
                </Box>
              </Box>

              {/* Flip hint */}
              <Tooltip title="Click card to flip">
                <IconButton
                  onClick={() => setIsFlipped(!isFlipped)}
                  aria-label="Flip card"
                  sx={{
                    position: 'absolute',
                    bottom: 16,
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'rgba(0,0,0,0.5)',
                    color: '#fff',
                    '&:hover': { background: 'rgba(0,0,0,0.7)' },
                  }}
                >
                  <FlipIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Grid>

          {/* Card Details Section */}
          <Grid item xs={12} md={7}>
            <Box sx={{ p: 3 }}>
              {/* Header */}
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant="h4"
                  sx={{
                    fontWeight: 700,
                    color: isDark ? '#fff' : '#333',
                    mb: 0.5,
                  }}
                >
                  {displayCard.name || displayCard.card_name}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Chip
                    label={displayCard.rarity || 'Unknown'}
                    size="small"
                    sx={{
                      background: rarityStyle.bg,
                      color: rarityStyle.text,
                      fontWeight: 600,
                    }}
                  />
                  {displayCard.type && (
                    <Chip
                      label={displayCard.type}
                      size="small"
                      sx={{
                        background: typeColor,
                        color: '#fff',
                        fontWeight: 600,
                      }}
                    />
                  )}
                  {displayCard.set_name && (
                    <Chip
                      label={displayCard.set_name}
                      size="small"
                      variant="outlined"
                      sx={{ color: isDark ? '#aaa' : '#666' }}
                    />
                  )}
                  {displayCard.is_godpack && (
                    <Chip
                      icon={<ShinyIcon sx={{ color: '#ffd700 !important' }} />}
                      label="God Pack"
                      size="small"
                      sx={{
                        background: 'linear-gradient(135deg, #ffd700 0%, #ff8c00 100%)',
                        color: '#000',
                        fontWeight: 700,
                      }}
                    />
                  )}
                </Stack>
              </Box>

              <Divider sx={{ my: 2 }} />

              {/* Stats */}
              <Grid container spacing={2} sx={{ mb: 2 }}>
                {displayCard.hp && (
                  <Grid item xs={6}>
                    <Box sx={{
                      p: 1.5,
                      borderRadius: 2,
                      background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                    }}>
                      <Typography variant="caption" color="text.secondary">HP</Typography>
                      <Typography variant="h5" fontWeight={700} color="error.main">
                        {displayCard.hp}
                      </Typography>
                    </Box>
                  </Grid>
                )}
                {displayCard.pack_points && (
                  <Grid item xs={6}>
                    <Box sx={{
                      p: 1.5,
                      borderRadius: 2,
                      background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                    }}>
                      <Typography variant="caption" color="text.secondary">Pack Points</Typography>
                      <Typography variant="h5" fontWeight={700} color="primary.main">
                        {displayCard.pack_points}
                      </Typography>
                    </Box>
                  </Grid>
                )}
                {(displayCard.card_number || displayCard.number) && (
                  <Grid item xs={6}>
                    <Box sx={{
                      p: 1.5,
                      borderRadius: 2,
                      background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                    }}>
                      <Typography variant="caption" color="text.secondary">Card Number</Typography>
                      <Typography variant="h6" fontWeight={600}>
                        #{displayCard.card_number || displayCard.number}
                      </Typography>
                    </Box>
                  </Grid>
                )}
                {displayCard.owned_count !== undefined && (
                  <Grid item xs={6}>
                    <Box sx={{
                      p: 1.5,
                      borderRadius: 2,
                      background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                    }}>
                      <Typography variant="caption" color="text.secondary">Owned</Typography>
                      <Typography variant="h5" fontWeight={700} color={displayCard.owned_count > 0 ? 'success.main' : 'text.secondary'}>
                        {displayCard.owned_count}x
                      </Typography>
                    </Box>
                  </Grid>
                )}
                {displayCard.stock_count !== undefined && (
                  <Grid item xs={6}>
                    <Box sx={{
                      p: 1.5,
                      borderRadius: 2,
                      background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                    }}>
                      <Typography variant="caption" color="text.secondary">Total in Database</Typography>
                      <Typography variant="h5" fontWeight={700} color="info.main">
                        {displayCard.stock_count?.toLocaleString() || 0}
                      </Typography>
                    </Box>
                  </Grid>
                )}
                {displayCard.available_count !== undefined && (
                  <Grid item xs={6}>
                    <Box sx={{
                      p: 1.5,
                      borderRadius: 2,
                      background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                    }}>
                      <Typography variant="caption" color="text.secondary">Available for Trade</Typography>
                      <Typography variant="h5" fontWeight={700} color={displayCard.available_count > 0 ? 'success.main' : 'text.secondary'}>
                        {displayCard.available_count?.toLocaleString() || 0}
                      </Typography>
                    </Box>
                  </Grid>
                )}
                {displayCard.accounts_with_card !== undefined && (
                  <Grid item xs={6}>
                    <Box sx={{
                      p: 1.5,
                      borderRadius: 2,
                      background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                    }}>
                      <Typography variant="caption" color="text.secondary">Accounts with Card</Typography>
                      <Typography variant="h5" fontWeight={700} color="secondary.main">
                        {displayCard.accounts_with_card?.toLocaleString() || 0}
                      </Typography>
                    </Box>
                  </Grid>
                )}
              </Grid>

              {/* Collection Progress (if applicable) */}
              {displayCard.collection_progress !== undefined && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                    Collection Progress
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={Math.min(displayCard.collection_progress, 100)}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      bgcolor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                      '& .MuiLinearProgress-bar': {
                        background: `linear-gradient(90deg, ${theme.palette.primary.main} 0%, ${theme.palette.secondary.light} 100%)`,
                        borderRadius: 4,
                      },
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                    {displayCard.collection_progress}% complete
                  </Typography>
                </Box>
              )}

              {/* Description */}
              {displayCard.description && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                    "{displayCard.description}"
                  </Typography>
                </Box>
              )}

              <Divider sx={{ my: 2 }} />

              {/* Action Buttons */}
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button
                  variant={isWishlisted ? 'contained' : 'outlined'}
                  color="error"
                  startIcon={isWishlisted ? <FavoriteIcon /> : <FavoriteBorderIcon />}
                  onClick={() => onWishlistToggle?.(card)}
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                  }}
                >
                  {isWishlisted ? 'Wishlisted' : 'Add to Wishlist'}
                </Button>
                <Button
                  variant={isForTrade ? 'contained' : 'outlined'}
                  color="primary"
                  startIcon={<TradeIcon />}
                  onClick={() => onTradeToggle?.(card)}
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                  }}
                >
                  {isForTrade ? 'For Trade' : 'Mark for Trade'}
                </Button>
                <Tooltip title="Copy Card ID">
                  <IconButton onClick={handleCopyId} aria-label="Copy card ID to clipboard">
                    <CopyIcon />
                  </IconButton>
                </Tooltip>
              </Stack>

              {/* Card ID */}
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 2, display: 'block', fontFamily: 'monospace' }}
              >
                ID: {displayCard.card_id || displayCard.backend_id || displayCard.id}
              </Typography>
            </Box>
          </Grid>
        </Grid>
      </DialogContent>
    </Dialog>
  )
}

export default EnhancedCardModal
