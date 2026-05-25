import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FadeIn } from '../components/Animations'
import {
  Box,
  Typography,
  Tabs,
  Tab,
  TextField,
  MenuItem,
  IconButton,
  Tooltip,
  Chip,
  Button,
  CircularProgress,
  Alert,
  Snackbar,
  FormControlLabel,
  Switch,
  Stack,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Grid,
  FormControl,
  InputLabel,
  Select,
  InputAdornment,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import {
  Refresh as RefreshIcon,
  ContentCopy as CopyIcon,
  Download as DownloadIcon,
  Delete as DeleteIcon,
  Search as SearchIcon,
  Article as LogsIcon,
  Description as LogFileIcon,
  Error as ErrorIcon,
  Check as CheckIcon,
} from '@mui/icons-material'
import { fetchWithAuth } from '../services/api'
import { formatRelativeTime, formatDateTime } from '../utils/dateFormat'
import { EmptyState } from '../components/EmptyState'
import PageHeader from '../components/PageHeader'
import SystemLogPanel from '../components/SystemLogPanel'
import { useSectionStyles } from '../components/SectionCard'

const PAGE_SIZE = 200

// System logs API (reads raw log files from disk)
const systemLogsApi = {
  list: () => fetch('/api/admin/logs', {
    credentials: 'include'
  }).then(r => r.json()),

  tail: (filename, lines = 200) => fetch(`/api/admin/logs/${encodeURIComponent(filename)}/tail?lines=${lines}`, {
    credentials: 'include'
  }).then(r => r.json()),

  clear: (filename) => fetch(`/api/admin/logs/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
    credentials: 'include'
  }).then(r => r.json()),
}

function formatTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

export default function TeamLogs({ user }) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const isDark = theme.palette.mode === 'dark'
  const logContainerRef = useRef(null)

  const LEVEL_COLORS = {
    info: theme.palette.info.main,
    warn: theme.palette.warning.main,
    error: theme.palette.error.main,
    success: theme.palette.success.main,
    godpack: theme.palette.secondary.main,
  }

  const LEVEL_BG = {
    info: `${theme.palette.info.main}14`,
    warn: `${theme.palette.warning.main}14`,
    error: `${theme.palette.error.main}1F`,
    success: `${theme.palette.success.main}14`,
    godpack: `${theme.palette.secondary.main}1F`,
  }

  const { sectionBox: cardSx } = useSectionStyles()

  // --- Shared state ---
  // Wave 7: ?tab=hunt|bot|system. Numeric index kept internally for the
  // <Tabs> component but URL uses readable names. Default 'hunt'.
  const TAB_NAMES = ['hunt', 'bot', 'system']
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = useMemo(() => {
    const fromUrl = searchParams.get('tab')
    const idx = TAB_NAMES.indexOf(fromUrl)
    return idx >= 0 ? idx : 0
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const [tab, setTabState] = useState(initialTab)
  const setTab = (next) => {
    setTabState(next)
    const sp = new URLSearchParams(searchParams)
    if (next === 0) sp.delete('tab')
    else sp.set('tab', TAB_NAMES[next] || String(next))
    setSearchParams(sp, { replace: true })
  }
  const [error, setError] = useState(null)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const intervalRef = useRef(null)

  // --- Hunt/Bot logs state (tabs 0 & 1) ---
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [huntType, setHuntType] = useState('')
  const [instanceId, setInstanceId] = useState('')
  const [level, setLevel] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')

  // --- System logs state (tab 2) ---
  const [sysLogFiles, setSysLogFiles] = useState([])
  const [sysSelectedLog, setSysSelectedLog] = useState(null)
  const [sysLogContent, setSysLogContent] = useState('')
  const [sysLoading, setSysLoading] = useState(false)
  const [sysLineCount, setSysLineCount] = useState(200)
  const [sysSearchTerm, setSysSearchTerm] = useState('')
  const [sysConfirmClear, setSysConfirmClear] = useState(null)
  const [sysCopied, setSysCopied] = useState(false)
  const [sysSuccess, setSysSuccess] = useState('')

  // ========================
  // Hunt/Bot logs (tabs 0/1)
  // ========================

  const fetchLogs = useCallback(async (append = false) => {
    if (tab === 2) return
    setLoading(true)
    setError(null)
    try {
      const offset = append ? logs.length : 0
      const params = new URLSearchParams()
      if (level) params.set('level', level)
      if (search) params.set('search', search)
      params.set('limit', String(PAGE_SIZE))
      params.set('offset', String(offset))

      let url
      if (tab === 0) {
        if (huntType) params.set('huntType', huntType)
        if (instanceId !== '') params.set('instanceId', instanceId)
        url = `/hunt-logs?${params}`
      } else {
        url = `/hunt-logs/bot-logs?${params}`
      }

      const res = await fetchWithAuth(url)
      const data = await res.json()

      if (data.success) {
        setLogs(prev => append ? [...prev, ...data.logs] : data.logs)
        setTotal(data.total)
      } else {
        setError(data.error || 'Failed to fetch logs')
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [tab, huntType, instanceId, level, search, logs.length])

  // Reset & fetch when filters or tab change (tabs 0/1 only)
  useEffect(() => {
    if (tab === 2) return
    setLogs([])
    setTotal(0)
    fetchLogs(false)
  }, [tab, huntType, instanceId, level, search]) // eslint-disable-line react-hooks/exhaustive-deps

  // ========================
  // System logs (tab 2)
  // ========================

  const loadSysLogFiles = useCallback(async () => {
    try {
      const result = await systemLogsApi.list()
      if (result.success) {
        setSysLogFiles(result.logs)
      } else {
        setError(result.error || 'Failed to load log files')
      }
    } catch (err) {
      setError('Failed to load log files')
    }
  }, [])

  const loadSysLogContent = useCallback(async () => {
    if (!sysSelectedLog) return
    try {
      setSysLoading(true)
      const result = await systemLogsApi.tail(sysSelectedLog.name, sysLineCount)
      if (result.success) {
        setSysLogContent(result.content)
        if (logContainerRef.current) {
          logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
        }
      } else {
        setError(result.error || 'Failed to load log content')
      }
    } catch (err) {
      setError('Failed to load log content')
    } finally {
      setSysLoading(false)
    }
  }, [sysSelectedLog, sysLineCount])

  // Load system log files when tab 2 is selected
  useEffect(() => {
    if (tab === 2) {
      loadSysLogFiles()
    }
  }, [tab, loadSysLogFiles])

  // Load content when a system log file is selected
  useEffect(() => {
    if (sysSelectedLog) {
      loadSysLogContent()
    }
  }, [sysSelectedLog, loadSysLogContent])

  // ========================
  // Auto-refresh (all tabs)
  // ========================

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (autoRefresh) {
      if (tab === 2) {
        if (sysSelectedLog) {
          intervalRef.current = setInterval(loadSysLogContent, 5000)
        }
      } else {
        intervalRef.current = setInterval(() => fetchLogs(false), 5000)
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [autoRefresh, tab, fetchLogs, loadSysLogContent, sysSelectedLog])

  // ========================
  // Actions: Hunt/Bot
  // ========================

  const handleCopy = () => {
    const text = logs.map(l => {
      const time = new Date(l.created_at).toISOString()
      if (tab === 0) {
        return `[${time}] [${l.level}] [${l.hunt_type}${l.instance_id != null ? `:${l.instance_id}` : ''}] ${l.message}`
      }
      return `[${time}] [${l.level}] [${l.username || `user:${l.user_id}`}] ${l.message}`
    }).join('\n')
    navigator.clipboard.writeText(text)
  }

  const handleDownload = () => {
    const text = logs.map(l => {
      const time = new Date(l.created_at).toISOString()
      if (tab === 0) {
        return `[${time}] [${l.level}] [${l.hunt_type}${l.instance_id != null ? `:${l.instance_id}` : ''}] ${l.message}`
      }
      return `[${time}] [${l.level}] [${l.username || `user:${l.user_id}`}] ${l.message}`
    }).join('\n')
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `team-logs-${tab === 0 ? 'hunt' : 'bot'}-${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleClear = async () => {
    if (!window.confirm('Delete all hunt logs?')) return
    try {
      const res = await fetchWithAuth('/hunt-logs', { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setLogs([])
        setTotal(0)
      }
    } catch (err) {
      setError(err.message)
    }
  }

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    setSearch(searchInput)
  }

  // ========================
  // Actions: System Logs
  // ========================

  const handleSysCopy = () => {
    navigator.clipboard.writeText(sysFilteredContent)
    setSysCopied(true)
    setTimeout(() => setSysCopied(false), 2000)
  }

  const handleSysDownload = () => {
    if (!sysSelectedLog || !sysLogContent) return
    const blob = new Blob([sysLogContent], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = sysSelectedLog.name
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleSysClearLog = async () => {
    if (!sysConfirmClear) return
    try {
      const result = await systemLogsApi.clear(sysConfirmClear.name)
      if (result.success) {
        setSysSuccess(`Log file ${sysConfirmClear.name} cleared`)
        setSysLogContent('')
        loadSysLogFiles()
      } else {
        setError(result.error || 'Failed to clear log')
      }
    } catch (err) {
      setError('Failed to clear log file')
    }
    setSysConfirmClear(null)
  }

  // Filter system log content by search
  const sysFilteredContent = sysSearchTerm
    ? sysLogContent.split('\n').filter(line =>
        line.toLowerCase().includes(sysSearchTerm.toLowerCase())
      ).join('\n')
    : sysLogContent

  // ========================
  // Refresh handler (shared)
  // ========================

  const handleRefresh = () => {
    if (tab === 2) {
      loadSysLogFiles()
      if (sysSelectedLog) loadSysLogContent()
    } else {
      fetchLogs(false)
    }
  }

  return (
    <FadeIn>
    <Box>
      {/* Header */}
      <PageHeader
        icon={<LogsIcon />}
        title="Activity Logs"
        subtitle="Hunt, bot, and system log viewer"
        action={
          <Stack direction="row" spacing={1} alignItems="center">
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  checked={autoRefresh}
                  onChange={e => setAutoRefresh(e.target.checked)}
                />
              }
              label={<Typography variant="caption">Auto-refresh</Typography>}
            />
            <Tooltip title="Refresh">
              <IconButton onClick={handleRefresh} size="small" aria-label="Refresh logs">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
            {tab !== 2 && (
              <>
                <Tooltip title="Copy to clipboard">
                  <IconButton onClick={handleCopy} size="small" disabled={logs.length === 0} aria-label="Copy to clipboard">
                    <CopyIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Download as .txt">
                  <IconButton onClick={handleDownload} size="small" disabled={logs.length === 0} aria-label="Download logs">
                    <DownloadIcon />
                  </IconButton>
                </Tooltip>
              </>
            )}
            {tab === 2 && sysSelectedLog && (
              <>
                <Tooltip title={sysCopied ? 'Copied!' : 'Copy to clipboard'}>
                  <IconButton onClick={handleSysCopy} size="small" aria-label="Copy system logs">
                    {sysCopied ? <CheckIcon /> : <CopyIcon />}
                  </IconButton>
                </Tooltip>
                <Tooltip title="Download log file">
                  <IconButton onClick={handleSysDownload} size="small" aria-label="Download system log">
                    <DownloadIcon />
                  </IconButton>
                </Tooltip>
              </>
            )}
            {user?.isAdmin && tab === 0 && (
              <Tooltip title="Clear hunt logs">
                <IconButton onClick={handleClear} size="small" color="error" aria-label="Clear hunt logs">
                  <DeleteIcon />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        }
      />

      {/* Tabs */}
      <Box
        sx={{
          ...cardSx,
          mb: 2,
          overflow: 'hidden',
        }}
      >
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant={isMobile ? 'scrollable' : 'standard'} scrollButtons="auto">
          <Tab label="Hunt Logs" />
          <Tab label="Bot Logs" />
          {user?.isAdmin && <Tab label="System Logs" />}
        </Tabs>
      </Box>

      {/* ======== Tabs 0 & 1: Hunt/Bot Logs ======== */}
      {tab !== 2 && (
        <>
          {/* Filters */}
          <Box sx={{ ...cardSx, p: 2, mb: 2 }}>
            <Stack direction="row" spacing={2} flexWrap="wrap" alignItems="center" useFlexGap>
              {tab === 0 && (
                <>
                  <TextField
                    select size="small" label="Hunt Type" value={huntType}
                    onChange={e => setHuntType(e.target.value)}
                    sx={{ minWidth: 130 }}
                  >
                    <MenuItem value="">All</MenuItem>
                    <MenuItem value="reroll">Reroll</MenuItem>
                  </TextField>
                  <TextField
                    size="small" label="Instance" type="number" value={instanceId}
                    onChange={e => setInstanceId(e.target.value)}
                    sx={{ width: 100 }}
                    inputProps={{ min: 0 }}
                  />
                </>
              )}
              <TextField
                select size="small" label="Level" value={level}
                onChange={e => setLevel(e.target.value)}
                sx={{ minWidth: 120 }}
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="info">Info</MenuItem>
                <MenuItem value="warn">Warn</MenuItem>
                <MenuItem value="error">Error</MenuItem>
                <MenuItem value="success">Success</MenuItem>
                {tab === 0 && <MenuItem value="godpack">God Pack</MenuItem>}
              </TextField>
              <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: 8 }}>
                <TextField
                  size="small" label="Search" value={searchInput}
                  onChange={e => setSearchInput(e.target.value)}
                  sx={{ minWidth: 200 }}
                />
                <IconButton type="submit" size="small" aria-label="Search logs">
                  <SearchIcon />
                </IconButton>
              </form>
              <Chip
                label={`${total.toLocaleString()} total`}
                size="small"
                variant="outlined"
              />
            </Stack>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>{error}</Alert>
          )}

          {/* Log entries */}
          <Box
            sx={{
              ...cardSx,
              fontFamily: 'monospace',
              fontSize: 13,
              maxHeight: 'calc(100vh - 340px)',
              overflow: 'auto',
              p: 1,
            }}
          >
            {logs.length === 0 && !loading && (
              <EmptyState
                title="No Logs Found"
                description="Adjust your filters or wait for new log entries"
                minHeight={150}
              />
            )}
            {logs.map(log => {
              const lvl = (log.level || 'info').toLowerCase()
              const color = LEVEL_COLORS[lvl] || theme.palette.text.primary
              const bg = LEVEL_BG[lvl] || 'transparent'
              return (
                <Box
                  key={log.id}
                  sx={{
                    px: 1,
                    py: 0.3,
                    bgcolor: bg,
                    borderLeft: `3px solid ${color}`,
                    mb: '1px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    borderRadius: '0 4px 4px 0',
                    '&:hover': {
                      bgcolor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                    },
                  }}
                >
                  <span style={{ color: theme.palette.text.secondary }}>{formatTime(log.created_at)}</span>
                  {' '}
                  <span style={{ color, fontWeight: 600 }}>[{lvl.toUpperCase()}]</span>
                  {' '}
                  {tab === 0 ? (
                    <>
                      <span style={{ color: theme.palette.info.main }}>
                        [{log.hunt_type}{log.instance_id != null ? `:${log.instance_id}` : ''}]
                      </span>
                      {' '}
                    </>
                  ) : (
                    <>
                      <span style={{ color: theme.palette.info.main }}>
                        [{log.username || `user:${log.user_id}`}{log.bot_instance_id != null ? `:bot${log.bot_instance_id}` : ''}]
                      </span>
                      {' '}
                    </>
                  )}
                  <span>{log.message}</span>
                  {log.context && (
                    <span style={{ color: theme.palette.text.secondary, marginLeft: 8 }}>
                      {typeof log.context === 'string' ? log.context : JSON.stringify(log.context)}
                    </span>
                  )}
                </Box>
              )
            })}
            {loading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            )}
          </Box>

          {/* Load more */}
          {logs.length < total && !loading && (
            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Button variant="outlined" onClick={() => fetchLogs(true)} sx={{ borderRadius: '10px' }}>
                Load More ({logs.length} / {total.toLocaleString()})
              </Button>
            </Box>
          )}
        </>
      )}

      {/* ======== Tab 2: System Logs ======== */}
      {tab === 2 && (
        <>
          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }}>{error}</Alert>
          )}

          <SystemLogPanel
            logs={sysLogContent}
            selectedFile={sysSelectedLog}
            files={sysLogFiles}
            onFileSelect={setSysSelectedLog}
            loading={sysLoading}
            lineCount={sysLineCount}
            onLineCountChange={setSysLineCount}
            searchQuery={sysSearchTerm}
            onSearchChange={setSysSearchTerm}
            onCopy={handleSysCopy}
            onDownload={handleSysDownload}
            onClear={setSysConfirmClear}
            autoRefresh={autoRefresh}
            height="calc(100vh - 280px)"
            copied={sysCopied}
          />

          {/* Clear Confirmation Dialog */}
          <Dialog open={!!sysConfirmClear} onClose={() => setSysConfirmClear(null)}>
            <DialogTitle>Clear Log File</DialogTitle>
            <DialogContent>
              <Typography>
                Are you sure you want to clear "{sysConfirmClear?.name}"?
                <br />
                This action cannot be undone.
              </Typography>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setSysConfirmClear(null)}>Cancel</Button>
              <Button color="error" variant="contained" onClick={handleSysClearLog}>
                Clear Log
              </Button>
            </DialogActions>
          </Dialog>

          {/* Success snackbar */}
          <Snackbar
            open={!!sysSuccess}
            autoHideDuration={4000}
            onClose={() => setSysSuccess('')}
            message={sysSuccess}
          />
        </>
      )}
    </Box>
    </FadeIn>
  )
}
