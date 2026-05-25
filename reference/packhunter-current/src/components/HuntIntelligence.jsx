/**
 * Hunt Intelligence Panel
 * Container PPM comparison with trustworthy health states.
 *
 * State model (authoritative, from backend perGroupBaseline[id].status):
 *   no_data      — no workers in this container (shouldn't render)
 *   idle         — workers exist but none active
 *   stale        — active workers but stats file not refreshing (agent dead?)
 *   stalled      — active + fresh, but no packs in 5+ min (confirmed stall)
 *   starting     — active + fresh but still ramping (first minute, no packs yet)
 *   low_activity — producing some packs, below healthy threshold (<5 ppm)
 *   healthy      — producing ≥5 ppm
 *
 * Falls back to a client-side classifier if an older backend response
 * doesn't include status — so UI never shows false STALL for missing data.
 */

import { memo, useMemo } from 'react';
import { Box, Typography, Chip, LinearProgress, Tooltip, useTheme } from '@mui/material';
import {
  Speed as PpmIcon,
  FiberManualRecord as DotIcon,
} from '@mui/icons-material';
import { useHuntStats } from '../contexts/HuntStatsContext';
import { tabularNumStyle } from '../utils/formatNumber';

// ── Status taxonomy (keep in sync with hunt.js route) ────────────────
const STATUS_META = {
  healthy:      { label: null,          color: 'success',      severity: 0, dotColor: 'success.main'       },
  low_activity: { label: 'LOW',         color: 'info',         severity: 1, dotColor: 'info.main'          },
  starting:     { label: 'STARTING',    color: 'info',         severity: 1, dotColor: 'info.main'          },
  idle:         { label: 'IDLE',        color: 'default',      severity: 2, dotColor: 'text.disabled'      },
  no_data:      { label: 'NO DATA',     color: 'default',      severity: 2, dotColor: 'text.disabled'      },
  stale:        { label: 'STALE',       color: 'warning',      severity: 3, dotColor: 'warning.main'       },
  stalled:      { label: 'STALL',       color: 'error',        severity: 4, dotColor: 'error.main'         },
};

function fallbackStatus({ active, total, staleSec, ppm, sinceLastPackSec }) {
  // Used only when backend omits status (old response shape)
  if (total === 0) return 'no_data';
  if (active === 0) return 'idle';
  if (staleSec != null && staleSec > 120) return 'stale';
  if (ppm >= 5) return 'healthy';
  if (ppm > 0) return 'low_activity';
  if (sinceLastPackSec != null && sinceLastPackSec > 300) return 'stalled';
  return 'starting';
}

function formatAgo(sec) {
  if (sec == null) return 'never';
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
  return `${Math.round(sec / 3600)}h ago`;
}

