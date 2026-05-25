import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Grid,
  Chip,
  useTheme,
} from '@mui/material'
import {
  SportsEsports as BattleIcon,
  HourglassEmpty as HourglassIcon,
  EmojiEvents as TrophyIcon,
  TrendingUp as TrendingIcon,
  Timer as TimerIcon,
} from '@mui/icons-material'
import { hunt } from '../services/api'
import StatCard from '../components/StatCardV2'
import { EmptyState } from '../components/EmptyState'
import { FadeIn, StaggerContainer, StaggerItem } from '../components/Animations'
import { StatsCardsSkeleton } from '../components/skeletons/PageSkeletons'
import PageHeader from '../components/PageHeader'

// Game constants for hourglass calculations
const HOURGLASSES_PER_STAMINA_REFILL = 12 // 12 hourglasses = 1 stamina refill
const PACKS_PER_STAMINA_REFILL = 2 // Each refill allows 2 pack openings

// Tier progress card
const TierCard = ({ tier, battles }) => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const tierNames = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    advanced: 'Advanced',
    expert: 'Expert',
    unknown: 'Unknown',
  }
  const tierColors = {
    beginner: theme.palette.success.main,
    intermediate: theme.palette.info.main,
    advanced: theme.palette.warning.main,
    expert: theme.palette.primary.main,
    unknown: theme.palette.text.secondary,
  }
  const color = tierColors[tier] || tierColors.unknown

  return (
    <Box
      sx={{
        p: 2.5,
        borderRadius: '14px',
        border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
        bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
        borderLeft: `3px solid ${color}`,
        transition: 'all 0.2s ease',
        '&:hover': {
          bgcolor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
          transform: 'translateY(-1px)',
        },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>
            {tierNames[tier] || tier}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Battle Tier
          </Typography>
        </Box>
        <Typography variant="h4" fontWeight={700} sx={{ color }}>
          {battles.toLocaleString()}
        </Typography>
      </Box>
    </Box>
  )
}

function BattleHistory() {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchBattleStats()
  }, [])

  const fetchBattleStats = async () => {
    try {
      setLoading(true)
      const data = await hunt.getBattleStats()
      setStats(data)
      setError('')
    } catch (err) {
      setError(err.message || 'Failed to fetch battle stats')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Box>
        <PageHeader
          icon={<BattleIcon />}
          title="Battle History & Stats"
          subtitle="Track your battle performance and hourglass earnings"
        />
        <StatsCardsSkeleton count={4} />
      </Box>
    )
  }

  const battlesByTier = stats?.battlesByTier || {}
  const sortedTiers = Object.entries(battlesByTier).sort((a, b) => b[1] - a[1])

  return (
    <FadeIn>
      <Box>
        {/* Header */}
        <PageHeader
          icon={<BattleIcon />}
          title="Battle History & Stats"
          subtitle="Track your battle performance and hourglass earnings"
        />

        {error && (
          <Box
            sx={{
              p: 2,
              mb: 3,
              borderRadius: '14px',
              border: `1px solid ${theme.palette.error.main}30`,
              bgcolor: `${theme.palette.error.main}10`,
              borderLeft: `3px solid ${theme.palette.error.main}`,
            }}
          >
            <Typography color="error">{error}</Typography>
          </Box>
        )}

        {/* Summary Stats */}
        <StaggerContainer>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <StaggerItem>
                <StatCard
                  icon={BattleIcon}
                  label="Total Battles"
                  value={stats?.totalBattles || 0}
                  color="primary"
                />
              </StaggerItem>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StaggerItem>
                <StatCard
                  icon={HourglassIcon}
                  label="Hourglasses Earned"
                  value={stats?.totalHourglasses || 0}
                  color="warning"
                />
              </StaggerItem>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StaggerItem>
                <StatCard
                  icon={TrendingIcon}
                  label="Avg Hourglass/Battle"
                  value={stats?.avgHourglassPerBattle || 0}
                  color="success"
                />
              </StaggerItem>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <StaggerItem>
                <StatCard
                  icon={TrophyIcon}
                  label="Battle Tiers"
                  value={Object.keys(battlesByTier).length}
                  color="secondary"
                />
              </StaggerItem>
            </Grid>
          </Grid>
        </StaggerContainer>

        {/* Battles by Tier */}
        <Box
          sx={{
            p: 2.5,
            borderRadius: '14px',
            border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
            bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
            mb: 3,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
            <TrophyIcon sx={{ color: theme.palette.secondary.main, fontSize: 20 }} />
            <Typography variant="subtitle1" fontWeight={700}>
              Battles by Tier
            </Typography>
          </Box>

          {sortedTiers.length === 0 ? (
            <EmptyState
              icon={<BattleIcon sx={{ fontSize: 64 }} />}
              title="No Battle Data"
              description="Battle stats will appear here when hunts complete battles"
              minHeight={200}
            />
          ) : (
            <StaggerContainer>
              <Grid container spacing={2}>
                {sortedTiers.map(([tier, battles]) => (
                  <Grid item xs={12} sm={6} md={3} key={tier}>
                    <StaggerItem>
                      <TierCard tier={tier} battles={battles} />
                    </StaggerItem>
                  </Grid>
                ))}
              </Grid>
            </StaggerContainer>
          )}
        </Box>

        {/* Hourglass Value */}
        <Box
          sx={{
            p: 2.5,
            borderRadius: '14px',
            border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
            bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
            mb: 3,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
            <HourglassIcon sx={{ color: theme.palette.warning.main, fontSize: 20 }} />
            <Typography variant="subtitle1" fontWeight={700}>
              Hourglass Value
            </Typography>
          </Box>

          <Grid container spacing={2}>
            {[
              {
                value: stats?.totalHourglasses || 0,
                label: 'Total Hourglasses',
                color: 'warning.main',
              },
              {
                value: Math.floor((stats?.totalHourglasses || 0) / HOURGLASSES_PER_STAMINA_REFILL),
                label: `Free Stamina Refills (${HOURGLASSES_PER_STAMINA_REFILL} = 1)`,
                color: 'info.main',
              },
              {
                value: Math.floor((stats?.totalHourglasses || 0) / HOURGLASSES_PER_STAMINA_REFILL / PACKS_PER_STAMINA_REFILL),
                label: `Extra Packs (~${PACKS_PER_STAMINA_REFILL} refills = 1 pack)`,
                color: 'success.main',
              },
            ].map((metric) => (
              <Grid item xs={12} sm={4} key={metric.label}>
                <Box
                  sx={{
                    textAlign: 'center',
                    p: 2,
                    borderRadius: '10px',
                    bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'}`,
                  }}
                >
                  <Typography variant="h3" fontWeight={700} sx={{ color: metric.color }}>
                    {metric.value.toLocaleString()}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {metric.label}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Battle Tips */}
        <Box
          sx={{
            p: 2.5,
            borderRadius: '14px',
            border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
            bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
            <TimerIcon sx={{ color: theme.palette.primary.main, fontSize: 20 }} />
            <Typography variant="subtitle1" fontWeight={700}>
              Battle Tips
            </Typography>
          </Box>

          <Grid container spacing={2}>
            {[
              { label: 'Expert', bg: theme.palette.primary.main, text: 'Expert battles give the most hourglasses per battle (~1.5 avg)' },
              { label: 'Steady Mode', bg: theme.palette.success.main, text: 'Use steady mode to avoid losses and maintain consistent earnings' },
              { label: '12s Delay', bg: theme.palette.warning.main, text: '12 second delay between battles prevents rate limiting' },
              { label: 'Session Reset', bg: theme.palette.info.main, text: 'Reset session after battles to avoid detection' },
            ].map((tip) => (
              <Grid item xs={12} md={6} key={tip.label}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 1.5,
                    p: 1.5,
                    borderRadius: '10px',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                    },
                  }}
                >
                  <Chip
                    label={tip.label}
                    size="small"
                    sx={{ background: tip.bg, color: '#fff', flexShrink: 0 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    {tip.text}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Box>
    </FadeIn>
  )
}

export default BattleHistory
