/**
 * ContainerCard — Per-container overview card.
 * Shows PPM (hero), PPM/worker, health tier, workers, packs, GP, alive.
 * Clickable to focus that container.
 */
import { memo, useState } from 'react'
import { Box, Typography, Chip, LinearProgress, Tooltip, Button, useTheme } from '@mui/material'
import { Lightbulb as SuggestIcon } from '@mui/icons-material'
import { getContainerColor, getContainerHealthTier, getActivityTier, FONT, STATUS } from './huntConstants'
import { formatNumber, tabularNumStyle } from '../../utils/formatNumber'

// Mini circular progress ring for alive%
const AliveRing = ({ alive, total, size = 32, strokeWidth = 3, isDark = true }) => {
  const pct = total > 0 ? (alive / total) * 100 : 0
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference - (pct / 100) * circumference
  const color = pct >= 50 ? STATUS.HEALTHY : pct >= 25 ? STATUS.WARNING : STATUS.CRITICAL
  const trackColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
  return (
    <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }} />
      </svg>
      <Typography sx={{
        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        fontSize: '0.55rem', fontWeight: 700, color, lineHeight: 1,
      }}>
        {alive}
      </Typography>
    </Box>
  )
}

const ContainerCard = memo(({
  group,
  ppm,
  // Phase 1-A3 (May 2026) — when ppmIsRolling is true, `ppm` is the live
  // 60-second rolling rate and `lifetimePPM` is the long-run average for
  // a secondary label. When false, `ppm` itself is the lifetime average
  // (warmup / no recentWindow data) and the label reflects that.
  ppmIsRolling = false,
  lifetimePPM = null,
  ppmPerWorker,
  active,
  total,
  packs,
  godPacks,
  alive,
  errors,
  accounts,
  acctsPct,
  acctsProcessed,
  lastPackAgeSec,
  recentErrorRate,
  recentErrors,
  isSelected,
  isAdmin = false,
  onClick,
  // Container OFF classification (Phase: container-OFF detection)
  huntActive = false,
  intentional = false,
  offReason = null,
  // Alignment (new — decision-layer signal). Optional; when omitted or
  // no_data, the alignment badge is hidden entirely so existing callers
  // don't show an empty row.
  alignment = null,   // { status, alignment, reason }
  // Operator-assisted optimization. When alignment < 90% AND admin AND
  // suggestions present, render the suggestion box + Apply button.
  suggestions = null, // [{ from, to, users, runtimeCount }]
  // Impact preview for the suggestion — { currentAlignmentPct,
  // expectedAlignmentPct, currentWastedPct, expectedWastedPct, … }.
  // Null when no suggestion; rendered inline under the suggestion text.
  suggestionProjection = null,
  onApplySuggestion,  // (group) => Promise<void>  — owner handles PUT + refresh
  // Hunt PPM throttle telemetry (May 2026) — authoritative outbound RPC
  // rate the governor actually controls. When the throttle is disabled
  // (default for H1/H2/H4) the prop is { enabled: false } and the RPC
  // row is hidden. When enabled it carries mode, target, actualRpcPpm,
  // errorPct, etc. — surfaced as a secondary line under "Live PPM" so
  // operators see the strict per-RPC rate next to the cycle-aggregated
  // metric (which can appear higher due to cycle-end timestamping).
  rpc = null,
}) => {
  const [applying, setApplying] = useState(false)
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const containerColor = getContainerColor(group)
  // Error rate = errors per account processed (not per pack — packs >> accounts so errors/packs is misleadingly low)
  const errorRate = accounts > 0 ? errors / accounts : 0
  const health = getContainerHealthTier(
    parseFloat(ppm) || 0, active, total, errorRate,
    { huntActive, intentional, reason: offReason }
  )
  // Non-admin: soften alarming tier labels
  const healthLabel = isAdmin ? health.label
    : health.label === 'Degraded' ? 'Slow'
    : health.label === 'Critical' ? 'Issue'
    : health.label === 'Down' ? 'Offline'
    : health.label
  // Operator-visible reason text (always show admins; non-admins only on
  // critical/unexpected so we don't leak internals).
  const reasonText = health.reason || offReason || null
  const showReason = !!reasonText && (isAdmin || health.tier === 'critical')
  const ppmNum = parseFloat(ppm) || 0
  const ppmColor = ppmNum >= 80 ? STATUS.HEALTHY : ppmNum >= 40 ? STATUS.WARNING : ppmNum > 0 ? STATUS.DEGRADED : theme.palette.text.secondary

  return (
    <Box
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.() } }}
      sx={{
        flex: '1 1 200px',
        minWidth: 200,
        cursor: 'pointer',
        borderRadius: '14px',
        overflow: 'hidden',
        transition: 'all 0.25s ease',
        bgcolor: isDark ? 'rgba(26, 32, 53, 0.7)' : 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: isSelected
          ? `2px solid ${containerColor}`
          : `1px solid ${isDark ? `${containerColor}25` : `${containerColor}20`}`,
        boxShadow: isSelected
          ? `0 4px 20px ${containerColor}25`
          : isDark ? '0 2px 12px rgba(0,0,0,0.15)' : '0 1px 6px rgba(0,0,0,0.04)',
        '&:hover': {
          boxShadow: `0 6px 24px ${containerColor}20`,
          borderColor: `${containerColor}50`,
          transform: 'translateY(-2px)',
        },
      }}
    >
      {/* Color accent bar */}
      <Box sx={{ height: 3, background: `linear-gradient(90deg, ${containerColor}, ${containerColor}66)` }} />

      <Box sx={{ p: 2 }}>
        {/* Header: Container name + health */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ color: containerColor, fontSize: FONT.section }}>
            Container {group}
          </Typography>
          <Tooltip
            title={reasonText
              ? `${healthLabel}: ${reasonText}${health.intentional === false ? ' (UNEXPECTED — auto-heal escalation pending)' : ''}`
              : healthLabel}
            arrow
          >
            <Chip
              icon={<Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: health.color, ml: 0.5 }} />}
              label={healthLabel}
              size="small"
              sx={{
                height: 20, fontSize: '0.65rem', fontWeight: 700,
                bgcolor: `${health.color}15`, color: health.color,
                border: `1px solid ${health.color}25`,
              }}
            />
          </Tooltip>
        </Box>

        {/* Hero PPM + PPM/worker */}
        {/*
          Phase 1-A3 (May 2026) — primary value is rolling 60s PPM when
          recentWindow data is present (ppmIsRolling). Secondary line
          shows the lifetime average so the operator can compare both
          without ambiguity. When ppmIsRolling is false the lifetime
          average IS the displayed primary value (warmup / pipeline
          regression) and the label says "Lifetime Avg" plainly.
        */}
        <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mb: 0.25 }}>
          <Typography sx={{ fontSize: '1.75rem', fontWeight: 800, color: ppmColor, lineHeight: 1, ...tabularNumStyle }}>
            {ppm}
          </Typography>
          <Tooltip title={
            rpc && rpc.enabled
              ? `Live PPM — authoritative outbound Pack/OpenV1 attempts per minute (last 60s), reported by the hunt PPM governor. Target ${Math.round(rpc.targetPpm || 0)}. Mode ${rpc.mode || '?'}. Error ${rpc.errorPct ?? 0}%.${rpc.hardMaxPaused ? ' HARD_MAX engaged — opens paused.' : ''}`
              : ppmIsRolling
                ? 'Live PPM — cycle-based estimate: packs opened in the last 60 seconds across this container\'s active workers. Updates as workers report. Lifetime average shown below for context.'
                : 'Lifetime Avg — total packs ÷ runtime minutes for this container. Rolling 60s rate is unavailable (no recentWindow data — workers just started, or stats pipeline lag).'
          }>
            <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: FONT.label, cursor: 'help' }}>
              {ppmIsRolling ? 'Live PPM' : 'Lifetime Avg'}
              {rpc && rpc.enabled && (
                <Typography component="span" sx={{ ml: 0.5, color: rpc.hardMaxPaused ? 'error.main' : rpc.mode === 'DEGRADED' ? 'warning.main' : rpc.mode === 'RECOVERY' ? 'info.main' : 'success.main', fontSize: FONT.label, fontWeight: 600 }}>
                  · governed{rpc.targetPpm ? ` · target ${Math.round(rpc.targetPpm)}` : ''}{rpc.hardMaxPaused ? ' · HARDMAX' : rpc.mode && rpc.mode !== 'NORMAL' ? ` · ${rpc.mode}` : ''}
                </Typography>
              )}
            </Typography>
          </Tooltip>
          {godPacks > 0 && (
            <Box sx={{ ml: 'auto' }}>
              <AliveRing alive={alive} total={godPacks} isDark={isDark} />
            </Box>
          )}
        </Box>
        {/* Secondary line — lifetime avg when primary is rolling. Hidden
            when the primary is itself the lifetime (no need to repeat). */}
        {ppmIsRolling && lifetimePPM != null && (
          <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5, mb: 0.5 }}>
            <Typography sx={{ color: 'text.secondary', fontSize: FONT.label, ...tabularNumStyle }}>
              {lifetimePPM}
            </Typography>
            <Tooltip title="Lifetime average for this container (total packs ÷ runtime minutes since first instance start). For long-run baseline only — does NOT reflect current rate.">
              <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: FONT.label, cursor: 'help' }}>Lifetime Avg</Typography>
            </Tooltip>
          </Box>
        )}
        {/* RPC PPM row removed (May 2026, "One-PPM UX"). The
            authoritative metric now drives the primary Live PPM value
            above when rpc.enabled. The "governed" badge is rendered
            inline next to the Live PPM label. */}

        {/* PPM per worker + activity + recent errors */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5, flexWrap: 'wrap' }}>
          <Typography sx={{ color: 'text.secondary', fontSize: FONT.label }}>
            {ppmPerWorker}/worker
          </Typography>
          {lastPackAgeSec != null && lastPackAgeSec > 10 && (() => {
            const activity = getActivityTier(lastPackAgeSec)
            return (
              <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, color: activity.color }}>
                {activity.label}
              </Typography>
            )
          })()}
          {/* Error rate details — admin only */}
          {isAdmin && recentErrorRate != null && recentErrorRate > 0.02 && (
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, color: recentErrorRate > 0.08 ? STATUS.CRITICAL : recentErrorRate > 0.03 ? STATUS.WARNING : 'text.secondary' }}>
              {(recentErrorRate * 100).toFixed(1)}% err (1m)
            </Typography>
          )}
          {isAdmin && recentErrorRate == null && recentErrors > 0 && (
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, color: recentErrors > 5 ? STATUS.CRITICAL : STATUS.WARNING }}>
              {recentErrors} err/1m
            </Typography>
          )}
          {isAdmin && recentErrorRate == null && !recentErrors && errorRate > 0.05 && (
            <Typography sx={{ fontSize: '0.6rem', fontWeight: 600, color: STATUS.CRITICAL }}>
              {(errorRate * 100).toFixed(1)}% err
            </Typography>
          )}
        </Box>

        {/* Stats row */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          {[
            { label: 'Packs', value: formatNumber(packs), color: 'text.primary' },
            { label: 'GP', value: godPacks, color: godPacks > 0 ? '#FFD700' : 'text.primary' },
            { label: 'Live', value: alive, color: alive > 0 ? STATUS.HEALTHY : 'text.secondary' },
            { label: 'Workers', value: `${active}/${total}`, color: 'text.primary' },
          ].map(stat => (
            <Box key={stat.label} sx={{ textAlign: 'center', flex: 1 }}>
              <Typography sx={{ color: 'text.secondary', fontSize: '0.6rem', display: 'block', lineHeight: 1.4 }}>{stat.label}</Typography>
              <Typography sx={{ fontSize: FONT.value, fontWeight: 700, color: stat.color, ...tabularNumStyle }}>{stat.value}</Typography>
            </Box>
          ))}
        </Box>

        {/* Alignment badge + reason — surfaced at-a-glance per card.
            Hidden when alignment data is absent or a no_data row (e.g.
            no active workers in this container this tick). */}
        {alignment && alignment.status && alignment.status !== 'no_data' && (
          <Box sx={{ mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography sx={{
                fontSize: '0.62rem', fontWeight: 700,
                color: alignment.status === 'aligned' ? '#4caf50'
                     : alignment.status === 'partial' ? '#fbbf24'
                     : '#ef5350',
              }}>
                {alignment.status === 'aligned' ? '✓' : '⚠️'} {Math.round((alignment.alignment || 0) * 100)}% aligned
              </Typography>
            </Box>
            {alignment.reason && alignment.status !== 'aligned' && (
              <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', lineHeight: 1.3, mt: 0.25 }}>
                {alignment.reason}
              </Typography>
            )}
          </Box>
        )}

        {/* Operator-assisted suggestion — appears only when alignment is
            below the green threshold AND we have computed swap pairs from
            runtime/demand/config. The Apply button (admin-only) calls
            the owner's onApplySuggestion which PUTs container_pack_config.
            DOES NOT move users — only changes future runtime pack rolls.
            Compact lightbox-blue styling; never shown when aligned. */}
        {suggestions && suggestions.length > 0 && alignment && alignment.status !== 'aligned' && (
          <Box sx={{
            mb: 1, p: 1, borderRadius: '8px',
            bgcolor: isDark ? 'rgba(33,150,243,0.08)' : 'rgba(33,150,243,0.06)',
            border: '1px solid rgba(33,150,243,0.2)',
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              <SuggestIcon sx={{ fontSize: 13, color: '#2196f3' }} />
              <Typography sx={{ fontSize: '0.62rem', fontWeight: 700, color: '#2196f3', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Suggestion
              </Typography>
            </Box>
            {suggestions.map((s, i) => (
              <Typography key={i} sx={{ fontSize: '0.65rem', color: 'text.primary', lineHeight: 1.4 }}>
                Replace <strong>{s.from.replace(/_/g, ' ')}</strong> with <strong>{s.to.replace(/_/g, ' ')}</strong>{' '}
                <span style={{ color: '#2196f3', fontWeight: 600 }}>
                  ({s.users} user{s.users !== 1 ? 's' : ''} requesting)
                </span>
              </Typography>
            ))}

            {/* Impact preview — expected alignment + wasted-capacity
                deltas if the swap(s) above are applied. Pure client-side
                simulation (alignment.simulateAlignmentAfterSwaps) so it's
                cheap + in sync with how alignment is computed. */}
            {suggestionProjection && (
              <Box sx={{ mt: 0.75, pl: 1.25, borderLeft: '2px solid rgba(33,150,243,0.4)' }}>
                <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary', lineHeight: 1.4, ...tabularNumStyle }}>
                  → Alignment:{' '}
                  <span style={{ color: 'text.secondary' }}>{suggestionProjection.currentAlignmentPct}%</span>
                  {' → '}
                  <span style={{ color: '#4caf50', fontWeight: 700 }}>
                    {suggestionProjection.expectedAlignmentPct}%
                  </span>
                  {suggestionProjection.alignmentDelta > 0 && (
                    <span style={{ color: '#4caf50', fontWeight: 600, marginLeft: 4 }}>
                      (+{suggestionProjection.alignmentDelta}pp)
                    </span>
                  )}
                </Typography>
                <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary', lineHeight: 1.4, ...tabularNumStyle }}>
                  → Wasted capacity:{' '}
                  <span style={{ color: '#ef5350' }}>{suggestionProjection.currentWastedPct}%</span>
                  {' → '}
                  <span style={{ color: '#4caf50', fontWeight: 700 }}>
                    {suggestionProjection.expectedWastedPct}%
                  </span>
                  {suggestionProjection.wastedDelta > 0 && (
                    <span style={{ color: '#4caf50', fontWeight: 600, marginLeft: 4 }}>
                      (−{suggestionProjection.wastedDelta}pp)
                    </span>
                  )}
                </Typography>
              </Box>
            )}
            {isAdmin && typeof onApplySuggestion === 'function' && (
              <Box sx={{ mt: 0.75, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Button
                  size="small"
                  variant="contained"
                  disabled={applying}
                  onClick={async (e) => {
                    e.stopPropagation()
                    setApplying(true)
                    try {
                      await onApplySuggestion(group, suggestions)
                    } finally {
                      setApplying(false)
                    }
                  }}
                  sx={{
                    fontSize: '0.6rem', textTransform: 'none', fontWeight: 700,
                    py: 0.25, px: 1, minWidth: 0, height: 22,
                    bgcolor: '#2196f3', '&:hover': { bgcolor: '#1976d2' },
                  }}
                >
                  {applying ? 'Applying…' : 'Apply Suggestion'}
                </Button>
                <Typography sx={{ fontSize: '0.55rem', color: 'text.secondary', fontStyle: 'italic' }}>
                  updates pack config only — does not move users
                </Typography>
              </Box>
            )}
          </Box>
        )}

        {/* Operator reason — surfaced when container is OFF/Down so the
            operator never has to guess whether OFF is intentional or a
            failure. Color-coded: critical = red, intentional off = muted. */}
        {showReason && (
          <Box sx={{ mb: 1 }}>
            <Typography sx={{
              fontSize: '0.62rem', fontWeight: 600,
              color: health.intentional === false ? STATUS.CRITICAL : 'text.secondary',
              lineHeight: 1.3,
            }}>
              {health.intentional === false ? '⚠ ' : ''}{reasonText}
            </Typography>
          </Box>
        )}

        {/* Account progress bar */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LinearProgress
            variant="determinate"
            value={acctsPct || 0}
            sx={{
              flex: 1, height: 3, borderRadius: 2,
              bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
              '& .MuiLinearProgress-bar': { borderRadius: 2, bgcolor: (acctsPct || 0) > 90 ? STATUS.DEGRADED : containerColor },
            }}
          />
          <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', ...tabularNumStyle, minWidth: 40, textAlign: 'right' }}>
            {formatNumber(acctsProcessed)} accts
          </Typography>
        </Box>
      </Box>
    </Box>
  )
})

ContainerCard.displayName = 'ContainerCard'
export default ContainerCard
