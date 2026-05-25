/**
 * LastActionStrip — compact "what just happened?" panel.
 *
 * Renders a small list of recent meaningful actions (manual move,
 * auto-apply, current block reason). Bounded to 3 lines, sourced
 * entirely from existing payloads via lastActionSummary helpers.
 *
 * Mounted next to control surfaces (Fleet Health strip, Hybrid Control
 * recommendation panel) so operators can answer "what just changed?"
 * without opening the audit drawer.
 */

import { Box, Typography, Chip } from '@mui/material';
import {
  History as HistoryIcon,
} from '@mui/icons-material';

const SEVERITY_COLOR = {
  success: '#22C55E',
  warning: '#F59E0B',
  error:   '#EF4444',
  info:    '#3B82F6',
};

export default function LastActionStrip({ lines = [], title = 'Recent', sx }) {
  if (!Array.isArray(lines) || lines.length === 0) return null;
  return (
    <Box sx={{
      borderTop: 1, borderColor: 'divider', pt: 0.75, mt: 0.75, ...sx,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.4 }}>
        <HistoryIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
        <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary', fontSize: '0.65rem' }}>
          {title}
        </Typography>
      </Box>
      {lines.map((line, i) => (
        <Box key={`${line.kind}-${i}`} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.6, py: 0.15 }}>
          <Box sx={{
            width: 4, height: 4, borderRadius: '50%', mt: 0.55,
            bgcolor: SEVERITY_COLOR[line.severity] || SEVERITY_COLOR.info,
            flexShrink: 0,
          }} />
          <Typography variant="caption" sx={{ fontSize: '0.7rem', lineHeight: 1.3 }}>
            {line.text}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
