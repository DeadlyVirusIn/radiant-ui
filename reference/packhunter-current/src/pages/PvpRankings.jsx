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
  LinearProgress,
} from '@mui/material'
import {
  Sync as SyncIcon,
  EmojiEvents as TrophyIcon,
  MilitaryTech as RankIcon,
  Star as StarIcon,
  SportsEsports as BattleIcon,
  Help as HelpIcon,
} from '@mui/icons-material'
import { accounts as accountsApi, pvp as pvpApi } from '../services/api'
import { useThemeMode } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'
import { FadeIn } from '../components/Animations'
import { EmptyState } from '../components/EmptyState'
import { TablePageSkeleton } from '../components/skeletons/PageSkeletons'
import PageHeader from '../components/PageHeader'
import CollapsibleHelp from '../components/CollapsibleHelp'
import { useSectionStyles } from '../components/SectionCard'

// Rank tier configurations (matching backend rank types)
const RANK_TIERS = {
  'BEGINNER': { name: 'Beginner', color: '#9e9e9e', icon: '🥉' },
  'MONSTER_BALL': { name: 'Great Ball', color: '#4caf50', icon: '🟢' },
  'SUPER_BALL': { name: 'Ultra Ball', color: '#2196f3', icon: '🔵' },
  'HYPER_BALL': { name: 'Master Ball', colorKey: 'secondary.light', icon: '🟣' },
  'MASTER_BALL': { name: 'Champion', color: '#ffd700', icon: '👑' },
}

// Sub-rank tiers (1-5 within each main rank)
const SUB_RANKS = [1, 2, 3, 4, 5]

// Helper to resolve rank tier color (supports colorKey or direct color)
const resolveRankColor = (tier, theme) => {
  if (tier.colorKey) {
    const [palette, shade] = tier.colorKey.split('.')
    return theme.palette[palette]?.[shade] || theme.palette.primary.main
  }
  return tier.color
}

