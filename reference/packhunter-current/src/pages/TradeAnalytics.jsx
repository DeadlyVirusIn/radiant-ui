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
  Avatar,
  useTheme,
} from '@mui/material'
import {
  Sync as SyncIcon,
  SwapHoriz as TradeIcon,
  Timer as TimerIcon,
  CheckCircle as SuccessIcon,
  People as PeopleIcon,
  History as HistoryIcon,
  Bolt as PowerIcon,
} from '@mui/icons-material'
import { accounts as accountsApi, trade as tradeApi, tasks as tasksApi } from '../services/api'
import { useLanguage } from '../contexts/LanguageContext'
import DataTable from '../components/DataTable'
import { EmptyState } from '../components/EmptyState'
import { FadeIn, StaggerContainer, StaggerItem } from '../components/Animations'
import { StatsCardsSkeleton } from '../components/skeletons/PageSkeletons'
import PageHeader from '../components/PageHeader'
import { useSectionStyles } from '../components/SectionCard'

// Format time countdown
const formatTimeRemaining = (seconds) => {
  if (!seconds || seconds <= 0) return 'Ready'
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function TradeAnalytics({ user }) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [userAccounts, setUserAccounts] = useState([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [error, setError] = useState('')
  const [tradeData, setTradeData] = useState({
    tradePower: { amount: 0, maxAmount: 5, healAt: null, secondsUntilHeal: 0 },
    totalTrades: 0,
    successfulTrades: 0,
    pendingTrades: 0,
    tradeHistory: [],
    topPartners: [],
  })

  const { sectionBox: cardSx } = useSectionStyles()

  // Load user accounts on mount
  useEffect(() => {
    loadAccounts()
  }, [])

  // Load trade data when account is selected
  useEffect(() => {
    if (selectedAccount) {
      loadTradeData()
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

  const loadTradeData = async () => {
    if (!selectedAccount) return

    setLoadingData(true)
    setError('')

    try {
      // Get trade power - try Trade API first, fallback to resources endpoint
      let powerData = null
      try {
        powerData = await tradeApi.getPower(selectedAccount)
      } catch {
        // Trade API failed, try getting from resources endpoint
        const resourcesData = await tasksApi.getResources(selectedAccount)
        if (resourcesData?.tradePower) {
          powerData = {
            currentPower: resourcesData.tradePower.current,
            maxPower: resourcesData.tradePower.max,
            nextRecoveryAt: resourcesData.tradePower.nextRecoveryAt,
          }
        }
      }

      // Get trade history (if endpoint exists)
      let history = []
      try {
        const historyData = await tradeApi.getHistory(selectedAccount)
        history = historyData?.trades || historyData?.history || []
      } catch {
        // History endpoint may not exist
      }

      // Calculate stats from history
      const totalTrades = history.length
      const successfulTrades = history.filter(t => t.status === 'completed').length
      const successRate = totalTrades > 0 ? Math.round((successfulTrades / totalTrades) * 100) : 0

      // Get top partners from history
      const partnerCounts = {}
      history.forEach(trade => {
        const partner = trade.partnerNickname || trade.partnerId
        if (partner) {
          partnerCounts[partner] = (partnerCounts[partner] || 0) + 1
        }
      })
      const topPartners = Object.entries(partnerCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }))

      setTradeData({
        tradePower: {
          amount: powerData?.currentPower ?? powerData?.amount ?? 0,
          maxAmount: powerData?.maxPower ?? powerData?.maxAmount ?? 5,
          healAt: powerData?.nextRecoveryAt ?? powerData?.healAt,
          secondsUntilHeal: powerData?.secondsUntilHeal ?? 0,
        },
        totalTrades,
        successfulTrades,
        successRate,
        pendingTrades: history.filter(t => t.status === 'pending').length,
        tradeHistory: history.slice(0, 10),
        topPartners,
      })

    } catch (err) {
      console.error('Failed to load trade data:', err)
      setError(`Failed to load trade data: ${err.message}`)
    } finally {
      setLoadingData(false)
    }
  }

  const powerPercentage = (tradeData.tradePower.amount / tradeData.tradePower.maxAmount) * 100

  // DataTable columns for trade history
  const tradeHistoryColumns = [
    {
      id: 'partner',
      label: 'Partner',
      render: (row) => row.partnerNickname || 'Unknown',
    },
    {
      id: 'sentCard',
      label: 'Card Sent',
      format: (val) => val || '-',
    },
    {
      id: 'receivedCard',
      label: 'Card Received',
      format: (val) => val || '-',
    },
    {
      id: 'status',
      label: 'Status',
      render: (row) => (
        <Chip
          label={row.status || 'Unknown'}
          size="small"
          color={row.status === 'completed' ? 'success' : row.status === 'pending' ? 'warning' : 'default'}
        />
      ),
    },
    {
      id: 'completedAt',
      label: 'Date',
      format: (val) => val ? new Date(val).toLocaleDateString() : '-',
    },
  ]

  if (loading) {
    return (
      <Box>
        <PageHeader
          icon={<TradeIcon />}
          title={t('nav.tradeAnalytics') || 'Trade Analytics'}
          subtitle="Monitor trading activity, power recovery, and partner statistics"
        />
        <StatsCardsSkeleton count={4} />
      </Box>
    )
  }

  return (
    <FadeIn>
      <Box>
        {/* Header */}
        <PageHeader
          icon={<TradeIcon />}
          title={t('nav.tradeAnalytics') || 'Trade Analytics'}
          subtitle="Monitor trading activity, power recovery, and partner statistics"
        />

        {/* Control bar */}
        <Box
          sx={{
            ...cardSx,
            mb: 3,
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
            onClick={loadTradeData}
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

        {error && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}

        {/* No account selected */}
        {!selectedAccount && (
          <Box sx={cardSx}>
            <EmptyState
              icon={<TradeIcon sx={{ fontSize: 64 }} />}
              title="No Account Selected"
              description="Select an account to view trade analytics"
              minHeight={250}
            />
          </Box>
        )}

        {/* Loading */}
        {selectedAccount && loadingData && (
          <StatsCardsSkeleton count={4} />
        )}

        {/* Trade Analytics content */}
        {selectedAccount && !loadingData && (
          <>
            {/* Trade Power */}
            <Box sx={{ ...cardSx, mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <PowerIcon sx={{ color: theme.palette.warning.main, fontSize: 20 }} />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Trade Power
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, flexWrap: 'wrap' }}>
                <Box sx={{ flex: 1, minWidth: 200 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">Current Power</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: theme.palette.warning.main }}>
                      {tradeData.tradePower.amount}/{tradeData.tradePower.maxAmount}
                    </Typography>
                  </Box>
                  <LinearProgress
                    variant="determinate"
                    value={powerPercentage}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                      '& .MuiLinearProgress-bar': {
                        background: powerPercentage === 100
                          ? `linear-gradient(90deg, ${theme.palette.success.main}, ${theme.palette.success.light})`
                          : `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                        borderRadius: 4,
                      },
                    }}
                  />
                </Box>

                {tradeData.tradePower.secondsUntilHeal > 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <TimerIcon sx={{ color: theme.palette.warning.main, fontSize: 18 }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary">Next recovery in</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {formatTimeRemaining(tradeData.tradePower.secondsUntilHeal)}
                      </Typography>
                    </Box>
                  </Box>
                )}

                {tradeData.tradePower.amount === tradeData.tradePower.maxAmount && (
                  <Chip
                    icon={<SuccessIcon sx={{ fontSize: 16 }} />}
                    label="Fully Charged"
                    color="success"
                    size="small"
                    variant="outlined"
                  />
                )}
              </Box>
            </Box>

            {/* Stats Overview - inline metric strip */}
            <StaggerContainer>
              <Grid container spacing={2} sx={{ mb: 3 }}>
                {[
                  {
                    icon: <TradeIcon sx={{ fontSize: 18, color: theme.palette.info.main }} />,
                    label: 'Total Trades',
                    value: tradeData.totalTrades,
                    sub: 'All time',
                    color: theme.palette.info.main,
                  },
                  {
                    icon: <SuccessIcon sx={{ fontSize: 18, color: theme.palette.success.main }} />,
                    label: 'Successful',
                    value: tradeData.successfulTrades,
                    sub: `${tradeData.successRate || 0}% rate`,
                    color: theme.palette.success.main,
                  },
                  {
                    icon: <TimerIcon sx={{ fontSize: 18, color: theme.palette.warning.main }} />,
                    label: 'Pending',
                    value: tradeData.pendingTrades,
                    sub: 'Awaiting response',
                    color: theme.palette.warning.main,
                  },
                  {
                    icon: <PeopleIcon sx={{ fontSize: 18, color: theme.palette.secondary.main }} />,
                    label: 'Trade Partners',
                    value: tradeData.topPartners.length,
                    sub: 'Unique partners',
                    color: theme.palette.secondary.main,
                  },
                ].map((stat, i) => (
                  <Grid item xs={6} md={3} key={i}>
                    <StaggerItem>
                      <Box
                        sx={{
                          ...cardSx,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                          transition: 'border-color 0.2s',
                          '&:hover': {
                            borderColor: isDark ? 'rgba(124, 138, 255, 0.2)' : 'rgba(0,0,0,0.12)',
                          },
                        }}
                      >
                        <Box
                          sx={{
                            width: 36,
                            height: 36,
                            borderRadius: '10px',
                            bgcolor: `${stat.color}18`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {stat.icon}
                        </Box>
                        <Box>
                          <Typography variant="h6" sx={{ fontWeight: 700, color: stat.color, lineHeight: 1.1 }}>
                            {stat.value}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                            {stat.label}
                          </Typography>
                          <Typography variant="caption" sx={{ color: stat.color, fontSize: '0.65rem' }}>
                            {stat.sub}
                          </Typography>
                        </Box>
                      </Box>
                    </StaggerItem>
                  </Grid>
                ))}
              </Grid>
            </StaggerContainer>

            {/* Top Trade Partners */}
            {tradeData.topPartners.length > 0 && (
              <Box sx={{ ...cardSx, mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <PeopleIcon sx={{ color: theme.palette.secondary.main, fontSize: 20 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                    Top Trade Partners
                  </Typography>
                </Box>
                <StaggerContainer>
                  <Grid container spacing={2}>
                    {tradeData.topPartners.map((partner, index) => (
                      <Grid item xs={12} sm={6} md={4} key={partner.name}>
                        <StaggerItem>
                          <Box
                            sx={{
                              p: 1.5,
                              borderRadius: '10px',
                              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
                              bgcolor: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.008)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 1.5,
                              transition: 'border-color 0.2s',
                              '&:hover': {
                                borderColor: isDark ? 'rgba(124, 138, 255, 0.18)' : 'rgba(0,0,0,0.1)',
                              },
                            }}
                          >
                            <Avatar sx={{ width: 36, height: 36, bgcolor: `hsl(${index * 60}, 60%, 50%)`, fontSize: 14 }}>
                              {partner.name.charAt(0).toUpperCase()}
                            </Avatar>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                                {partner.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {partner.count} trades
                              </Typography>
                            </Box>
                            <Chip
                              label={`#${index + 1}`}
                              size="small"
                              sx={{
                                height: 20,
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                bgcolor: index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : 'action.hover',
                                color: index < 3 ? '#000' : 'text.primary',
                              }}
                            />
                          </Box>
                        </StaggerItem>
                      </Grid>
                    ))}
                  </Grid>
                </StaggerContainer>
              </Box>
            )}

            {/* Recent Trade History */}
            <Box
              sx={{
                ...cardSx,
                p: tradeData.tradeHistory.length > 0 ? 0 : 2.5,
                overflow: 'hidden',
              }}
            >
              {tradeData.tradeHistory.length > 0 ? (
                <>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, p: 2, pb: 1 }}>
                    <HistoryIcon sx={{ color: theme.palette.info.main, fontSize: 20 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                      Recent Trades
                    </Typography>
                  </Box>
                  <DataTable
                    columns={tradeHistoryColumns}
                    rows={tradeData.tradeHistory}
                    loading={false}
                    searchable={false}
                    pageSize={10}
                    emptyMessage="No trade history"
                    rowKey="id"
                  />
                </>
              ) : (
                <EmptyState
                  icon={<TradeIcon sx={{ fontSize: 48 }} />}
                  title="No Trade History"
                  description="No trade history available yet"
                  minHeight={200}
                />
              )}
            </Box>
          </>
        )}
      </Box>
    </FadeIn>
  )
}

export default TradeAnalytics
