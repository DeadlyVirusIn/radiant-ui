import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import {
  Box,
  Typography,
  Grid,
  Chip,
  Alert,
  TextField,
  InputAdornment,
  Tooltip,
  IconButton,
  Pagination,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  useTheme,
} from '@mui/material'
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  CheckCircle as CheckIcon,
  Cancel as CancelIcon,
  Timer as TimerIcon,
  CatchingPokemon as PokeballIcon,
  Star as StarIcon,
  PlayCircle as EligibleIcon,
  Person as PersonIcon,
  FilterList as FilterIcon,
  BarChart as ChartIcon,
} from '@mui/icons-material'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts'
import { hunt } from '../services/api'
import { formatDateTime as formatDate } from '../utils/dateFormat'
import StatCard from '../components/StatCardV2'
import DataTable from '../components/DataTable'
import { EmptyState } from '../components/EmptyState'
import { FadeIn, StaggerContainer, StaggerItem } from '../components/Animations'
import { StatsCardsSkeleton } from '../components/skeletons/PageSkeletons'
import { useSectionStyles } from '../components/SectionCard'

function AccountAnalytics({ user }) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  // Colors for the chart bars using theme tokens
  const CHART_COLORS = {
    '0-49': theme.palette.error.main,
    '50-94': theme.palette.warning.main,
    '95-99': theme.palette.success.main,
    '100-149': theme.palette.info.main,
    '150-199': theme.palette.secondary.main,
    '200+': '#ffd700',
  }

  const [accounts, setAccounts] = useState([])
  const [summary, setSummary] = useState({})
  const [packDistribution, setPackDistribution] = useState([])
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalCount: 0 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  // Pagination and sorting state
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)
  const [sortBy, setSortBy] = useState('total_packs')
  const [sortOrder, setSortOrder] = useState('desc')
  const [filter, setFilter] = useState('')

  useEffect(() => {
    if (user?.isAdmin) {
      fetchAnalytics()
      fetchPackDistribution()
    }
  }, [user])

  useEffect(() => {
    if (user?.isAdmin) {
      fetchAnalytics()
    }
  }, [page, limit, sortBy, sortOrder, filter])

  // Admin-only page - redirect non-admins
  if (!user?.isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  const fetchAnalytics = async () => {
    try {
      setLoading(true)
      const data = await hunt.getAccountAnalytics(null, { page, limit, sortBy, sortOrder, filter })
      setAccounts(data.accounts || [])
      setSummary(data.summary || {})
      setPagination(data.pagination || { page: 1, totalPages: 1, totalCount: 0 })
      setError('')
    } catch (err) {
      setError(err.message || 'Failed to fetch analytics')
    } finally {
      setLoading(false)
    }
  }

  const fetchPackDistribution = async () => {
    try {
      const data = await hunt.getPackDistribution()
      setPackDistribution(data.distribution || [])
    } catch (err) {
      console.error('Failed to fetch pack distribution:', err)
    }
  }

  // Filter accounts by search (client-side for current page)
  const filteredAccounts = accounts.filter(acc => {
    if (!search) return true
    const searchLower = search.toLowerCase()
    return (
      acc.nickname?.toLowerCase().includes(searchLower) ||
      acc.player_id?.toLowerCase().includes(searchLower) ||
      acc.device_account?.toLowerCase().includes(searchLower)
    )
  })

  // Calculate cooldown status
  const getCooldownStatus = (lastHuntedAt) => {
    if (!lastHuntedAt) return { canHunt: true, remaining: null }
    const lastHunted = new Date(lastHuntedAt).getTime()
    const cooldownEnd = lastHunted + (12 * 60 * 60 * 1000) // 12 hours
    const now = Date.now()
    if (now >= cooldownEnd) return { canHunt: true, remaining: null }
    const remainingMs = cooldownEnd - now
    const hours = Math.floor(remainingMs / (60 * 60 * 1000))
    const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000))
    return { canHunt: false, remaining: `${hours}h ${minutes}m` }
  }

  // Handle sort
  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
    setPage(1) // Reset to first page on sort change
  }

  // Handle page change
  const handlePageChange = (event, newPage) => {
    setPage(newPage)
  }

  // Handle filter change
  const handleFilterChange = (event) => {
    setFilter(event.target.value)
    setPage(1) // Reset to first page on filter change
  }

  // DataTable columns for accounts
  const accountColumns = [
    {
      id: 'nickname',
      label: 'Player',
      sortable: true,
      minWidth: 150,
      render: (row) => (
        <Box>
          <Typography variant="body2" fontWeight={600}>
            {row.nickname || 'Unknown'}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {row.player_id || row.device_account?.slice(0, 16) + '...'}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'total_packs',
      label: 'Packs',
      sortable: true,
      align: 'right',
      render: (row) => (
        <Typography
          variant="body2"
          fontWeight={600}
          color={(row.total_packs || 0) >= 95 ? 'success.main' : 'text.secondary'}
        >
          {(row.total_packs || 0).toLocaleString()}
        </Typography>
      ),
    },
    {
      id: 'godpack_count',
      label: 'God Packs',
      sortable: true,
      align: 'right',
      render: (row) => (
        <Typography
          variant="body2"
          fontWeight={600}
          color={row.godpack_count > 0 ? 'warning.main' : 'inherit'}
        >
          {row.godpack_count || 0}
        </Typography>
      ),
    },
    {
      id: 'status',
      label: 'Status',
      align: 'center',
      render: (row) => {
        const isValid = row.is_valid && (row.total_packs || 0) >= 95
        return (
          <Tooltip title={isValid ? 'Valid (95+ packs)' : 'Invalid or < 95 packs'}>
            {isValid ? (
              <CheckIcon color="success" fontSize="small" />
            ) : (
              <CancelIcon color="error" fontSize="small" />
            )}
          </Tooltip>
        )
      },
    },
    {
      id: 'eligible',
      label: 'Eligible',
      align: 'center',
      render: (row) => {
        const isValid = row.is_valid && (row.total_packs || 0) >= 95
        const cooldown = getCooldownStatus(row.last_hunted_at)
        if (row.is_eligible || (cooldown.canHunt && isValid)) {
          return <Chip label="Ready" size="small" color="success" />
        }
        if (!isValid) {
          return <Chip label="Invalid" size="small" color="error" variant="outlined" />
        }
        return (
          <Chip
            icon={<TimerIcon />}
            label={cooldown.remaining}
            size="small"
            color="warning"
          />
        )
      },
    },
    {
      id: 'last_synced_at',
      label: 'Last Synced',
      sortable: true,
      format: (val) => formatDate(val),
    },
    {
      id: 'last_hunted_at',
      label: 'Last Hunted',
      sortable: true,
      format: (val) => formatDate(val),
    },
  ]

  if (loading && accounts.length === 0) {
    return (
      <Box>
        {/* Header skeleton state */}
        <PageHeader
          icon={<ChartIcon />}
          title="Account Analytics"
          subtitle="Per-account statistics and performance metrics"
        />
        <StatsCardsSkeleton count={5} />
      </Box>
    )
  }

  const { sectionBox: cardStyle } = useSectionStyles()

  return (
    <FadeIn>
      <Box>
        {/* Header */}
        <PageHeader
          icon={<ChartIcon />}
          title="Account Analytics"
          subtitle={`Per-account statistics and performance metrics (${pagination.totalCount?.toLocaleString()} total accounts)`}
          action={
            <IconButton
              onClick={fetchAnalytics}
              disabled={loading}
              aria-label="Refresh analytics"
              sx={{
                border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
                borderRadius: '10px',
              }}
            >
              <RefreshIcon />
            </IconButton>
          }
        />

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Summary Stats */}
        <StaggerContainer>
          <Grid container spacing={2} sx={{ mb: 4 }}>
            <Grid item xs={6} sm={4} md={2.4}>
              <StaggerItem>
                <StatCard
                  icon={PersonIcon}
                  label="Total Accounts"
                  value={summary.total_accounts || 0}
                  color="primary"
                />
              </StaggerItem>
            </Grid>
            <Grid item xs={6} sm={4} md={2.4}>
              <StaggerItem>
                <StatCard
                  icon={CheckIcon}
                  label="Valid Accounts"
                  value={summary.valid_accounts || 0}
                  color="success"
                  subtitle="95+ packs"
                />
              </StaggerItem>
            </Grid>
            <Grid item xs={6} sm={4} md={2.4}>
              <StaggerItem>
                <StatCard
                  icon={EligibleIcon}
                  label="Eligible Accounts"
                  value={summary.eligible_accounts || 0}
                  color="info"
                  subtitle="Ready for hunt"
                />
              </StaggerItem>
            </Grid>
            <Grid item xs={6} sm={4} md={2.4}>
              <StaggerItem>
                <StatCard
                  icon={PokeballIcon}
                  label="Total Packs"
                  value={summary.total_packs || 0}
                  color="secondary"
                />
              </StaggerItem>
            </Grid>
            <Grid item xs={6} sm={4} md={2.4}>
              <StaggerItem>
                <StatCard
                  icon={StarIcon}
                  label="Avg Packs/Account"
                  value={Math.round(summary.avg_packs || 0)}
                  color="warning"
                />
              </StaggerItem>
            </Grid>
          </Grid>
        </StaggerContainer>

        {/* Pack Distribution Chart */}
        {packDistribution.length > 0 && (
          <Box sx={{ ...cardStyle, mb: 4 }}>
            {/* Chart header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark || theme.palette.primary.main})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <ChartIcon sx={{ color: 'white', fontSize: 16 }} />
              </Box>
              <Box>
                <Typography variant="subtitle1" fontWeight={600}>
                  Pack Distribution
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Accounts by pack count
                </Typography>
              </Box>
            </Box>

            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={packDistribution} margin={{ top: 10, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}
                />
                <XAxis
                  dataKey="bucket"
                  tick={{ fontSize: 12, fill: theme.palette.text.secondary }}
                />
                <YAxis tick={{ fontSize: 12, fill: theme.palette.text.secondary }} />
                <RechartsTooltip
                  formatter={(value) => [value.toLocaleString() + ' accounts', 'Count']}
                  labelFormatter={(label) => `${label} packs`}
                  contentStyle={{
                    backgroundColor: isDark ? '#1e2235' : '#fff',
                    border: `1px solid ${isDark ? 'rgba(124,138,255,0.15)' : 'rgba(0,0,0,0.08)'}`,
                    borderRadius: 8,
                    fontSize: 13,
                  }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {packDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CHART_COLORS[entry.bucket] || '#8884d8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>

            {/* Legend */}
            <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 2, mt: 2 }}>
              {Object.entries(CHART_COLORS).map(([label, color]) => (
                <Box key={label} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 10, height: 10, bgcolor: color, borderRadius: '3px', flexShrink: 0 }} />
                  <Typography variant="caption" color="text.secondary">{label}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}

        {/* Search and Filters */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
          <TextField
            fullWidth
            placeholder="Search by player name, ID, or device account..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            size="small"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
              sx: { borderRadius: '10px' },
            }}
          />
          <FormControl sx={{ minWidth: 180 }} size="small">
            <InputLabel>Filter</InputLabel>
            <Select
              value={filter}
              label="Filter"
              onChange={handleFilterChange}
              startAdornment={<FilterIcon sx={{ mr: 1, color: 'action.active', fontSize: 18 }} />}
              sx={{ borderRadius: '10px' }}
            >
              <MenuItem value="">All Accounts</MenuItem>
              <MenuItem value="valid">Valid (95+ packs)</MenuItem>
              <MenuItem value="eligible">Eligible (Ready for Hunt)</MenuItem>
              <MenuItem value="invalid">Invalid</MenuItem>
            </Select>
          </FormControl>
          <FormControl sx={{ minWidth: 120 }} size="small">
            <InputLabel>Per Page</InputLabel>
            <Select
              value={limit}
              label="Per Page"
              onChange={(e) => { setLimit(e.target.value); setPage(1); }}
              sx={{ borderRadius: '10px' }}
            >
              <MenuItem value={25}>25</MenuItem>
              <MenuItem value={50}>50</MenuItem>
              <MenuItem value={100}>100</MenuItem>
            </Select>
          </FormControl>
        </Stack>

        {/* Accounts Table */}
        <Box
          sx={{
            borderRadius: '14px',
            border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
            overflow: 'hidden',
            bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
          }}
        >
          <DataTable
            columns={accountColumns}
            rows={filteredAccounts}
            loading={loading}
            searchable={false}
            pageSize={limit}
            emptyMessage={search ? 'No accounts match your search' : 'No accounts found'}
            emptyIcon={<PersonIcon sx={{ fontSize: 48 }} />}
            rowKey="id"
          />
        </Box>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 3, flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Showing {((page - 1) * limit) + 1}–{Math.min(page * limit, pagination.totalCount)} of {pagination.totalCount?.toLocaleString()}
            </Typography>
            <Pagination
              count={pagination.totalPages}
              page={page}
              onChange={handlePageChange}
              color="primary"
              showFirstButton
              showLastButton
              size="small"
            />
          </Box>
        )}
      </Box>
    </FadeIn>
  )
}

export default AccountAnalytics
