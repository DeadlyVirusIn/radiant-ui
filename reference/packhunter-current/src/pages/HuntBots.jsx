/**
 * Hunt Bots Admin Page
 * Shows bot health per hunt container participant with proxy slot management
 * and bot start/stop/restart controls.
 */
import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, Button, Chip, Snackbar, Alert, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, Dialog, DialogTitle,
  DialogContent, DialogActions, Select, MenuItem, FormControl, InputLabel,
  Tooltip, IconButton, CircularProgress, Collapse,
} from '@mui/material'
import {
  Refresh as RefreshIcon,
  SwapHoriz as SwapIcon,
  Circle as CircleIcon,
  PlayArrow as StartIcon,
  Stop as StopIcon,
  RestartAlt as RestartIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material'
import { useTheme } from '@mui/material'
import { FadeIn } from '../components/Animations'
import PageHeader from '../components/PageHeader'
import { useSectionStyles } from '../components/SectionCard'
import { fetchWithAuth } from '../services/api'

const containerColors = { '1': '#4caf50', '2': '#ff9800', '3': '#2196f3', '4': '#9c27b0' }

function getHealthBadge(bot) {
  if (bot.botStatus === 'offline' || !bot.botStatus || bot.botStatus === 'stopped') {
    return { color: '#6b7280', label: 'Offline' }
  }
  if (bot.heartbeatAgeSec !== null && bot.heartbeatAgeSec > 120) {
    return { color: '#ef4444', label: 'Stale' }
  }
  if (!bot.proxySlotId && bot.proxySlotId !== 0) {
    return { color: '#ef4444', label: 'No Slot' }
  }
  // Use metrics if available
  if (bot.botStatus === 'running' && bot.acceptsPer60s !== null && bot.acceptsPer60s !== undefined) {
    const accepts = bot.acceptsPer60s
    const accErrors = bot.consecutiveAcceptErrors || 0
    if (accErrors >= 10 || accepts < 20) return { color: '#ef4444', label: 'Struggling' }
    if (accErrors >= 3 || accepts < 40) return { color: '#fbbf24', label: 'Warning' }
    return { color: '#34d399', label: 'Healthy' }
  }
  if (bot.botStatus === 'running') {
    return { color: '#34d399', label: 'Running' }
  }
  return { color: '#fbbf24', label: bot.botStatus || '?' }
}

export default function HuntBots() {
  const theme = useTheme()
  const { sectionBox, tableContainerStyle, tableHeadStyle } = useSectionStyles()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Reassign dialog state
  const [reassignDialog, setReassignDialog] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState('')
  const [reassigning, setReassigning] = useState(false)

  // Bot action loading (per bot key)
  const [botActionLoading, setBotActionLoading] = useState({})

  // Collapsed containers (all expanded by default)
  const [collapsed, setCollapsed] = useState({})
  const toggleContainer = (g) => setCollapsed(prev => ({ ...prev, [g]: !prev[g] }))

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetchWithAuth('/admin/hunt-bot-health')
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
    } catch (err) {
      setError(err.message || 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Auto-refresh every 30s
  useEffect(() => {
    const interval = setInterval(() => {
      fetchWithAuth('/admin/hunt-bot-health')
        .then(r => r.json())
        .then(json => { if (!json.error) setData(json) })
        .catch(() => {})
    }, 30000)
    return () => clearInterval(interval)
  }, [])

  const handleReassign = async () => {
    if (!reassignDialog || selectedSlot === '') return
    setReassigning(true)
    try {
      const res = await fetchWithAuth(`/admin/users/${reassignDialog.userId}/proxy-slot`, {
        method: 'POST',
        body: JSON.stringify({ slotId: Number(selectedSlot) }),
      })
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setSuccess(`${reassignDialog.username}: slot changed to ${selectedSlot} (${json.portStart}-${json.portEnd}). Bot restart required.`)
      setReassignDialog(null)
      setSelectedSlot('')
      fetchData()
    } catch (err) {
      setError(err.message || 'Failed to reassign slot')
    } finally {
      setReassigning(false)
    }
  }

  const botAction = async (bot, action) => {
    const key = `${bot.discordId}_${action}`
    setBotActionLoading(prev => ({ ...prev, [key]: true }))
    try {
      if (action === 'restart') {
        // Stop then start
        await fetchWithAuth(`/admin/bots/${bot.playerId}/stop`, {
          method: 'POST',
          body: JSON.stringify({ accountType: bot.accountType || 'main', discordId: bot.discordId }),
        })
        // Brief pause for clean shutdown
        await new Promise(r => setTimeout(r, 2000))
        const startRes = await fetchWithAuth(`/admin/bots/${bot.playerId}/start`, {
          method: 'POST',
          body: JSON.stringify({ accountType: bot.accountType || 'main', discordId: bot.discordId }),
        })
        const startJson = await startRes.json()
        if (startJson.error) throw new Error(startJson.error)
        setSuccess(`${bot.webUsername || bot.discordUsername}: bot restarted`)
      } else if (action === 'start') {
        const res = await fetchWithAuth(`/admin/bots/${bot.playerId}/start`, {
          method: 'POST',
          body: JSON.stringify({ accountType: bot.accountType || 'main', discordId: bot.discordId }),
        })
        const json = await res.json()
        if (json.error) throw new Error(json.error)
        setSuccess(`${bot.webUsername || bot.discordUsername}: bot started`)
      } else if (action === 'stop') {
        const res = await fetchWithAuth(`/admin/bots/${bot.playerId}/stop`, {
          method: 'POST',
          body: JSON.stringify({ accountType: bot.accountType || 'main', discordId: bot.discordId }),
        })
        const json = await res.json()
        if (json.error) throw new Error(json.error)
        setSuccess(`${bot.webUsername || bot.discordUsername}: bot stopped`)
      }
      // Refresh data after action
      setTimeout(fetchData, 1500)
    } catch (err) {
      setError(`${bot.webUsername || bot.discordUsername}: ${err.message}`)
    } finally {
      setBotActionLoading(prev => ({ ...prev, [key]: false }))
    }
  }

  const containers = data?.containers || {}
  const availableSlots = data?.availableSlots || []
  const config = data?.config || {}
  const groups = Object.keys(containers).sort()

  // Summary counts
  const totalBots = groups.reduce((s, g) => s + (containers[g]?.length || 0), 0)
  const runningBots = groups.reduce((s, g) => s + (containers[g]?.filter(b => b.botStatus === 'running').length || 0), 0)

  return (
    <FadeIn>
      <Box>
        <PageHeader
          icon={<SwapIcon />}
          title="Hunt Bot Health"
          subtitle={`${runningBots}/${totalBots} bots running | ${config.portsPerWorker || '?'} ports/user | ${availableSlots.length} slots available`}
          action={
            <Button startIcon={<RefreshIcon />} onClick={fetchData} disabled={loading} variant="outlined" size="small">
              Refresh
            </Button>
          }
        />

        {loading && !data ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
        ) : (
          groups.map(g => {
            const bots = containers[g] || []
            const borderColor = containerColors[g] || theme.palette.primary.main
            const runningCount = bots.filter(b => b.botStatus === 'running').length

            return (
              <Box key={g} sx={{ ...sectionBox, mb: 3, borderTop: `3px solid ${borderColor}` }}>
                <Box
                  onClick={() => toggleContainer(g)}
                  sx={{
                    display: 'flex', alignItems: 'center', gap: 1.5, mb: collapsed[g] ? 0 : 2,
                    cursor: 'pointer', userSelect: 'none',
                    '&:hover': { opacity: 0.8 },
                  }}
                >
                  {collapsed[g] ? <ExpandMoreIcon sx={{ color: borderColor }} /> : <ExpandLessIcon sx={{ color: borderColor }} />}
                  <Typography variant="h6" fontWeight={700} sx={{ color: borderColor }}>
                    Container {g}
                  </Typography>
                  <Chip label={`${runningCount}/${bots.length} running`} size="small"
                    sx={{ bgcolor: `${borderColor}20`, color: borderColor, fontWeight: 700, fontSize: '0.7rem' }} />
                  <Chip label={bots[0]?.packName || '?'} size="small" variant="outlined"
                    sx={{ fontSize: '0.65rem' }} />
                </Box>

                <Collapse in={!collapsed[g]}>
                <TableContainer sx={tableContainerStyle}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={tableHeadStyle}>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem' }}>User</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem' }}>Slot</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem' }} align="right">Accepts/60s</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem' }} align="right">Errors</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem' }} align="right">Acc Errors</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem' }} align="right">Friends</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem' }}>Status</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem' }} align="center">Bot</TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem' }} align="center">Proxy</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {bots.map((bot, i) => {
                        const health = getHealthBadge(bot)
                        const isRunning = bot.botStatus === 'running'
                        const hasPlayerId = !!bot.playerId
                        const startLoading = botActionLoading[`${bot.discordId}_start`]
                        const stopLoading = botActionLoading[`${bot.discordId}_stop`]
                        const restartLoading = botActionLoading[`${bot.discordId}_restart`]
                        const anyLoading = startLoading || stopLoading || restartLoading

                        return (
                          <TableRow key={bot.discordId + '_' + i} hover>
                            <TableCell>
                              <Box>
                                <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.8rem' }}>
                                  {bot.webUsername || bot.discordUsername}
                                </Typography>
                                {bot.webUsername && bot.discordUsername !== bot.webUsername && (
                                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.6rem' }}>
                                    Discord: {bot.discordUsername}
                                  </Typography>
                                )}
                              </Box>
                            </TableCell>
                            <TableCell>
                              <Tooltip title={bot.portStart && bot.portEnd ? `Ports ${bot.portStart}-${bot.portEnd}` : 'No slot'}>
                                <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                                  {bot.proxySlotId !== null ? bot.proxySlotId : '-'}
                                </Typography>
                              </Tooltip>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight={700} sx={{
                                fontFamily: 'monospace', fontSize: '0.85rem',
                                color: bot.acceptsPer60s >= 50 ? '#34d399' : bot.acceptsPer60s >= 30 ? '#fbbf24' : bot.acceptsPer60s > 0 ? '#ef4444' : 'text.secondary',
                              }}>
                                {bot.acceptsPer60s !== null && bot.acceptsPer60s !== undefined ? bot.acceptsPer60s : '-'}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{
                                fontFamily: 'monospace', fontSize: '0.8rem',
                                color: (bot.totalErrors || 0) > 0 ? '#fbbf24' : 'text.secondary',
                              }}>
                                {bot.consecutiveErrors ?? '-'}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" fontWeight={(bot.consecutiveAcceptErrors || 0) >= 3 ? 700 : 400} sx={{
                                fontFamily: 'monospace', fontSize: '0.8rem',
                                color: (bot.consecutiveAcceptErrors || 0) >= 5 ? '#ef4444' : (bot.consecutiveAcceptErrors || 0) >= 1 ? '#fbbf24' : 'text.secondary',
                              }}>
                                {bot.consecutiveAcceptErrors ?? '-'}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem', color: 'text.secondary' }}>
                                {bot.currentFriendCount ?? '-'}
                              </Typography>
                            </TableCell>
                            <TableCell>
                              <Chip
                                icon={<CircleIcon sx={{ fontSize: '8px !important' }} />}
                                label={health.label}
                                size="small"
                                sx={{
                                  height: 20, fontSize: '0.65rem', fontWeight: 700,
                                  bgcolor: `${health.color}18`, color: health.color,
                                  border: `1px solid ${health.color}30`,
                                  '& .MuiChip-icon': { color: health.color },
                                }}
                              />
                            </TableCell>
                            <TableCell align="center">
                              {hasPlayerId ? (
                                <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                                  {isRunning ? (
                                    <>
                                      <Tooltip title="Restart bot">
                                        <IconButton size="small" color="warning" disabled={anyLoading}
                                          onClick={() => botAction(bot, 'restart')}>
                                          {restartLoading ? <CircularProgress size={16} /> : <RestartIcon fontSize="small" />}
                                        </IconButton>
                                      </Tooltip>
                                      <Tooltip title="Stop bot">
                                        <IconButton size="small" color="error" disabled={anyLoading}
                                          onClick={() => botAction(bot, 'stop')}>
                                          {stopLoading ? <CircularProgress size={16} /> : <StopIcon fontSize="small" />}
                                        </IconButton>
                                      </Tooltip>
                                    </>
                                  ) : (
                                    <Tooltip title="Start bot">
                                      <IconButton size="small" color="success" disabled={anyLoading}
                                        onClick={() => botAction(bot, 'start')}>
                                        {startLoading ? <CircularProgress size={16} /> : <StartIcon fontSize="small" />}
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                </Box>
                              ) : (
                                <Typography variant="caption" color="text.secondary">No account</Typography>
                              )}
                            </TableCell>
                            <TableCell align="center">
                              {bot.userId ? (
                                <Tooltip title="Change proxy slot">
                                  <IconButton size="small" onClick={() => {
                                    setReassignDialog({
                                      userId: bot.userId,
                                      username: bot.webUsername || bot.discordUsername,
                                      currentSlot: bot.proxySlotId,
                                      currentPorts: bot.portStart && bot.portEnd ? `${bot.portStart}-${bot.portEnd}` : '-',
                                    })
                                    setSelectedSlot('')
                                  }}>
                                    <SwapIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              ) : (
                                <Typography variant="caption" color="text.secondary">-</Typography>
                              )}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
                </Collapse>
              </Box>
            )
          })
        )}

        {/* Reassign Slot Dialog */}
        <Dialog open={!!reassignDialog} onClose={() => setReassignDialog(null)} maxWidth="xs" fullWidth>
          <DialogTitle>Change Proxy Slot</DialogTitle>
          <DialogContent>
            {reassignDialog && (
              <Box sx={{ pt: 1 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>User:</strong> {reassignDialog.username}
                </Typography>
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Current slot:</strong> {reassignDialog.currentSlot} ({reassignDialog.currentPorts})
                </Typography>
                <Alert severity="warning" sx={{ mb: 2, fontSize: '0.75rem' }}>
                  Bot restart required after slot change. Stop and restart the bot after changing.
                </Alert>
                <FormControl fullWidth size="small">
                  <InputLabel>New Slot</InputLabel>
                  <Select
                    value={selectedSlot}
                    onChange={(e) => setSelectedSlot(e.target.value)}
                    label="New Slot"
                  >
                    {availableSlots.map(s => (
                      <MenuItem key={s.slotId} value={s.slotId}>
                        Slot {s.slotId} — ports {s.portStart}-{s.portEnd}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Box>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setReassignDialog(null)}>Cancel</Button>
            <Button
              onClick={handleReassign}
              disabled={selectedSlot === '' || reassigning}
              variant="contained"
              color="warning"
            >
              {reassigning ? 'Reassigning...' : 'Change Slot'}
            </Button>
          </DialogActions>
        </Dialog>

        <Snackbar open={!!success} autoHideDuration={5000} onClose={() => setSuccess('')}>
          <Alert severity="success" onClose={() => setSuccess('')}>{success}</Alert>
        </Snackbar>
        <Snackbar open={!!error} autoHideDuration={5000} onClose={() => setError('')}>
          <Alert severity="error" onClose={() => setError('')}>{error}</Alert>
        </Snackbar>
      </Box>
    </FadeIn>
  )
}
