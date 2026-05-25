/**
 * PackDistribution — Pack selection / distribution card.
 * - Collapses identical values: "All containers: God Pack"
 * - Shows per-pack PPM bars when mixed
 * - Fixed broken "God Pack / God Pack / God Pack / God Pack" display
 */
import { memo } from 'react'
import {
  Box, Typography, Chip, LinearProgress, Card, CardContent, Alert, useTheme,
} from '@mui/material'
import {
  Speed as SpeedIcon,
  Inventory as PackIcon,
  PeopleAlt as PeopleIcon,
  Star as StarIcon,
  HowToVote as VoteIcon,
} from '@mui/icons-material'
import { FONT } from './huntConstants'
import { formatNumber, tabularNumStyle } from '../../utils/formatNumber'

const PACK_COLORS = [
  '#ef5350', '#ab47bc', '#5c6bc0', '#29b6f6', '#26a69a',
  '#9ccc65', '#ffee58', '#ffa726', '#8d6e63', '#78909c',
]

const CONTAINER_COLORS = { 1: '#4caf50', 2: '#ff9800', 3: '#2196f3', 4: '#9c27b0' }

/**
 * Per-container sub-section — shown below the global view when `perContainer`
 * is supplied. Each container displays its own user count + per-pack users
 * (NOT just the global tally). This answers the operator question "which
 * packs is each container actually voting on, and by how many users?".
 *
 * Input shape: perContainer = { 1: {totalUsers, userCountByPack, distribution}, 2: {...}, ... }
 * Containers whose sub-query failed (null) or have 0 users are skipped.
 */
