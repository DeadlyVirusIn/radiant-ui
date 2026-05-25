/**
 * Phase 19 — inline HealthChip.
 *
 * Compact severity pill suitable for inline placement on user rows,
 * scheduler rows, etc. Reuses Phase 17's SEVERITY_COLOR palette to
 * stay visually coherent with LastActionStrip.
 */

import { Chip, Tooltip } from '@mui/material';

const SEVERITY_PALETTE = {
  critical: { bg: '#7F1D1D', fg: '#FEE2E2', label: 'CRITICAL' },
  error:    { bg: '#991B1B', fg: '#FECACA', label: 'ERROR' },
  warning:  { bg: '#92400E', fg: '#FEF3C7', label: 'WARN' },
  info:     { bg: '#1E40AF', fg: '#DBEAFE', label: 'INFO' },
};

export default function HealthChip({ severity = 'info', label, title, onClick }) {
  const meta = SEVERITY_PALETTE[severity] || SEVERITY_PALETTE.info;
  const chip = (
    <Chip
      label={label || meta.label}
      size="small"
      onClick={onClick}
      sx={{
        bgcolor: meta.bg,
        color: meta.fg,
        height: 18,
        fontSize: '0.62rem',
        fontWeight: 700,
        cursor: onClick ? 'pointer' : 'default',
      }}
    />
  );
  return title ? <Tooltip title={title}>{chip}</Tooltip> : chip;
}

export { SEVERITY_PALETTE };
