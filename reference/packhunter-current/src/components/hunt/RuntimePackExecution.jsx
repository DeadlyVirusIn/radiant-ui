/**
 * RuntimePackExecution — TRUTH surface for what containers are ACTUALLY
 * opening right now. Deliberately distinct from the "User Pack Preferences"
 * card so operators can never confuse user votes with runtime execution.
 *
 * Per container (C1..C4) this card shows:
 *   - Operator-configured mode (fixed | pool) + pack list from
 *     container_pack_config (or "Legacy fallback" when no row exists)
 *   - Actual pack(s) workers are currently opening, derived from each
 *     active instance's statsLogger `packLabel` field (written by
 *     getPackInfo() → statsLogger.recordPackSelection(chosen))
 *   - Per-actual-pack worker count so pool-mode containers make their
 *     split visible at a glance
 *
 * Data sources:
 *   - containers  ← GET /api/hunt/container-pack-config  (new)
 *   - instances   ← existing stats.instances from /api/hunt/stats
 *
 * No backend work needed beyond the new read-only config endpoint.
 */

import { memo } from 'react'
import {
  Box, Typography, Chip, LinearProgress, Card, CardContent, Tooltip, useTheme,
} from '@mui/material'
import {
  PlayCircleOutline as RuntimeIcon,
  Inventory as PackIcon,
  CheckCircle as CheckIcon,
  Warning as WarningIcon,
} from '@mui/icons-material'
import { FONT } from './huntConstants'
import { tabularNumStyle } from '../../utils/formatNumber'

const CONTAINER_COLORS = { 1: '#4caf50', 2: '#ff9800', 3: '#2196f3', 4: '#9c27b0' }

function normalizePackLabel(label) {
  if (!label) return null
  // packLabel in stats files can be either the pack NAME (uppercase
  // identifier like MEGA_SHINE) or a display label — normalize to the
  // identifier form by uppercasing + space→underscore. Matches
  // container_pack_config.packs entries which use the identifier form.
  return String(label).trim().replace(/\s+/g, '_').toUpperCase()
}

