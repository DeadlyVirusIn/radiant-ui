/**
 * Pack Recommendation Component
 * Recommends the best pack to open based on collection gaps
 */

import { useState, useEffect, useRef } from 'react'
import {
  Box,
  Typography,
  Paper,
  Grid,
  Chip,
  LinearProgress,
  Button,
  CircularProgress,
  Collapse,
  IconButton,
  Tooltip,
  Divider,
} from '@mui/material'
import {
  Recommend as RecommendIcon,
  Star as StarIcon,
  TrendingUp as TrendingUpIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
  CatchingPokemon as PokeballIcon,
} from '@mui/icons-material'
import { collection as collectionApi } from '../services/api'
import { RARITY_COLORS } from '../constants/gameData'
import { getRarityChipTextColor } from '../constants/rarityConfig'

// Pack data with set codes.
// Phase 5.17 — B3 LIVE 2026-04-27 (frida verified). Single pack with
// both cover Pokemon. unverified flag dropped.
const PACKS = [
  { name: 'Pulsing Aura',    setCode: 'B3',  packId: 'BN006_0010_00_000', color: '#FFB300' },
  { name: 'Paldean Wonders', setCode: 'B2A', packId: 'BN004_0010_00_000', color: '#4CAF50' },
  { name: 'Gardevoir', setCode: 'B2', packId: 'BN003_0010_00_000', color: '#E91E63' },
  { name: 'Crimson Blaze', setCode: 'B1A', packId: 'BN002_0010_00_000', color: '#FF5722' },
  { name: 'Mega Blaziken', setCode: 'B1', packId: 'BN001_0010_00_000', color: '#FF6B6B' },
  { name: 'Mega Gyarados', setCode: 'B1', packId: 'BN001_0020_00_000', color: '#2196F3' },
  { name: 'Mega Altaria', setCode: 'B1', packId: 'BN001_0030_00_000', color: '#81D4FA' },
  { name: 'Deluxe Pack ex', setCode: 'A4B', packId: 'AN011_0010_00_000', color: '#9C27B0' },
  { name: 'Secluded Springs', setCode: 'A4A', packId: 'AN010_0010_00_000', color: '#00BCD4' },
  { name: 'Ho-Oh', setCode: 'A4', packId: 'AN009_0010_00_000', color: '#FF9800' },
  { name: 'Lugia', setCode: 'A4', packId: 'AN009_0020_00_000', color: '#90CAF9' },
  { name: 'Eevee Grove', setCode: 'A3B', packId: 'AN008_0010_00_000', color: '#8BC34A' },
  { name: 'Dimensional Crisis', setCode: 'A3A', packId: 'AN007_0010_00_000', color: '#FF5722' },
  { name: 'Solgaleo', setCode: 'A3', packId: 'AN006_0010_00_000', color: '#FF9800' },
  { name: 'Lunala', setCode: 'A3', packId: 'AN006_0020_00_000', color: '#673AB7' },
  { name: 'Shining Revelry', setCode: 'A2B', packId: 'AN005_0010_00_000', color: '#E91E63' },
  { name: 'Triumphant Light', setCode: 'A2A', packId: 'AN004_0010_00_000', color: '#FFC107' },
  { name: 'Dialga', setCode: 'A2', packId: 'AN003_0010_00_000', color: '#2196F3' },
  { name: 'Palkia', setCode: 'A2', packId: 'AN003_0020_00_000', color: '#E91E63' },
  { name: 'Mythical Island', setCode: 'A1A', packId: 'AN002_0010_00_000', color: '#009688' },
  { name: 'Mewtwo', setCode: 'A1', packId: 'AN001_0010_00_000', color: '#9C27B0' },
  { name: 'Charizard', setCode: 'A1', packId: 'AN001_0020_00_000', color: '#FF5722' },
  { name: 'Pikachu', setCode: 'A1', packId: 'AN001_0030_00_000', color: '#FFC107' },
]

// Rarity weights for scoring
const RARITY_WEIGHTS = {
  'C': 1,
  'U': 2,
  'R': 5,
  'RR': 15,
  'AR': 25,
  'SR': 50,
  'SAR': 100,
  'IM': 150,
  'UR': 200,
}


