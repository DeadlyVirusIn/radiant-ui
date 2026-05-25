import { useState, useEffect } from 'react'
import { useTheme } from '@mui/material/styles'
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Chip,
  Grid,
  Tabs,
  Tab,
  Badge,
} from '@mui/material'
import {
  Sync as SyncIcon,
  AutoAwesome as SkinIcon,
  Palette as DecorationIcon,
  FlashOn as EffectIcon,
  Collections as CollectionIcon,
  Star as StarIcon,
} from '@mui/icons-material'
import { accounts as accountsApi, inventory as inventoryApi, cards as cardsApi } from '../services/api'
import { useThemeMode } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'
import { EmptyState } from '../components/EmptyState'
import { FadeIn, StaggerContainer, StaggerItem } from '../components/Animations'
import { CardGridSkeleton } from '../components/LoadingSkeleton'
import PageHeader from '../components/PageHeader'

// Skin name mappings (based on common skin patterns)
const SKIN_NAMES = {
  // Common skin patterns - skinId to readable name
  // Format: CARD_SKIN_{number}_{variant}
  1: 'Holographic',
  2: 'Premium',
  3: 'Limited Edition',
  4: 'Anniversary',
  5: 'Event Special',
  // Add more as discovered from proto/game data
}

// Skin type labels - colorKey resolved via theme at render time
const SKIN_TYPES = {
  DECORATION: { label: 'Decoration', icon: <DecorationIcon />, colorKey: 'secondary.light' },
  BATTLE_EFFECT: { label: 'Battle Effect', icon: <EffectIcon />, color: '#ff5722' },
  UNSPECIFIED: { label: 'Standard', icon: <SkinIcon />, color: '#2196f3' },
}

// Card skin type mapping from proto
const CARD_SKIN_TYPE_MAP = {
  0: 'UNSPECIFIED',
  1: 'DECORATION',
  2: 'BATTLE_EFFECT',
}

// Helper to resolve color from SKIN_TYPES (supports colorKey or direct color)
const resolveSkinColor = (typeInfo, theme) => {
  if (typeInfo.colorKey) {
    const [palette, shade] = typeInfo.colorKey.split('.')
    return theme.palette[palette]?.[shade] || theme.palette.primary.main
  }
  return typeInfo.color
}