const RuntimePackExecution = memo(({ containers, instances }) => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const glass = {
    bgcolor: isDark ? 'rgba(26, 32, 53, 0.7)' : 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    border: `1px solid ${isDark ? 'rgba(76, 175, 80, 0.12)' : 'rgba(0, 0, 0, 0.06)'}`,
  }

  const cfgByGroup = new Map(
    (Array.isArray(containers) ? containers : []).map(c => [Number(c.containerGroup), c])
  )

  // Aggregate instances per container group → { [group]: { activePackLabel→count, totalActive } }
  const runtimeByGroup = new Map()
  for (const inst of (instances || [])) {
    if (!inst.isActive) continue
    const g = Number(inst.containerGroup) || 0
    if (g === 0) continue
    if (!runtimeByGroup.has(g)) runtimeByGroup.set(g, { counts: new Map(), totalActive: 0 })
    const bucket = runtimeByGroup.get(g)
    bucket.totalActive++
    const label = normalizePackLabel(inst.packLabel) || 'UNKNOWN'
    bucket.counts.set(label, (bucket.counts.get(label) || 0) + 1)
  }

  const groups = [1, 2, 3, 4].map(g => {
    const cfg = cfgByGroup.get(g)
    const runtime = runtimeByGroup.get(g)
    return { group: g, cfg, runtime }
  })

  const anyHasRuntime = groups.some(g => g.runtime && g.runtime.totalActive > 0)
  const anyHasConfig = groups.some(g => g.cfg && g.cfg.mode)
  // Render nothing when both sources are empty — caller probably hasn't
  // started a hunt and hasn't configured per-container either; showing
  // a card full of "no data" is just noise.
  if (!anyHasRuntime && !anyHasConfig) return null

  return (
    <Card sx={{ mb: 2, borderRadius: '12px', ...glass, borderLeft: '3px solid #4caf50' }}>
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
          <RuntimeIcon sx={{ fontSize: 18, color: '#4caf50' }} />
          <Typography sx={{ fontSize: FONT.section, fontWeight: 600, color: 'text.primary' }}>
            What Workers Are Opening
          </Typography>
          <Chip
            label="live runtime"
            size="small"
            sx={{
              height: 18, fontSize: '0.6rem', fontWeight: 700,
              bgcolor: 'rgba(76,175,80,0.15)', color: '#4caf50',
            }}
          />
        </Box>

        <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', mb: 1.5 }}>
          Live truth per container. <strong>Configured</strong> = what the admin set in the Scheduler's per-container
          pack config; <strong>Opening now</strong> = what each worker's stats file reports as its chosen pack for
          the current batch. Mismatches (or legacy-fallback containers) are flagged inline.
        </Typography>

        <Box sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
          gap: 1.5,
        }}>
          {groups.map(({ group, cfg, runtime }) => {
            const color = CONTAINER_COLORS[group] || theme.palette.text.secondary
            const isLegacy = !cfg || !cfg.mode
            const configuredPacks = cfg?.packs || []
            const configuredSet = new Set(configuredPacks.map(normalizePackLabel))

            // Build opening-now rows, sorted by count desc so dominant pack is first.
            const openingRows = runtime
              ? [...runtime.counts.entries()]
                  .sort((a, b) => b[1] - a[1])
                  .map(([label, count]) => ({
                    label,
                    count,
                    pct: runtime.totalActive > 0
                      ? ((count / runtime.totalActive) * 100).toFixed(0)
                      : '0',
                    // Flag packs being opened that AREN'T in the configured
                    // list — either legacy-fallback operation or (rare)
                    // a bug. Either way the operator should see it.
                    inConfig: isLegacy || configuredSet.has(label),
                  }))
              : []

            return (
              <Box
                key={group}
                sx={{
                  p: 1.25,
                  borderRadius: '10px',
                  border: `1px solid ${color}30`,
                  borderLeft: `3px solid ${color}`,
                  bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                }}
              >
                {/* Header: container + mode */}
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography sx={{ fontSize: FONT.value, fontWeight: 700, color }}>
                    C{group}
                  </Typography>
                  {isLegacy ? (
                    <Tooltip title="No per-container config set. Worker resolves via legacy default_pack / DYNAMIC / PACK_MODE env.">
                      <Chip
                        icon={<WarningIcon sx={{ fontSize: 11 }} />}
                        label="Legacy fallback"
                        size="small"
                        sx={{
                          height: 18, fontSize: '0.58rem', fontWeight: 700,
                          bgcolor: 'rgba(158,158,158,0.15)', color: 'text.secondary',
                          '& .MuiChip-icon': { color: 'text.secondary' },
                        }}
                      />
                    </Tooltip>
                  ) : (
                    <Chip
                      label={`${cfg.mode} · ${configuredPacks.length}`}
                      size="small"
                      sx={{
                        height: 18, fontSize: '0.58rem', fontWeight: 700,
                        bgcolor: cfg.mode === 'fixed' ? 'rgba(76,175,80,0.15)' : 'rgba(33,150,243,0.15)',
                        color: cfg.mode === 'fixed' ? '#4caf50' : '#2196f3',
                      }}
                    />
                  )}
                </Box>

                {/* Configured section */}
                <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>
                  Configured
                </Typography>
                {isLegacy ? (
                  <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', fontStyle: 'italic', mb: 1.25 }}>
                    (no per-container row — using legacy fallback)
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.25 }}>
                    {configuredPacks.map(name => (
                      <Chip
                        key={name}
                        label={name.replace(/_/g, ' ')}
                        size="small"
                        sx={{ height: 18, fontSize: '0.6rem', bgcolor: `${color}15`, color, fontWeight: 600 }}
                      />
                    ))}
                  </Box>
                )}

                {/* Opening-now section */}
                <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.5 }}>
                  Opening now ({runtime?.totalActive || 0} active worker{runtime?.totalActive === 1 ? '' : 's'})
                </Typography>
                {openingRows.length === 0 ? (
                  <Typography sx={{ fontSize: '0.7rem', color: 'text.secondary', fontStyle: 'italic' }}>
                    no active workers
                  </Typography>
                ) : (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                    {openingRows.map(row => (
                      <Box key={row.label}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.25 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, maxWidth: '65%' }}>
                            {row.inConfig
                              ? <CheckIcon sx={{ fontSize: 11, color: '#4caf50', flexShrink: 0 }} />
                              : <WarningIcon sx={{ fontSize: 11, color: '#ff9800', flexShrink: 0 }} />}
                            <Typography sx={{
                              fontSize: '0.68rem', fontWeight: 500, color: 'text.primary',
                              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            }}>
                              {row.label.replace(/_/g, ' ')}
                            </Typography>
                            {!row.inConfig && (
                              <Tooltip title="This pack is being opened but is NOT in the configured container_pack_config list — indicates legacy fallback or a drift bug.">
                                <Chip
                                  label="not in config"
                                  size="small"
                                  sx={{ height: 14, fontSize: '0.52rem', bgcolor: 'rgba(255,152,0,0.15)', color: '#ff9800', fontWeight: 700 }}
                                />
                              </Tooltip>
                            )}
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', ...tabularNumStyle }}>
                              {row.count}w
                            </Typography>
                            <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, color, minWidth: 30, textAlign: 'right', ...tabularNumStyle }}>
                              {row.pct}%
                            </Typography>
                          </Box>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={parseFloat(row.pct) || 0}
                          sx={{
                            height: 3, borderRadius: 2,
                            bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                            '& .MuiLinearProgress-bar': { bgcolor: color, borderRadius: 2 },
                          }}
                        />
                      </Box>
                    ))}
                  </Box>
                )}
              </Box>
            )
          })}
        </Box>
      </CardContent>
    </Card>
  )
})

RuntimePackExecution.displayName = 'RuntimePackExecution'
export default RuntimePackExecution
