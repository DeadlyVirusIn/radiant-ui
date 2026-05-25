import { useState, useEffect, useCallback, memo } from 'react'
import { useTheme } from '@mui/material/styles'
import {
  Box,
  Typography,
  Grid,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  Divider,
} from '@mui/material'
import {
  CatchingPokemon as PokeballIcon,
  Star as StarIcon,
  Replay as ReplayIcon,
  History as HistoryIcon,
  HourglassEmpty as HourglassIcon,
  AutoAwesome as GoldIcon,
  Share as ShareIcon,
} from '@mui/icons-material'
import { FormControlLabel, Switch, Tooltip } from '@mui/material'
import { tasks, cards as cardsApi, fetchWithAuth } from '../services/api'
import { useAccount } from '../contexts/AccountContext'
import { getCardDisplayName } from '../hooks/useLocalizedCards'
import { useThemeMode } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'
import { RARITY_COLORS } from '../constants/gameData'
import { getRarityChipTextColor } from '../constants/rarityConfig'
import { EmptyState } from '../components/EmptyState'
import { FadeIn, StaggerContainer, StaggerItem } from '../components/Animations'
import { PackOpenSkeleton } from '../components/LoadingSkeleton'
import PageHeader from '../components/PageHeader'
import AccountSelector from '../components/AccountSelector'
import LoadingButton from '../components/LoadingButton'

// Rarity to stars
const RARITY_STARS = {
  'C': 1,
  'U': 2,
  'R': 3,
  'RR': 4,
  'AR': 4,
  'SR': 4,
  'SAR': 4,
  'IM': 4,
  'UR': 5,
}

/** Stable card image — prevents flicker from parent re-renders */
const StableCardImage = memo(function StableCardImage({ src, alt, sx }) {
  const [failed, setFailed] = useState(false)
  const imgSrc = failed ? '/card-placeholder.png' : (src || '/card-placeholder.png')
  return (
    <Box component="img" src={imgSrc} alt={alt || 'Card'}
      sx={{ width: '100%', aspectRatio: '5/7', objectFit: 'contain', display: 'block', ...sx }}
      onError={() => { if (!failed) setFailed(true) }}
    />
  )
})

