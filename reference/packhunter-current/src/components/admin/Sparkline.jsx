/**
 * Sparkline — tiny inline-SVG trend line. No dependencies.
 *
 * Draws a polyline across a fixed-height box. Auto-scales to the data
 * range (or falls back to a flat midline if the series is too short /
 * flat). Emits a small dot on the last point so the current value is
 * always findable.
 *
 * Intentionally minimal — this is tile context, not a chart.
 */

import { Box, useTheme } from '@mui/material';

/**
 * @param {object} props
 * @param {Array<{value:number}>|Array<number>} props.values
 * @param {number} [props.width]   default 88
 * @param {number} [props.height]  default 22
 * @param {string} [props.state]   'healthy' | 'warning' | 'error' — colors the line
 * @param {string} [props.label]   ARIA label
 */
export default function Sparkline({
  values,
  width = 88,
  height = 22,
  state = 'healthy',
  label,
}) {
  const theme = useTheme();
  const arr = Array.isArray(values)
    ? values.map(v => (typeof v === 'number' ? v : Number(v?.value || 0)))
    : [];

  // Not enough data → render a subtle baseline so the tile doesn't jiggle.
  if (arr.length < 2) {
    return (
      <Box
        role="img"
        aria-label={label || 'trend unavailable'}
        sx={{
          width, height,
          display: 'flex', alignItems: 'center',
          opacity: 0.5,
        }}
      >
        <Box sx={{
          width: '100%', height: 1,
          bgcolor: theme.palette.divider,
        }} />
      </Box>
    );
  }

  const min = Math.min(...arr);
  const max = Math.max(...arr);
  const span = max - min || 1;

  // Leave 2px of vertical padding so the line never clips the edge.
  const pad = 2;
  const innerH = height - pad * 2;

  const stepX = arr.length > 1 ? width / (arr.length - 1) : 0;
  const points = arr.map((v, i) => {
    const x = i * stepX;
    const y = pad + innerH - ((v - min) / span) * innerH;
    return [x, y];
  });

  const stroke = {
    healthy: theme.palette.success.main,
    warning: theme.palette.warning.main,
    error:   theme.palette.error.main,
    info:    theme.palette.info.main,
  }[state] || theme.palette.primary.main;

  const pointsAttr = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [lx, ly] = points[points.length - 1];

  return (
    <Box
      role="img"
      aria-label={label || `trend with ${arr.length} points`}
      sx={{ width, height, display: 'inline-flex', lineHeight: 0 }}
    >
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} xmlns="http://www.w3.org/2000/svg">
        <polyline
          points={pointsAttr}
          fill="none"
          stroke={stroke}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.85"
        />
        <circle cx={lx} cy={ly} r="2" fill={stroke} />
      </svg>
    </Box>
  );
}

/**
 * Summarize the trend direction of a series as 'up' | 'down' | 'flat'.
 * Used by tiles to show a tiny textual cue next to the sparkline.
 * "Meaningful" = first vs last differs by > 10% of the max value.
 */
export function trendDirection(values) {
  if (!Array.isArray(values) || values.length < 3) return 'flat';
  const nums = values.map(v => typeof v === 'number' ? v : Number(v?.value || 0));
  const first = nums[0];
  const last = nums[nums.length - 1];
  const range = Math.max(1, Math.max(...nums) - Math.min(...nums));
  const delta = last - first;
  if (Math.abs(delta) / range < 0.2) return 'flat';
  return delta > 0 ? 'up' : 'down';
}
