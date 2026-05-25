/**
 * InsightStrip2 — Intelligence layer component
 * Displays derived insights as a compact, high-signal strip.
 * Fetches from /hunt/insights (30s cache backend, 45s poll frontend).
 */

import { memo, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Chip, Skeleton, useTheme } from '@mui/material';
import {
  EmojiEvents as TrophyIcon,
  TrendingUp as UpIcon,
  TrendingDown as DownIcon,
  Warning as WarnIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  LocalFireDepartment as FireIcon,
  PieChart as PieIcon,
  BarChart as ChartIcon,
} from '@mui/icons-material';
import { hunt } from '../services/api';

const ICON_MAP = {
  trophy: TrophyIcon,
  trending_up: UpIcon,
  trending_down: DownIcon,
  warning: WarnIcon,
  check: CheckIcon,
  error: ErrorIcon,
  fire: FireIcon,
  pie: PieIcon,
  chart: ChartIcon,
};

const SEVERITY_COLORS = {
  positive: '#4caf50',
  watch: '#ff9800',
  alert: '#f44336',
  neutral: '#90caf9',
};

const InsightStrip2 = memo(function InsightStrip2({ showNarrative = true }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const isDark = theme.palette.mode === 'dark';
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const result = await hunt.getInsights();
      if (!result.error) setData(result);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    load();
    const interval = setInterval(load, 45000);
    return () => clearInterval(interval);
  }, [load]);

  if (loading && !data) {
    return (
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, overflow: 'hidden' }}>
        {[1, 2, 3].map(i => (
          <Skeleton key={i} variant="rectangular" width={180} height={52} sx={{ borderRadius: 2, flexShrink: 0 }} />
        ))}
      </Box>
    );
  }

  if (!data?.insights?.length) return null;

  return (
    <Box sx={{ mb: 2.5 }}>
      {/* Narrative banner */}
      {showNarrative && data.narrative && (
        <Box sx={{
          px: 2,
          py: 1,
          mb: 1.5,
          borderRadius: '10px',
          bgcolor: isDark ? 'rgba(144, 202, 249, 0.04)' : 'rgba(33, 150, 243, 0.04)',
          border: `1px solid ${isDark ? 'rgba(144, 202, 249, 0.08)' : 'rgba(33, 150, 243, 0.08)'}`,
        }}>
          <Typography variant="body2" sx={{ color: 'text.secondary', fontSize: '0.8rem', lineHeight: 1.5 }}>
            {data.narrative}
          </Typography>
        </Box>
      )}

      {/* Insight cards strip */}
      <Box sx={{
        display: 'flex',
        gap: 1.5,
        overflowX: 'auto',
        pb: 0.5,
        '&::-webkit-scrollbar': { height: 4 },
        '&::-webkit-scrollbar-thumb': { bgcolor: 'rgba(255,255,255,0.1)', borderRadius: 2 },
      }}>
        {data.insights.map((insight, i) => {
          const IconComponent = ICON_MAP[insight.icon] || CheckIcon;
          const color = SEVERITY_COLORS[insight.severity] || SEVERITY_COLORS.neutral;

          return (
            <Box
              key={i}
              onClick={() => insight.drilldown?.page && navigate(insight.drilldown.page)}
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 1.5,
                py: 1,
                minWidth: 160,
                maxWidth: 240,
                flexShrink: 0,
                borderRadius: '10px',
                bgcolor: `${color}08`,
                border: `1px solid ${color}18`,
                cursor: insight.drilldown ? 'pointer' : 'default',
                transition: 'border-color 0.2s, transform 0.15s',
                '&:hover': insight.drilldown ? {
                  borderColor: `${color}40`,
                  transform: 'translateY(-1px)',
                } : {},
              }}
            >
              <IconComponent sx={{ fontSize: 18, color, flexShrink: 0 }} />
              <Box sx={{ minWidth: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="caption" sx={{
                    fontWeight: 600,
                    fontSize: '0.7rem',
                    color: 'text.primary',
                    lineHeight: 1.2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}>
                    {insight.text}
                  </Typography>
                  {insight.confidence && (
                    <Typography variant="caption" sx={{
                      fontSize: '0.5rem',
                      fontWeight: 600,
                      color: insight.confidence === 'high' ? '#4caf50' : insight.confidence === 'medium' ? '#ff9800' : '#90caf9',
                      textTransform: 'uppercase',
                      letterSpacing: 0.5,
                      flexShrink: 0,
                    }}>
                      {insight.confidence}
                    </Typography>
                  )}
                </Box>
                {insight.detail && (
                  <Typography variant="caption" sx={{
                    fontSize: '0.6rem',
                    color: 'text.secondary',
                    display: 'block',
                    lineHeight: 1.1,
                    mt: 0.25,
                  }}>
                    {insight.detail}
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
});

export default InsightStrip2;
