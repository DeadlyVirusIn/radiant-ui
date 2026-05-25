/**
 * GodPackTimeline — Horizontal scroll of recent god packs.
 * Shows container, status, and time ago. Links to gallery.
 */
import { memo } from 'react'
import { Box, Typography, Chip, useTheme } from '@mui/material'
import { Star as StarIcon } from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'
import { getContainerColor, GP_STATUS_COLORS, FONT, timeAgo } from './huntConstants'

const GodPackTimeline = memo(({ godPacks }) => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const navigate = useNavigate()

  if (!godPacks || godPacks.length === 0) return null

  return (
    <Box sx={{
      mb: 2, p: 2, borderRadius: '12px',
      bgcolor: isDark ? 'rgba(26, 32, 53, 0.7)' : 'rgba(255, 255, 255, 0.7)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      border: `1px solid ${isDark ? 'rgba(255, 215, 0, 0.08)' : 'rgba(255, 215, 0, 0.12)'}`,
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <StarIcon sx={{ fontSize: 18, color: '#FFD700' }} />
        <Typography sx={{ fontSize: FONT.section, fontWeight: 700, color: 'text.primary' }}>
          Recent God Packs
        </Typography>
        <Chip label={godPacks.length} size="small" sx={{
          height: 18, fontSize: '0.6rem', fontWeight: 700,
          bgcolor: 'rgba(255,215,0,0.1)', color: '#FFD700',
        }} />
        <Typography
          sx={{
            ml: 'auto', cursor: 'pointer', fontSize: FONT.label,
            color: theme.palette.primary.main, fontWeight: 600,
            '&:hover': { textDecoration: 'underline' },
          }}
          onClick={() => navigate('/godpacks')}
        >
          View all →
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5, '&::-webkit-scrollbar': { height: 0 } }}>
        {godPacks.slice(0, 8).map((gp, idx) => {
          const statusColor = GP_STATUS_COLORS[gp.packStatus] || GP_STATUS_COLORS.PENDING
          const containerColor = getContainerColor(gp.containerGroup)
          return (
            <Box
              key={gp.id || idx}
              onClick={() => navigate('/godpacks')}
              sx={{
                minWidth: 100, p: 1.5, borderRadius: '10px', cursor: 'pointer',
                bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)',
                border: `1px solid ${statusColor}15`,
                borderTop: `2px solid ${statusColor}`,
                transition: 'border-color 0.2s, box-shadow 0.2s',
                '&:hover': { borderColor: `${statusColor}50`, boxShadow: `0 2px 12px ${statusColor}15` },
                flexShrink: 0, textAlign: 'center',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, mb: 0.75 }}>
                {gp.containerGroup && (
                  <Chip label={`C${gp.containerGroup}`} size="small" sx={{
                    height: 16, fontSize: '0.5rem', fontWeight: 700,
                    bgcolor: `${containerColor}15`, color: containerColor,
                    border: `1px solid ${containerColor}20`,
                  }} />
                )}
                <Chip label={gp.packStatus || 'PENDING'} size="small" sx={{
                  height: 16, fontSize: '0.5rem', fontWeight: 700,
                  bgcolor: `${statusColor}15`, color: statusColor,
                }} />
              </Box>
              <Typography sx={{ fontSize: '0.6rem', color: 'text.secondary', fontWeight: 500 }}>
                {timeAgo(gp.discoveredAt)}
              </Typography>
            </Box>
          )
        })}
      </Box>
    </Box>
  )
})

GodPackTimeline.displayName = 'GodPackTimeline'
export default GodPackTimeline
