/**
 * AdminDebugPanel — admin-only panel for inspecting recent trade/gift requests.
 * Shows stuck alert, filterable table, and quick-inspect drawer with timeline.
 */
import { useState, useEffect, useCallback } from 'react'
import {
  Box, Typography, Chip, Table, TableHead, TableBody, TableRow, TableCell,
  TextField, Select, MenuItem, FormControl, InputLabel, CircularProgress,
  Alert, Drawer, IconButton, Tooltip, Button, InputAdornment,
} from '@mui/material'
import { useTheme } from '@mui/material/styles'
import { Close as CloseIcon, Search as SearchIcon, Refresh as RefreshIcon, ContentCopy as CopyIcon } from '@mui/icons-material'
import RequestTimeline from './RequestTimeline'
import InsightCards from './InsightCards'
import ExecutionLogView from './ExecutionLogView'
import { getDisplayStatus, getErrorDisplay, formatRelativeTime } from '../utils/errorDisplay'

export default function AdminDebugPanel() {
  const theme = useTheme()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [stuckCount, setStuckCount] = useState(0)
  const [typeFilter, setTypeFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [stuckOnly, setStuckOnly] = useState(false)
  const [selectedReq, setSelectedReq] = useState(null)

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ type: typeFilter, limit: '100' })
      if (statusFilter) params.set('status', statusFilter)
      if (search) params.set('search', search)
      if (stuckOnly) params.set('stuck', 'true')
      const res = await fetch(`/api/admin/debug/requests?${params}`, { credentials: 'include' })
      const data = await res.json()
      setRequests(data.requests || [])
      setStuckCount(data.stuckCount || 0)
    } catch { setRequests([]) }
    setLoading(false)
  }, [typeFilter, statusFilter, search, stuckOnly])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).catch(() => {})
  }

  return (
    <Box>
      {/* Insights (admin view with repeated failures) */}
      <InsightCards isAdmin />

      {/* Stuck alert */}
      {stuckCount > 0 ? (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: '10px' }}>
          {stuckCount} stuck request{stuckCount > 1 ? 's' : ''} detected (active &gt; 20 min). Reaper will clean these automatically.
        </Alert>
      ) : (
        <Alert severity="success" sx={{ mb: 2, borderRadius: '10px' }}>All clear — no stuck requests.</Alert>
      )}

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 100 }}>
          <InputLabel>Type</InputLabel>
          <Select value={typeFilter} label="Type" onChange={e => setTypeFilter(e.target.value)}>
            <MenuItem value="all">All</MenuItem>
            <MenuItem value="trade">Trade</MenuItem>
            <MenuItem value="gift">Gift</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel>Status</InputLabel>
          <Select value={statusFilter} label="Status" onChange={e => setStatusFilter(e.target.value)}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="FAILED">Failed</MenuItem>
            <MenuItem value="COMPLETED">Completed</MenuItem>
            <MenuItem value="PENDING,MATCHING,FRIEND_REQUEST_SENT">Active</MenuItem>
            <MenuItem value="CANCELLED">Cancelled</MenuItem>
          </Select>
        </FormControl>
        <TextField
          size="small" placeholder="Search user / card..."
          value={search} onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && fetchRequests()}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16 }} /></InputAdornment> }}
          sx={{ minWidth: 180 }}
        />
        <Chip
          label="Stuck only"
          size="small"
          color={stuckOnly ? 'warning' : 'default'}
          variant={stuckOnly ? 'filled' : 'outlined'}
          onClick={() => setStuckOnly(!stuckOnly)}
          sx={{ cursor: 'pointer' }}
        />
        <IconButton size="small" onClick={fetchRequests} disabled={loading}>
          {loading ? <CircularProgress size={16} /> : <RefreshIcon sx={{ fontSize: 18 }} />}
        </IconButton>
        <Typography variant="caption" color="text.secondary">{requests.length} results (7-day window)</Typography>
      </Box>

      {/* Table */}
      <Box sx={{ overflowX: 'auto' }}>
        <Table size="small" sx={{
          minWidth: 700,
          '& .MuiTableBody-root .MuiTableRow-root:nth-of-type(odd)': {
            bgcolor: 'action.hover',
          },
          '& .MuiTableRow-root': {
            height: 42,
            transition: 'background-color 120ms ease-out',
          },
        }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem' }}>ID</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem' }}>Type</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem' }}>User</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem' }}>Card</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem' }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem' }}>Error</TableCell>
              <TableCell sx={{ fontWeight: 700, fontSize: '0.7rem' }}>Time</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {requests.map(req => {
              const ds = getDisplayStatus(req.status, req.type)
              const err = req.error_message ? getErrorDisplay(req.error_message, req.status) : null
              return (
                <TableRow
                  key={`${req.type}-${req.id}`}
                  hover
                  onClick={() => setSelectedReq(req)}
                  sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                >
                  <TableCell sx={{ fontSize: '0.7rem', fontFamily: 'monospace' }}>#{req.id}</TableCell>
                  <TableCell>
                    <Chip label={req.type} size="small" color={req.type === 'trade' ? 'primary' : 'success'} variant="outlined" sx={{ height: 18, fontSize: '0.6rem' }} />
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.7rem' }}>{req.discord_username || req.username || `User #${req.user_id}`}</TableCell>
                  <TableCell sx={{ fontSize: '0.7rem' }}>{req.card_name}</TableCell>
                  <TableCell>
                    <Chip label={ds.label} size="small" color={ds.color} variant={ds.state === 'done' ? 'filled' : 'outlined'} sx={{ height: 18, fontSize: '0.55rem' }} />
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.65rem', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {err ? `${err.icon} ${err.message}` : '—'}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>{formatRelativeTime(req.completed_at || req.requested_at)}</TableCell>
                </TableRow>
              )
            })}
            {requests.length === 0 && !loading && (
              <TableRow><TableCell colSpan={7} align="center"><Typography color="text.secondary" variant="body2">No matching requests</Typography></TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </Box>

      {/* Inspect Drawer */}
      <Drawer anchor="right" open={!!selectedReq} onClose={() => setSelectedReq(null)} PaperProps={{ sx: { width: { xs: '100%', sm: 400 }, p: 2 } }}>
        {selectedReq && (() => {
          const ds = getDisplayStatus(selectedReq.status, selectedReq.type)
          const err = selectedReq.error_message ? getErrorDisplay(selectedReq.error_message, selectedReq.status) : null
          return (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" fontWeight={700}>Request #{selectedReq.id}</Typography>
                <IconButton onClick={() => setSelectedReq(null)}><CloseIcon /></IconButton>
              </Box>

              {/* Quick summary */}
              {(() => {
                const ds = getDisplayStatus(selectedReq.status, selectedReq.type)
                const err = selectedReq.error_message ? getErrorDisplay(selectedReq.error_message, selectedReq.status) : null
                const summary = err
                  ? `${ds.label} at ${selectedReq.action_sent_at ? 'Trade/Gift' : selectedReq.friend_request_sent_at ? 'Friend' : selectedReq.matched_at ? 'Matching' : 'Queue'} step — ${err.message}`
                  : ds.label
                return (
                  <Typography variant="body2" sx={{
                    mb: 1.5, p: 1, borderRadius: '8px', fontSize: '0.78rem', fontWeight: 500,
                    bgcolor: ds.state === 'failed' ? 'error.main' : ds.state === 'done' ? 'success.main' : 'info.main',
                    color: 'white',
                  }}>
                    {summary}
                  </Typography>
                )
              })()}

              {/* Timeline */}
              <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>TIMELINE</Typography>
              <RequestTimeline request={selectedReq} type={selectedReq.type} />

              {/* Details */}
              <Box sx={{ mt: 2, display: 'grid', gridTemplateColumns: '100px 1fr', gap: 0.5, fontSize: '0.75rem' }}>
                {[
                  ['Type', <Chip label={selectedReq.type} size="small" sx={{ height: 18, fontSize: '0.6rem' }} />],
                  ['Status', <Chip label={ds.label} size="small" color={ds.color} sx={{ height: 18, fontSize: '0.6rem' }} />],
                  ['User', selectedReq.discord_username || selectedReq.username || `#${selectedReq.user_id}`],
                  ['Account', `#${selectedReq.user_account_id || '?'}`],
                  ['Card', selectedReq.card_name],
                  ['Rarity', selectedReq.rarity_code],
                  ['Requested', selectedReq.requested_at ? new Date(selectedReq.requested_at).toLocaleString() : '—'],
                  ['Matched', selectedReq.matched_at ? new Date(selectedReq.matched_at).toLocaleString() : '—'],
                  ['Friend Sent', selectedReq.friend_request_sent_at ? new Date(selectedReq.friend_request_sent_at).toLocaleString() : '—'],
                  ['Action Sent', selectedReq.action_sent_at ? new Date(selectedReq.action_sent_at).toLocaleString() : '—'],
                  ['Completed', selectedReq.completed_at ? new Date(selectedReq.completed_at).toLocaleString() : '—'],
                ].map(([label, value]) => (
                  <Box key={label} sx={{ display: 'contents' }}>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>{label}</Typography>
                    <Typography variant="caption">{typeof value === 'string' ? value : value}</Typography>
                  </Box>
                ))}
              </Box>

              {/* Error */}
              {err && (
                <Alert severity="error" sx={{ mt: 2, borderRadius: '8px', fontSize: '0.75rem' }}>
                  {err.icon} {err.message}
                  {err.category === 'retryable' && <Typography variant="caption" display="block">Category: Retryable</Typography>}
                  {err.category === 'actionable' && <Typography variant="caption" display="block">Category: User action needed</Typography>}
                </Alert>
              )}

              {/* Execution Log (attempts + progress + timeline) */}
              {selectedReq.execution_log && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="caption" fontWeight={700} color="text.secondary" sx={{ display: 'block', mb: 0.5, fontSize: '0.65rem', textTransform: 'uppercase' }}>
                    Execution Log
                  </Typography>
                  <ExecutionLogView executionLog={selectedReq.execution_log} />
                </Box>
              )}

              {/* Error diagnostics (structured) */}
              {selectedReq.error_source && (
                <Box sx={{ mt: 1.5, display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                  <Chip label={`Source: ${selectedReq.error_source}`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.6rem' }} />
                  {selectedReq.error_category && <Chip label={`Category: ${selectedReq.error_category}`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.6rem' }} />}
                  {selectedReq.error_code && <Chip label={`Code: ${selectedReq.error_code}`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.6rem' }} />}
                  {selectedReq.proxy_slot != null && <Chip label={`Proxy: #${selectedReq.proxy_slot}`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.6rem' }} />}
                  {selectedReq.execution_id && <Chip label={`Exec: ${selectedReq.execution_id}`} size="small" variant="outlined" color="info" sx={{ height: 20, fontSize: '0.6rem', fontFamily: 'monospace' }} />}
                </Box>
              )}

              {/* Guided recovery suggestion */}
              {selectedReq.status === 'FAILED' && (() => {
                const step = selectedReq.action_sent_at ? 'Trade/Gift' : selectedReq.friend_request_sent_at ? 'Friend' : selectedReq.matched_at ? 'Matching' : 'Queue'
                const suggestions = {
                  'Queue': 'Card may be out of stock. Check bot inventories.',
                  'Matching': 'No available bot account. Check account locks and availability.',
                  'Friend': 'User did not accept friend request. Ask user to retry with game open.',
                  'Trade/Gift': 'Execution failed after friend acceptance. May be a proxy or session issue. User can retry.',
                }
                return (
                  <Alert severity="info" sx={{ mt: 1.5, borderRadius: '8px', fontSize: '0.75rem' }}>
                    <Typography variant="body2" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Recovery guidance</Typography>
                    <Typography variant="caption">{suggestions[step] || 'No specific guidance available.'}</Typography>
                  </Alert>
                )
              })()}

              {/* Safe actions */}
              <Box sx={{ display: 'flex', gap: 1, mt: 2, flexWrap: 'wrap' }}>
                <Button
                  size="small" variant="outlined" startIcon={<RefreshIcon />} sx={{ textTransform: 'none' }}
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/admin/debug/requests/${selectedReq.type}/${selectedReq.id}/recheck`, { credentials: 'include' })
                      const data = await res.json()
                      if (data.request) {
                        setSelectedReq({ ...selectedReq, ...data.request, _recheckedAt: data.checkedAt })
                      }
                    } catch {}
                  }}
                >
                  Re-check status
                </Button>
                <Button
                  size="small" startIcon={<CopyIcon />} sx={{ textTransform: 'none' }}
                  onClick={() => copyToClipboard(JSON.stringify(selectedReq, null, 2))}
                >
                  Copy JSON
                </Button>
              </Box>
              {selectedReq._recheckedAt && (
                <Typography variant="caption" color="success.main" sx={{ mt: 0.5, display: 'block', fontSize: '0.6rem' }}>
                  ✓ Re-checked at {new Date(selectedReq._recheckedAt).toLocaleTimeString()}
                </Typography>
              )}
            </Box>
          )
        })()}
      </Drawer>
    </Box>
  )
}
