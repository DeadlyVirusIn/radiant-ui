import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import CollapsibleHelp from '../components/CollapsibleHelp'
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
  LinearProgress,
  Tooltip,
  Tabs,
  Tab,
  useTheme,
} from '@mui/material'
import {
  Sync as SyncIcon,
  EmojiEvents as TrophyIcon,
  Star as StarIcon,
  Lock as LockIcon,
  CheckCircle as CheckIcon,
  Style as CardIcon,
  SwapHoriz as TradeIcon,
  SportsEsports as BattleIcon,
  Redeem as PackIcon,
  People as FriendsIcon,
  AutoAwesome as WonderIcon,
  Help as HelpIcon,
} from '@mui/icons-material'
import { accounts as accountsApi, achievements as achievementsApi } from '../services/api'
import { useLanguage } from '../contexts/LanguageContext'
import { EmptyState } from '../components/EmptyState'
import { FadeIn, StaggerContainer, StaggerItem } from '../components/Animations'
import { CardGridSkeleton } from '../components/LoadingSkeleton'

// Trophy tier configurations
const TROPHY_TIERS = {
  'BRONZE': { name: 'Bronze', color: '#cd7f32', icon: '🥉', points: 10 },
  'SILVER': { name: 'Silver', color: '#c0c0c0', icon: '🥈', points: 25 },
  'GOLD': { name: 'Gold', color: '#ffd700', icon: '🥇', points: 50 },
  'RAINBOW': { name: 'Rainbow', color: 'linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #8f00ff)', icon: '🌈', points: 100 },
}

// Achievement categories
const CATEGORIES = [
  { id: 'all', label: 'All', icon: TrophyIcon },
  { id: 'collection', label: 'Collection', icon: CardIcon },
  { id: 'battle', label: 'Battle', icon: BattleIcon },
  { id: 'trade', label: 'Trade', icon: TradeIcon },
  { id: 'packs', label: 'Packs', icon: PackIcon },
  { id: 'social', label: 'Social', icon: FriendsIcon },
]

// Achievement Card component
const AchievementCard = ({ achievement }) => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const tier = TROPHY_TIERS[achievement.tier]
  const progress = Math.min((achievement.current / achievement.target) * 100, 100)
  const isRainbow = achievement.tier === 'RAINBOW'
  const isCompleted = achievement.completed

  // Resolve solid tier color for non-rainbow
  const solidColor = isRainbow ? '#8f00ff' : tier.color

  return (
    <Box
      sx={{
        p: 2.5,
        borderRadius: '14px',
        height: '100%',
        position: 'relative',
        overflow: 'visible',
        border: isCompleted
          ? `1px solid ${solidColor}55`
          : `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
        bgcolor: isCompleted
          ? isRainbow
            ? isDark ? 'rgba(143,0,255,0.06)' : 'rgba(143,0,255,0.03)'
            : isDark ? `${solidColor}12` : `${solidColor}08`
          : isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
        borderLeft: `3px solid ${isCompleted ? solidColor : isDark ? 'rgba(124,138,255,0.15)' : 'rgba(0,0,0,0.08)'}`,
        transition: 'all 0.2s ease',
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: isDark
            ? `0 8px 24px rgba(0,0,0,0.35), 0 0 0 1px ${solidColor}22`
            : `0 8px 24px rgba(0,0,0,0.07), 0 0 0 1px ${solidColor}18`,
        },
      }}
    >
      {/* Tier Badge */}
      <Box
        sx={{
          position: 'absolute',
          top: -11,
          right: 16,
          px: 1.5,
          py: 0.3,
          borderRadius: '6px',
          bgcolor: isRainbow ? undefined : solidColor,
          background: isRainbow ? tier.color : undefined,
          color: 'white',
          fontSize: '0.7rem',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          boxShadow: `0 2px 6px ${solidColor}50`,
        }}
      >
        {tier.icon} {tier.name}
      </Box>

      {/* Content */}
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mt: 1 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: '12px',
            flexShrink: 0,
            background: isCompleted
              ? `linear-gradient(135deg, ${solidColor}30, ${solidColor}15)`
              : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `2px solid ${isCompleted ? solidColor : isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
          }}
        >
          {isCompleted ? (
            <CheckIcon sx={{ color: solidColor, fontSize: 24 }} />
          ) : (
            <LockIcon sx={{ color: 'text.disabled', fontSize: 20 }} />
          )}
        </Box>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: '0.9rem', lineHeight: 1.3 }}>
            {achievement.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, fontSize: '0.8rem', lineHeight: 1.4 }}>
            {achievement.description}
          </Typography>

          {/* Progress */}
          <Box sx={{ mb: 1.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">Progress</Typography>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {achievement.current.toLocaleString()} / {achievement.target.toLocaleString()}
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{
                height: 6,
                borderRadius: 3,
                bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                '& .MuiLinearProgress-bar': {
                  borderRadius: 3,
                  background: isCompleted
                    ? isRainbow
                      ? 'linear-gradient(90deg, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff)'
                      : `linear-gradient(90deg, ${solidColor}, ${solidColor}bb)`
                    : `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.light})`,
                },
              }}
            />
          </Box>

          {/* Points */}
          <Chip
            icon={<StarIcon sx={{ fontSize: 12 }} />}
            label={`${tier.points} pts`}
            size="small"
            variant="outlined"
            color={isCompleted ? 'success' : 'default'}
            sx={{ fontSize: '0.7rem', height: 22 }}
          />
        </Box>
      </Box>
    </Box>
  )
}

