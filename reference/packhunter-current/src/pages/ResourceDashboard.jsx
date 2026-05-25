import { useState, useEffect, useCallback } from 'react'
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
  useTheme,
} from '@mui/material'
import {
  Sync as SyncIcon,
  AccountBalanceWallet as WalletIcon,
  HourglassEmpty as HourglassIcon,
  ConfirmationNumber as TicketIcon,
  Diamond as DiamondIcon,
  CardGiftcard as PackIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  Inventory as InventoryIcon,
  AutoAwesome as ShineIcon,
} from '@mui/icons-material'
import { accounts as accountsApi, tasks as tasksApi } from '../services/api'
import { useLanguage } from '../contexts/LanguageContext'
import DataTable from '../components/DataTable'
import { FadeIn } from '../components/Animations'
import { EmptyState } from '../components/EmptyState'
import { DashboardSkeleton } from '../components/skeletons/PageSkeletons'
import PageHeader from '../components/PageHeader'
import { useSectionStyles } from '../components/SectionCard'

// Resource Card component - themed Box with modern UX
const ResourceCard = ({ icon, label, value, subValue, color, trend, maxValue, isDark, theme }) => {
  const percentage = maxValue ? (value / maxValue) * 100 : null

  return (
    <Box
      sx={{
        p: 2.5,
        borderRadius: '14px',
        border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
        bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
        height: '100%',
        transition: 'border-color 0.2s',
        '&:hover': {
          borderColor: isDark ? `${color}30` : `${color}40`,
        },
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 1.5 }}>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: '10px',
            bgcolor: `${color}18`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Box sx={{ color, display: 'flex' }}>{icon}</Box>
        </Box>

        {trend !== undefined && trend !== 0 && (
          <Chip
            icon={trend > 0 ? <TrendingUpIcon sx={{ fontSize: 14 }} /> : <TrendingDownIcon sx={{ fontSize: 14 }} />}
            label={`${trend > 0 ? '+' : ''}${trend}`}
            size="small"
            sx={{
              height: 20,
              fontSize: '0.65rem',
              fontWeight: 700,
              bgcolor: trend > 0 ? `${theme.palette.success.main}18` : `${theme.palette.error.main}18`,
              color: trend > 0 ? theme.palette.success.main : theme.palette.error.main,
            }}
          />
        )}
      </Box>

      <Typography variant="h4" sx={{ fontWeight: 800, color, lineHeight: 1.1, mb: 0.25 }}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </Typography>

      <Typography variant="body2" sx={{ fontWeight: 500, color: 'text.primary', mb: 0.25 }}>
        {label}
      </Typography>

      {subValue && (
        <Typography variant="caption" color="text.secondary">
          {subValue}
        </Typography>
      )}

      {percentage !== null && (
        <Box sx={{ mt: 1.5 }}>
          <LinearProgress
            variant="determinate"
            value={Math.min(percentage, 100)}
            sx={{
              height: 4,
              borderRadius: 2,
              bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
              mb: 0.5,
              '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 2 },
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {value}/{maxValue} ({Math.round(percentage)}%)
          </Typography>
        </Box>
      )}
    </Box>
  )
}

function ResourceDashboard({ user }) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [userAccounts, setUserAccounts] = useState([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [error, setError] = useState('')
  const [resources, setResources] = useState({
    hourglasses: 0,
    shopTickets: 0,
    premierTickets: 0,
    shineDust: 0,
    packPoints: 0,
    totalCards: 0,
    packsAvailable: 0,
  })
  const [resourceHistory, setResourceHistory] = useState([])

  const { sectionBox: cardSx } = useSectionStyles()

  // Load user accounts on mount
  useEffect(() => {
    loadAccounts()
  }, [])

  // Load resources when account is selected
  useEffect(() => {
    if (selectedAccount) {
      loadResources()
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

  const loadResources = async () => {
    if (!selectedAccount) return

    setLoadingData(true)
    setError('')

    try {
      const resourcesData = await tasksApi.getResources(selectedAccount)

      const hourglasses = resourcesData?.hourglasses ?? 0

      setResources({
        hourglasses,
        shopTickets: resourcesData?.shopTickets ?? 0,
        premierTickets: resourcesData?.premierShopTickets ?? 0,
        shineDust: resourcesData?.shinedust ?? 0,
        packPoints: resourcesData?.packPoints ?? 0,
        totalCards: resourcesData?.totalCards ?? 0,
        packsAvailable: Math.floor(hourglasses / 12),
      })

      // Add to history for trending (mock - in real implementation, store in DB)
      setResourceHistory(prev => {
        const newEntry = {
          timestamp: new Date().toISOString(),
          hourglasses,
          shopTickets: resourcesData?.shopTickets ?? 0,
        }
        return [...prev.slice(-23), newEntry] // Keep last 24 entries
      })

    } catch (err) {
      console.error('Failed to load resources:', err)
      setError(`Failed to load resources: ${err.message}`)
    } finally {
      setLoadingData(false)
    }
  }

  // Calculate trend from history
  const getTrend = (key) => {
    if (resourceHistory.length < 2) return 0
    const latest = resourceHistory[resourceHistory.length - 1]?.[key] || 0
    const previous = resourceHistory[resourceHistory.length - 2]?.[key] || 0
    return latest - previous
  }

  if (loading) {
    return <DashboardSkeleton />
  }

  return (
    <FadeIn>
    <Box>
      <PageHeader
        icon={<WalletIcon />}
        title={t('nav.resourceDashboard') || 'Resource Dashboard'}
        subtitle="Track all in-game currencies and resources in real-time"
        accent={theme.palette.warning.main}
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
          onClick={loadResources}
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
        <EmptyState
          icon={<WalletIcon />}
          title="No Account Selected"
          description="Select an account to view resources"
        />
      )}

      {/* Loading */}
      {selectedAccount && loadingData && (
        <DashboardSkeleton />
      )}

      {/* Resources content */}
      {selectedAccount && !loadingData && (
        <>
          {/* Primary Currencies section label */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <WalletIcon sx={{ color: theme.palette.warning.main, fontSize: 18 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.7rem' }}>
              Primary Currencies
            </Typography>
          </Box>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={4}>
              <ResourceCard
                icon={<HourglassIcon sx={{ fontSize: 20 }} />}
                label="Hourglasses"
                value={resources.hourglasses}
                subValue={`${resources.packsAvailable} packs available`}
                color={theme.palette.secondary.main}
                trend={getTrend('hourglasses')}
                isDark={isDark}
                theme={theme}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <ResourceCard
                icon={<TicketIcon sx={{ fontSize: 20 }} />}
                label="Shop Tickets"
                value={resources.shopTickets}
                subValue="Wonder Pick currency"
                color={theme.palette.warning.main}
                trend={getTrend('shopTickets')}
                isDark={isDark}
                theme={theme}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <ResourceCard
                icon={<DiamondIcon sx={{ fontSize: 20 }} />}
                label="Premier Tickets"
                value={resources.premierTickets}
                subValue="Premium shop currency"
                color={theme.palette.info.main}
                isDark={isDark}
                theme={theme}
              />
            </Grid>
          </Grid>

          {/* Other Resources section label */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
            <InventoryIcon sx={{ color: theme.palette.success.main, fontSize: 18 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.7rem' }}>
              Other Resources
            </Typography>
          </Box>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={4}>
              <ResourceCard
                icon={<ShineIcon sx={{ fontSize: 20 }} />}
                label="Shine Dust"
                value={resources.shineDust}
                subValue="Craft materials"
                color={theme.palette.primary.main}
                isDark={isDark}
                theme={theme}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <ResourceCard
                icon={<PackIcon sx={{ fontSize: 20 }} />}
                label="Pack Points"
                value={resources.packPoints}
                subValue="Bonus points from packs"
                color={theme.palette.info.main}
                isDark={isDark}
                theme={theme}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <ResourceCard
                icon={<InventoryIcon sx={{ fontSize: 20 }} />}
                label="Total Cards"
                value={resources.totalCards}
                subValue="Cards in collection"
                color={theme.palette.success.main}
                isDark={isDark}
                theme={theme}
              />
            </Grid>
          </Grid>

          {/* Resource Summary Table */}
          <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 600, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', fontSize: '0.7rem' }}>
            Resource Summary
          </Typography>
          <Box sx={{ ...cardSx, p: 0, overflow: 'hidden', mb: 3 }}>
            <DataTable
              columns={[
                {
                  id: 'resource',
                  label: 'Resource',
                  render: (row) => (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {row.icon}
                      {row.resource}
                    </Box>
                  ),
                },
                { id: 'current', label: 'Current', align: 'right' },
                { id: 'canPurchase', label: 'Can Purchase', align: 'right' },
              ]}
              rows={[
                {
                  id: 'hourglasses',
                  resource: 'Hourglasses',
                  icon: <HourglassIcon sx={{ color: theme.palette.secondary.main, fontSize: 18 }} />,
                  current: resources.hourglasses,
                  canPurchase: `${resources.packsAvailable} packs (12 per pack)`,
                },
                {
                  id: 'shopTickets',
                  resource: 'Shop Tickets',
                  icon: <TicketIcon sx={{ color: theme.palette.warning.main, fontSize: 18 }} />,
                  current: resources.shopTickets,
                  canPurchase: `${Math.floor(resources.shopTickets / 12)} discounted 6-packs | ${Math.floor(resources.shopTickets / 3)} singles`,
                },
              ]}
              searchable={false}
              pageSize={10}
              emptyMessage="No resource data"
              rowKey="id"
            />
          </Box>

          {/* Spending Power Summary */}
          <Box sx={cardSx}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <WalletIcon sx={{ color: theme.palette.warning.main, fontSize: 18 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Spending Power
              </Typography>
            </Box>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Box
                  sx={{
                    textAlign: 'center',
                    p: 2,
                    borderRadius: '10px',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}`,
                    bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
                  }}
                >
                  <Typography variant="h3" sx={{ fontWeight: 800, color: theme.palette.secondary.main, lineHeight: 1 }}>
                    {resources.packsAvailable}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Regular Packs Available
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Box
                  sx={{
                    textAlign: 'center',
                    p: 2,
                    borderRadius: '10px',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'}`,
                    bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
                  }}
                >
                  <Typography variant="h3" sx={{ fontWeight: 800, color: theme.palette.warning.main, lineHeight: 1 }}>
                    {Math.floor(resources.shopTickets / 12) * 6}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    Hourglasses Purchasable
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </>
      )}
    </Box>
    </FadeIn>
  )
}

export default ResourceDashboard
