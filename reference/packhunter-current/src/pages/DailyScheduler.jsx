import { useState, useEffect, useMemo, useRef } from 'react'
import { routeTimer } from '../utils/routeTimer'
import {
  Box,
  Typography,
  Grid,
  Button,
  IconButton,
  Switch,
  FormControlLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  Chip,
  Divider,
  CircularProgress,
  Tooltip,
  Tabs,
  Tab,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import {
  Schedule as ScheduleIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PlayArrow as RunIcon,
  History as HistoryIcon,
  CheckCircle as SuccessIcon,
  Error as ErrorIcon,
  Pending as PendingIcon,
  AccessTime as TimeIcon,
  Person as AccountIcon,
  Task as MissionIcon,
  CardGiftcard as PresentIcon,
  HourglassBottom as HourglassIcon,
  HelpOutline as HelpIcon,
} from '@mui/icons-material'
import { scheduler, accounts as accountsApi } from '../services/api'
import { useConfirmDialog } from '../components/ConfirmDialog'
import { formatDateTime } from '../utils/dateFormat'
import StatCardV2 from '../components/StatCardV2'
import DataTable from '../components/DataTable'
import { FadeIn, StaggerContainer, StaggerItem } from '../components/Animations'
import { EmptyState } from '../components/EmptyState'
import { FormPageSkeleton } from '../components/skeletons/PageSkeletons'
import PageHeader from '../components/PageHeader'
import CollapsibleHelp from '../components/CollapsibleHelp'
import { useSectionStyles } from '../components/SectionCard'

// Format relative time
const formatRelative = (dateStr) => {
  if (!dateStr) return 'N/A'
  const date = new Date(dateStr)
  const now = new Date()
  const diff = date - now

  if (diff < 0) return 'Overdue'

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (hours > 24) {
    const days = Math.floor(hours / 24)
    return `in ${days}d ${hours % 24}h`
  }
  if (hours > 0) return `in ${hours}h ${minutes}m`
  return `in ${minutes}m`
}

// Status chip component
const StatusChip = ({ status }) => {
  const config = {
    success: { icon: <SuccessIcon sx={{ fontSize: 16 }} />, color: 'success', label: 'Success' },
    partial: { icon: <PendingIcon sx={{ fontSize: 16 }} />, color: 'warning', label: 'Partial' },
    error: { icon: <ErrorIcon sx={{ fontSize: 16 }} />, color: 'error', label: 'Error' },
    pending: { icon: <PendingIcon sx={{ fontSize: 16 }} />, color: 'info', label: 'Pending' },
    skipped: { icon: <PendingIcon sx={{ fontSize: 16 }} />, color: 'default', label: 'Skipped' },
  }

  const cfg = config[status] || config.pending
  return (
    <Chip
      icon={cfg.icon}
      label={cfg.label}
      color={cfg.color}
      size="small"
      sx={{ height: 24 }}
    />
  )
}

// Schedule Form Dialog
const ScheduleFormDialog = ({ open, onClose, onSave, schedule, accounts, timezones }) => {
  const [formData, setFormData] = useState({
    accountId: '',
    scheduleTime: '00:00',
    timezone: 'UTC',
    claimMissions: true,
    claimPresents: true,
    claimHourglass: true,
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (schedule) {
      setFormData({
        accountId: schedule.account_id || '',
        scheduleTime: schedule.schedule_time || '00:00',
        timezone: schedule.timezone || 'UTC',
        claimMissions: schedule.claim_missions === 1,
        claimPresents: schedule.claim_presents === 1,
        claimHourglass: schedule.claim_hourglass === 1,
      })
    } else {
      setFormData({
        accountId: '',
        scheduleTime: '00:00',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        claimMissions: true,
        claimPresents: true,
        claimHourglass: true,
      })
    }
  }, [schedule, open])

  const handleSave = async () => {
    setSaving(true)
    try {
      await onSave({
        accountId: formData.accountId || null,
        scheduleTime: formData.scheduleTime,
        timezone: formData.timezone,
        claimMissions: formData.claimMissions,
        claimPresents: formData.claimPresents,
        claimHourglass: formData.claimHourglass,
      })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {schedule ? 'Edit Schedule' : 'Create Schedule'}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          <Grid item xs={12}>
            <FormControl fullWidth>
              <InputLabel>Account</InputLabel>
              <Select
                value={formData.accountId}
                onChange={(e) => setFormData({ ...formData, accountId: e.target.value })}
                label="Account"
              >
                <MenuItem value="">All Accounts</MenuItem>
                {accounts.map((acc) => (
                  <MenuItem key={acc.id} value={acc.id}>
                    {acc.player_name || acc.device_account?.substring(0, 12)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={6}>
            <TextField
              fullWidth
              label="Schedule Time"
              type="time"
              value={formData.scheduleTime}
              onChange={(e) => setFormData({ ...formData, scheduleTime: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>

          <Grid item xs={6}>
            <FormControl fullWidth>
              <InputLabel>Timezone</InputLabel>
              <Select
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                label="Timezone"
              >
                {timezones.map((tz) => (
                  <MenuItem key={tz.value} value={tz.value}>
                    {tz.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <Divider sx={{ my: 1 }} />
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Tasks to Claim
            </Typography>
          </Grid>

          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.claimMissions}
                  onChange={(e) => setFormData({ ...formData, claimMissions: e.target.checked })}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <MissionIcon sx={{ fontSize: 20 }} />
                  Claim Missions
                </Box>
              }
            />
          </Grid>

          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.claimPresents}
                  onChange={(e) => setFormData({ ...formData, claimPresents: e.target.checked })}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <PresentIcon sx={{ fontSize: 20 }} />
                  Claim Presents
                </Box>
              }
            />
          </Grid>

          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={formData.claimHourglass}
                  onChange={(e) => setFormData({ ...formData, claimHourglass: e.target.checked })}
                />
              }
              label={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <HourglassIcon sx={{ fontSize: 20 }} />
                  Claim Hourglass Packs
                </Box>
              }
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : null}
        >
          {schedule ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

function DailyScheduler() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const isDark = theme.palette.mode === 'dark'
  const [schedules, setSchedules] = useState([])
  const [accounts, setAccounts] = useState([])
  const [timezones, setTimezones] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState(0)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSchedule, setEditingSchedule] = useState(null)
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })
  const { confirm, ConfirmDialogComponent } = useConfirmDialog()

  const { sectionBox } = useSectionStyles()

  // Phase 19 — frontend route timer. Reports route hydration time to the
  // health engine (POST /api/admin/health/route-perf). Only fires when
  // hydratedMs exceeds the threshold; engine decides whether the latency
  // crosses the SLO and warrants a SCHEDULER_ROUTE_SLOW finding.
  const timerRef = useRef(null)
  if (timerRef.current === null) {
    timerRef.current = routeTimer('/admin/scheduler')
  }

  // Phase 18 — memoize the three stat-card reductions so they don't
  // recompute on every keystroke or unrelated re-render.
  const scheduleStats = useMemo(() => ({
    total:      schedules.length,
    enabled:    schedules.filter(s => s.enabled).length,
    totalRuns:  schedules.reduce((sum, s) => sum + (s.run_count || 0), 0),
    successful: schedules.reduce((sum, s) => sum + (s.success_count || 0), 0),
  }), [schedules])

  useEffect(() => {
    timerRef.current?.mark('firstRender')
    fetchData()
  }, [])

  // Phase 19 — once schedules + timezones are loaded the page is usable.
  // Fire `firstData` then `hydrated` so the timer reports total time.
  useEffect(() => {
    if (!loading) {
      timerRef.current?.mark('firstData')
      timerRef.current?.mark('hydrated')
    }
  }, [loading])

  const fetchData = async () => {
    // Phase 18 — Scheduler perf fix.
    //
    // Prior impl called the non-existent `accountsApi.getAll()` which
    // throws a hard "API Contract" error and rejects the entire
    // Promise.all — the page would spin forever. Correct method on the
    // exported `accounts` module is `list()`.
    //
    // We also split critical (schedules + timezones) from secondary
    // (accounts for the edit-dialog dropdown, logs ring buffer) so the
    // table renders as soon as the schedule list is back, while logs
    // and accounts fill in after. Each request is independent: a single
    // failure no longer blocks the whole page.
    const loadOne = async (label, fn, setter, defaultVal) => {
      const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now()
      try {
        const data = await fn()
        setter(data || defaultVal)
        if (typeof console !== 'undefined' && console.debug) {
          const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now()
          console.debug(`[Scheduler] ${label} loaded in ${(t1 - t0).toFixed(0)}ms`)
        }
      } catch (err) {
        // Surface only the first failure — extra noise drowns actionable errors.
        setSnackbar(prev => prev.open ? prev : ({ open: true, message: `${label}: ${err.message}`, severity: 'error' }))
      }
    }

    setLoading(true)
    // Critical path: schedules + timezones. Await both so the table
    // can render with working controls.
    await Promise.all([
      loadOne('schedules', () => scheduler.getSchedules(), (d) => setSchedules(d.schedules || []), { schedules: [] }),
      loadOne('timezones', () => scheduler.getTimezones(), (d) => setTimezones(d.timezones || []), { timezones: [] }),
    ])
    setLoading(false)
    // Secondary — fire-and-forget. Accounts only needed for the dialog
    // dropdown; logs are a ring buffer shown in a collapsible section.
    loadOne('accounts', () => accountsApi.list(), (d) => setAccounts(d.accounts || []), { accounts: [] })
    loadOne('logs',     () => scheduler.getAllLogs(), (d) => setLogs(d.logs || []),       { logs: [] })
  }

  const handleCreate = () => {
    setEditingSchedule(null)
    setDialogOpen(true)
  }

  const handleEdit = (schedule) => {
    setEditingSchedule(schedule)
    setDialogOpen(true)
  }

  const handleSave = async (data) => {
    try {
      if (editingSchedule) {
        await scheduler.updateSchedule(editingSchedule.id, data)
        setSnackbar({ open: true, message: 'Schedule updated successfully', severity: 'success' })
      } else {
        await scheduler.createSchedule(data)
        setSnackbar({ open: true, message: 'Schedule created successfully', severity: 'success' })
      }
      fetchData()
    } catch (error) {
      setSnackbar({ open: true, message: error.message, severity: 'error' })
      throw error
    }
  }

  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: 'Delete Schedule?',
      message: 'Are you sure you want to delete this schedule? This action cannot be undone.',
      confirmText: 'Delete',
      confirmColor: 'error',
      variant: 'danger',
    })
    if (!confirmed) return

    try {
      await scheduler.deleteSchedule(id)
      setSnackbar({ open: true, message: 'Schedule deleted', severity: 'success' })
      fetchData()
    } catch (error) {
      setSnackbar({ open: true, message: error.message, severity: 'error' })
    }
  }

  const handleToggle = async (schedule) => {
    try {
      await scheduler.updateSchedule(schedule.id, {
        enabled: !schedule.enabled,
      })
      fetchData()
    } catch (error) {
      setSnackbar({ open: true, message: error.message, severity: 'error' })
    }
  }

  const handleRunNow = async (id) => {
    try {
      await scheduler.runNow(id)
      setSnackbar({ open: true, message: 'Schedule triggered successfully', severity: 'success' })
      fetchData()
    } catch (error) {
      setSnackbar({ open: true, message: error.message, severity: 'error' })
    }
  }

  if (loading) {
    return <FormPageSkeleton />
  }

  return (
    <FadeIn>
    <Box>
      {/* Header */}
      <PageHeader
        icon={<ScheduleIcon />}
        title="Daily Scheduler"
        subtitle="Automate your daily reward claiming"
        accent={theme.palette.success.main}
        action={
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleCreate}
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              '&:hover': { background: `linear-gradient(135deg, ${theme.palette.primary.dark || theme.palette.primary.main}, ${theme.palette.secondary.dark || theme.palette.secondary.main})` },
            }}
          >
            New Schedule
          </Button>
        }
      />

      {/* Help Info */}
      <CollapsibleHelp sx={{ mb: 3 }}>
        <ul>
          <li><strong>Schedule automated claiming:</strong> Set a daily time to automatically claim rewards</li>
          <li><strong>All Accounts:</strong> Select this to run the schedule for every linked account</li>
          <li><strong>Timezone:</strong> Determines when your schedule runs (uses your selected timezone)</li>
          <li><strong>Task types:</strong> Choose to claim Missions, Presents, and/or Hourglass packs</li>
          <li><strong>Run Now:</strong> Triggers the schedule immediately without waiting for the scheduled time</li>
        </ul>
      </CollapsibleHelp>

      {/* Stats Cards */}
      <StaggerContainer>
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={6} sm={3}>
            <StaggerItem>
              <StatCardV2
                icon={ScheduleIcon}
                label="Active Schedules"
                value={scheduleStats.total}
                color="primary"
              />
            </StaggerItem>
          </Grid>
          <Grid item xs={6} sm={3}>
            <StaggerItem>
              <StatCardV2
                icon={SuccessIcon}
                label="Enabled"
                value={scheduleStats.enabled}
                color="success"
              />
            </StaggerItem>
          </Grid>
          <Grid item xs={6} sm={3}>
            <StaggerItem>
              <StatCardV2
                icon={HistoryIcon}
                label="Total Runs"
                value={scheduleStats.totalRuns}
                color="info"
              />
            </StaggerItem>
          </Grid>
          <Grid item xs={6} sm={3}>
            <StaggerItem>
              <StatCardV2
                icon={SuccessIcon}
                label="Successful"
                value={scheduleStats.successful}
                color="secondary"
              />
            </StaggerItem>
          </Grid>
        </Grid>
      </StaggerContainer>

      {/* Tabs */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} variant={isMobile ? 'scrollable' : 'standard'} scrollButtons="auto">
          <Tab icon={<ScheduleIcon />} iconPosition="start" label="Schedules" />
          <Tab icon={<HistoryIcon />} iconPosition="start" label="History" />
        </Tabs>
      </Box>

      {/* Tab Content */}
      {activeTab === 0 ? (
        // Schedules Tab
        schedules.length === 0 ? (
          <Box sx={sectionBox}>
            <EmptyState
              icon={<ScheduleIcon sx={{ fontSize: 64 }} />}
              title="No Schedules Yet"
              description="Create your first schedule to automate daily reward claiming"
              action={
                <Button variant="contained" startIcon={<AddIcon />} onClick={handleCreate}>
                  Create Schedule
                </Button>
              }
            />
          </Box>
        ) : (
          <Grid container spacing={3}>
            {schedules.map((schedule) => (
              <Grid item xs={12} md={6} key={schedule.id}>
                <Box
                  sx={{
                    ...sectionBox,
                    opacity: schedule.enabled ? 1 : 0.7,
                    borderColor: schedule.enabled
                      ? (isDark ? `${theme.palette.primary.main}30` : `${theme.palette.primary.main}20`)
                      : (isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'),
                    transition: 'all 0.2s',
                    '&:hover': {
                      borderColor: schedule.enabled
                        ? (isDark ? `${theme.palette.primary.main}50` : `${theme.palette.primary.main}40`)
                        : (isDark ? 'rgba(124, 138, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)'),
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                        <AccountIcon sx={{ fontSize: 20, color: 'primary.main' }} />
                        <Typography variant="h6" fontWeight={600}>
                          {schedule.account_name || 'All Accounts'}
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TimeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                        <Typography variant="body2" color="text.secondary">
                          {schedule.schedule_time} ({schedule.timezone})
                        </Typography>
                      </Box>
                    </Box>
                    <Switch
                      checked={schedule.enabled === 1}
                      onChange={() => handleToggle(schedule)}
                      color="primary"
                    />
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                    {schedule.claim_missions === 1 && (
                      <Chip icon={<MissionIcon />} label="Missions" size="small" variant="outlined" />
                    )}
                    {schedule.claim_presents === 1 && (
                      <Chip icon={<PresentIcon />} label="Presents" size="small" variant="outlined" />
                    )}
                    {schedule.claim_hourglass === 1 && (
                      <Chip icon={<HourglassIcon />} label="Hourglass" size="small" variant="outlined" />
                    )}
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Next Run</Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {schedule.enabled ? formatRelative(schedule.next_run) : 'Disabled'}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Last Run</Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {formatDateTime(schedule.last_run)}
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Status</Typography>
                      <Box sx={{ mt: 0.5 }}>
                        {schedule.last_status ? (
                          <StatusChip status={schedule.last_status} />
                        ) : (
                          <Typography variant="body2">No runs yet</Typography>
                        )}
                      </Box>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary">Success Rate</Typography>
                      <Typography variant="body2" fontWeight={500}>
                        {schedule.run_count > 0
                          ? `${Math.round((schedule.success_count / schedule.run_count) * 100)}%`
                          : 'N/A'}
                      </Typography>
                    </Grid>
                  </Grid>

                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
                    <Tooltip title="Run Now">
                      <IconButton size="small" onClick={() => handleRunNow(schedule.id)} aria-label="Run now">
                        <RunIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => handleEdit(schedule)} aria-label="Edit schedule">
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => handleDelete(schedule.id)} aria-label="Delete schedule">
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        )
      ) : (
        // History Tab
        <Box sx={{ ...sectionBox, p: 0, overflow: 'hidden' }}>
          <DataTable
            columns={[
              { id: 'created_at', label: 'Date', sortable: true, render: (row) => formatDateTime(row.created_at) },
              { id: 'account_name', label: 'Account', sortable: true, render: (row) => row.account_name || 'All' },
              { id: 'status', label: 'Status', sortable: true, render: (row) => <StatusChip status={row.status} /> },
              { id: 'message', label: 'Message', render: (row) => <Typography variant="body2" noWrap sx={{ maxWidth: 300 }}>{row.message}</Typography> },
              { id: 'duration_ms', label: 'Duration', sortable: true, render: (row) => row.duration_ms ? `${(row.duration_ms / 1000).toFixed(1)}s` : '-' },
            ]}
            rows={logs}
            loading={false}
            emptyMessage="No execution history yet"
            emptyIcon={<HistoryIcon sx={{ fontSize: 48 }} />}
            pageSize={15}
            rowKey="id"
          />
        </Box>
      )}

      {/* Form Dialog */}
      <ScheduleFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSave}
        schedule={editingSchedule}
        accounts={accounts}
        timezones={timezones}
      />

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Confirm Dialog */}
      {ConfirmDialogComponent}
    </Box>
    </FadeIn>
  )
}

export default DailyScheduler
