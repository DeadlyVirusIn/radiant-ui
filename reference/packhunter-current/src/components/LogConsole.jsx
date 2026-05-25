import { useRef, useEffect } from 'react'
import { Box, Typography, IconButton, Tooltip, useTheme } from '@mui/material'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'

/**
 * LogConsole — shared monospace scrollable log panel.
 * Replaces duplicated log console patterns in Bot, BotHub, Tasks, Missions.
 *
 * Usage:
 *   <LogConsole
 *     logs={logLines}           // array of strings or { message, level, timestamp } objects
 *     maxHeight={300}
 *     onClear={() => setLogs([])}
 *     title="Logs"
 *   />
 */

function getLogColor(line, theme) {
  const text = typeof line === 'string' ? line : (line.message || '')
  const level = typeof line === 'string' ? null : line.level
  if (level === 'error' || /error|fail|exception/i.test(text)) return theme.palette.error.main
  if (level === 'warn' || /warn|timeout/i.test(text)) return theme.palette.warning.main
  if (level === 'success' || /success|complete|done|found/i.test(text)) return theme.palette.success.main
  if (level === 'info' || /info|start|connect/i.test(text)) return theme.palette.info?.main || theme.palette.primary.main
  return theme.palette.text.secondary
}

export default function LogConsole({
  logs = [],
  maxHeight = 300,
  onClear,
  title = 'Logs',
  sx,
}) {
  const theme = useTheme()
  const g = theme.custom.glass
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs.length])

  const handleCopy = () => {
    const text = logs.map(l => typeof l === 'string' ? l : l.message).join('\n')
    navigator.clipboard.writeText(text)
  }

  return (
    <Box
      sx={{
        borderRadius: `${theme.custom.radius.lg}px`,
        border: `1px solid ${g.border}`,
        bgcolor: g.cardBg,
        overflow: 'hidden',
        ...sx,
      }}
    >
      {/* Header */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        px: 2,
        py: 1,
        borderBottom: `1px solid ${g.border}`,
      }}>
        <Typography variant="caption" sx={{ fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          {title}
          {logs.length > 0 && (
            <Typography component="span" variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
              ({logs.length})
            </Typography>
          )}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Copy logs">
            <IconButton size="small" onClick={handleCopy} disabled={!logs.length}>
              <ContentCopyIcon sx={{ fontSize: '1rem' }} />
            </IconButton>
          </Tooltip>
          {onClear && (
            <Tooltip title="Clear logs">
              <IconButton size="small" onClick={onClear} disabled={!logs.length}>
                <DeleteOutlineIcon sx={{ fontSize: '1rem' }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Box>

      {/* Log content */}
      <Box
        sx={{
          maxHeight,
          overflowY: 'auto',
          p: 1.5,
          fontFamily: theme.custom.monoFontFamily,
          fontSize: '0.75rem',
          lineHeight: 1.6,
          '&::-webkit-scrollbar': { width: 6 },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: g.glow?.['15'] || 'rgba(124, 138, 255, 0.15)',
            borderRadius: 3,
          },
        }}
      >
        {logs.length === 0 ? (
          <Typography variant="caption" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>
            No logs yet...
          </Typography>
        ) : (
          logs.map((line, i) => {
            const text = typeof line === 'string' ? line : line.message
            const color = getLogColor(line, theme)
            return (
              <Box key={i} sx={{ color, py: 0.25, wordBreak: 'break-all' }}>
                {text}
              </Box>
            )
          })
        )}
        <div ref={bottomRef} />
      </Box>
    </Box>
  )
}
