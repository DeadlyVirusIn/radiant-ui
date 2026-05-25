/**
 * ContainerAlignmentSummary — decision-layer card at the top of Hunt Monitor.
 *
 * Answers ONE question: are containers opening packs that match user demand?
 * Green row = aligned. Yellow = partial drag. Red = clearly wasting capacity.
 *
 * Pure UI — consumes the data already loaded elsewhere:
 *   - instances (from /api/hunt/stats)
 *   - containerPackConfigs (from /api/hunt/container-pack-config)
 *   - perContainer demand (from /api/hunt/distribution?containerGroup=N)
 *
 * Math lives in ./alignment.js so it's testable + reused by ContainerCard.
 */

import { memo, useMemo } from 'react'
import {
  Box, Typography, Chip, LinearProgress, Card, CardContent, Tooltip, useTheme,
} from '@mui/material'
import {
  FactCheck as AlignmentIcon,
  CheckCircle as AlignedIcon,
  WarningAmber as PartialIcon,
  ErrorOutline as MismatchIcon,
} from '@mui/icons-material'
import { FONT } from './huntConstants'
import { tabularNumStyle } from '../../utils/formatNumber'
import {
  computeContainerAlignment,
  rollupFleetAlignment,
  statusColor,
  statusLabel,
} from './alignment'

const CONTAINER_COLORS = { 1: '#4caf50', 2: '#ff9800', 3: '#2196f3', 4: '#9c27b0' }

function StatusPill({ status, alignment, theme }) {
  const color = statusColor(status, theme)
  const Icon =
    status === 'aligned'  ? AlignedIcon :
    status === 'partial'  ? PartialIcon :
    status === 'mismatch' ? MismatchIcon : AlignedIcon
  const pct = Math.round((alignment || 0) * 100)
  return (
    <Chip
      icon={<Icon sx={{ fontSize: 14 }} />}
      label={status === 'no_data' ? '—' : `${pct}% · ${statusLabel(status)}`}
      size="small"
      sx={{
        height: 22, fontSize: '0.65rem', fontWeight: 700, ...tabularNumStyle,
        bgcolor: `${color}18`, color,
        border: `1px solid ${color}35`,
        '& .MuiChip-icon': { color },
      }}
    />
  )
}

const ContainerAlignmentSummary = memo(({ instances, containers, perContainer }) => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const rows = useMemo(() => {
    const cfgByGroup = new Map((containers || []).map(c => [Number(c.containerGroup), c]))
    return [1, 2, 3, 4].map(g => computeContainerAlignment({
      instances, group: g,
      demand: perContainer?.[g],
      cfg: cfgByGroup.get(g),
    }))
  }, [instances, containers, perContainer])

  const fleet = useMemo(() => rollupFleetAlignment(rows), [rows])
  const renderedRows = rows.filter(r => r.status !== 'no_data')
  if (renderedRows.length === 0) return null  // nothing hunting → nothing to summarize

  const fleetColor =
    fleet.wastedPct >= 40 ? '#ef5350' :
    fleet.wastedPct >= 15 ? '#fbbf24' : '#4caf50'

  return (
    <Card sx={{
      mb: 2, borderRadius: '12px',
      borderLeft: `3px solid ${fleetColor}`,
      bgcolor: isDark ? 'rgba(26, 32, 53, 0.7)' : 'rgba(255, 255, 255, 0.7)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
    }}>
      <CardContent sx={{ p: 2 }}>
        {/* Header + fleet rollup */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AlignmentIcon sx={{ fontSize: 18, color: fleetColor }} />
            <Typography sx={{ fontSize: FONT.section, fontWeight: 700, color: 'text.primary' }}>
              Container Alignment Summary
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Chip
              icon={<AlignedIcon sx={{ fontSize: 12 }} />}
              label={`${fleet.aligned}/${fleet.total} aligned`}
              size="small"
              sx={{
                height: 22, fontSize: '0.65rem', fontWeight: 700, ...tabularNumStyle,
                bgcolor: `${fleetColor}15`, color: fleetColor,
                '& .MuiChip-icon': { color: fleetColor },
              }}
            />
            <Tooltip title="Worker-weighted estimate of how much runtime capacity is being spent opening packs that have no user demand in their container.">
              <Chip
                label={`~${fleet.wastedPct}% wasted capacity`}
                size="small"
                sx={{
                  height: 22, fontSize: '0.65rem', fontWeight: 700, ...tabularNumStyle,
                  bgcolor: fleet.wastedPct > 0 ? 'rgba(239, 83, 80, 0.12)' : 'rgba(76, 175, 80, 0.12)',
                  color: fleet.wastedPct > 0 ? '#ef5350' : '#4caf50',
                }}
              />
            </Tooltip>
          </Box>
        </Box>

        {/* Per-container rows */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1 }}>
          {renderedRows.map(row => {
            const color = CONTAINER_COLORS[row.group] || theme.palette.text.secondary
            const statusClr = statusColor(row.status, theme)
            return (
              <Box
                key={row.group}
                sx={{
                  p: 1, pl: 1.25,
                  borderRadius: '8px',
                  border: `1px solid ${statusClr}35`,
                  borderLeft: `3px solid ${color}`,
                  bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
                  <Typography sx={{ fontSize: FONT.value, fontWeight: 700, color }}>
                    C{row.group}
                  </Typography>
                  <StatusPill status={row.status} alignment={row.alignment} theme={theme} />
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={Math.round((row.alignment || 0) * 100)}
                  sx={{
                    height: 4, borderRadius: 2, mb: row.reason ? 0.5 : 0,
                    bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                    '& .MuiLinearProgress-bar': { bgcolor: statusClr, borderRadius: 2 },
                  }}
                />
                {row.reason && (
                  <Typography sx={{
                    fontSize: '0.65rem', color: 'text.secondary',
                    fontStyle: 'italic', mt: 0.25,
                  }}>
                    {row.reason}
                  </Typography>
                )}
              </Box>
            )
          })}
        </Box>
      </CardContent>
    </Card>
  )
})

ContainerAlignmentSummary.displayName = 'ContainerAlignmentSummary'
export default ContainerAlignmentSummary
