import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Chip,
  Grid,
  LinearProgress,
  CircularProgress,
  useTheme,
} from '@mui/material'
import {
  Sync as SyncIcon,
  SportsEsports as BattleIcon,
  EmojiEvents as TrophyIcon,
  CheckCircle as CheckIcon,
  TrendingUp as StreakIcon,
  Star as StarIcon,
  Whatshot as FireIcon,
} from '@mui/icons-material'
import { accounts as accountsApi, soloBattle as soloBattleApi } from '../services/api'
import { useThemeMode } from '../contexts/ThemeContext'
import { useLanguage } from '../contexts/LanguageContext'
import StatCard from '../components/StatCardV2'
import DataTable from '../components/DataTable'
import { EmptyState } from '../components/EmptyState'
import { FadeIn, StaggerContainer, StaggerItem } from '../components/Animations'
import { StatsCardsSkeleton } from '../components/skeletons/PageSkeletons'
import PageHeader from '../components/PageHeader'
import { useSectionStyles } from '../components/SectionCard'

// Difficulty constants
const DIFFICULTY_KEYS = ['Beginner', 'Intermediate', 'Advanced', 'Elite', 'Expert']

// Difficulty Progress component
const DifficultyProgress = ({ difficulty, completed, total, color, isDark }) => {
  const percentage = total > 0 ? (completed / total) * 100 : 0

  return (
    <Box
      sx={{
        mb: 2,
        p: 1.5,
        borderRadius: '10px',
        transition: 'all 0.15s ease',
        '&:hover': {
          bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        },
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.75 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={difficulty}
            size="small"
            sx={{ bgcolor: `${color}20`, color, fontWeight: 600 }}
          />
        </Box>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>
          {completed}/{total}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={percentage}
        sx={{
          height: 8,
          borderRadius: 5,
          bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
          '& .MuiLinearProgress-bar': {
            bgcolor: color,
            borderRadius: 5,
          },
        }}
      />
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
        {Math.round(percentage)}% complete
      </Typography>
    </Box>
  )
}

function BattleStats({ user }) {
  const theme = useTheme()
  const { isDark } = useThemeMode()
  const { t } = useLanguage()

  const DIFFICULTY_COLORS = {
    Beginner: theme.palette.success.main,
    Intermediate: theme.palette.warning.main,
    Advanced: theme.palette.error.main,
    Elite: theme.palette.secondary.main,
    Expert: theme.palette.primary.main,
  }

  const [loading, setLoading] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [userAccounts, setUserAccounts] = useState([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [error, setError] = useState('')
  const [stats, setStats] = useState({
    totalBattles: 0,
    completedBattles: 0,
    firstClears: 0,
    byDifficulty: {},
    winStreak: 0,
    recentBattles: [],
  })
  const [stages, setStages] = useState({ byDifficulty: {} })

  const { sectionBox } = useSectionStyles()

  // Load user accounts on mount
  useEffect(() => {
    loadAccounts()
    loadStages()
  }, [])

  // Load battle stats when account is selected
  useEffect(() => {
    if (selectedAccount) {
      loadBattleStats()
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

  const loadStages = async () => {
    try {
      const data = await soloBattleApi.getStages()
      setStages(data)
    } catch (err) {
      console.error('Failed to load stages:', err)
    }
  }

  const loadBattleStats = async () => {
    if (!selectedAccount) return

    setLoadingData(true)
    setError('')

    try {
      const statusData = await soloBattleApi.getStatus(selectedAccount)

      const byDifficulty = {}
      let totalCompleted = 0
      let totalBattles = 0

      Object.entries(stages.byDifficulty || {}).forEach(([difficulty, difficultyStages]) => {
        const diffBattles = difficultyStages.reduce((sum, stage) => sum + stage.totalBattles, 0)
        const diffCompleted = difficultyStages.reduce((sum, stage) => {
          return sum + stage.battles.filter(b => statusData?.completionMap?.[b.id]?.isCleared).length
        }, 0)

        byDifficulty[difficulty] = {
          total: diffBattles,
          completed: diffCompleted,
        }

        totalBattles += diffBattles
        totalCompleted += diffCompleted
      })

      const firstClears = Object.values(statusData?.completionMap || {}).filter(
        b => b.isCleared && b.clearCount === 1
      ).length

      const accountInfo = userAccounts.find(a => a.id === selectedAccount)

      setStats({
        totalBattles,
        completedBattles: totalCompleted,
        firstClears,
        byDifficulty,
        winStreak: accountInfo?.total_win_count || totalCompleted,
        recentBattles: [],
      })

    } catch (err) {
      console.error('Failed to load battle stats:', err)
      setError(`Failed to load battle stats: ${err.message}`)
    } finally {
      setLoadingData(false)
    }
  }

  const completionPercentage = stats.totalBattles > 0
    ? Math.round((stats.completedBattles / stats.totalBattles) * 100)
    : 0

  const difficultyRows = DIFFICULTY_KEYS
    .filter(difficulty => {
      const diffStats = stats.byDifficulty[difficulty]
      return diffStats && diffStats.total > 0
    })
    .map(difficulty => {
      const diffStats = stats.byDifficulty[difficulty]
      const percentage = Math.round((diffStats.completed / diffStats.total) * 100)
      return {
        id: difficulty,
        difficulty,
        completed: diffStats.completed,
        total: diffStats.total,
        percentage,
        isComplete: percentage === 100,
        color: DIFFICULTY_COLORS[difficulty],
      }
    })

  const difficultyColumns = [
    {
      id: 'difficulty',
      label: 'Difficulty',
      sortable: true,
      render: (row) => (
        <Chip
          label={row.difficulty}
          size="small"
          sx={{ bgcolor: `${row.color}20`, color: row.color, fontWeight: 600 }}
        />
      ),
    },
    { id: 'completed', label: 'Completed', sortable: true, align: 'center' },
    { id: 'total', label: 'Total', sortable: true, align: 'center' },
    {
      id: 'percentage',
      label: 'Progress',
      sortable: true,
      align: 'center',
      format: (val) => `${val}%`,
    },
    {
      id: 'isComplete',
      label: 'Status',
      align: 'center',
      render: (row) => row.isComplete ? (
        <Chip
          icon={<CheckIcon sx={{ fontSize: 16 }} />}
          label="Complete"
          size="small"
          color="success"
        />
      ) : (
        <Chip
          label="In Progress"
          size="small"
          variant="outlined"
        />
      ),
    },
  ]

  if (loading) {
    return (
      <Box>
        <PageHeader
          icon={<BattleIcon />}
          title={t('nav.battleStats') || 'Battle Statistics'}
        />
        <StatsCardsSkeleton count={4} />
      </Box>
    )
  }

  return (
    <FadeIn>
      <Box>
        <PageHeader
          icon={<BattleIcon />}
          title={t('nav.battleStats') || 'Battle Statistics'}
          subtitle="Track your battle progress, completion rates, and achievements"
        />
        {/* Control bar */}
        <Box sx={{ mb: 4 }}>

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
                onClick={loadBattleStats}
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
            </Box>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* No account selected */}
        {!selectedAccount && (
          <Box sx={sectionBox}>
            <EmptyState
              icon={<BattleIcon sx={{ fontSize: 64 }} />}
              title="No Account Selected"
              description="Select an account to view battle statistics"
              minHeight={250}
            />
          </Box>
        )}

        {/* Loading */}
        {selectedAccount && loadingData && (
          <StatsCardsSkeleton count={4} />
        )}

        {/* Battle Stats content */}
        {selectedAccount && !loadingData && (
          <>
            {/* Overview Stats */}
            <StaggerContainer>
              <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <StaggerItem>
                    <StatCard
                      icon={<BattleIcon />}
                      label="Total Battles"
                      value={stats.totalBattles}
                      subValue="All difficulties"
                      color="primary"
                    />
                  </StaggerItem>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StaggerItem>
                    <StatCard
                      icon={<CheckIcon />}
                      label="Completed"
                      value={stats.completedBattles}
                      subValue={`${completionPercentage}% completion rate`}
                      color="success"
                    />
                  </StaggerItem>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StaggerItem>
                    <StatCard
                      icon={<StarIcon />}
                      label="First Clears"
                      value={stats.firstClears}
                      subValue="Bonus rewards earned"
                      color="warning"
                    />
                  </StaggerItem>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <StaggerItem>
                    <StatCard
                      icon={<FireIcon />}
                      label="Win Streak"
                      value={stats.winStreak}
                      subValue="Current streak"
                      color="secondary"
                    />
                  </StaggerItem>
                </Grid>
              </Grid>
            </StaggerContainer>

            {/* Overall Progress */}
            <Box sx={{ ...sectionBox, mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                <TrophyIcon sx={{ color: theme.palette.warning.main, fontSize: 20 }} />
                <Typography variant="subtitle1" fontWeight={700}>
                  Overall Progress
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <Box sx={{ flex: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={completionPercentage}
                    sx={{
                      height: 16,
                      borderRadius: 8,
                      bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                      '& .MuiLinearProgress-bar': {
                        background: completionPercentage === 100
                          ? `linear-gradient(90deg, ${theme.palette.warning.main}, ${theme.palette.warning.light})`
                          : `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                        borderRadius: 8,
                      },
                    }}
                  />
                </Box>
                <Typography variant="h5" sx={{ fontWeight: 700, minWidth: 56, textAlign: 'right' }}>
                  {completionPercentage}%
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                {stats.completedBattles} of {stats.totalBattles} battles completed
              </Typography>
            </Box>

            {/* Progress by Difficulty */}
            <Box sx={{ ...sectionBox, mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                <BattleIcon sx={{ color: theme.palette.primary.main, fontSize: 20 }} />
                <Typography variant="subtitle1" fontWeight={700}>
                  Progress by Difficulty
                </Typography>
              </Box>

              {DIFFICULTY_KEYS.map((difficulty) => {
                const color = DIFFICULTY_COLORS[difficulty]
                const diffStats = stats.byDifficulty[difficulty] || { completed: 0, total: 0 }
                if (diffStats.total === 0) return null
                return (
                  <DifficultyProgress
                    key={difficulty}
                    difficulty={difficulty}
                    completed={diffStats.completed}
                    total={diffStats.total}
                    color={color}
                    isDark={isDark}
                  />
                )
              })}
            </Box>

            {/* Difficulty Breakdown Table */}
            <Box
              sx={{
                borderRadius: '14px',
                border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
                bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
                overflow: 'hidden',
              }}
            >
              <Box sx={{ px: 2.5, pt: 2.5, pb: 1.5, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <StreakIcon sx={{ color: theme.palette.secondary.main, fontSize: 20 }} />
                <Typography variant="subtitle1" fontWeight={700}>
                  Difficulty Breakdown
                </Typography>
              </Box>
              <DataTable
                columns={difficultyColumns}
                rows={difficultyRows}
                loading={false}
                searchable={false}
                pageSize={10}
                emptyMessage="No difficulty data available"
                emptyIcon={<BattleIcon sx={{ fontSize: 48 }} />}
                rowKey="id"
              />
            </Box>
          </>
        )}
      </Box>
    </FadeIn>
  )
}

export default BattleStats