function PerContainerBreakdown({ perContainer, isDark, theme }) {
  const groups = [1, 2, 3, 4]
    .map(g => ({ group: g, data: perContainer?.[g] }))
    .filter(({ data }) => data && Number(data.totalUsers) > 0)

  if (groups.length === 0) return null

  return (
    <Box sx={{ mt: 2, pt: 2, borderTop: `1px dashed ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}` }}>
      <Typography sx={{ fontSize: FONT.value, fontWeight: 600, color: 'text.secondary', mb: 1.5 }}>
        Per-Container User Vote Breakdown
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
        {groups.map(({ group, data }) => {
          const color = CONTAINER_COLORS[group] || theme.palette.text.secondary
          const totalUsers = Number(data.totalUsers) || 0
          // Sort packs by user count desc within this container so the
          // highest-vote pack lands first — mirrors the global view.
          const userCountByPack = data.userCountByPack || {}
          const packs = Object.entries(userCountByPack)
            .sort((a, b) => b[1] - a[1])
            .map(([name, users]) => ({
              name,
              users,
              pct: totalUsers > 0 ? ((users / totalUsers) * 100).toFixed(1) : '0.0',
            }))
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
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
                <Typography sx={{ fontSize: FONT.value, fontWeight: 700, color }}>
                  C{group}
                </Typography>
                <Chip
                  icon={<PeopleIcon sx={{ fontSize: 11 }} />}
                  label={`${totalUsers} user${totalUsers === 1 ? '' : 's'}`}
                  size="small"
                  sx={{
                    fontSize: '0.6rem', height: 18, ...tabularNumStyle,
                    bgcolor: `${color}15`, color,
                    '& .MuiChip-icon': { color },
                  }}
                />
              </Box>
              {packs.length === 0 ? (
                <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', fontStyle: 'italic' }}>
                  No packs enrolled
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                  {packs.map((pack, i) => (
                    <Box key={pack.name}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.25 }}>
                        <Typography sx={{
                          fontSize: '0.68rem', fontWeight: 500, color: 'text.primary',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%',
                        }}>
                          {pack.name.replace(/_/g, ' ')}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', ...tabularNumStyle }}>
                            {pack.users}u
                          </Typography>
                          <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, color, minWidth: 36, textAlign: 'right', ...tabularNumStyle }}>
                            {pack.pct}%
                          </Typography>
                        </Box>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={parseFloat(pack.pct) || 0}
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
    </Box>
  )
}

const PackDistribution = memo(({ distribution, totalUsers, userCountByPack, perContainer, instances, packTypeBreakdown }) => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const glass = {
    bgcolor: isDark ? 'rgba(26, 32, 53, 0.7)' : 'rgba(255, 255, 255, 0.7)',
    backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
    border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
  }

  // Determine hunt type — huntType values include group suffix: 'reroll-G1', 'reroll-G2', etc.
  const huntTypes = [...new Set((instances || []).map(i => i.huntType).filter(Boolean))]
  const isHeadlessReroll = huntTypes.length > 0 && huntTypes.every(t => t === 'reroll' || t.startsWith('reroll-G'))

  // For non-reroll hunts: show pack distribution from instances
  if (!isHeadlessReroll && instances && instances.length > 0) {
    let sortedPacks = []

    if (packTypeBreakdown && Object.keys(packTypeBreakdown).length > 0) {
      sortedPacks = Object.entries(packTypeBreakdown)
        .sort((a, b) => b[1].ppm - a[1].ppm)
        .map(([packName, stats]) => ({
          name: packName,
          label: packName,
          count: stats.instances,
          ppm: stats.ppm,
          totalPacks: stats.totalPacks,
          godPacks: stats.godPacks,
          percentage: instances.length > 0 ? ((stats.instances / instances.filter(i => i.isActive).length) * 100).toFixed(1) : '0',
        }))
    } else {
      const packCounts = {}
      const packLabels = {}
      instances.forEach(inst => {
        const pack = inst.packMode || 'RANDOM'
        packCounts[pack] = (packCounts[pack] || 0) + 1
        if (inst.packLabel && !packLabels[pack]) packLabels[pack] = inst.packLabel
      })
      sortedPacks = Object.entries(packCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([packName, count]) => ({
          name: packName,
          label: packLabels[packName] || packName.replace(/_/g, ' '),
          count,
          ppm: null, totalPacks: null, godPacks: null,
          percentage: ((count / instances.length) * 100).toFixed(1),
        }))
    }

    // Collapse when all containers run the same pack
    const baseTypes = [...new Set(huntTypes.map(t => t.replace(/-G\d+$/, '')))]
    const huntTypeLabel = baseTypes.length > 0
      ? baseTypes.map(t => t === 'godpack' ? 'God Pack' : t === 'maxpack' ? 'Max Pack' : t === 'reroll' ? 'Reroll' : t).join(' / ')
        + (huntTypes.length > 1 ? ` \u2014 All Containers` : '')
      : 'Hunt'
    const activeCount = instances.filter(i => i.isActive).length

    if (sortedPacks.length === 1) {
      // Single pack — show collapsed summary
      const pack = sortedPacks[0]
      return (
        <Card sx={{ mb: 2, borderRadius: '12px', ...glass }}>
          <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PackIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />
              <Typography sx={{ fontSize: FONT.section, fontWeight: 600, color: 'text.primary' }}>
                All containers: {pack.label}
              </Typography>
              {pack.ppm !== null && (
                <Chip icon={<SpeedIcon sx={{ fontSize: 14 }} />} label={`${pack.ppm} PPM`} size="small"
                  sx={{ fontSize: '0.65rem', height: 22, fontWeight: 600, ...tabularNumStyle,
                    bgcolor: 'rgba(124,138,255,0.1)', color: theme.palette.primary.main,
                    border: '1px solid rgba(124,138,255,0.15)',
                    '& .MuiChip-icon': { color: theme.palette.primary.main },
                  }} />
              )}
              <Chip label={`${activeCount} active`} size="small"
                sx={{ fontSize: '0.65rem', height: 22, bgcolor: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.15)' }} />
            </Box>
          </CardContent>
        </Card>
      )
    }

    // Multiple packs — show full breakdown
    return (
      <Card sx={{ mb: 2, borderRadius: '12px', ...glass }}>
        <CardContent sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <PackIcon sx={{ fontSize: 18, color: theme.palette.primary.main }} />
              <Typography sx={{ fontSize: FONT.section, fontWeight: 600, color: 'text.primary' }}>
                Pack Selection ({huntTypeLabel})
              </Typography>
            </Box>
            <Chip label={`${activeCount} active`} size="small"
              sx={{ fontSize: '0.65rem', height: 22, bgcolor: 'rgba(52,211,153,0.1)', color: '#34d399', border: '1px solid rgba(52,211,153,0.15)' }} />
          </Box>

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {sortedPacks.map((pack, index) => (
              <Box key={pack.name}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <PackIcon sx={{ fontSize: 14, color: PACK_COLORS[index % PACK_COLORS.length] }} />
                    <Typography sx={{ fontSize: FONT.value, fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'text.primary' }}>
                      {pack.label}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    {pack.ppm !== null && (
                      <Chip icon={<SpeedIcon sx={{ fontSize: 12 }} />} label={`${pack.ppm} ppm`} size="small"
                        sx={{ fontSize: '0.6rem', height: 20, fontWeight: 600, ...tabularNumStyle,
                          bgcolor: 'rgba(124,138,255,0.1)', color: theme.palette.primary.main,
                          '& .MuiChip-icon': { color: theme.palette.primary.main },
                        }} />
                    )}
                    <Chip label={`${pack.count} workers`} size="small" variant="outlined"
                      sx={{ fontSize: '0.6rem', height: 18, ...tabularNumStyle, borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', color: 'text.secondary' }} />
                    {pack.godPacks > 0 && (
                      <Chip icon={<StarIcon sx={{ fontSize: 11 }} />} label={pack.godPacks} size="small"
                        sx={{ fontSize: '0.6rem', height: 18, ...tabularNumStyle, bgcolor: 'rgba(245,158,11,0.1)', color: '#fbbf24',
                          '& .MuiChip-icon': { color: '#fbbf24' },
                        }} />
                    )}
                  </Box>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={parseFloat(pack.percentage) || 0}
                  sx={{
                    height: 5, borderRadius: 3,
                    bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                    '& .MuiLinearProgress-bar': { bgcolor: PACK_COLORS[index % PACK_COLORS.length], borderRadius: 3 },
                  }}
                />
              </Box>
            ))}
          </Box>
        </CardContent>
      </Card>
    )
  }

  // For headless-reroll: show Discord user distribution
  if (!distribution || Object.keys(distribution).length === 0) return null

  const sortedPacks = Object.entries(distribution)
    .sort((a, b) => b[1] - a[1])
    .map(([packName, weight]) => {
      let ppmData = null
      if (packTypeBreakdown) {
        ppmData = packTypeBreakdown[packName] ||
          Object.entries(packTypeBreakdown).find(([k]) =>
            k.toLowerCase() === packName.toLowerCase() ||
            k.toLowerCase().replace(/[_\s]/g, '') === packName.toLowerCase().replace(/[_\s]/g, '')
          )?.[1]
      }
      return { name: packName, weight, percentage: (weight * 100).toFixed(1), users: userCountByPack?.[packName] || 0, ppm: ppmData?.ppm || null, totalPacks: ppmData?.totalPacks || null }
    })

  const totalPPM = sortedPacks.reduce((sum, p) => sum + (p.ppm || 0), 0)

  return (
    <Card sx={{ mb: 2, borderRadius: '12px', ...glass }}>
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <VoteIcon sx={{ fontSize: 18, color: theme.palette.secondary.main }} />
            <Typography sx={{ fontSize: FONT.section, fontWeight: 600, color: 'text.primary' }}>
              What Users Want
            </Typography>
            <Chip
              label="Bot Hub votes"
              size="small"
              sx={{
                height: 18, fontSize: '0.6rem', fontWeight: 700,
                bgcolor: 'rgba(167,139,250,0.15)', color: theme.palette.secondary.main,
              }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            {totalPPM > 0 && (
              <Chip icon={<SpeedIcon sx={{ fontSize: 12 }} />} label={`${totalPPM.toFixed(1)} PPM`} size="small"
                sx={{ fontSize: '0.65rem', height: 22, fontWeight: 600, ...tabularNumStyle,
                  bgcolor: 'rgba(124,138,255,0.1)', color: theme.palette.primary.main,
                  '& .MuiChip-icon': { color: theme.palette.primary.main },
                }} />
            )}
            <Chip icon={<PeopleIcon sx={{ fontSize: 12 }} />} label={`${totalUsers} users`} size="small"
              sx={{ fontSize: '0.65rem', height: 22, bgcolor: 'rgba(167,139,250,0.1)', color: theme.palette.secondary.main,
                '& .MuiChip-icon': { color: theme.palette.secondary.main },
              }} />
          </Box>
        </Box>

        {/* Decision-layer warning — reinforces the Alignment Summary at
            the top of the page. When config drifts from demand this
            reminds operators that votes do NOT automatically become
            runtime pack selection. */}
        <Alert severity="warning" icon={false} sx={{ mb: 1.5, py: 0.5, fontSize: '0.7rem' }}>
          ⚠️ Workers may not follow user demand if container configuration differs.
        </Alert>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          {sortedPacks.map((pack, index) => (
            <Box key={pack.name}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PackIcon sx={{ fontSize: 14, color: PACK_COLORS[index % PACK_COLORS.length] }} />
                  <Typography sx={{ fontSize: FONT.value, fontWeight: 500, color: 'text.primary' }}>
                    {pack.name.replace(/_/g, ' ')}
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                  {pack.ppm !== null && (
                    <Chip icon={<SpeedIcon sx={{ fontSize: 12 }} />} label={`${pack.ppm} ppm`} size="small"
                      sx={{ fontSize: '0.6rem', height: 20, fontWeight: 600, ...tabularNumStyle,
                        bgcolor: 'rgba(124,138,255,0.1)', color: theme.palette.primary.main,
                        '& .MuiChip-icon': { color: theme.palette.primary.main },
                      }} />
                  )}
                  <Chip label={`${pack.users} users`} size="small"
                    sx={{ fontSize: '0.6rem', height: 18, ...tabularNumStyle, bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.025)', color: 'text.secondary' }} />
                  <Typography sx={{ minWidth: 45, textAlign: 'right', fontSize: FONT.value, fontWeight: 600, color: 'text.primary', ...tabularNumStyle }}>
                    {pack.percentage}%
                  </Typography>
                </Box>
              </Box>
              <LinearProgress
                variant="determinate"
                value={parseFloat(pack.percentage)}
                sx={{
                  height: 5, borderRadius: 3,
                  bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                  '& .MuiLinearProgress-bar': { bgcolor: PACK_COLORS[index % PACK_COLORS.length], borderRadius: 3 },
                }}
              />
            </Box>
          ))}
        </Box>

        {/* Per-container breakdown — scoped distribution per container_group.
            Shows which packs each container is actually voting on and how
            many users voted for each, so operators can see the real
            distribution per container, not only the aggregate. */}
        <PerContainerBreakdown perContainer={perContainer} isDark={isDark} theme={theme} />
      </CardContent>
    </Card>
  )
})

PackDistribution.displayName = 'PackDistribution'
export default PackDistribution