// Skin Card component
const SkinCard = ({ skin }) => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const typeInfo = SKIN_TYPES[skin.type] || SKIN_TYPES.DECORATION
  const typeColor = resolveSkinColor(typeInfo, theme)

  const rarityGlow = skin.rarity
    ? `0 4px 16px ${typeColor}40`
    : `0 2px 8px ${typeColor}20`

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '14px',
        border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
        bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
        overflow: 'hidden',
        transition: 'box-shadow 0.25s ease, transform 0.25s ease',
        '&:hover': {
          transform: 'scale(1.03)',
          boxShadow: rarityGlow,
        },
      }}
    >
      <Box
        sx={{
          height: 140,
          bgcolor: `${typeColor}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {skin.amount > 1 && (
          <Badge
            badgeContent={`x${skin.amount}`}
            color="primary"
            sx={{ position: 'absolute', top: 12, right: 12 }}
          />
        )}
        <Box sx={{ textAlign: 'center' }}>
          <Box sx={{ color: typeColor, mb: 1 }}>{typeInfo.icon}</Box>
          <SkinIcon sx={{ fontSize: 48, color: typeColor, opacity: 0.7 }} />
        </Box>
      </Box>

      <Box sx={{ p: 2, flex: 1 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '1rem', mb: 0.5 }}>
          {skin.skinName}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {skin.cardName}
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Chip
            label={typeInfo.label}
            size="small"
            sx={{ bgcolor: `${typeColor}20`, color: typeColor }}
          />
          {skin.rarity && (
            <Chip
              icon={<StarIcon sx={{ fontSize: 14 }} />}
              label={skin.rarity}
              size="small"
              variant="outlined"
            />
          )}
        </Box>
      </Box>
    </Box>
  )
}

function CardSkins({ user }) {
  const { isDark } = useThemeMode()
  const theme = useTheme()
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [userAccounts, setUserAccounts] = useState([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [error, setError] = useState('')
  const [skins, setSkins] = useState([])
  const [selectedType, setSelectedType] = useState('all')

  // Load user accounts on mount
  useEffect(() => {
    loadAccounts()
  }, [])

  // Load skins when account is selected
  useEffect(() => {
    if (selectedAccount) {
      loadSkins()
    }
  }, [selectedAccount])

  const loadAccounts = async () => {
    try {
      const data = await accountsApi.list()
      const activeAccounts = (data.accounts || []).filter(a => a.is_active)
      setUserAccounts(activeAccounts)

      if (activeAccounts.length === 1) {
        setSelectedAccount(activeAccounts[0].id)
      }
    } catch (err) {
      console.error('Failed to load accounts:', err)
      setError('Failed to load accounts')
    } finally {
      setLoading(false)
    }
  }

  const loadSkins = async () => {
    if (!selectedAccount) return

    setLoadingData(true)
    setError('')

    try {
      // Fetch real skin data from PlayerResources via inventory API
      const response = await inventoryApi.getSkins(selectedAccount)

      if (response.error) {
        throw new Error(response.message || response.error)
      }

      // Get unique card IDs to lookup names
      const cardIds = [...new Set((response.skins || []).map(s => s.cardId).filter(Boolean))]

      // Fetch card metadata for name lookups
      let cardMetadata = {}
      if (cardIds.length > 0) {
        try {
          const cardsResponse = await cardsApi.list()
          const allCards = cardsResponse.cards || cardsResponse || []
          // Create lookup map by backend_id and card_id
          allCards.forEach(card => {
            if (card.backend_id) cardMetadata[card.backend_id] = card
            if (card.card_id) cardMetadata[card.card_id] = card
          })
        } catch (cardErr) {
        }
      }

      // Helper to get skin name
      const getSkinName = (skinId) => {
        if (SKIN_NAMES[skinId]) return SKIN_NAMES[skinId]
        // Parse skinId if it's a string like "CARD_SKIN_1234_01"
        if (typeof skinId === 'string' && skinId.includes('_')) {
          const parts = skinId.split('_')
          const variant = parts[parts.length - 1]
          return `Variant ${variant}`
        }
        return `Skin #${skinId}`
      }

      // Transform API response to component format with real names
      const skinData = (response.skins || []).map((skin, idx) => {
        const cardInfo = cardMetadata[skin.cardId] || {}
        return {
          id: `skin_${skin.cardId}_${skin.skinId}_${idx}`,
          cardId: skin.cardId,
          cardName: cardInfo.name || cardInfo.card_name || `Card ${skin.cardId}`,
          skinId: skin.skinId,
          skinName: getSkinName(skin.skinId),
          type: CARD_SKIN_TYPE_MAP[skin.type] || 'DECORATION',
          amount: skin.amount || 1,
          rarity: cardInfo.rarity,
        }
      })

      setSkins(skinData)
    } catch (err) {
      console.error('Failed to load skins:', err)
      setError(`Failed to load skins: ${err.message}`)
      setSkins([])
    } finally {
      setLoadingData(false)
    }
  }

  // Filter skins by type
  const filteredSkins = selectedType === 'all'
    ? skins
    : skins.filter(skin => skin.type === selectedType)

  // Count by type
  const skinCounts = {
    all: skins.length,
    DECORATION: skins.filter(s => s.type === 'DECORATION').length,
    BATTLE_EFFECT: skins.filter(s => s.type === 'BATTLE_EFFECT').length,
  }

  if (loading) {
    return <CardGridSkeleton count={8} />
  }

  return (
    <FadeIn duration={0.3}>
    <Box>
      <PageHeader
        icon={<SkinIcon />}
        title={t('nav.cardSkins') || 'Card Skins'}
        subtitle="View and manage your card skin collection"
      />

      {/* Control bar */}
      <Box
        sx={{
          p: 2,
          mt: 3,
          mb: 2,
          borderRadius: '14px',
          border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
          bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Select Account</InputLabel>
          <Select
            value={selectedAccount}
            label="Select Account"
            onChange={(e) => setSelectedAccount(e.target.value)}
          >
            {userAccounts.map((account) => (
              <MenuItem key={account.id} value={account.id}>
                {account.nickname || account.device_account?.substring(0, 8) || `Account ${account.id}`}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Button
          variant="contained"
          startIcon={loadingData ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
          onClick={loadSkins}
          disabled={!selectedAccount || loadingData}
          sx={{ background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})` }}
        >
          {loadingData ? 'Loading...' : 'Refresh'}
        </Button>

        {selectedAccount && (
          <Chip
            icon={<CollectionIcon sx={{ fontSize: 18 }} />}
            label={`${skins.length} Skins`}
            color="primary"
            variant="outlined"
            size="small"
            sx={{ ml: 'auto' }}
          />
        )}
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        Card skins are fetched from your game account. Select an account and click Refresh to load your skin collection.
      </Alert>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* No account selected */}
      {!selectedAccount && (
        <Box
          sx={{
            p: 2.5,
            borderRadius: '14px',
            border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
            bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
          }}
        >
          <EmptyState
            icon={<SkinIcon sx={{ fontSize: 64 }} />}
            title="Select an account to view card skins"
            description="Choose an account above and click Refresh to load your skin collection"
          />
        </Box>
      )}

      {/* Loading */}
      {selectedAccount && loadingData && (
        <CardGridSkeleton count={8} />
      )}

      {/* Skins content */}
      {selectedAccount && !loadingData && (
        <>
          {/* Type tabs */}
          <Box
            sx={{
              mb: 3,
              borderRadius: '14px',
              border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
              bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
              overflow: 'hidden',
            }}
          >
            <Tabs
              value={selectedType}
              onChange={(e, v) => setSelectedType(v)}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab
                value="all"
                label={`All (${skinCounts.all})`}
                icon={<CollectionIcon sx={{ fontSize: 20 }} />}
                iconPosition="start"
              />
              <Tab
                value="DECORATION"
                label={`Decorations (${skinCounts.DECORATION})`}
                icon={<DecorationIcon sx={{ fontSize: 20 }} />}
                iconPosition="start"
              />
              <Tab
                value="BATTLE_EFFECT"
                label={`Battle Effects (${skinCounts.BATTLE_EFFECT})`}
                icon={<EffectIcon sx={{ fontSize: 20 }} />}
                iconPosition="start"
              />
            </Tabs>
          </Box>

          {/* Skins grid */}
          {filteredSkins.length > 0 ? (
            <StaggerContainer staggerDelay={0.03}>
              <Grid container spacing={3}>
                {filteredSkins.map((skin) => (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={skin.id}>
                    <StaggerItem>
                      <SkinCard skin={skin} />
                    </StaggerItem>
                  </Grid>
                ))}
              </Grid>
            </StaggerContainer>
          ) : (
            <Box
              sx={{
                p: 2.5,
                borderRadius: '14px',
                border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
                bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
              }}
            >
              <EmptyState
                icon={<SkinIcon sx={{ fontSize: 64 }} />}
                title={selectedType === 'all'
                  ? 'No card skins in your collection yet'
                  : `No ${SKIN_TYPES[selectedType]?.label.toLowerCase()} skins found`}
              />
            </Box>
          )}
        </>
      )}
    </Box>
    </FadeIn>
  )
}

export default CardSkins
