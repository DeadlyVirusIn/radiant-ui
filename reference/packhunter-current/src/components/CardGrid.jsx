/**
 * CardGrid Component
 * Responsive grid of cards with trade buttons - Vibrant block-based UI
 */

import { useState } from 'react';
import {
  Box,
  Grid,
  Card,
  CardMedia,
  CardContent,
  CardActions,
  Typography,
  Button,
  Chip,
  Skeleton,
  Tooltip,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import InventoryIcon from '@mui/icons-material/Inventory2';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import { RARITY_COLORS, RARITY_NAMES } from '../constants/gameData';
import { RARITY_CHIP_TEXT } from '../constants/rarityConfig';
import { EmptyState } from './EmptyState';

// Card image placeholder when no image available
const PLACEHOLDER_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI4MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI4MCIgZmlsbD0iIzJhMmEyYSIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmaWxsPSIjNjY2IiBmb250LWZhbWlseT0ic2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPk5vIEltYWdlPC90ZXh0Pjwvc3ZnPg==';

export default function CardGrid({
  cards = [],
  loading = false,
  error = null,
  onTradeClick,
  disabledCardIds = [],
  // Gold-flair clarity mode (2026-05-25). Default false → all other pages
  // (Cards, SharingCards, CardRequest…) render exactly as before. When true,
  // tiles use gold-flair wording: status-based availability, "Top bot: N
  // copies" (not user-owned), and frame/mint detail. Labels only; no logic.
  flairMode = false,
}) {
  const [imageErrors, setImageErrors] = useState({});
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';

  const handleImageError = (cardId) => {
    setImageErrors((prev) => ({ ...prev, [cardId]: true }));
  };

  const getCardImageUrl = (card) => {
    // Only check imageErrors - backend can fetch from CDN even if has_image is 0
    if (imageErrors[card.backend_id]) {
      return PLACEHOLDER_IMAGE;
    }
    return `/api/cards/${card.backend_id}/image?v=5`;
  };

  // Loading skeleton
  if (loading) {
    return (
      <Grid container spacing={1.5}>
        {[...Array(8)].map((_, index) => (
          <Grid item xs={6} sm={4} md={3} lg={2.4} key={index}>
            <Card sx={{ height: '100%', borderRadius: '12px' }}>
              <Skeleton variant="rectangular" height={200} animation="wave" sx={{ borderRadius: '12px 12px 0 0' }} />
              <CardContent sx={{ py: 1.5 }}>
                <Skeleton variant="text" width="80%" />
                <Skeleton variant="text" width="40%" />
              </CardContent>
              <CardActions sx={{ p: 1, pt: 0 }}>
                <Skeleton variant="rectangular" width="100%" height={32} sx={{ borderRadius: '8px' }} />
              </CardActions>
            </Card>
          </Grid>
        ))}
      </Grid>
    );
  }

  // Error state
  if (error) {
    return (
      <EmptyState
        icon={<WarningIcon sx={{ fontSize: 48 }} />}
        title="Error loading cards"
        description={error}
        iconColor="error.main"
        minHeight={200}
      />
    );
  }

  // Empty state
  if (cards.length === 0) {
    return (
      <EmptyState
        icon={<SearchOffIcon sx={{ fontSize: 48 }} />}
        title="No cards found"
        description="Try selecting a different pack or card type."
        minHeight={200}
      />
    );
  }

  return (
    <Grid container spacing={1.5}>
      {cards.map((card) => {
        const isDisabled = disabledCardIds.includes(card.backend_id);
        const isAvailable = card.isAvailable;
        const rarityColor = RARITY_COLORS[card.rarity_code] || '#666';
        const rarityName = RARITY_NAMES[card.rarity_code] || card.rarity_code;
        const isClickable = isAvailable && !isDisabled && onTradeClick;

        return (
          <Grid item xs={6} sm={4} md={3} lg={2.4} key={card.backend_id}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                borderRadius: '12px',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
                filter: isAvailable ? 'none' : 'grayscale(0.7) brightness(0.85)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                cursor: isClickable ? 'pointer' : 'default',
                '&:hover': isClickable ? {
                  transform: 'scale(1.01)',
                  borderColor: rarityColor,
                  boxShadow: `0 0 16px ${rarityColor}33, ${isDark ? '0 8px 24px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.1)'}`,
                } : {},
                '@media (prefers-reduced-motion: reduce)': {
                  transition: 'none',
                  '&:hover': { transform: 'none' },
                },
              }}
              role={isClickable ? 'button' : undefined}
              tabIndex={isClickable ? 0 : undefined}
              aria-label={isClickable ? `Trade ${card.card_name}, ${rarityName}${isAvailable ? '' : ', not available'}` : undefined}
              onClick={() => isClickable && onTradeClick(card)}
              onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onTradeClick(card); } } : undefined}
            >
              {/* Card Image — viewport-gated to prevent first-load image storm.
                  Before: all cards fetched immediately (200+ GETs per set).
                  After: browser defers to IntersectionObserver-equivalent. */}
              <CardMedia
                component="img"
                image={getCardImageUrl(card)}
                alt={card.card_name}
                loading="lazy"
                decoding="async"
                onError={() => handleImageError(card.backend_id)}
                sx={{
                  height: 200,
                  objectFit: 'contain',
                  bgcolor: isDark ? 'grey.900' : 'grey.100',
                  p: 1,
                  borderRadius: '12px 12px 0 0',
                }}
              />

              {/* Card Info */}
              <CardContent sx={{ flexGrow: 1, py: 1.5, px: 1.5 }}>
                <Typography
                  variant="subtitle2"
                  fontWeight="bold"
                  noWrap
                  title={card.card_name}
                >
                  {card.card_name}
                </Typography>

                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
                  <Chip
                    size="small"
                    label={card.rarity_code}
                    sx={{
                      bgcolor: rarityColor,
                      color: RARITY_CHIP_TEXT[card.rarity_code] || '#ffffff',
                      fontWeight: 'bold',
                      fontSize: '0.6875rem',
                      height: 20,
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    #{card.card_number || '?'}
                  </Typography>
                </Box>

                {/* Availability */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.75 }}>
                  {flairMode ? (
                    (card.status === 'trade_ready' || card.tradeReady) ? (
                      <>
                        <CheckCircleIcon sx={{ fontSize: 13, color: 'success.main' }} />
                        <Typography variant="caption" color="success.main" fontWeight={600}>
                          Ready to send
                        </Typography>
                      </>
                    ) : (card.status === 'reserve_low' || ((card.maxCopies || 0) >= 10 && (card.maxCopies || 0) < 11)) ? (
                      <>
                        <WarningIcon sx={{ fontSize: 13, color: 'warning.main' }} />
                        <Typography variant="caption" color="warning.main" fontWeight={600}>
                          Low stock
                        </Typography>
                      </>
                    ) : (
                      <>
                        <WarningIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                        <Typography variant="caption" color="text.disabled">
                          Unavailable
                        </Typography>
                      </>
                    )
                  ) : isAvailable ? (
                    <>
                      <CheckCircleIcon sx={{ fontSize: 13, color: 'success.main' }} />
                      <Typography variant="caption" color="success.main" fontWeight={600}>
                        Available
                      </Typography>
                    </>
                  ) : (
                    <>
                      <WarningIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
                      <Typography variant="caption" color="text.disabled">
                        Not available
                      </Typography>
                    </>
                  )}
                </Box>

                {flairMode ? (
                  /* Gold-flair fleet stock — maxCopies is one bot's stack, not
                     user-owned inventory or total stock. */
                  <>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.4 }}>
                      <InventoryIcon sx={{ fontSize: 13, color: (card.maxCopies || 0) >= 11 ? 'info.main' : 'text.disabled' }} />
                      <Typography variant="caption" color={(card.maxCopies || 0) >= 11 ? 'info.main' : 'text.disabled'}>
                        Top bot: {card.maxCopies || 0} copies
                      </Typography>
                    </Box>
                    {(() => {
                      const framed = card.alreadyFramed || card.observedFrameStock;
                      const ready = card.status === 'trade_ready' || card.tradeReady;
                      const low = card.status === 'reserve_low' || ((card.maxCopies || 0) >= 10 && (card.maxCopies || 0) < 11);
                      const detail = framed ? 'Frame in stock' : ready ? 'Will mint' : low ? 'Need 11 copies' : null;
                      return detail ? (
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.3 }}>
                          {detail}
                        </Typography>
                      ) : null;
                    })()}
                  </>
                ) : (
                  /* User's inventory */
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.4 }}>
                    <InventoryIcon sx={{ fontSize: 13, color: card.user_owned > 0 ? 'info.main' : 'text.disabled' }} />
                    <Typography
                      variant="caption"
                      color={card.user_owned > 0 ? 'info.main' : 'text.disabled'}
                    >
                      {card.user_owned || 0} owned
                    </Typography>
                  </Box>
                )}

                {/* Sand cost for premium cards */}
                {card.sandCost > 0 && (
                  <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5, fontWeight: 600 }}>
                    {card.sandCost.toLocaleString()} Bright Sand
                  </Typography>
                )}
              </CardContent>

              {/* Trade Button */}
              <CardActions sx={{ p: 1, pt: 0 }}>
                <Tooltip
                  title={
                    flairMode
                      ? (!isAvailable
                          ? ((card.status === 'reserve_low' || ((card.maxCopies || 0) >= 10 && (card.maxCopies || 0) < 11))
                              ? `Top bot has only ${card.maxCopies || 0} copies — needs 11 (10 to mint + 1 to send)`
                              : 'No bot has enough copies of this card yet')
                          : isDisabled
                          ? 'Trade request pending'
                          : 'Bot will mint & send the gold-framed card (~1–2 min)')
                      : (!isAvailable
                          ? 'No bots have this card'
                          : isDisabled
                          ? 'Trade request pending'
                          : `Trade for ${card.card_name}`)
                  }
                >
                  <span style={{ width: '100%' }}>
                    <Button
                      fullWidth
                      variant={isAvailable ? 'contained' : 'outlined'}
                      color={isAvailable ? 'primary' : 'inherit'}
                      startIcon={<SwapHorizIcon />}
                      disabled={!isAvailable || isDisabled}
                      onClick={(e) => { e.stopPropagation(); onTradeClick && onTradeClick(card); }}
                      size="small"
                      sx={{
                        textTransform: 'none',
                        fontWeight: 'bold',
                        borderRadius: '8px',
                        ...(isAvailable && !isDisabled ? {
                          background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                          '&:hover': {
                            background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.dark})`,
                          },
                        } : {}),
                      }}
                    >
                      Trade
                    </Button>
                  </span>
                </Tooltip>
              </CardActions>
            </Card>
          </Grid>
        );
      })}
    </Grid>
  );
}
