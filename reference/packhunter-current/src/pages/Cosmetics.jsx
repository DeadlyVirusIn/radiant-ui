import { useState, useEffect } from 'react'
import { useTheme } from '@mui/material/styles'
import PageHeader from '../components/PageHeader'
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
  Avatar,
} from '@mui/material'
import {
  Sync as SyncIcon,
  Palette as CosmeticIcon,
  Shield as ShieldIcon,
  TableChart as MatIcon,
  MonetizationOn as CoinIcon,
  Folder as FileIcon,
  Dashboard as BoardIcon,
  EmojiEvents as EmblemIcon,
  Face as IconIcon,
  Collections as CollectionIcon,
} from '@mui/icons-material'
import { accounts as accountsApi, inventory as inventoryApi } from '../services/api'
import { useThemeMode } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'
import { RARITY_COLORS } from '../constants/gameData'
import { EmptyState } from '../components/EmptyState'
import { FadeIn, StaggerContainer, StaggerItem } from '../components/Animations'
import { CardGridSkeleton } from '../components/LoadingSkeleton'

// Cosmetic categories
const COSMETIC_CATEGORIES = {
  deck_shield: { label: 'Deck Shields', icon: <ShieldIcon />, color: '#2196f3' },
  play_mat: { label: 'Play Mats', icon: <MatIcon />, color: '#4caf50' },
  coin_skin: { label: 'Coin Skins', icon: <CoinIcon />, color: '#ffd700' },
  collection_file: { label: 'Collection Files', icon: <FileIcon />, colorKey: 'secondary.light' },
  collection_board: { label: 'Collection Boards', icon: <BoardIcon />, color: '#ff5722' },
  emblem: { label: 'Emblems', icon: <EmblemIcon />, colorKey: 'primary.main' },
  icon: { label: 'Profile Icons', icon: <IconIcon />, color: '#00bcd4' },
}

// Peripheral goods type mapping from proto
const PERIPHERAL_TYPE_MAP = {
  DECK_SHIELD: 'deck_shield',
  PLAY_MAT: 'play_mat',
  COIN_SKIN: 'coin_skin',
  COLLECTION_FILE: 'collection_file',
  COLLECTION_BOARD: 'collection_board',
}

// Profile decoration type mapping from proto
const DECORATION_TYPE_MAP = {
  EMBLEM: 'emblem',
  ICON: 'icon',
}

// Helper to resolve color from category config (supports colorKey or direct color)
const resolveCategoryColor = (catInfo, theme) => {
  if (catInfo.colorKey) {
    const [palette, shade] = catInfo.colorKey.split('.')
    return theme.palette[palette]?.[shade] || theme.palette.primary.main
  }
  return catInfo.color
}