function Achievements({ user }) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [userAccounts, setUserAccounts] = useState([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [error, setError] = useState('')
  // Wave 7: ?category=… deep-link. URL is the source of truth on mount;
  // changes write back so back/forward buttons restore the prior tab.
  const [searchParams, setSearchParams] = useSearchParams()
  const initialCategory = useMemo(() => searchParams.get('category') || 'all', []) // eslint-disable-line react-hooks/exhaustive-deps
  const [selectedCategory, setSelectedCategoryState] = useState(initialCategory)
  const setSelectedCategory = (next) => {
    setSelectedCategoryState(next)
    const sp = new URLSearchParams(searchParams)
    if (!next || next === 'all') sp.delete('category')
    else sp.set('category', next)
    setSearchParams(sp, { replace: true })
  }
  const [achievements, setAchievements] = useState([])
  const [achievementStats, setAchievementStats] = useState(null)

  // Calculate stats from API response or fallback to local calculation
  const totalAchievements = achievementStats?.total || achievements.length
  const completedAchievements = achievementStats?.completed || achievements.filter(a => a.completed).length
  const totalPoints = achievementStats?.totalPoints || achievements
    .filter(a => a.completed)
    .reduce((sum, a) => sum + TROPHY_TIERS[a.tier]?.points || 0, 0)

  const cardBoxSx = {
    p: 2.5,
    borderRadius: '14px',
    border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
    bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
  }

  // Load accounts on mount
  useEffect(() => {
    loadAccounts()
  }, [])

  // Reload achievements when account changes
  useEffect(() => {
    loadAchievementsData()
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

  const loadAchievementsData = async () => {
    setLoadingData(true)
    setError('')

    try {
      // Fetch real achievements from API
      const data = await achievementsApi.getAll(selectedAccount || null)

      if (data.achievements) {
        setAchievements(data.achievements)
      }

      if (data.stats) {
        setAchievementStats(data.stats)
      }

    } catch (err) {
      console.error('Failed to load achievements data:', err)
      setError(`Failed to load achievements data: ${err.message}`)
    } finally {
      setLoadingData(false)
    }
  }

  // Filter achievements by category
  const filteredAchievements = selectedCategory === 'all'
    ? achievements
    : achievements.filter(a => a.category === selectedCategory)

  if (loading) {
    return <CardGridSkeleton count={6} />
  }

  return (
    <FadeIn duration={0.3}>
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <PageHeader
          icon={<TrophyIcon />}
          title={t('nav.achievements') || 'Achievements'}
          subtitle="Track your progress and earn trophies"
          accent="#F59E0B"
        />

        {/* Help Info */}
        <CollapsibleHelp title="How it works" sx={{ mt: 2 }}>
          <ul>
            <li><strong>Trophy tiers:</strong> Bronze (10pts), Silver (25pts), Gold (50pts), Rainbow (100pts)</li>
            <li><strong>Categories:</strong> Collection, Battle, Trade, Packs, Social</li>
            <li><strong>Progress:</strong> Tracked from your collection and activity data</li>
            <li><strong>Total points:</strong> Shown at top - earn points by completing achievements</li>
          </ul>
        </CollapsibleHelp>

        {/* Control bar */}
        <Box
          sx={{
            ...cardBoxSx,
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
            onClick={loadAchievementsData}
            disabled={!selectedAccount || loadingData}
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              borderRadius: '8px',
              '&:hover': { background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.dark})` },
            }}
          >
            {loadingData ? 'Loading...' : 'Refresh'}
          </Button>

          {/* Stats */}
          {selectedAccount && (
            <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
              <Chip
                icon={<TrophyIcon sx={{ fontSize: 16 }} />}
                label={`${completedAchievements}/${totalAchievements} Completed`}
                color="primary"
                variant="outlined"
                size="small"
              />
              <Chip
                icon={<StarIcon sx={{ fontSize: 16 }} />}
                label={`${totalPoints} Points`}
                color="warning"
                variant="outlined"
                size="small"
              />
            </Box>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: '10px' }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* No account selected message */}
      {!selectedAccount && (
        <Box sx={cardBoxSx}>
          <EmptyState
            icon={<TrophyIcon sx={{ fontSize: 64 }} />}
            title="Select an account to view achievements"
            description="Choose an account above to see your trophy progress"
          />
        </Box>
      )}

      {/* Loading state */}
      {selectedAccount && loadingData && (
        <CardGridSkeleton count={6} />
      )}

      {/* Achievements Content */}
      {selectedAccount && !loadingData && (
        <>
          {/* Trophy Tiers Overview */}
          <Box sx={{ ...cardBoxSx, mb: 3 }}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              {Object.entries(TROPHY_TIERS).map(([key, tier]) => {
                const count = achievements.filter(a => a.tier === key && a.completed).length
                const total = achievements.filter(a => a.tier === key).length
                const solidTierColor = key === 'RAINBOW' ? '#8f00ff' : tier.color
                return (
                  <Tooltip key={key} title={`${tier.name}: ${count}/${total} completed`}>
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        p: 1.5,
                        borderRadius: '10px',
                        bgcolor: isDark ? `${solidTierColor}12` : `${solidTierColor}0a`,
                        border: `1px solid ${solidTierColor}30`,
                        minWidth: 80,
                        cursor: 'default',
                        transition: 'all 0.15s ease',
                        '&:hover': { transform: 'scale(1.04)', boxShadow: `0 4px 12px ${solidTierColor}30` },
                      }}
                    >
                      <Typography sx={{ fontSize: 26, lineHeight: 1 }}>{tier.icon}</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 700, mt: 0.5, color: solidTierColor }}>
                        {count}/{total}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                        {tier.name}
                      </Typography>
                    </Box>
                  </Tooltip>
                )
              })}
            </Box>
          </Box>

          {/* Category Tabs */}
          <Box sx={{ ...cardBoxSx, mb: 3, p: 0, overflow: 'hidden' }}>
            <Tabs
              value={selectedCategory}
              onChange={(e, val) => setSelectedCategory(val)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ '& .MuiTab-root': { fontSize: '0.82rem', minHeight: 48 } }}
            >
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon
                const count = cat.id === 'all'
                  ? achievements.filter(a => a.completed).length
                  : achievements.filter(a => a.category === cat.id && a.completed).length
                const total = cat.id === 'all'
                  ? achievements.length
                  : achievements.filter(a => a.category === cat.id).length
                return (
                  <Tab
                    key={cat.id}
                    value={cat.id}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <Icon sx={{ fontSize: 16 }} />
                        {cat.label}
                        <Chip
                          label={`${count}/${total}`}
                          size="small"
                          variant="outlined"
                          sx={{ height: 18, fontSize: '0.65rem', '& .MuiChip-label': { px: 0.75 } }}
                        />
                      </Box>
                    }
                  />
                )
              })}
            </Tabs>
          </Box>

          {/* Achievements Grid */}
          <StaggerContainer staggerDelay={0.04}>
            <Grid container spacing={2}>
              {filteredAchievements.map((achievement) => (
                <Grid item xs={12} sm={6} md={4} key={achievement.id}>
                  <StaggerItem>
                    <AchievementCard achievement={achievement} />
                  </StaggerItem>
                </Grid>
              ))}
            </Grid>
          </StaggerContainer>

          {filteredAchievements.length === 0 && (
            <Box sx={cardBoxSx}>
              <EmptyState
                icon={<TrophyIcon sx={{ fontSize: 64 }} />}
                title="No achievements in this category"
              />
            </Box>
          )}
        </>
      )}
    </Box>
    </FadeIn>
  )
}

export default Achievements