function OpenPack({ user }) {
  const { isDark } = useThemeMode()
  const theme = useTheme()
  const { t } = useLanguage()
  const { accounts: linkedAccounts, selectedAccountId, selectAccount, loading: accountsLoading } = useAccount()
  const selectedAccount = selectedAccountId ? String(selectedAccountId) : ''
  const [selectedPack, setSelectedPack] = useState('')
  const [loading, setLoading] = useState(false)
  const [opening, setOpening] = useState(false)
  const [error, setError] = useState('')

  // Available packs (loaded from API)
  const [availablePacks, setAvailablePacks] = useState([])
  const [packsLoading, setPacksLoading] = useState(true)

  // Resources state
  const [resources, setResources] = useState(null)
  const [resourcesLoading, setResourcesLoading] = useState(false)

  // Pack opening state
  const [showResults, setShowResults] = useState(false)
  const [pulledCards, setPulledCards] = useState([])
  const [revealedCards, setRevealedCards] = useState([])
  const [bulkPacks, setBulkPacks] = useState(null) // For bulk opens: array of {packIndex, cards}
  const [openMode, setOpenMode] = useState(null) // Track which mode was used
  const [doShare, setDoShare] = useState(false) // Share wonder pick to friends (default off)

  // Pack history (stored in localStorage)
  const [packHistory, setPackHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('packOpenHistory') || '[]')
    } catch { return [] }
  })
  const [historyExpanded, setHistoryExpanded] = useState(false)

  useEffect(() => {
    loadPacks()
  }, [])

  const loadPacks = async () => {
    try {
      const response = await fetchWithAuth('/tasks/packs')
      const data = await response.json()
      if (data.packs && data.packs.length > 0) {
        setAvailablePacks(data.packs)
        if (!selectedPack) {
          setSelectedPack(data.packs[data.packs.length - 1].packId)
        }
      }
    } catch (err) {
      console.error('Failed to load packs:', err)
      setError('Failed to load packs: ' + err.message)
    } finally {
      setPacksLoading(false)
    }
  }

  const loadResources = useCallback(async (accountId) => {
    if (!accountId) return
    setResourcesLoading(true)
    try {
      const data = await tasks.getResources(accountId)
      setResources(data)
    } catch (err) {
      console.error('Failed to load resources:', err)
    } finally {
      setResourcesLoading(false)
    }
  }, [])

  // Load resources when account changes
  useEffect(() => {
    if (selectedAccount) {
      loadResources(selectedAccount)
    }
  }, [selectedAccount, loadResources])

  // Open a pack (calls REAL API)
  const handleOpenPack = async (mode = 'hourglass') => {
    if (!selectedAccount) {
      setError('Please select an account first')
      return
    }

    if (!selectedPack) {
      setError('Please select a pack first')
      return
    }

    setError('')
    setOpening(true)
    setPulledCards([])
    setRevealedCards([])
    setBulkPacks(null)
    setOpenMode(mode)
    setShowResults(true)

    try {
      if (mode === 'premium') {
        // Premium subscription free pack
        const result = await tasks.openPackPremium(selectedAccount, selectedPack, doShare)

        if (result.error) {
          setError(result.error)
          setShowResults(false)
        } else if (result.cards && result.cards.length > 0) {
          setPulledCards(result.cards)
          revealCardsSequentially(result.cards)

          const packInfo = availablePacks.find(p => p.packId === selectedPack)
          const historyEntry = {
            id: Date.now(),
            packName: packInfo?.label || selectedPack,
            setCode: packInfo?.setCode || '',
            cards: result.cards,
            totalStars: result.cards.reduce((sum, c) => sum + (RARITY_STARS[c.rarity_code] || 1), 0),
            timestamp: new Date().toISOString(),
            usedFreePack: true,
            isPremiumPack: true,
          }
          const newHistory = [historyEntry, ...packHistory].slice(0, 50)
          setPackHistory(newHistory)
          localStorage.setItem('packOpenHistory', JSON.stringify(newHistory))
        } else {
          setError('No cards returned from premium pack')
          setShowResults(false)
        }
      } else if (mode === 'bulk') {
        // Bulk open 10 packs
        const result = await tasks.openPackBulk(selectedAccount, selectedPack, doShare)

        if (result.error) {
          setError(result.error)
          setShowResults(false)
        } else if (result.packs && result.packs.length > 0) {
          setBulkPacks(result.packs)
          // Flatten all cards for sequential reveal
          const allCards = result.packs.flatMap(p => p.cards)
          setPulledCards(allCards)
          revealCardsSequentially(allCards)

          // Save each pack to history
          result.packs.forEach((pack, idx) => {
            const packInfo = availablePacks.find(p => p.packId === selectedPack)
            const historyEntry = {
              id: Date.now() + idx,
              packName: packInfo?.label || selectedPack,
              setCode: packInfo?.setCode || '',
              cards: pack.cards,
              totalStars: pack.cards.reduce((sum, c) => sum + (RARITY_STARS[c.rarity_code] || 1), 0),
              timestamp: new Date().toISOString(),
              bulk: true,
              bulkIndex: idx + 1,
              bulkTotal: result.packs.length,
            }
            setPackHistory(prev => {
              const updated = [historyEntry, ...prev].slice(0, 50)
              localStorage.setItem('packOpenHistory', JSON.stringify(updated))
              return updated
            })
          })
        } else {
          setError('No packs returned from bulk opening')
          setShowResults(false)
        }
      } else {
        // Single pack (free or hourglass - smart opener handles both)
        const result = await tasks.openPackReal(selectedAccount, selectedPack, 'HOURGLASS', doShare)

        if (result.error) {
          setError(result.error)
          setShowResults(false)
        } else if (result.cards && result.cards.length > 0) {
          setPulledCards(result.cards)
          revealCardsSequentially(result.cards)

          // Save to history
          const packInfo = availablePacks.find(p => p.packId === selectedPack)
          const historyEntry = {
            id: Date.now(),
            packName: packInfo?.label || selectedPack,
            setCode: packInfo?.setCode || '',
            cards: result.cards,
            totalStars: result.cards.reduce((sum, c) => sum + (RARITY_STARS[c.rarity_code] || 1), 0),
            timestamp: new Date().toISOString(),
            usedFreePack: result.usedFreePack || false,
            chargersUsed: result.chargersUsed || null,
          }
          const newHistory = [historyEntry, ...packHistory].slice(0, 50)
          setPackHistory(newHistory)
          localStorage.setItem('packOpenHistory', JSON.stringify(newHistory))
        } else {
          setError('No cards returned from pack opening')
          setShowResults(false)
        }
      }

      // Refresh resources after opening
      loadResources(selectedAccount)
    } catch (err) {
      setError(err.message || 'Failed to open pack')
      setShowResults(false)
    } finally {
      setOpening(false)
    }
  }

  // Reveal cards one by one with animation
  const revealCardsSequentially = (cards) => {
    cards.forEach((card, index) => {
      setTimeout(() => {
        setRevealedCards(prev => [...prev, card])
      }, index * 600)
    })
  }

  // Close results and reset
  const handleClose = () => {
    setShowResults(false)
    setPulledCards([])
    setRevealedCards([])
    setBulkPacks(null)
    setOpenMode(null)
  }

  // Calculate total stars from cards
  const getTotalStars = () => {
    return revealedCards.reduce((sum, card) => {
      return sum + (RARITY_STARS[card.rarity_code] || 1)
    }, 0)
  }

  // Card flip component
  const FlipCard = ({ card, revealed, index }) => (
    <Box
      sx={{
        perspective: '1000px',
        width: { xs: 100, sm: 140, md: 160 },
        height: { xs: 140, sm: 200, md: 230 },
      }}
    >
      <Box
        sx={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.8s',
          transform: revealed ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* Card Back */}
        <Box
          sx={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            borderRadius: 2,
            background: 'linear-gradient(135deg, #1a237e 0%, #4a148c 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
            border: '3px solid #ffd700',
          }}
        >
          <PokeballIcon sx={{ fontSize: 48, color: 'rgba(255,255,255,0.3)' }} />
        </Box>

        {/* Card Front */}
        <Box
          sx={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            borderRadius: 2,
            overflow: 'hidden',
            boxShadow: revealed ? `0 4px 20px ${RARITY_COLORS[card?.rarity_code] || '#666'}66` : 'none',
            border: `3px solid ${RARITY_COLORS[card?.rarity_code] || '#666'}`,
            transition: 'transform 0.2s, box-shadow 0.2s',
            '&:hover': revealed ? {
              transform: 'rotateY(180deg) scale(1.03)',
              boxShadow: `0 8px 32px ${RARITY_COLORS[card?.rarity_code] || '#666'}88`,
            } : {},
          }}
        >
          {card && (
            <>
              <StableCardImage
                src={cardsApi.getImageUrl(card.backend_id)}
                alt={getCardDisplayName(card)}
                sx={{ height: '100%' }}
              />
              {/* Rarity badge */}
              <Box
                sx={{
                  position: 'absolute',
                  bottom: 4,
                  right: 4,
                  bgcolor: RARITY_COLORS[card.rarity_code] || '#666',
                  color: getRarityChipTextColor(card.rarity_code),
                  borderRadius: 1,
                  px: 0.75,
                  py: 0.25,
                  fontSize: '0.7rem',
                  fontWeight: 700,
                }}
              >
                {card.rarity_code}
              </Box>
            </>
          )}
        </Box>
      </Box>
    </Box>
  )

  if (loading || accountsLoading) {
    return <PackOpenSkeleton />
  }

  const freePacks = resources?.packPower?.current ?? 0
  const premiumPacks = resources?.premiumPower?.current ?? 0
  const hasPremium = resources?.premiumPower != null
  const hourglasses = resources?.hourglasses ?? 0
  const shinedust = resources?.shinedust ?? 0

  return (
    <FadeIn duration={0.3}>
    <Box>
      <PageHeader
        icon={<PokeballIcon />}
        title={t('nav.openPack')}
        subtitle={t('openpack.subtitle')}
      />

      {linkedAccounts.length === 0 ? (
        <Box
          sx={{
            p: 2.5,
            borderRadius: '14px',
            border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
            bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
          }}
        >
          <EmptyState
            icon={<PokeballIcon sx={{ fontSize: 64 }} />}
            title={t('common.noAccountsLinked')}
            description="Link an account to start opening packs"
          />
        </Box>
      ) : (
        <>
          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: '12px' }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {/* Pack Selection + Resources — compact inline bar */}
          <Box
            sx={{
              p: 2,
              mb: 3,
              borderRadius: '14px',
              border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
              bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, mb: 1.5, display: 'block' }}>
              {t('openpack.selectPack')}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
              <AccountSelector label={t('openpack.selectAccount')} hideIfSingle={false} />

              <FormControl size="small" sx={{ minWidth: 240, flex: 1 }}>
                <InputLabel>{t('openpack.selectPack')}</InputLabel>
                <Select
                  value={selectedPack}
                  onChange={(e) => setSelectedPack(e.target.value)}
                  label={t('openpack.selectPack')}
                  disabled={packsLoading}
                >
                  {packsLoading ? (
                    <MenuItem value="" disabled>Loading packs...</MenuItem>
                  ) : availablePacks.length === 0 ? (
                    <MenuItem value="" disabled>No packs available</MenuItem>
                  ) : (
                    availablePacks.map((pack) => (
                      <MenuItem key={pack.packId} value={pack.packId}>
                        {pack.label}
                      </MenuItem>
                    ))
                  )}
                </Select>
              </FormControl>

              {/* Resources inline */}
              {resourcesLoading ? (
                <CircularProgress size={20} />
              ) : resources ? (
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                  <Chip
                    icon={<PokeballIcon sx={{ fontSize: 16 }} />}
                    label={`Free: ${freePacks}`}
                    color={freePacks > 0 ? 'success' : 'default'}
                    variant={freePacks > 0 ? 'filled' : 'outlined'}
                    size="small"
                    sx={{ fontWeight: 600 }}
                  />
                  {hasPremium && (
                    <Chip
                      icon={<StarIcon sx={{ fontSize: 16 }} />}
                      label={`Premium: ${premiumPacks}`}
                      color={premiumPacks > 0 ? 'warning' : 'default'}
                      variant={premiumPacks > 0 ? 'filled' : 'outlined'}
                      size="small"
                      sx={{ fontWeight: 600 }}
                    />
                  )}
                  <Chip
                    icon={<HourglassIcon sx={{ fontSize: 16 }} />}
                    label={`HG: ${hourglasses}`}
                    color={hourglasses >= 1 ? 'primary' : 'default'}
                    variant={hourglasses >= 1 ? 'filled' : 'outlined'}
                    size="small"
                    sx={{ fontWeight: 600 }}
                  />
                  <Chip
                    icon={<GoldIcon sx={{ fontSize: 16 }} />}
                    label={`Dust: ${shinedust.toLocaleString()}`}
                    variant="outlined"
                    size="small"
                    sx={{ fontWeight: 600 }}
                  />
                </Box>
              ) : (
                <Typography variant="caption" color="text.secondary">Select an account to view resources</Typography>
              )}
            </Box>
          </Box>

          {/* Share Wonder Pick Toggle */}
          <Box sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
            <Tooltip title="When enabled, your pack opening will create a Wonder Pick for friends. Turn off to match your in-game 'Do not share' setting." arrow>
              <FormControlLabel
                control={
                  <Switch
                    checked={doShare}
                    onChange={(e) => setDoShare(e.target.checked)}
                    size="small"
                    color="primary"
                  />
                }
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <ShareIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                    <Typography variant="body2" color="text.secondary">
                      Share Wonder Pick
                    </Typography>
                  </Box>
                }
              />
            </Tooltip>
          </Box>

          {/* Open Pack Buttons */}
          <Box
            sx={{
              p: 2,
              mb: 3,
              borderRadius: '14px',
              border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
              bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
              display: 'flex',
              gap: 2,
              flexWrap: 'wrap',
            }}
          >
            {/* Free Pack Button */}
            <LoadingButton
              loading={opening && openMode === 'free'}
              size="large"
              onClick={() => handleOpenPack('free')}
              disabled={!selectedPack || freePacks === 0}
              startIcon={<PokeballIcon />}
              sx={{
                flex: 1,
                minWidth: 140,
                py: 1.5,
                borderRadius: '10px',
                fontWeight: 700,
                bgcolor: 'accent.main',
                '&:hover': { bgcolor: 'accent.dark' },
                '&.Mui-disabled': { background: 'rgba(0,0,0,0.12)' },
              }}
            >
              {opening && openMode === 'free' ? 'Opening...' : `Free Pack (${freePacks})`}
            </LoadingButton>

            {/* Premium Pack Button — only for premium subscribers */}
            {hasPremium && (
              <LoadingButton
                loading={opening && openMode === 'premium'}
                size="large"
                onClick={() => handleOpenPack('premium')}
                disabled={!selectedPack || premiumPacks === 0}
                startIcon={<StarIcon />}
                sx={{
                  flex: 1,
                  minWidth: 140,
                  py: 1.5,
                  borderRadius: '10px',
                  fontWeight: 700,
                  background: premiumPacks > 0
                    ? 'linear-gradient(135deg, #F59E0B, #D97706)'
                    : 'rgba(0,0,0,0.12)',
                  '&:hover': { background: 'linear-gradient(135deg, #D97706, #B45309)' },
                  '&.Mui-disabled': { background: 'rgba(0,0,0,0.12)' },
                  color: '#fff',
                }}
              >
                {opening && openMode === 'premium' ? 'Opening...' : `Premium Free (${premiumPacks})`}
              </LoadingButton>
            )}

            {/* Hourglass Pack Button */}
            <LoadingButton
              loading={opening && openMode === 'hourglass'}
              size="large"
              onClick={() => handleOpenPack('hourglass')}
              disabled={!selectedPack || hourglasses < 1}
              startIcon={<HourglassIcon />}
              sx={{
                flex: 1,
                minWidth: 140,
                py: 1.5,
                borderRadius: '10px',
                fontWeight: 700,
                bgcolor: 'accent.main',
                '&:hover': { bgcolor: 'accent.dark' },
                '&.Mui-disabled': { background: 'rgba(0,0,0,0.12)' },
              }}
            >
              {opening && openMode === 'hourglass' ? 'Opening...' : `1 Pack (Smart HG)`}
            </LoadingButton>

            {/* Bulk 10 Packs Button */}
            <LoadingButton
              loading={opening && openMode === 'bulk'}
              size="large"
              onClick={() => handleOpenPack('bulk')}
              disabled={!selectedPack || hourglasses < 120}
              startIcon={<StarIcon />}
              sx={{
                flex: 1,
                minWidth: 140,
                py: 1.5,
                borderRadius: '10px',
                fontWeight: 700,
                bgcolor: 'accent.main',
                '&:hover': { bgcolor: 'accent.dark' },
                '&.Mui-disabled': { background: 'rgba(0,0,0,0.12)' },
              }}
            >
              {opening && openMode === 'bulk' ? 'Opening...' : `10 Packs (120 HG)`}
            </LoadingButton>
          </Box>

          {/* Pack Preview Grid */}
          <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.72rem' }}>
            {t('openpack.availablePacks')}
          </Typography>
          <Grid container spacing={1.5} sx={{ mb: 4 }}>
            {availablePacks.slice(-8).map((pack) => (
              <Grid item xs={6} sm={4} md={3} lg={1.5} key={pack.packId}>
                <Box
                  onClick={() => setSelectedPack(pack.packId)}
                  sx={{
                    p: 1.5,
                    textAlign: 'center',
                    cursor: 'pointer',
                    borderRadius: '12px',
                    border: selectedPack === pack.packId
                      ? `2px solid ${theme.palette.primary.main}`
                      : `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
                    bgcolor: selectedPack === pack.packId
                      ? (isDark ? `${theme.palette.primary.main}18` : `${theme.palette.primary.main}0D`)
                      : (isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)'),
                    transition: 'all 0.2s',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.3)' : '0 8px 20px rgba(0,0,0,0.08)',
                      borderColor: theme.palette.primary.main,
                    },
                  }}
                >
                  <Box
                    sx={{
                      width: 52,
                      height: 72,
                      mx: 'auto',
                      mb: 1,
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #1a237e 0%, #4a148c 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <PokeballIcon sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 28 }} />
                  </Box>
                  <Typography variant="caption" sx={{ fontSize: '0.63rem', fontWeight: selectedPack === pack.packId ? 700 : 400, color: selectedPack === pack.packId ? 'primary.main' : 'text.secondary' }}>
                    {pack.name || pack.setCode}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>

          {/* Pack History Section */}
          {packHistory.length > 0 && (
            <Box
              sx={{
                mt: 2,
                borderRadius: '14px',
                border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
                bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
                overflow: 'hidden',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  px: 2.5,
                  py: 1.75,
                  borderBottom: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0,0,0,0.06)'}`,
                }}
              >
                <HistoryIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />
                <Typography variant="subtitle2" fontWeight={700}>
                  {t('openpack.packHistory')} ({packHistory.length})
                </Typography>
              </Box>
              <Box sx={{ p: 2.5 }}>
                {packHistory.slice(0, 10).map((entry) => (
                  <Box
                    key={entry.id}
                    sx={{
                      p: 2,
                      mb: 1.5,
                      borderRadius: '10px',
                      border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0,0,0,0.06)'}`,
                      bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600, fontSize: '0.85rem' }}>
                          {entry.packName}
                          {entry.bulk && (
                            <Chip label={`Pack ${entry.bulkIndex}/${entry.bulkTotal}`} size="small" sx={{ ml: 1, height: 18, fontSize: '0.6rem' }} />
                          )}
                          {entry.usedFreePack && (
                            <Chip label="FREE" size="small" color="success" sx={{ ml: 1, height: 18, fontSize: '0.6rem' }} />
                          )}
                          {entry.chargersUsed && !entry.usedFreePack && (
                            <Chip label={`${entry.chargersUsed} HG${entry.chargersUsed < 12 ? ` (saved ${12 - entry.chargersUsed})` : ''}`} size="small" color={entry.chargersUsed < 12 ? 'warning' : 'default'} sx={{ ml: 1, height: 18, fontSize: '0.6rem' }} />
                          )}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.72rem' }}>
                          {new Date(entry.timestamp).toLocaleString()}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        {[...Array(Math.min(entry.totalStars, 10))].map((_, i) => (
                          <StarIcon key={i} sx={{ color: '#ffd700', fontSize: 14 }} />
                        ))}
                        <Typography variant="caption" sx={{ ml: 0.5, fontSize: '0.72rem' }}>
                          ({entry.totalStars})
                        </Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto' }}>
                      {entry.cards.map((card, idx) => (
                        <Box
                          key={idx}
                          sx={{
                            width: 60,
                            minWidth: 52,
                            maxWidth: 70,
                            textAlign: 'center',
                            flexShrink: 0,
                          }}
                        >
                          <Box
                            sx={{
                              borderRadius: 1,
                              overflow: 'hidden',
                              border: `2px solid ${RARITY_COLORS[card.rarity_code] || '#ccc'}`,
                              mb: 0.5,
                              transition: 'transform 0.2s, box-shadow 0.2s',
                              '&:hover': {
                                transform: 'scale(1.03)',
                                boxShadow: `0 4px 12px ${RARITY_COLORS[card.rarity_code] || 'rgba(0,0,0,0.2)'}55`,
                              },
                            }}
                          >
                            <StableCardImage
                              src={cardsApi.getImageUrl(card.backend_id)}
                              alt={getCardDisplayName(card)}
                            />
                          </Box>
                          <Typography variant="caption" sx={{ fontSize: '0.58rem' }}>
                            {card.rarity_code}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                  </Box>
                ))}
                {packHistory.length > 10 && (
                  <Typography variant="caption" color="text.secondary">
                    {t('openpack.showingPacks').replace('{count}', packHistory.length)}
                  </Typography>
                )}
                <Button
                  size="small"
                  color="error"
                  onClick={() => {
                    setPackHistory([])
                    localStorage.removeItem('packOpenHistory')
                  }}
                  sx={{ mt: 1 }}
                >
                  {t('openpack.clearHistory')}
                </Button>
              </Box>
            </Box>
          )}
        </>
      )}

      {/* Pack Results Dialog */}
      <Dialog
        open={showResults}
        onClose={handleClose}
        maxWidth={openMode === 'bulk' ? 'lg' : 'md'}
        fullWidth
        PaperProps={{
          sx: {
            background: 'linear-gradient(135deg, #0d0d0d 0%, #111827 100%)',
            minHeight: 400,
            maxHeight: '90vh',
          },
        }}
      >
        <DialogContent sx={{ overflowY: 'auto' }}>
          <Box sx={{ textAlign: 'center', py: 2 }}>
            {opening ? (
              <Box sx={{ py: 8 }}>
                <CircularProgress size={60} sx={{ color: theme.palette.primary.main }} />
                <Typography color="white" sx={{ mt: 3 }}>
                  {openMode === 'bulk' ? 'Opening 10 packs...' : t('openpack.openingPack')}
                </Typography>
              </Box>
            ) : (
              <>
                <Typography variant="h5" sx={{ color: 'white', mb: 3 }}>
                  {openMode === 'bulk'
                    ? `Bulk Results - ${bulkPacks?.length || 0} Packs`
                    : t('openpack.packResults')
                  }
                </Typography>

                {/* Single pack display */}
                {openMode !== 'bulk' && (
                  <>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'center',
                        gap: { xs: 1, sm: 2 },
                        flexWrap: 'wrap',
                        mb: 4,
                      }}
                    >
                      {pulledCards.map((card, index) => (
                        <FlipCard
                          key={card.backend_id || index}
                          card={card}
                          revealed={revealedCards.includes(card)}
                          index={index}
                        />
                      ))}
                    </Box>

                    {/* Stats */}
                    {revealedCards.length === pulledCards.length && pulledCards.length > 0 && (
                      <Box sx={{ mb: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, mb: 2 }}>
                          {[...Array(Math.min(getTotalStars(), 20))].map((_, i) => (
                            <StarIcon key={i} sx={{ color: '#ffd700', fontSize: 24 }} />
                          ))}
                        </Box>
                        <Typography color="rgba(255,255,255,0.7)">
                          {getTotalStars()} {t('openpack.totalStars')}
                        </Typography>
                      </Box>
                    )}
                  </>
                )}

                {/* Bulk pack display - grouped by pack */}
                {openMode === 'bulk' && bulkPacks && (
                  <Box sx={{ textAlign: 'left' }}>
                    {bulkPacks.map((pack, packIdx) => {
                      const packStars = pack.cards.reduce((sum, c) => sum + (RARITY_STARS[c.rarity_code] || 1), 0)
                      return (
                        <Box key={packIdx} sx={{ mb: 3 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="subtitle1" sx={{ color: 'white', fontWeight: 600 }}>
                              Pack {packIdx + 1} of {bulkPacks.length}
                            </Typography>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              {[...Array(Math.min(packStars, 10))].map((_, i) => (
                                <StarIcon key={i} sx={{ color: '#ffd700', fontSize: 14 }} />
                              ))}
                              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)', ml: 0.5 }}>
                                ({packStars})
                              </Typography>
                            </Box>
                          </Box>
                          <Box
                            sx={{
                              display: 'flex',
                              gap: { xs: 0.5, sm: 1 },
                              flexWrap: 'wrap',
                              justifyContent: 'center',
                            }}
                          >
                            {pack.cards.map((card, cardIdx) => (
                              <FlipCard
                                key={`${packIdx}-${card.backend_id || cardIdx}`}
                                card={card}
                                revealed={revealedCards.includes(card)}
                                index={packIdx * 5 + cardIdx}
                              />
                            ))}
                          </Box>
                          {packIdx < bulkPacks.length - 1 && (
                            <Divider sx={{ mt: 2, borderColor: 'rgba(255,255,255,0.1)' }} />
                          )}
                        </Box>
                      )
                    })}

                    {/* Bulk summary */}
                    {revealedCards.length === pulledCards.length && pulledCards.length > 0 && (
                      <Box sx={{ textAlign: 'center', mt: 3, pt: 2, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
                        <Typography variant="h6" sx={{ color: '#ffd700', mb: 1 }}>
                          Total: {getTotalStars()} Stars from {bulkPacks.length} Packs
                        </Typography>
                        <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.5)' }}>
                          {pulledCards.length} cards opened
                        </Typography>
                      </Box>
                    )}
                  </Box>
                )}

                {/* Actions */}
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 3 }}>
                  <LoadingButton
                    loading={opening}
                    startIcon={<ReplayIcon />}
                    onClick={() => handleOpenPack(openMode || 'hourglass')}
                    sx={{
                      borderRadius: '8px',
                      background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                    }}
                  >
                    {t('openpack.openAnother')}
                  </LoadingButton>
                  <Button
                    variant="outlined"
                    onClick={handleClose}
                    sx={{ borderRadius: '8px', color: 'white', borderColor: 'rgba(255,255,255,0.3)' }}
                  >
                    {t('common.close')}
                  </Button>
                </Box>
              </>
            )}
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
    </FadeIn>
  )
}

export default OpenPack