// Rank Badge component
const RankBadge = ({ mainRank, subRank, size = 'medium' }) => {
  const theme = useTheme()
  const tier = RANK_TIERS[mainRank] || RANK_TIERS['BEGINNER']
  const tierColor = resolveRankColor(tier, theme)
  const iconSize = size === 'large' ? 48 : size === 'medium' ? 32 : 24
  const fontSize = size === 'large' ? '1.5rem' : size === 'medium' ? '1rem' : '0.75rem'

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box
        sx={{
          width: iconSize,
          height: iconSize,
          borderRadius: '50%',
          bgcolor: `${tierColor}20`,
          border: `2px solid ${tierColor}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: iconSize * 0.5,
        }}
      >
        {tier.icon}
      </Box>
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 600, fontSize, color: tierColor }}>
          {tier.name}
        </Typography>
        {subRank && (
          <Box sx={{ display: 'flex', gap: 0.25 }}>
            {SUB_RANKS.map((sr) => (
              <StarIcon
                key={sr}
                sx={{
                  fontSize: size === 'large' ? 16 : 12,
                  color: sr <= subRank ? tierColor : '#e0e0e0',
                }}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  )
}

// Player Stats Card
const PlayerStatsCard = ({ stats, isDark, theme }) => {
  const winRate = stats.wins + stats.losses > 0
    ? ((stats.wins / (stats.wins + stats.losses)) * 100).toFixed(1)
    : 0

  const metricItems = [
    { value: `#${stats.globalRank || '-'}`, label: 'Global Rank', color: 'warning.main' },
    { value: stats.points, label: 'Rank Points', color: 'info.main' },
    { value: stats.wins, label: 'Wins', color: 'success.main' },
    { value: `${winRate}%`, label: 'Win Rate', color: 'secondary.main' },
  ]

  return (
    <Box
      sx={{
        p: 2.5,
        borderRadius: '14px',
        border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
        bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2.5 }}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>
            Your Battle Stats
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {stats.isEstimated ? 'Estimated rank based on battle wins' : 'Current season stats'}
          </Typography>
        </Box>
        <RankBadge mainRank={stats.mainRank} subRank={stats.subRank} size="large" />
      </Box>

      <Grid container spacing={2} sx={{ mb: 2.5 }}>
        {metricItems.map((m) => (
          <Grid item xs={6} md={3} key={m.label}>
            <Box
              sx={{
                textAlign: 'center',
                p: 1.5,
                borderRadius: '10px',
                bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}`,
                transition: 'all 0.15s ease',
                '&:hover': {
                  bgcolor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                },
              }}
            >
              <Typography variant="h4" sx={{ fontWeight: 700, color: m.color }}>
                {m.value}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {m.label}
              </Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      {/* Progress to next rank */}
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
          <Typography variant="body2" color="text.secondary">
            Progress to next sub-rank
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {stats.progressToNext || 0}%
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={stats.progressToNext || 0}
          sx={{
            height: 8,
            borderRadius: 4,
            bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
            '& .MuiLinearProgress-bar': {
              borderRadius: 4,
              bgcolor: resolveRankColor(RANK_TIERS[stats.mainRank] || RANK_TIERS['BEGINNER'], theme),
            },
          }}
        />
      </Box>
    </Box>
  )
}

function PvpRankings({ user }) {
  const theme = useTheme()
  const { isDark } = useThemeMode()
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [userAccounts, setUserAccounts] = useState([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [error, setError] = useState('')
  const [playerStats, setPlayerStats] = useState(null)
  const [battleProgress, setBattleProgress] = useState(null)

  const { sectionBox } = useSectionStyles()

  // Load user accounts on mount
  useEffect(() => {
    loadAccounts()
  }, [])

  // Load rankings data when account is selected
  useEffect(() => {
    if (selectedAccount) {
      loadRankingsData()
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

  const loadRankingsData = async () => {
    if (!selectedAccount) return

    setLoadingData(true)
    setError('')

    try {
      const response = await pvpApi.getStats(selectedAccount)

      if (response.error) {
        throw new Error(response.message || response.error)
      }

      const stats = response.stats || {}
      const rank = stats.estimatedRank || {}

      setPlayerStats({
        globalRank: null,
        points: stats.totalWins * 10 || 0,
        mainRank: rank.mainRank || 'BEGINNER',
        subRank: rank.subRank || 1,
        wins: stats.totalWins || 0,
        losses: 0,
        progressToNext: Math.min(100, ((stats.totalWins % 10) / 10) * 100),
        isEstimated: rank.isEstimated || true,
        playerLevel: stats.playerLevel || 1,
        maxDamage: stats.maxDamage || 0,
      })

      setBattleProgress(stats.battleProgress || null)

    } catch (err) {
      console.error('Failed to load rankings data:', err)
      setError(`Failed to load rankings data: ${err.message}`)
      setPlayerStats(null)
      setBattleProgress(null)
    } finally {
      setLoadingData(false)
    }
  }

  if (loading) {
    return <TablePageSkeleton />
  }

  return (
    <FadeIn>
      <Box>
        {/* Header with controls */}
        <Box sx={{ mb: 4 }}>
          <PageHeader
            icon={<TrophyIcon />}
            title={t('nav.pvpRankings') || 'PVP Rankings'}
            subtitle="View your rank, stats, and the global leaderboard"
            accent={theme.palette.warning.main}
          />

          {/* Help Info */}
          <CollapsibleHelp title="How it works">
            <ul>
              <li><strong>Estimated ranks:</strong> Ranks are calculated based on win count (not live from servers)</li>
              <li><strong>Ranking tiers:</strong> Beginner → Great Ball → Ultra Ball → Master Ball → Champion</li>
              <li><strong>Sub-ranks:</strong> Each tier has 5 stars (sub-ranks) to progress through</li>
              <li><strong>Points:</strong> ~10 points per win estimated</li>
            </ul>
          </CollapsibleHelp>

          {/* Control bar */}
          <Box sx={sectionBox}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
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
                onClick={loadRankingsData}
                disabled={!selectedAccount || loadingData}
                sx={{
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  '&:hover': {
                    background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.dark})`,
                  },
                }}
              >
                {loadingData ? 'Loading...' : 'Refresh'}
              </Button>

              {/* Stats indicator */}
              {playerStats && (
                <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TrophyIcon sx={{ color: 'warning.main' }} />
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    Level {playerStats.playerLevel || 1}
                  </Typography>
                  <Chip
                    label={`${playerStats.wins || 0} wins`}
                    size="small"
                    color="success"
                    variant="outlined"
                  />
                </Box>
              )}
            </Box>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* No account selected message */}
        {!selectedAccount && (
          <EmptyState
            icon={<TrophyIcon sx={{ fontSize: 64 }} />}
            title="Select an Account"
            description="Select an account above to view PVP rankings"
          />
        )}

        {/* Loading state */}
        {selectedAccount && loadingData && (
          <TablePageSkeleton />
        )}

        {/* Rankings Content */}
        {selectedAccount && !loadingData && playerStats && (
          <>
            {/* Player Stats */}
            <Box sx={{ mb: 3 }}>
              <PlayerStatsCard stats={playerStats} isDark={isDark} theme={theme} />
            </Box>

            {/* Battle Progress */}
            {battleProgress && (
              <Box sx={{ ...sectionBox, mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                  <BattleIcon sx={{ color: theme.palette.info.main, fontSize: 20 }} />
                  <Typography variant="subtitle1" fontWeight={700}>
                    Solo Battle Progress
                  </Typography>
                </Box>

                <Grid container spacing={2}>
                  {[
                    { label: 'Beginner', value: battleProgress.beginner || 0, color: 'success.main', bg: `${theme.palette.success.main}15` },
                    { label: 'Intermediate', value: battleProgress.intermediate || 0, color: 'info.main', bg: `${theme.palette.info.main}15` },
                    { label: 'Advanced', value: battleProgress.advanced || 0, color: 'secondary.main', bg: `${theme.palette.secondary.main}15` },
                    { label: 'Expert', value: battleProgress.expert || 0, color: 'warning.main', bg: `${theme.palette.warning.main}15` },
                  ].map((item) => (
                    <Grid item xs={6} sm={3} key={item.label}>
                      <Box
                        sx={{
                          textAlign: 'center',
                          p: 2,
                          borderRadius: '10px',
                          bgcolor: item.bg,
                          border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}`,
                          transition: 'all 0.15s ease',
                          '&:hover': {
                            transform: 'translateY(-2px)',
                          },
                        }}
                      >
                        <Typography variant="h4" sx={{ fontWeight: 700, color: item.color }}>
                          {item.value}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {item.label}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>

                <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center' }}>
                  <Chip
                    label={`Total: ${battleProgress.total || 0} battles completed`}
                    color="primary"
                    variant="outlined"
                  />
                </Box>
              </Box>
            )}

            {/* Rank Tiers Info */}
            <Box sx={sectionBox}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                <RankIcon sx={{ color: theme.palette.primary.main, fontSize: 20 }} />
                <Typography variant="subtitle1" fontWeight={700}>
                  Rank Tiers
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                {Object.entries(RANK_TIERS).map(([key, tier]) => {
                  const color = resolveRankColor(tier, theme)
                  return (
                    <Chip
                      key={key}
                      label={`${tier.icon} ${tier.name}`}
                      sx={{
                        bgcolor: `${color}20`,
                        color,
                        fontWeight: 600,
                        border: `1px solid ${color}50`,
                        transition: 'all 0.15s ease',
                        '&:hover': {
                          bgcolor: `${color}30`,
                        },
                      }}
                    />
                  )
                })}
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Each tier has 5 sub-ranks (stars). Win battles to earn points and climb the ranks!
              </Typography>
            </Box>
          </>
        )}

        {/* No stats loaded */}
        {selectedAccount && !loadingData && !playerStats && (
          <EmptyState
            icon={<TrophyIcon sx={{ fontSize: 64 }} />}
            title="No Battle Stats Available"
            description="Click Refresh to load your battle data."
          />
        )}
      </Box>
    </FadeIn>
  )
}

export default PvpRankings
