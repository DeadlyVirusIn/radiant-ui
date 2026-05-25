/**
 * PageSkeletons - Standardized loading skeleton components
 *
 * Provides consistent loading states across all pages
 * Each skeleton matches the actual page layout for seamless transition
 */

import { Box, Skeleton, Paper, Grid, Card, CardContent } from '@mui/material'

// Generic page header skeleton
export function PageHeaderSkeleton({ hasSubtitle = true, hasAction = false }) {
  return (
    <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
      <Box>
        <Skeleton variant="text" width={200} height={40} />
        {hasSubtitle && <Skeleton variant="text" width={300} height={24} />}
      </Box>
      {hasAction && <Skeleton variant="rounded" width={100} height={36} />}
    </Box>
  )
}

// Stats cards row (used in Dashboard, Hunt Monitor, etc.)
export function StatsCardsSkeleton({ count = 4 }) {
  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      {Array.from({ length: count }).map((_, i) => (
        <Grid item xs={6} sm={6} md={3} key={i}>
          <Card>
            <CardContent sx={{ py: 2, textAlign: 'center' }}>
              <Skeleton variant="circular" width={48} height={48} sx={{ mx: 'auto', mb: 1 }} />
              <Skeleton variant="text" width="60%" height={32} sx={{ mx: 'auto' }} />
              <Skeleton variant="text" width="40%" height={20} sx={{ mx: 'auto' }} />
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  )
}

// Dashboard skeleton
export function DashboardSkeleton() {
  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      {/* Hero Section */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
          <Skeleton variant="circular" width={80} height={80} />
          <Box sx={{ flex: 1, minWidth: 200 }}>
            <Skeleton variant="text" width={180} height={32} />
            <Skeleton variant="text" width={120} height={20} />
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Skeleton variant="rounded" width={60} height={24} />
              <Skeleton variant="rounded" width={80} height={24} />
            </Box>
          </Box>
        </Box>
      </Paper>

      {/* Stats Cards */}
      <StatsCardsSkeleton count={4} />

      {/* Activity Feed */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2 }}>
            <Skeleton variant="text" width={150} height={28} sx={{ mb: 2 }} />
            {Array.from({ length: 5 }).map((_, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Skeleton variant="circular" width={40} height={40} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton variant="text" width="80%" />
                  <Skeleton variant="text" width="50%" height={16} />
                </Box>
              </Box>
            ))}
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Skeleton variant="text" width={120} height={28} sx={{ mb: 2 }} />
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={60} sx={{ mb: 1 }} />
            ))}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  )
}