// Cosmetic Card component
const CosmeticCard = ({ cosmetic }) => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const categoryInfo = COSMETIC_CATEGORIES[cosmetic.category] || COSMETIC_CATEGORIES.deck_shield
  const catColor = resolveCategoryColor(categoryInfo, theme)
  const rarityColor = RARITY_COLORS[cosmetic.rarity] || RARITY_COLORS.Common

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: '14px',
        border: `1px solid ${cosmetic.owned
          ? `${catColor}40`
          : isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
        bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
        opacity: cosmetic.owned ? 1 : 0.5,
        overflow: 'hidden',
        transition: 'box-shadow 0.25s ease, transform 0.25s ease',
        '&:hover': {
          transform: 'scale(1.03)',
          boxShadow: `0 4px 16px ${catColor}30`,
        },
      }}
    >
      <Box
        sx={{
          height: 100,
          bgcolor: `${catColor}15`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {!cosmetic.owned && (
          <Chip
            label="Not Owned"
            size="small"
            sx={{
              position: 'absolute',
              top: 8,
              right: 8,
              bgcolor: 'rgba(0,0,0,0.6)',
              color: 'white',
            }}
          />
        )}
        <Box sx={{ color: catColor }}>{categoryInfo.icon}</Box>
      </Box>

      <Box sx={{ p: 2, flex: 1 }}>
        <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
          {cosmetic.name}
        </Typography>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
          <Chip
            label={cosmetic.rarity}
            size="small"
            sx={{ bgcolor: `${rarityColor}20`, color: rarityColor, fontWeight: 500 }}
          />
          {cosmetic.owned && (
            <Chip
              label="Owned"
              size="small"
              color="success"
              variant="outlined"
            />
          )}
        </Box>
      </Box>
    </Box>
  )
}

function Cosmetics({ user }) {
  const { isDark } = useThemeMode()
  const theme = useTheme()
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [userAccounts, setUserAccounts] = useState([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [error, setError] = useState('')
  const [cosmetics, setCosmetics] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [showOwnedOnly, setShowOwnedOnly] = useState(false)

  // Load user accounts on mount
  useEffect(() => {
    loadAccounts()
  }, [])

  // Load cosmetics when account is selected
  useEffect(() => {
    if (selectedAccount) {
      loadCosmetics()
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

  const loadCosmetics = async () => {
    if (!selectedAccount) return

    setLoadingData(true)
    setError('')

    try {
      // Fetch real cosmetics data from PlayerResources via inventory API
      const response = await inventoryApi.getCosmetics(selectedAccount)

      if (response.error) {
        throw new Error(response.message || response.error)
      }

      const cosmeticsData = []

      // Transform peripheral goods (deck shields, play mats, coin skins, etc.)
      const peripheralGoods = response.cosmetics?.peripheralGoods || []
      peripheralGoods.forEach((item, idx) => {
        const category = PERIPHERAL_TYPE_MAP[item.type] || 'deck_shield'
        cosmeticsData.push({
          id: `pg_${item.type}_${item.id}_${idx}`,
          category,
          name: `${COSMETIC_CATEGORIES[category]?.label || item.type} #${item.id}`,
          rarity: 'Standard',
          owned: true,
          amount: item.amount || 1,
        })
      })

      // Transform profile decorations (emblems, icons)
      const profileDecorations = response.cosmetics?.profileDecorations || []
      profileDecorations.forEach((item, idx) => {
        const category = DECORATION_TYPE_MAP[item.type] || 'icon'
        cosmeticsData.push({
          id: `pd_${item.type}_${item.id}_${idx}`,
          category,
          name: `${COSMETIC_CATEGORIES[category]?.label || item.type} #${item.id}`,
          rarity: 'Standard',
          owned: true,
          amount: item.amount || 1,
        })
      })

      setCosmetics(cosmeticsData)
    } catch (err) {
      console.error('Failed to load cosmetics:', err)
      setError(`Failed to load cosmetics: ${err.message}`)
      setCosmetics([])
    } finally {
      setLoadingData(false)
    }
  }

  // Filter cosmetics
  let filteredCosmetics = cosmetics
  if (selectedCategory !== 'all') {
    filteredCosmetics = filteredCosmetics.filter(c => c.category === selectedCategory)
  }
  if (showOwnedOnly) {
    filteredCosmetics = filteredCosmetics.filter(c => c.owned)
  }

  // Count by category
  const getCategoryCount = (category) => {
    const items = category === 'all' ? cosmetics : cosmetics.filter(c => c.category === category)
    const owned = items.filter(c => c.owned).length
    return { total: items.length, owned }
  }

  if (loading) {
    return <CardGridSkeleton count={8} />
  }

  return (
    <FadeIn duration={0.3}>
    <Box>
      {/* Header */}
      <PageHeader
        icon={<CosmeticIcon />}
        title={t('nav.cosmetics') || 'Cosmetics'}
        subtitle="View your deck shields, play mats, coins, emblems, and profile icons"
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
          onClick={loadCosmetics}
          disabled={!selectedAccount || loadingData}
          sx={{ background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})` }}
        >
          {loadingData ? 'Loading...' : 'Refresh'}
        </Button>

        <Button
          variant={showOwnedOnly ? 'contained' : 'outlined'}
          onClick={() => setShowOwnedOnly(!showOwnedOnly)}
          size="small"
        >
          {showOwnedOnly ? 'Show All' : 'Owned Only'}
        </Button>

        {selectedAccount && (
          <Chip
            icon={<CollectionIcon sx={{ fontSize: 18 }} />}
            label={`${cosmetics.filter(c => c.owned).length}/${cosmetics.length} Owned`}
            color="primary"
            variant="outlined"
            size="small"
            sx={{ ml: 'auto' }}
          />
        )}
      </Box>

      <Alert severity="info" sx={{ mb: 2 }}>
        Cosmetics are fetched from your game account. Select an account and click Refresh to load your cosmetic collection.
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
            icon={<CosmeticIcon sx={{ fontSize: 64 }} />}
            title="Select an account to view cosmetics"
            description="Choose an account above and click Refresh to load your collection"
          />
        </Box>
      )}

      {/* Loading */}
      {selectedAccount && loadingData && (
        <CardGridSkeleton count={8} />
      )}

      {/* Cosmetics content */}
      {selectedAccount && !loadingData && (
        <>
          {/* Category tabs */}
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
              value={selectedCategory}
              onChange={(e, v) => setSelectedCategory(v)}
              variant="scrollable"
              scrollButtons="auto"
            >
              <Tab
                value="all"
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CollectionIcon sx={{ fontSize: 20 }} />
                    All ({getCategoryCount('all').owned}/{getCategoryCount('all').total})
                  </Box>
                }
              />
              {Object.entries(COSMETIC_CATEGORIES).map(([key, cat]) => {
                const counts = getCategoryCount(key)
                const resolvedColor = resolveCategoryColor(cat, theme)
                return (
                  <Tab
                    key={key}
                    value={key}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box sx={{ color: resolvedColor }}>{cat.icon}</Box>
                        {cat.label} ({counts.owned}/{counts.total})
                      </Box>
                    }
                  />
                )
              })}
            </Tabs>
          </Box>

          {/* Cosmetics grid */}
          {filteredCosmetics.length > 0 ? (
            <StaggerContainer staggerDelay={0.03}>
              <Grid container spacing={3}>
                {filteredCosmetics.map((cosmetic) => (
                  <Grid item xs={6} sm={4} md={3} lg={2} key={cosmetic.id}>
                    <StaggerItem>
                      <CosmeticCard cosmetic={cosmetic} />
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
                icon={<CosmeticIcon sx={{ fontSize: 64 }} />}
                title={showOwnedOnly
                  ? 'No owned cosmetics in this category'
                  : 'No cosmetics found in this category'}
              />
            </Box>
          )}

          {/* Summary */}
          <Box
            sx={{
              p: 2.5,
              mt: 4,
              borderRadius: '14px',
              border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
              bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <CollectionIcon sx={{ fontSize: 20, color: 'text.secondary' }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Collection Summary
              </Typography>
            </Box>
            <Grid container spacing={2}>
              {Object.entries(COSMETIC_CATEGORIES).map(([key, cat]) => {
                const counts = getCategoryCount(key)
                const percentage = counts.total > 0 ? Math.round((counts.owned / counts.total) * 100) : 0
                const resolvedColor = resolveCategoryColor(cat, theme)
                return (
                  <Grid item xs={6} sm={4} md={3} key={key}>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        bgcolor: 'action.hover',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                      }}
                    >
                      <Avatar sx={{ bgcolor: `${resolvedColor}20`, color: resolvedColor }}>
                        {cat.icon}
                      </Avatar>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {cat.label}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {counts.owned}/{counts.total} ({percentage}%)
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                )
              })}
            </Grid>
          </Box>
        </>
      )}
    </Box>
    </FadeIn>
  )
}

export default Cosmetics
