/**
 * EmptyState - Reusable empty state component for when there's no data
 *
 * Usage:
 *   <EmptyState
 *     icon={<InboxIcon />}
 *     title="No Messages"
 *     description="You haven't received any messages yet."
 *     action={<Button onClick={refresh}>Refresh</Button>}
 *   />
 */

import { isValidElement } from 'react'
import { Box, Typography, Button } from '@mui/material'
import InboxIcon from '@mui/icons-material/Inbox'

export function EmptyState({
  icon = <InboxIcon sx={{ fontSize: 64 }} />,
  title = 'No Data',
  description = 'There is nothing to display here yet.',
  action = null,
  iconColor = 'text.secondary',
  minHeight = 300,
}) {
  // Accept both <Icon /> elements and Icon component references
  // MUI icons are React.memo(forwardRef(...)) which React cannot render directly
  const iconNode = isValidElement(icon)
    ? icon
    : (typeof icon === 'function' || (icon && typeof icon === 'object' && icon.$$typeof))
      ? (() => { const C = icon; return <C sx={{ fontSize: 64 }} /> })()
      : icon;
  return (
    <Box
      role="status"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight,
        py: 4,
        px: 2,
        textAlign: 'center',
      }}
    >
      <Box
        sx={{
          color: iconColor,
          opacity: 0.6,
          mb: 2,
        }}
      >
        {iconNode}
      </Box>
      <Typography
        variant="h6"
        color="text.primary"
        gutterBottom
        sx={{ fontWeight: 500 }}
      >
        {title}
      </Typography>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ maxWidth: 400, mb: action ? 3 : 0 }}
      >
        {description}
      </Typography>
      {action}
    </Box>
  )
}

// Pre-configured empty states for common scenarios
export function NoAccountsEmpty({ onAddAccount }) {
  return (
    <EmptyState
      title="No Accounts Linked"
      description="Link your game accounts to get started with pack hunting and automation."
      action={
        onAddAccount && (
          <Button variant="contained" onClick={onAddAccount}>
            Link Account
          </Button>
        )
      }
    />
  )
}

export function NoResultsEmpty({ searchTerm, onClear }) {
  return (
    <EmptyState
      title="No Results Found"
      description={
        searchTerm
          ? `No results found for "${searchTerm}". Try a different search term.`
          : 'No results match your current filters.'
      }
      action={
        onClear && (
          <Button variant="outlined" onClick={onClear}>
            Clear Filters
          </Button>
        )
      }
    />
  )
}

export function NoCardsEmpty() {
  return (
    <EmptyState
      title="No Cards Yet"
      description="Open some packs to start building your collection!"
    />
  )
}

export function NoFriendsEmpty({ onAddFriend }) {
  return (
    <EmptyState
      title="No Friends"
      description="Add friends to trade cards and send gifts."
      action={
        onAddFriend && (
          <Button variant="contained" onClick={onAddFriend}>
            Add Friend
          </Button>
        )
      }
    />
  )
}

export function NoHistoryEmpty() {
  return (
    <EmptyState
      title="No History"
      description="Your activity history will appear here once you start using the app."
      minHeight={200}
    />
  )
}

export function LoadingErrorEmpty({ onRetry }) {
  return (
    <EmptyState
      title="Failed to Load"
      description="Something went wrong while loading the data. Please try again."
      action={
        onRetry && (
          <Button variant="contained" onClick={onRetry}>
            Retry
          </Button>
        )
      }
    />
  )
}

export default EmptyState