// Cards/Collection page skeleton
export function CardGridSkeleton({ count = 12 }) {
  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeaderSkeleton hasAction />

      {/* Filters */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Skeleton variant="rounded" width={200} height={40} />
          <Skeleton variant="rounded" width={150} height={40} />
          <Skeleton variant="rounded" width={150} height={40} />
          <Skeleton variant="rounded" width={120} height={40} />
        </Box>
      </Paper>

      {/* Card Grid */}
      <Grid container spacing={2}>
        {Array.from({ length: count }).map((_, i) => (
          <Grid item xs={6} sm={4} md={3} lg={2.4} key={i}>
            <Card>
              <Skeleton variant="rectangular" height={180} />
              <CardContent sx={{ py: 1.5 }}>
                <Skeleton variant="text" width="80%" />
                <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                  <Skeleton variant="rounded" width={40} height={20} />
                  <Skeleton variant="text" width={30} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}

// Friends page skeleton
export function FriendsSkeleton() {
  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeaderSkeleton hasAction />

      {/* Stats */}
      <StatsCardsSkeleton count={4} />

      {/* Friends List */}
      <Paper sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
          <Skeleton variant="text" width={150} height={28} />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Skeleton variant="rounded" width={100} height={36} />
            <Skeleton variant="rounded" width={100} height={36} />
          </Box>
        </Box>
        {Array.from({ length: 8 }).map((_, i) => (
          <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            <Skeleton variant="circular" width={40} height={40} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width={150} />
              <Skeleton variant="text" width={100} height={16} />
            </Box>
            <Skeleton variant="rounded" width={80} height={32} />
          </Box>
        ))}
      </Paper>
    </Box>
  )
}

// Hunt Monitor skeleton
export function HuntMonitorSkeleton() {
  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeaderSkeleton hasAction />

      {/* Hunt Status */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Skeleton variant="circular" width={60} height={60} />
          <Box>
            <Skeleton variant="text" width={200} height={32} />
            <Skeleton variant="text" width={150} height={20} />
          </Box>
        </Box>
        <Skeleton variant="rounded" height={8} sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Skeleton variant="text" width={100} />
          <Skeleton variant="text" width={100} />
        </Box>
      </Paper>

      {/* Stats */}
      <StatsCardsSkeleton count={4} />

      {/* Instance Cards */}
      <Grid container spacing={2}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Grid item xs={12} sm={6} md={4} key={i}>
            <Card>
              <CardContent>
                <Skeleton variant="text" width={120} height={24} />
                <Skeleton variant="text" width={80} height={16} sx={{ mb: 1 }} />
                <Skeleton variant="rounded" height={4} sx={{ mb: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Skeleton variant="text" width={60} />
                  <Skeleton variant="text" width={60} />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  )
}

// Settings page skeleton
export function SettingsSkeleton() {
  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeaderSkeleton />

      {Array.from({ length: 3 }).map((_, i) => (
        <Paper key={i} sx={{ p: 3, mb: 2 }}>
          <Skeleton variant="text" width={180} height={28} sx={{ mb: 2 }} />
          {Array.from({ length: 4 }).map((_, j) => (
            <Box key={j} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1.5 }}>
              <Box>
                <Skeleton variant="text" width={150} />
                <Skeleton variant="text" width={250} height={16} />
              </Box>
              <Skeleton variant="rounded" width={50} height={30} />
            </Box>
          ))}
        </Paper>
      ))}
    </Box>
  )
}

// Bot Control skeleton
export function BotControlSkeleton() {
  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeaderSkeleton hasAction />

      {/* Account Selector */}
      <Skeleton variant="rounded" width={300} height={56} sx={{ mb: 3 }} />

      {/* Status Panel */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Skeleton variant="circular" width={48} height={48} />
          <Box>
            <Skeleton variant="text" width={150} height={28} />
            <Skeleton variant="text" width={200} height={20} />
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Skeleton variant="rounded" width={120} height={40} />
          <Skeleton variant="rounded" width={120} height={40} />
        </Box>
      </Paper>

      {/* Log Console */}
      <Paper sx={{ p: 2 }}>
        <Skeleton variant="text" width={100} height={24} sx={{ mb: 1 }} />
        <Skeleton variant="rounded" height={300} />
      </Paper>
    </Box>
  )
}

// Form page skeleton (header + form fields)
export function FormPageSkeleton({ fields = 5 }) {
  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeaderSkeleton />
      {Array.from({ length: fields }).map((_, i) => (
        <Paper key={i} sx={{ p: 3, mb: 2 }}>
          <Skeleton variant="text" width={180} height={28} sx={{ mb: 2 }} />
          <Skeleton variant="rounded" width="100%" height={56} sx={{ mb: 1 }} />
          <Skeleton variant="text" width="60%" height={16} />
        </Paper>
      ))}
    </Box>
  )
}

// Table page skeleton (header + filters + table)
export function TablePageSkeleton({ rows = 10, columns = 5 }) {
  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <PageHeaderSkeleton hasAction />
      <StatsCardsSkeleton count={4} />
      <TableSkeleton rows={rows} columns={columns} />
    </Box>
  )
}

// Table skeleton (for lists with many items)
export function TableSkeleton({ rows = 10, columns = 5 }) {
  return (
    <Paper sx={{ p: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', gap: 2, pb: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} variant="text" width={100} height={24} sx={{ flex: i === 0 ? 2 : 1 }} />
        ))}
      </Box>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
          {Array.from({ length: columns }).map((_, j) => (
            <Skeleton key={j} variant="text" width="100%" sx={{ flex: j === 0 ? 2 : 1 }} />
          ))}
        </Box>
      ))}
    </Paper>
  )
}

// Generic content skeleton
export function ContentSkeleton({ lines = 5 }) {
  return (
    <Box>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          width={`${Math.random() * 30 + 70}%`}
          sx={{ mb: 1 }}
        />
      ))}
    </Box>
  )
}

export default {
  PageHeaderSkeleton,
  StatsCardsSkeleton,
  DashboardSkeleton,
  CardGridSkeleton,
  FriendsSkeleton,
  HuntMonitorSkeleton,
  SettingsSkeleton,
  BotControlSkeleton,
  FormPageSkeleton,
  TablePageSkeleton,
  TableSkeleton,
  ContentSkeleton,
}
