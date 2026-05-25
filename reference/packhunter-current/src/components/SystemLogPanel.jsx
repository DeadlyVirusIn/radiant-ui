/**
 * SystemLogPanel — Shared two-panel log viewer for system/PM2 log files.
 *
 * Used by both LogViewer (admin page) and TeamLogs (tab 2).
 *
 * Props:
 *   logs            - raw log content string
 *   selectedFile    - currently selected file object ({ name, sizeHuman, modified, type })
 *   files           - array of file objects for the sidebar list
 *   onFileSelect    - (file) => void — called when a file is clicked
 *   onRefresh       - () => void — called when refresh is requested
 *   loading         - boolean — show spinner in content area
 *   lineCount       - number — current tail line count (100/200/500/1000)
 *   onLineCountChange - (value) => void
 *   searchQuery     - string — current search filter
 *   onSearchChange  - (value) => void
 *   onCopy          - () => void
 *   onDownload      - () => void
 *   onClear         - (file) => void — opens clear confirmation for a file
 *   autoRefresh     - boolean
 *   onAutoRefreshToggle - (checked) => void
 *   height          - optional override for panel height (default 'calc(100vh - 200px)')
 *   copied          - boolean — show check icon on copy button
 *   emptyIcon       - optional icon element for the empty state
 *   labels          - optional object to override default labels
 */

import { useState, useRef, useMemo, memo } from 'react'
import {
  Box,
  Typography,
  Grid,
  CircularProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  TextField,
  InputAdornment,
  Chip,
  useTheme,
} from '@mui/material'
import {
  Description as LogIcon,
  Error as ErrorIcon,
  Search as SearchIcon,
  Download as DownloadIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material'
import Button from '@mui/material/Button'
import { EmptyState } from './EmptyState'

// Correlation ID pattern: [shinedust-abc123-def456] or [fill_missing-abc123-def456]
const CORRELATION_RE = /\[((?:shinedust|fill_missing)-[a-z0-9]+-[a-z0-9]+)\]/g

// Memoized log line component — prevents re-rendering all lines when one changes
const LogLine = memo(function LogLine({ line, idx, getLineColor, isDark, theme, onFilterByCorrelation }) {
  const lineColor = getLineColor(line)
  const isError = lineColor === theme.palette.error.main
  const isWarn = lineColor === theme.palette.warning.main
  const isSuccess = lineColor === theme.palette.success.main
  const hasAccent = isError || isWarn || isSuccess
  const borderColor = isError ? theme.palette.error.main : isWarn ? theme.palette.warning.main : isSuccess ? theme.palette.success.main : 'transparent'

  // Render line with clickable correlation IDs
  const renderLineContent = () => {
    if (!onFilterByCorrelation) return line
    const parts = []
    let lastIndex = 0
    let match
    const re = new RegExp(CORRELATION_RE.source, 'g')
    while ((match = re.exec(line)) !== null) {
      if (match.index > lastIndex) parts.push(line.slice(lastIndex, match.index))
      const corrId = match[1]
      parts.push(
        <Chip
          key={match.index}
          component="span"
          label={corrId}
          size="small"
          onClick={(e) => { e.stopPropagation(); onFilterByCorrelation(corrId); }}
          sx={{
            height: 16, fontSize: '9px', fontFamily: 'monospace', cursor: 'pointer',
            bgcolor: theme.palette.primary.main + '22', color: theme.palette.primary.main,
            '&:hover': { bgcolor: theme.palette.primary.main + '44' },
            mx: 0.25, verticalAlign: 'text-bottom',
          }}
        />
      )
      lastIndex = re.lastIndex
    }
    if (lastIndex < line.length) parts.push(line.slice(lastIndex))
    return parts.length > 0 ? parts : line
  }

  return (
    <Box
      sx={{
        color: lineColor,
        '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' },
        px: 1, py: '1px', borderRadius: '4px',
        borderLeft: hasAccent ? `3px solid ${borderColor}` : '3px solid transparent',
        bgcolor: hasAccent ? (isDark ? `${borderColor}12` : `${borderColor}08`) : 'transparent',
      }}
    >
      <Typography component="span" sx={{ color: 'text.disabled', mr: 2, userSelect: 'none', fontSize: '10px', fontFamily: 'monospace' }}>
        {String(idx + 1).padStart(4, ' ')}
      </Typography>
      {renderLineContent()}
    </Box>
  )
})
import { formatRelativeTime, formatDateTime } from '../utils/dateFormat'
import { useSectionStyles } from './SectionCard'