function PackRecommendation({ compact = false }) {
  // Wave 1.1: viewport-gated mount. This component previously kicked off
  // 23 sequential API calls (1 summary + 22 sequential getSet) the moment
  // it mounted — even if off-screen. Now we defer the fetch until either:
  //   (a) the component scrolls into view (IntersectionObserver), OR
  //   (b) the user expands it (click).
  // For cold Tracker loads where the component sits below the fold, this
  // eliminates the fan-out entirely until the user shows intent.
  const [loading, setLoading] = useState(false)
  const [recommendations, setRecommendations] = useState([])
  const [expanded, setExpanded] = useState(!compact)
  const [showDetails, setShowDetails] = useState(false)
  const [loaded, setLoaded] = useState(false)   // have we done the fetch yet?
  const containerRef = useRef(null)

  // Kick off the fetch when the card scrolls into view (or immediately in
  // the non-compact / always-visible case).
  useEffect(() => {
    if (loaded) return

    // Fallback for environments without IntersectionObserver
    if (typeof IntersectionObserver === 'undefined') {
      loadRecommendations()
      return
    }

    const node = containerRef.current
    if (!node) return

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          loadRecommendations()
          observer.disconnect()
          break
        }
      }
    }, { rootMargin: '200px' }) // start loading slightly before visible

    observer.observe(node)
    return () => observer.disconnect()
  }, [loaded])

  const loadRecommendations = async (force = false) => {
    if (!force && (loaded || loading)) return
    setLoading(true)
    setLoaded(true)
    try {
      // Get collection summary
      const summaryData = await collectionApi.getSummary()
      const sets = summaryData.sets || []

      // Wave 1.1: batch set fetches — unique setCodes, parallel.
      // Before: 22 sequential awaits (≈500ms–2s wall time, bypasses dedup).
      // After: 15 parallel requests, ~1 round-trip wall time. With the
      // in-flight dedup layer (services/api.js) any duplicate setCode
      // coming from another component collapses to a single network call.
      const uniqueSetCodes = [...new Set(
        PACKS
          .filter(p => sets.some(s => s.set_code === p.setCode))
          .map(p => p.setCode)
      )]
      const setDataPairs = await Promise.all(
        uniqueSetCodes.map(async code => {
          try {
            return [code, await collectionApi.getSet(code)]
          } catch {
            return [code, null]
          }
        })
      )
      const setDataMap = Object.fromEntries(setDataPairs)

      // Calculate pack scores
      const packScores = []

      for (const pack of PACKS) {
        // Find the set data
        const setInfo = sets.find(s => s.set_code === pack.setCode)
        if (!setInfo) continue

        // Lookup pre-fetched set data
        const setData = setDataMap[pack.setCode]
        if (!setData) continue
        const cards = setData.cards || []

        // Calculate missing cards by rarity
        const missingByRarity = {}
        let totalScore = 0
        let missingCount = 0

        for (const card of cards) {
          if (card.owned === 0) {
            const rarity = card.rarity_code || 'C'
            missingByRarity[rarity] = (missingByRarity[rarity] || 0) + 1
            totalScore += RARITY_WEIGHTS[rarity] || 1
            missingCount++
          }
        }

        // Calculate completion percentage
        const completion = setInfo.percentage || 0
        const remaining = 100 - completion

        packScores.push({
          ...pack,
          score: totalScore,
          missingCount,
          totalCards: cards.length,
          completion,
          remaining,
          missingByRarity,
          valuePerPack: missingCount > 0 ? totalScore / missingCount : 0,
        })
      }

      // Sort by score (highest = most valuable missing cards)
      packScores.sort((a, b) => b.score - a.score)

      setRecommendations(packScores.slice(0, 5)) // Top 5
    } catch (error) {
      console.error('Failed to load recommendations:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRecommendationReason = (pack, index) => {
    if (index === 0) {
      const highRarities = ['SR', 'SAR', 'IM', 'UR'].filter(r => pack.missingByRarity[r] > 0)
      if (highRarities.length > 0) {
        return `Best value! Missing ${highRarities.map(r => `${pack.missingByRarity[r]} ${r}`).join(', ')}`
      }
      return `Highest priority - ${pack.missingCount} cards missing`
    }
    if (pack.remaining > 50) {
      return `Low completion (${pack.completion.toFixed(0)}%) - lots to collect`
    }
    return `${pack.missingCount} cards needed for completion`
  }

  // Idle state: not yet loaded, not loading. Shows a lightweight
  // placeholder with the observer attached so IntersectionObserver can
  // trigger the fetch when the card scrolls into view. Same height as the
  // real card to prevent layout shift.
  if (!loaded && !loading) {
    return (
      <Paper ref={containerRef} sx={{ p: 3, minHeight: compact ? 60 : 120 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.disabled' }}>
          <RecommendIcon />
          <Typography variant="body2">Pack recommendations load when visible…</Typography>
        </Box>
      </Paper>
    )
  }

  if (loading) {
    return (
      <Paper ref={containerRef} sx={{ p: 3, textAlign: 'center' }}>
        <CircularProgress size={24} />
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Analyzing collection...
        </Typography>
      </Paper>
    )
  }

  if (compact && !expanded) {
    return (
      <Paper
        ref={containerRef}
        sx={{ p: 2, cursor: 'pointer' }}
        onClick={() => setExpanded(true)}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <RecommendIcon color="primary" />
            <Typography variant="subtitle2">Best Pack:</Typography>
            {recommendations[0] && (
              <Chip
                label={recommendations[0].name}
                size="small"
                sx={{ bgcolor: recommendations[0].color, color: 'white' }}
              />
            )}
          </Box>
          <ExpandMoreIcon color="action" />
        </Box>
      </Paper>
    )
  }

  return (
    <Paper ref={containerRef} sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <RecommendIcon color="primary" />
          <Typography variant="h6">Pack Recommendations</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Tooltip title="Refresh recommendations">
            <IconButton size="small" onClick={() => loadRecommendations(true)} aria-label="Refresh recommendations">
              <RefreshIcon />
            </IconButton>
          </Tooltip>
          {compact && (
            <IconButton size="small" onClick={() => setExpanded(false)} aria-label="Collapse recommendations">
              <ExpandLessIcon />
            </IconButton>
          )}
        </Box>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Based on your missing cards, weighted by rarity value
      </Typography>

      {recommendations.length === 0 ? (
        <Typography color="text.secondary">No recommendations available</Typography>
      ) : (
        <Grid container spacing={2}>
          {recommendations.map((pack, index) => (
            <Grid item xs={12} key={pack.packId}>
              <Paper
                elevation={index === 0 ? 3 : 1}
                sx={{
                  p: 2,
                  border: index === 0 ? '2px solid' : '1px solid',
                  borderColor: index === 0 ? pack.color : 'divider',
                  bgcolor: index === 0 ? `${pack.color}10` : 'background.paper',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                  {/* Rank Badge */}
                  <Box
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      bgcolor: index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : 'action.hover',
                      color: index < 3 ? 'black' : 'text.secondary',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {index + 1}
                  </Box>

                  {/* Pack Info */}
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <Chip
                        label={pack.name}
                        size="small"
                        sx={{ bgcolor: pack.color, color: 'white', fontWeight: 600 }}
                      />
                      <Chip
                        label={pack.setCode}
                        size="small"
                        variant="outlined"
                      />
                      {index === 0 && (
                        <Chip
                          icon={<StarIcon sx={{ fontSize: 14 }} />}
                          label="Best Choice"
                          size="small"
                          sx={{ bgcolor: '#ffd700', color: 'black' }}
                        />
                      )}
                    </Box>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {getRecommendationReason(pack, index)}
                    </Typography>

                    {/* Stats Row */}
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 1 }}>
                      <Typography variant="caption" color="text.secondary">
                        Missing: <strong>{pack.missingCount}</strong> / {pack.totalCards}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Completion: <strong>{pack.completion.toFixed(1)}%</strong>
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Value Score: <strong>{pack.score}</strong>
                      </Typography>
                    </Box>

                    {/* Missing by Rarity */}
                    {Object.keys(pack.missingByRarity).length > 0 && (
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                        {Object.entries(pack.missingByRarity)
                          .sort((a, b) => (RARITY_WEIGHTS[b[0]] || 0) - (RARITY_WEIGHTS[a[0]] || 0))
                          .map(([rarity, count]) => (
                            <Chip
                              key={rarity}
                              label={`${count} ${rarity}`}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.65rem',
                                bgcolor: RARITY_COLORS[rarity] || '#666',
                                color: getRarityChipTextColor(rarity),
                              }}
                            />
                          ))}
                      </Box>
                    )}

                    {/* Progress Bar */}
                    <LinearProgress
                      variant="determinate"
                      value={pack.completion}
                      sx={{
                        mt: 1.5,
                        height: 6,
                        borderRadius: 3,
                        bgcolor: 'rgba(0,0,0,0.1)',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 3,
                          bgcolor: pack.color,
                        },
                      }}
                    />
                  </Box>
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Show more details toggle */}
      {recommendations.length > 0 && (
        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Button
            size="small"
            onClick={() => setShowDetails(!showDetails)}
            endIcon={showDetails ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          >
            {showDetails ? 'Hide' : 'Show'} Scoring Details
          </Button>

          <Collapse in={showDetails}>
            <Paper sx={{ p: 2, mt: 2, bgcolor: 'action.hover' }}>
              <Typography variant="subtitle2" gutterBottom>How Scores Are Calculated</Typography>
              <Typography variant="caption" component="div" color="text.secondary">
                Each missing card is weighted by rarity:
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                {Object.entries(RARITY_WEIGHTS).map(([rarity, weight]) => (
                  <Chip
                    key={rarity}
                    label={`${rarity}: ${weight}pts`}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.65rem' }}
                  />
                ))}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                Higher scores mean more valuable cards are missing from that pack.
              </Typography>
            </Paper>
          </Collapse>
        </Box>
      )}
    </Paper>
  )
}

export default PackRecommendation