const HuntIntelligence = memo(function HuntIntelligence() {
  const theme = useTheme();
  const { data: huntStats } = useHuntStats();
  const raw = huntStats?._raw;
  const instances = raw?.instances || [];

  const containers = useMemo(() => {
    const groups = {};
    for (const inst of instances) {
      const g = inst.containerGroup || 0;
      if (g === 0) continue;
      if (!groups[g]) groups[g] = { active: 0, total: 0, packs: 0, lastUpdate: 0 };
      groups[g].total++;
      if (inst.isActive) {
        groups[g].active++;
        groups[g].packs += inst.packsOpened || 0;
      }
      const lu = inst.lastUpdateTime || inst.lastUpdated || 0;
      if (lu > groups[g].lastUpdate) groups[g].lastUpdate = lu;
    }

    const pgb = raw?.perGroupBaseline || {};
    return Object.entries(groups).map(([id, g]) => {
      const baseline = pgb[`C${id}`] || pgb[id] || {};
      // Backend is authoritative; fall back to local classifier if status missing
      const ppm = baseline.rollingPPM != null ? baseline.rollingPPM : 0;
      const staleSec = baseline.staleSec != null
        ? baseline.staleSec
        : (g.lastUpdate > 0 ? Math.round((Date.now() - g.lastUpdate) / 1000) : null);
      const sinceLastPackSec = baseline.sinceLastPackSec != null ? baseline.sinceLastPackSec : null;

      const status = baseline.status || fallbackStatus({
        active: g.active, total: g.total, staleSec, ppm, sinceLastPackSec,
      });

      return {
        name: `C${id}`,
        active: g.active,
        total: g.total,
        packs: g.packs,
        ppm: Math.round(ppm * 10) / 10,
        status,
        staleSec,
        sinceLastPackSec,
        lastUpdateTs: baseline.lastUpdateTs || g.lastUpdate || null,
      };
    }).sort((a, b) => parseInt(a.name.slice(1)) - parseInt(b.name.slice(1)));
  }, [instances, raw]);

  if (containers.length === 0) return null;

  const maxPpm = Math.max(...containers.map(c => c.ppm), 1);

  // Consistency guard: if ANY container claims stalled but aggregate PPM > 0,
  // we trust the aggregate and downgrade the badge to avoid contradiction.
  const aggregatePPM = raw?.summary?.rollingPPM ?? raw?.summary?.packsPerMinute ?? 0;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <PpmIcon sx={{ fontSize: 18, color: theme.palette.info.main }} />
        <Typography variant="subtitle2" fontWeight={700}>Hunt Intelligence</Typography>
        <Chip
          label={`${containers.filter(c => c.active > 0).length} active`}
          size="small"
          variant="outlined"
          sx={{ height: 20, fontSize: '0.65rem', ml: 'auto' }}
        />
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {containers.map(c => {
          const meta = STATUS_META[c.status] || STATUS_META.no_data;
          const isHealthyFamily = c.status === 'healthy' || c.status === 'low_activity';
          const barColor =
            c.status === 'stalled' ? theme.palette.error.main
            : c.status === 'stale' ? theme.palette.warning.main
            : c.active === 0 ? theme.palette.text.disabled
            : theme.palette.info.main;

          const tooltip = [
            `${c.active}/${c.total} workers`,
            `${c.packs.toLocaleString()} packs total`,
            c.lastUpdateTs ? `updated ${formatAgo(c.staleSec)}` : 'no updates yet',
            c.sinceLastPackSec != null ? `last pack ${formatAgo(c.sinceLastPackSec)}` : null,
            c.status !== 'healthy' ? `status: ${c.status}` : null,
          ].filter(Boolean).join(' · ');

          // Display text inside bar
          let barText;
          if (c.status === 'idle' || c.status === 'no_data') barText = meta.label?.toLowerCase() || 'idle';
          else if (c.status === 'starting') barText = 'starting…';
          else if (c.status === 'stalled' || c.status === 'stale') barText = '—';
          else barText = `${c.ppm} ppm`;

          return (
            <Box key={c.name} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 32, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <DotIcon sx={{ fontSize: 8, color: meta.dotColor }} />
                <Typography variant="caption" fontWeight={600} sx={{ fontSize: '0.7rem' }}>
                  {c.name}
                </Typography>
              </Box>

              <Tooltip title={tooltip}>
                <Box sx={{ flex: 1, position: 'relative' }}>
                  <LinearProgress
                    variant="determinate"
                    value={isHealthyFamily ? Math.min(c.ppm / maxPpm * 100, 100) : 0}
                    sx={{
                      height: 18,
                      borderRadius: 1,
                      bgcolor: 'rgba(255,255,255,0.04)',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 1,
                        bgcolor: barColor,
                        transition: 'transform 0.6s ease',
                      },
                    }}
                  />
                  <Typography
                    variant="caption"
                    sx={{
                      position: 'absolute',
                      right: 6,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      color: 'text.primary',
                      ...tabularNumStyle,
                    }}
                  >
                    {barText}
                  </Typography>
                </Box>
              </Tooltip>

              {/* Status badge — only render for non-healthy states.
                  Consistency guard: never show STALL for ALL containers
                  when aggregate PPM > 0 (that would be the pre-fix bug). */}
              {meta.label && !(c.status === 'stalled' && aggregatePPM > 0 && containers.every(x => x.status === 'stalled')) && (
                <Chip
                  label={meta.label}
                  size="small"
                  color={meta.color}
                  sx={{ height: 18, fontSize: '0.6rem', fontWeight: 700 }}
                />
              )}
            </Box>
          );
        })}
      </Box>

      {/* Footer: last updated Xs ago for the freshest container */}
      <Box sx={{ mt: 1, display: 'flex', justifyContent: 'flex-end' }}>
        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.disabled' }}>
          last update: {formatAgo(Math.min(...containers.filter(c => c.staleSec != null).map(c => c.staleSec).concat(9999)))}
        </Typography>
      </Box>
    </Box>
  );
});

export default HuntIntelligence;