export default function SystemLogPanel({
  logs = '',
  selectedFile,
  files = [],
  onFileSelect,
  onRefresh,
  loading = false,
  lineCount = 200,
  onLineCountChange,
  searchQuery = '',
  onSearchChange,
  onCopy,
  onDownload,
  onClear,
  autoRefresh = false,
  onAutoRefreshToggle,
  height = 'calc(100vh - 200px)',
  copied = false,
  emptyIcon,
  labels = {},
}) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const logContainerRef = useRef(null)
  const { sectionBox } = useSectionStyles()

  // Merge default labels with overrides
  const l = {
    logFiles: 'Log Files',
    selectLogFile: 'Select a log file',
    selectLogPrompt: 'Choose a file from the list to view its contents',
    emptyLog: 'This log file is empty',
    autoRefreshLabel: 'Auto',
    autoRefreshOn: 'Auto-refresh: ON (5s)',
    autoRefreshOff: 'Auto-refresh: OFF',
    lines: 'Lines',
    copy: 'Copy',
    copied: 'Copied!',
    download: 'Download',
    clearLog: 'Clear log file',
    size: 'Size',
    modified: 'Modified',
    noLogsFound: 'No system log files found',
    ...labels,
  }

  // Card style derived from section styles
  const cardSx = {
    borderRadius: sectionBox.borderRadius,
    border: sectionBox.border,
    bgcolor: sectionBox.bgcolor,
  }

  const borderThin = isDark ? 'rgba(124,138,255,0.08)' : 'rgba(0,0,0,0.06)'

  const LINE_CAP = 500
  const [showAll, setShowAll] = useState(false)

  // Split and filter log lines (memoized)
  const allLines = useMemo(() => {
    const lines = logs ? logs.split('\n') : []
    if (!searchQuery) return lines
    return lines.filter((line) => line.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [logs, searchQuery])

  const visibleLines = showAll ? allLines : allLines.slice(0, LINE_CAP)
  const isCapped = allLines.length > LINE_CAP && !showAll

  // Legacy compat: filteredContent as string for non-rendering checks
  const filteredContent = allLines.length > 0 ? 'has-content' : ''

  // Syntax-highlight a log line by content
  const getLineColor = (line) => {
    const lower = line.toLowerCase()
    if (lower.includes('error') || lower.includes('exception') || lower.includes('failed')) {
      return theme.palette.error.main
    }
    if (lower.includes('warn')) {
      return theme.palette.warning.main
    }
    if (lower.includes('success') || lower.includes('completed')) {
      return theme.palette.success.main
    }
    return 'inherit'
  }

  return (
    <Grid container spacing={2}>
      {/* ---- File list (left panel) ---- */}
      <Grid item xs={12} md={4}>
        <Box sx={{ ...cardSx, height, overflow: 'auto', p: 0 }}>
          <Box sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${borderThin}` }}>
            <Typography variant="subtitle1" fontWeight={700}>
              {l.logFiles}
            </Typography>
          </Box>
          <Box sx={{ p: 1.5 }}>
            {files.length === 0 ? (
              <EmptyState title="No Log Files" description={l.noLogsFound} minHeight={150} />
            ) : (
              <List dense disablePadding>
                {files.map((log) => (
                  <ListItem
                    key={log.name}
                    button
                    selected={selectedFile?.name === log.name}
                    onClick={() => onFileSelect?.(log)}
                    sx={{
                      borderRadius: '10px',
                      mb: 0.5,
                      border: '1px solid',
                      borderColor:
                        selectedFile?.name === log.name
                          ? 'primary.main'
                          : borderThin,
                      bgcolor:
                        selectedFile?.name === log.name
                          ? isDark
                            ? 'rgba(124,138,255,0.1)'
                            : 'rgba(92,106,196,0.06)'
                          : 'transparent',
                      '&:hover': {
                        bgcolor: isDark ? 'rgba(124,138,255,0.06)' : 'rgba(0,0,0,0.03)',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      {log.type === 'error' ? (
                        <ErrorIcon color="error" fontSize="small" />
                      ) : (
                        <LogIcon color="action" fontSize="small" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Typography variant="body2" fontWeight={500} noWrap>
                          {log.name}
                        </Typography>
                      }
                      secondary={
                        <Box>
                          <Typography variant="caption" display="block" color="text.secondary">
                            {log.sizeHuman}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {formatRelativeTime(log.modified)}
                          </Typography>
                        </Box>
                      }
                    />
                    <ListItemSecondaryAction>
                      <Tooltip title={l.clearLog}>
                        <IconButton
                          size="small"
                          aria-label="Clear log"
                          onClick={(e) => {
                            e.stopPropagation()
                            onClear?.(log)
                          }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </Box>
      </Grid>

      {/* ---- Log content (right panel) ---- */}
      <Grid item xs={12} md={8}>
        <Box sx={{ ...cardSx, height, display: 'flex', flexDirection: 'column', p: 0 }}>
          {/* Content header */}
          <Box sx={{ px: 2.5, py: 2, borderBottom: `1px solid ${borderThin}` }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
              <Typography variant="subtitle1" fontWeight={700} noWrap sx={{ flex: 1 }}>
                {selectedFile ? selectedFile.name : l.selectLogFile}
              </Typography>

              {selectedFile && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                  {onAutoRefreshToggle && (
                    <FormControlLabel
                      control={
                        <Switch
                          checked={autoRefresh}
                          onChange={(e) => onAutoRefreshToggle(e.target.checked)}
                          size="small"
                        />
                      }
                      label={<Typography variant="caption">{l.autoRefreshLabel}</Typography>}
                    />
                  )}

                  <FormControl size="small" sx={{ minWidth: 90 }}>
                    <InputLabel>{l.lines}</InputLabel>
                    <Select
                      value={lineCount}
                      onChange={(e) => onLineCountChange?.(e.target.value)}
                      label={l.lines}
                    >
                      <MenuItem value={100}>100</MenuItem>
                      <MenuItem value={200}>200</MenuItem>
                      <MenuItem value={500}>500</MenuItem>
                      <MenuItem value={1000}>1000</MenuItem>
                    </Select>
                  </FormControl>

                  {onCopy && (
                    <Tooltip title={copied ? l.copied : l.copy}>
                      <IconButton onClick={onCopy} size="small" aria-label="Copy logs">
                        {copied ? <CheckIcon fontSize="small" /> : <CopyIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                  )}

                  {onDownload && (
                    <Tooltip title={l.download}>
                      <IconButton onClick={onDownload} size="small" aria-label="Download logs">
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              )}
            </Box>

            {selectedFile && (
              <TextField
                fullWidth
                size="small"
                placeholder="Search in log content..."
                value={searchQuery}
                onChange={(e) => onSearchChange?.(e.target.value)}
                sx={{ mt: 1.5 }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
            )}
          </Box>

          {/* Log output */}
          <Box
            ref={logContainerRef}
            sx={{
              flex: 1,
              overflow: 'auto',
              bgcolor: isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
              p: 2,
              fontFamily: 'monospace',
              fontSize: '12px',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
            }}
          >
            {!selectedFile ? (
              <EmptyState
                title="Select a Log File"
                description={l.selectLogPrompt}
                icon={emptyIcon || <LogIcon sx={{ fontSize: 48 }} />}
                minHeight={200}
              />
            ) : loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : !filteredContent ? (
              <EmptyState title="Empty Log" description={l.emptyLog} minHeight={150} />
            ) : (
              <>
                {visibleLines.map((line, idx) => (
                  <LogLine key={idx} line={line} idx={idx} getLineColor={getLineColor} isDark={isDark} theme={theme}
                    onFilterByCorrelation={onSearchChange ? (corrId) => onSearchChange(corrId) : undefined}
                  />
                ))}
                {isCapped && (
                  <Box sx={{ textAlign: 'center', py: 2, borderTop: `1px solid ${borderThin}` }}>
                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                      Showing {LINE_CAP} of {allLines.length} lines
                    </Typography>
                    <Button size="small" variant="outlined" onClick={() => setShowAll(true)}>
                      Show All {allLines.length} Lines
                    </Button>
                  </Box>
                )}
              </>
            )}
          </Box>

          {/* Status bar */}
          {selectedFile && (
            <Box
              sx={{
                px: 2.5,
                py: 1,
                borderTop: `1px solid ${borderThin}`,
                bgcolor: isDark ? 'rgba(0,0,0,0.15)' : 'rgba(0,0,0,0.02)',
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {autoRefresh ? l.autoRefreshOn : l.autoRefreshOff} |&nbsp;
                {l.size}: {selectedFile.sizeHuman} |&nbsp;
                {l.modified}: {formatDateTime(selectedFile.modified)}
              </Typography>
            </Box>
          )}
        </Box>
      </Grid>
    </Grid>
  )
}
