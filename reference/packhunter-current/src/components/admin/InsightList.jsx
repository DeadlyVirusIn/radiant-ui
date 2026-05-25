/**
 * InsightList — ≤3 operational narratives.
 *
 * Input: insights[] from utils/fleetInsights.deriveInsights.
 * Output: compact stacked list with a trend icon + one-line title + optional body.
 *
 * Deliberately understated — insights are interpretation, not incident.
 * Alert banners own the high-severity visual weight; insights sit below.
 */

import { Box, Typography, Paper } from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  CheckCircle as RecoveryIcon,
  EmojiEvents as LeaderIcon,
  Info as InfoIcon,
} from '@mui/icons-material';

function iconFor(insight) {
  if (insight.kind === 'recovery') return <RecoveryIcon fontSize="small" color="success" />;
  if (insight.kind === 'leader')   return <LeaderIcon   fontSize="small" color="primary" />;
  if (insight.kind === 'trend') {
    // Look at the title for direction cue.
    const t = (insight.title || '').toLowerCase();
    if (t.includes(' up '))    return <TrendingUpIcon   fontSize="small" color="warning" />;
    if (t.includes(' down '))  return <TrendingDownIcon fontSize="small" color="error"   />;
    if (t.includes('rising'))  return <TrendingUpIcon   fontSize="small" color="warning" />;
    return <TrendingFlatIcon fontSize="small" color="action" />;
  }
  return <InfoIcon fontSize="small" color="action" />;
}

export default function InsightList({ insights }) {
  if (!insights || insights.length === 0) return null;

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 1.5,
        mb: 2,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.75,
        borderRadius: 1.5,
      }}
    >
      <Typography variant="overline" color="text.secondary">Insights</Typography>
      {insights.map((ins, i) => (
        <Box key={`${ins.kind}-${i}`} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
          <Box sx={{ pt: 0.25 }}>{iconFor(ins)}</Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 500 }}>{ins.title}</Typography>
            {ins.body && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {ins.body}
              </Typography>
            )}
          </Box>
        </Box>
      ))}
    </Paper>
  );
}
