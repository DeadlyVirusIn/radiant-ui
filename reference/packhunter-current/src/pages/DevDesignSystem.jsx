/**
 * DevDesignSystem — internal design system viewer.
 * Admin-only route at /dev/design-system.
 * Renders all shared components with mock data for visual inspection.
 */
import { useState } from 'react'
import { Box, Typography, Paper, Grid, Chip, Divider, Button, Alert } from '@mui/material'
import { useTheme } from '@mui/material/styles'

// Components
import StatusIndicator from '../components/StatusIndicator'
import AccountBadge from '../components/AccountBadge'
import SystemHealthDot from '../components/SystemHealthDot'
import RequestTimeline from '../components/RequestTimeline'
import InsightCards from '../components/InsightCards'
import AdaptiveHints from '../components/AdaptiveHints'
import OptimizationCards from '../components/OptimizationCards'
import InlineActivityStrip from '../components/InlineActivityStrip'

// Tokens
import { SPACING, FONT, STATUS, CARD, CHIP, MOTION, TABLE } from '../constants/designTokens'

const Section = ({ title, children }) => (
  <Paper sx={{ p: 3, mb: 3, borderRadius: '12px' }}>
    <Typography variant="h6" fontWeight={700} sx={{ mb: 2, fontSize: '1rem' }}>{title}</Typography>
    {children}
  </Paper>
)

// Mock data
const MOCK_TRADE_REQUEST = {
  id: 12345, status: 'FRIEND_REQUEST_SENT', card_name: 'Mewtwo', card_id: 'PK_10_001500_00',
  rarity_code: 'SAR', requested_at: new Date(Date.now() - 300000).toISOString(),
  matched_at: new Date(Date.now() - 240000).toISOString(),
  friend_request_sent_at: new Date(Date.now() - 180000).toISOString(),
  trade_sent_at: null, completed_at: null, error_message: null,
}
const MOCK_FAILED_REQUEST = {
  ...MOCK_TRADE_REQUEST, id: 12346, status: 'FAILED',
  error_message: 'Friend request was not accepted within 10 minutes',
  completed_at: new Date(Date.now() - 60000).toISOString(),
}
const MOCK_COMPLETED_REQUEST = {
  ...MOCK_TRADE_REQUEST, id: 12347, status: 'COMPLETED',
  trade_sent_at: new Date(Date.now() - 120000).toISOString(),
  completed_at: new Date(Date.now() - 30000).toISOString(),
}
const MOCK_REQUESTS = [MOCK_TRADE_REQUEST, MOCK_FAILED_REQUEST, MOCK_COMPLETED_REQUEST,
  { ...MOCK_COMPLETED_REQUEST, id: 12348 }, { ...MOCK_COMPLETED_REQUEST, id: 12349 },
  { ...MOCK_FAILED_REQUEST, id: 12350, error_message: 'Timed out after 20 minutes' },
]

