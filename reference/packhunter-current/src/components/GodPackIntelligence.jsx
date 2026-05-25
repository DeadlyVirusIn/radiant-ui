/**
 * God Pack Intelligence Panel
 * Discovery timeline (30d), pack type breakdown, live GP count.
 * Fetches from /hunt/godpacks/stats (page load) and /hunt/summary/today (60s cache).
 */

import { memo, useState, useEffect, useCallback } from 'react';
import { Box, Typography, Chip, Skeleton, useTheme } from '@mui/material';
import {
  AutoAwesome as GpIcon,
  FiberManualRecord as DotIcon,
  TrendingUp as TrendIcon,
} from '@mui/icons-material';
import { AreaChart, Area, ResponsiveContainer, XAxis, Tooltip as RechartsTooltip, BarChart, Bar } from 'recharts';
import { hunt } from '../services/api';
import { tabularNumStyle, formatCompact } from '../utils/formatNumber';

const GodPackIntelligence = memo(function GodPackIntelligence() {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const [stats, setStats] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const [gpStats, todayData] = await Promise.all([
        hunt.getGodpackStats(),
        hunt.getSummaryToday(),
      ]);
      setStats(gpStats);
      setSummary(todayData);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 60000);
    return () => clearInterval(interval);
  }, [loadStats]);

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width={200} height={24} />
        <Skeleton variant="rectangular" height={120} sx={{ borderRadius: 1, mt: 1 }} />
      </Box>
    );
  }

  if (!stats) return null;

  const timeline = (stats.timeline || []).slice(-14); // Last 14 days for compact view
  const byPack = (stats.byPack || []).slice(0, 6);
  const gpToday = summary?.gp_today || 0;
  const gp1h = summary?.gp_1h || 0;
  const gp24h = summary?.gp_24h || stats.last24h || 0;
  const packsToday = summary?.packs_today || 0;

  const goldColor = '#FFD700';
  const accentColor = theme.palette.info.main;

  return (
    <Box>
      {/* Header with live GP badge */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <GpIcon sx={{ fontSize: 18, color: goldColor }} />
        <Typography variant="subtitle2" fontWeight={700}>God Pack Intelligence</Typography>
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
          {gp1h > 0 && (
            <Chip
              icon={<DotIcon sx={{ fontSize: 8, color: '#4caf50', animation: 'pulse 2s infinite', '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.3 } } }} />}
              label={`${gp1h} in 1h`}
              size="small"
              variant="outlined"
              sx={{ height: 20, fontSize: '0.65rem', borderColor: '#4caf5040' }}
            />
          )}
        </Box>
      </Box>

      {/* Stat Row */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <StatMini label="Today" value={gpToday} color={goldColor} />
        <StatMini label="24h" value={gp24h} color={accentColor} />
        <StatMini label="7d" value={stats.last7d || 0} color={theme.palette.secondary.main} />
        <StatMini label="Packs Today" value={formatCompact(packsToday)} color={theme.palette.success.main} />
      </Box>

      {/* Timeline Chart (14 days) */}
      {timeline.length > 2 && (
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', mb: 0.5, display: 'block' }}>
            Discovery Trend (14d)
          </Typography>
          <ResponsiveContainer width="100%" height={80}>
            <AreaChart data={timeline} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="gpGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={goldColor} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={goldColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={false}
                axisLine={false}
                tickLine={false}
              />
              <RechartsTooltip
                contentStyle={{
                  background: isDark ? '#1a1a2e' : '#fff',
                  border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                  borderRadius: 6,
                  fontSize: '0.7rem',
                }}
                labelFormatter={(v) => v ? new Date(v).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}
                formatter={(v) => [`${v} GPs`, 'Found']}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke={goldColor}
                strokeWidth={2}
                fill="url(#gpGrad)"
                dot={false}
                activeDot={{ r: 3, fill: goldColor }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Box>
      )}

      {/* Pack Type Breakdown */}
      {byPack.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem', mb: 0.5, display: 'block' }}>
            By Pack Type
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {byPack.map((p, i) => {
              const maxCount = byPack[0]?.count || 1;
              const pct = Math.round(p.count / maxCount * 100);
              return (
                <Box key={p.pack_type || i} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography variant="caption" sx={{ width: 80, fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.pack_type || 'Unknown'}
                  </Typography>
                  <Box sx={{ flex: 1, bgcolor: 'rgba(255,255,255,0.04)', borderRadius: 0.5, height: 14, overflow: 'hidden' }}>
                    <Box sx={{
                      width: `${pct}%`,
                      height: '100%',
                      bgcolor: `${goldColor}${i === 0 ? '' : '90'}`,
                      borderRadius: 0.5,
                      transition: 'width 0.4s ease',
                    }} />
                  </Box>
                  <Typography variant="caption" sx={{ width: 32, textAlign: 'right', fontSize: '0.65rem', fontWeight: 600, ...tabularNumStyle }}>
                    {p.count}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}
    </Box>
  );
});

function StatMini({ label, value, color }) {
  return (
    <Box sx={{ textAlign: 'center', flex: 1 }}>
      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem', display: 'block', lineHeight: 1 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 700, color, ...tabularNumStyle, fontSize: '0.9rem' }}>
        {value}
      </Typography>
    </Box>
  );
}

export default GodPackIntelligence;
