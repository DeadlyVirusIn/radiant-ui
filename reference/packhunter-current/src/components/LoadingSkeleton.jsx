/**
 * Loading Skeleton Components
 */

import { Box, Skeleton, Grid, Paper } from '@mui/material'

// Card grid skeleton (for Cards page)
export function CardGridSkeleton({ count = 12 }) {
  return (
    <Grid container spacing={2} role="status" aria-label="Loading content">
      {[...Array(count)].map((_, i) => (
        <Grid item xs={6} sm={4} md={3} lg={2} key={i}>
          <Skeleton variant="rounded" height={280} animation="wave" />
        </Grid>
      ))}
    </Grid>
  )
}

// Stats card skeleton (for Dashboard)
export function StatsCardSkeleton() {
  return (
    <Paper sx={{ p: 2 }} role="status" aria-label="Loading content">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Skeleton variant="circular" width={48} height={48} />
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="60%" height={32} />
          <Skeleton variant="text" width="40%" height={20} />
        </Box>
      </Box>
    </Paper>
  )
}

// Activity feed skeleton
export function ActivitySkeleton({ count = 5 }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }} role="status" aria-label="Loading content">
      {[...Array(count)].map((_, i) => (
        <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Skeleton variant="circular" width={32} height={32} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="80%" />
            <Skeleton variant="text" width="50%" height={16} />
          </Box>
          <Skeleton variant="rounded" width={60} height={24} />
        </Box>
      ))}
    </Box>
  )
}

// List item skeleton
export function ListItemSkeleton({ count = 5 }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }} role="status" aria-label="Loading content">
      {[...Array(count)].map((_, i) => (
        <Paper key={i} sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Skeleton variant="circular" width={40} height={40} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="70%" />
            <Skeleton variant="text" width="40%" height={16} />
          </Box>
          <Skeleton variant="rounded" width={80} height={32} />
        </Paper>
      ))}
    </Box>
  )
}

// Wonder pick row skeleton
export function WonderPickSkeleton({ count = 3 }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }} role="status" aria-label="Loading content">
      {[...Array(count)].map((_, i) => (
        <Paper key={i} sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {[...Array(5)].map((_, j) => (
              <Skeleton key={j} variant="rounded" width={100} height={140} />
            ))}
          </Box>
          <Box sx={{ minWidth: 200, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Skeleton variant="text" width="80%" />
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="rounded" height={36} />
          </Box>
        </Paper>
      ))}
    </Box>
  )
}

// Pack opening skeleton
export function PackOpenSkeleton() {
  return (
    <Box sx={{ textAlign: 'center', py: 4 }} role="status" aria-label="Loading content">
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} variant="rounded" width={140} height={200} />
        ))}
      </Box>
    </Box>
  )
}

// Bot status skeleton
export function BotStatusSkeleton() {
  return (
    <Paper sx={{ p: 3 }} role="status" aria-label="Loading content">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Skeleton variant="rounded" width={200} height={40} />
        <Skeleton variant="rounded" width={80} height={32} />
        <Skeleton variant="rounded" width={100} height={36} />
      </Box>
      <Box sx={{ display: 'flex', gap: 2 }}>
        <Skeleton variant="text" width="40%" />
        <Skeleton variant="text" width="30%" />
      </Box>
    </Paper>
  )
}

// Timeline skeleton
export function TimelineSkeleton({ count = 5 }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pl: 4 }} role="status" aria-label="Loading content">
      {[...Array(count)].map((_, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 2, position: 'relative' }}>
          <Box sx={{
            position: 'absolute',
            left: -24,
            top: 4,
            width: 12,
            height: 12,
            borderRadius: '50%',
            bgcolor: 'grey.300',
          }} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="60%" />
            <Skeleton variant="text" width="30%" height={16} />
          </Box>
        </Box>
      ))}
    </Box>
  )
}

export default {
  CardGridSkeleton,
  StatsCardSkeleton,
  ActivitySkeleton,
  ListItemSkeleton,
  WonderPickSkeleton,
  PackOpenSkeleton,
  BotStatusSkeleton,
  TimelineSkeleton,
}