export default function DevDesignSystem() {
  const theme = useTheme()
  const [section, setSection] = useState('all')

  return (
    <Box sx={{ p: 3, maxWidth: 1000, mx: 'auto' }}>
      <Typography variant="h4" fontWeight={800} sx={{ mb: 1 }}>Design System</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Internal reference — renders all shared components with mock data.
      </Typography>

      {/* Navigation */}
      <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap' }}>
        {['all', 'foundation', 'status', 'activity', 'timeline', 'insights', 'adaptive'].map(s => (
          <Chip key={s} label={s} size="small" variant={section === s ? 'filled' : 'outlined'} color="primary"
            onClick={() => setSection(s)} sx={{ cursor: 'pointer', textTransform: 'capitalize' }} />
        ))}
      </Box>

      {/* Foundation */}
      {(section === 'all' || section === 'foundation') && (
        <Section title="Foundation — Colors">
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
            {Object.entries(STATUS).map(([name, color]) => (
              <Box key={name} sx={{ textAlign: 'center' }}>
                <Box sx={{ width: 48, height: 48, borderRadius: '12px', bgcolor: color, mb: 0.5 }} />
                <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>{name}</Typography>
                <Typography variant="caption" display="block" sx={{ fontSize: '0.55rem', color: 'text.secondary' }}>{color}</Typography>
              </Box>
            ))}
          </Box>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Typography</Typography>
          <Typography sx={{ fontSize: FONT.metric, fontWeight: FONT.metricWeight }}>Metric: 1.3rem / 800</Typography>
          <Typography sx={{ fontSize: FONT.title, fontWeight: FONT.titleWeight }}>Title: 0.8rem / 700</Typography>
          <Typography sx={{ fontSize: FONT.body }}>Body: 0.78rem</Typography>
          <Typography sx={{ fontSize: FONT.label, fontWeight: FONT.labelWeight }}>Label: 0.65rem / 600</Typography>
          <Typography sx={{ fontSize: FONT.meta, color: 'text.secondary' }}>Meta: 0.6rem</Typography>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1 }}>Spacing (8px grid)</Typography>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
            {Object.entries(SPACING).map(([name, val]) => (
              <Box key={name} sx={{ textAlign: 'center' }}>
                <Box sx={{ width: val * 8, height: val * 8, bgcolor: 'primary.main', borderRadius: 1, minWidth: 4, minHeight: 4 }} />
                <Typography variant="caption" sx={{ fontSize: '0.55rem' }}>{name}: {val * 8}px</Typography>
              </Box>
            ))}
          </Box>
        </Section>
      )}

      {/* Status Components */}
      {(section === 'all' || section === 'status') && (
        <Section title="StatusIndicator">
          <Grid container spacing={2}>
            {['PENDING', 'MATCHING', 'FRIEND_REQUEST_SENT', 'TRADE_PROPOSAL_SENT', 'COMPLETED', 'FAILED', 'CANCELLED'].map(status => (
              <Grid item xs={6} sm={4} md={3} key={status}>
                <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary', mb: 0.5, display: 'block' }}>{status}</Typography>
                <StatusIndicator status={status} type="trade" errorMessage={status === 'FAILED' ? 'Friend request expired' : null} compact />
              </Grid>
            ))}
          </Grid>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Full (non-compact)</Typography>
          <Box sx={{ maxWidth: 300 }}>
            <StatusIndicator status="FAILED" type="trade" errorMessage="Friend request was not accepted within 10 minutes" />
          </Box>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>AccountBadge</Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <AccountBadge />
            <AccountBadge activeCount={3} />
          </Box>
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>SystemHealthDot</Typography>
          <SystemHealthDot />
        </Section>
      )}

      {/* Activity */}
      {(section === 'all' || section === 'activity') && (
        <Section title="InlineActivityStrip">
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Shows when socket events arrive. Empty here (no live events in dev mode).
          </Typography>
          <InlineActivityStrip />
          <Alert severity="info" sx={{ mt: 1 }}>ActivityFeed and InlineActivityStrip require live socket events or API data. View on Dashboard for live demo.</Alert>
        </Section>
      )}

      {/* Timeline */}
      {(section === 'all' || section === 'timeline') && (
        <Section title="RequestTimeline">
          <Typography variant="subtitle2" sx={{ mb: 1 }}>In Progress (Friend step)</Typography>
          <RequestTimeline request={MOCK_TRADE_REQUEST} type="trade" />
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Completed</Typography>
          <RequestTimeline request={MOCK_COMPLETED_REQUEST} type="trade" />
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Failed</Typography>
          <RequestTimeline request={MOCK_FAILED_REQUEST} type="trade" />
        </Section>
      )}

      {/* Insights */}
      {(section === 'all' || section === 'insights') && (
        <Section title="InsightCards + OptimizationCards">
          <Typography variant="subtitle2" sx={{ mb: 1 }}>InsightCards (fetches live data)</Typography>
          <InsightCards />
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 1 }}>OptimizationCards (from mock requests)</Typography>
          <OptimizationCards requests={MOCK_REQUESTS} />
        </Section>
      )}

      {/* Adaptive */}
      {(section === 'all' || section === 'adaptive') && (
        <Section title="AdaptiveHints">
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            Rules trigger based on request history patterns. Using mock data with 3 failures.
          </Typography>
          <AdaptiveHints requests={MOCK_REQUESTS} type="trade" />
        </Section>
      )}
    </Box>
  )
}
