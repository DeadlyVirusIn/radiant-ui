/**
 * UpgradeRequired - Shown when user's subscription tier is insufficient
 */
import { Box, Typography, Button, Paper } from '@mui/material'
import { Lock as LockIcon } from '@mui/icons-material'

const TIER_LABELS = {
  free: 'Free',
  trade: 'Trade',
  premium: 'Premium',
  admin: 'Admin',
}

export default function UpgradeRequired({ currentTier, requiredTiers }) {
  const currentLabel = TIER_LABELS[currentTier] || currentTier
  const requiredLabel = requiredTiers
    .filter(t => t !== 'admin')
    .map(t => TIER_LABELS[t] || t)
    .join(' or ')

  return (
    <Box sx={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '60vh',
      p: 3,
    }}>
      <Paper sx={{
        p: 5,
        textAlign: 'center',
        maxWidth: 480,
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
      }}>
        <LockIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
        <Typography variant="h5" fontWeight={700} gutterBottom>
          Upgrade Required
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          This feature requires a <strong>{requiredLabel}</strong> subscription.
          You currently have a <strong>{currentLabel}</strong> plan.
        </Typography>
        <Button
          variant="contained"
          href="https://ko-fi.com/vudoo"
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
            px: 4,
            py: 1.2,
          }}
        >
          Upgrade on Ko-fi
        </Button>
      </Paper>
    </Box>
  )
}
