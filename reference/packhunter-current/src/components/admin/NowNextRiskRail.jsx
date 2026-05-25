/**
 * NOW / NEXT / RISK rail — compact operator decision strip.
 *
 * C6 (2026-04-24). One-line per cell, three cells separated by
 * dividers, color-coded by severity (green / yellow / red). Data
 * comes from pure reducers in utils/nowNextRisk.js so consumers on
 * different pages (HuntMonitor socket-driven, AdminFleetHealth
 * 30s-polled, HybridControl REST) render consistently.
 *
 * Props:
 *   inputs — bag passed straight to computeNowNextRisk():
 *     { unifiedVerdict, balanceStatus, recoveryLabels,
 *       counts, pools, blockers, metrics }
 *   When any input is missing the underlying reducer still returns a
 *   non-empty line (default "Low risk", "No action needed", or the
 *   best-effort health verdict), so the rail never blanks.
 */

import { useMemo } from 'react'
import { Box, Divider, Typography, useTheme } from '@mui/material'
import { computeNowNextRisk, NNR_TIER } from '../../utils/nowNextRisk'

const TIER_COLOR = {
  [NNR_TIER.OK]:   { fg: '#16A34A', bg: 'rgba(22, 163, 74, 0.06)' },
  [NNR_TIER.INFO]: { fg: '#3B82F6', bg: 'rgba(59, 130, 246, 0.06)' },
  [NNR_TIER.WARN]: { fg: '#D97706', bg: 'rgba(217, 119, 6, 0.07)' },
  [NNR_TIER.ERR]:  { fg: '#DC2626', bg: 'rgba(220, 38, 38, 0.07)' },
}

function Cell({ label, line }) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const tier = TIER_COLOR[line?.tier] || TIER_COLOR[NNR_TIER.OK]
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        px: 1.5, py: 0.8,
        display: 'flex', alignItems: 'center', gap: 1,
        bgcolor: isDark ? tier.bg : tier.bg,
      }}
    >
      <Typography
        variant="caption"
        sx={{ fontWeight: 700, color: tier.fg, letterSpacing: '0.08em', flexShrink: 0 }}
      >
        {label}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          color: 'text.primary',
          fontWeight: 500,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        title={line?.text || ''}
      >
        {line?.text || '—'}
      </Typography>
    </Box>
  )
}

export default function NowNextRiskRail({ inputs }) {
  const theme = useTheme()
  const { now, next, risk } = useMemo(() => computeNowNextRisk(inputs || {}), [inputs])
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        mb: 2,
        borderRadius: 1,
        border: `1px solid ${theme.palette.divider}`,
        overflow: 'hidden',
      }}
    >
      <Cell label="NOW"  line={now}  />
      <Divider orientation="vertical" flexItem />
      <Cell label="NEXT" line={next} />
      <Divider orientation="vertical" flexItem />
      <Cell label="RISK" line={risk} />
    </Box>
  )
}
