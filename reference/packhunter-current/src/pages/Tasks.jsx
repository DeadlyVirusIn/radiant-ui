import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Chip,
  CircularProgress,
  useTheme,
} from '@mui/material'
import {
  Redeem as RedeemIcon,
  Assignment as TaskIcon,
  History as HistoryIcon,
  Terminal as TerminalIcon,
} from '@mui/icons-material'
import { accounts, tasks } from '../services/api'
import { onTaskStatus, onTaskLog, offTaskStatus, offTaskLog } from '../services/socket'
import { FadeIn } from '../components/Animations'
import { EmptyState } from '../components/EmptyState'
import { TablePageSkeleton } from '../components/skeletons/PageSkeletons'
import PageHeader from '../components/PageHeader'
import { useSectionStyles } from '../components/SectionCard'

function Tasks({ user }) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const [linkedAccounts, setLinkedAccounts] = useState([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [taskLogs, setTaskLogs] = useState([])
  const [taskHistory, setTaskHistory] = useState([])

  // Task checkboxes
  const [selectedTasks, setSelectedTasks] = useState({
    CLAIM_MISSIONS: true,
    OPEN_PACKS: false, // Off by default — consumes pack stamina/hourglasses
    WONDER_PICK: false, // Off by default — consumes resources
    BATTLE: true,
  })

  const { sectionBox: cardSx } = useSectionStyles()

  useEffect(() => {
    loadAccounts()
    loadHistory()

    // Socket event listeners
    const handleTaskStatus = (data) => {
      if (data.status === 'completed') {
        setSuccess(`Task ${data.taskType} completed!`)
      } else if (data.status === 'failed') {
        setError(`Task ${data.taskType} failed: ${data.error}`)
      }
      loadHistory()
    }

    const handleTaskLog = (data) => {
      setTaskLogs((prev) => [data, ...prev].slice(0, 50))
    }

    onTaskStatus(handleTaskStatus)
    onTaskLog(handleTaskLog)

    return () => {
      offTaskStatus(handleTaskStatus)
      offTaskLog(handleTaskLog)
    }
  }, [])

  useEffect(() => {
    if (selectedAccount) {
      loadHistory()
    }
  }, [selectedAccount])

  const loadAccounts = async () => {
    try {
      const data = await accounts.list()
      setLinkedAccounts(data.accounts || [])
      if (data.accounts?.length > 0 && !selectedAccount) {
        setSelectedAccount(data.accounts[0].id.toString())
      }
    } catch (err) {
      setError('Failed to load accounts')
    } finally {
      setLoading(false)
    }
  }

  const loadHistory = async () => {
    try {
      const data = await tasks.getHistory(20, selectedAccount || null)
      setTaskHistory(data.history || [])
    } catch (err) {
      console.error('Failed to load history:', err)
    }
  }

  const handleTaskToggle = (taskType) => {
    setSelectedTasks((prev) => ({
      ...prev,
      [taskType]: !prev[taskType],
    }))
  }

  const handleRunTask = async (taskType) => {
    setError('')
    setSuccess('')
    setActionLoading(true)
    setTaskLogs([])

    try {
      let result
      switch (taskType) {
        case 'CLAIM_MISSIONS':
          result = await tasks.claimMissions(selectedAccount)
          break
        case 'OPEN_PACKS':
          result = await tasks.openPacks(selectedAccount)
          break
        case 'WONDER_PICK':
          result = await tasks.wonderPick(selectedAccount)
          break
        case 'BATTLE':
          result = await tasks.battle(selectedAccount)
          break
        default:
          throw new Error(`Unknown task: ${taskType}`)
      }

      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(`${taskType} completed successfully!`)
        loadHistory()
      }
    } catch (err) {
      setError(err.message || 'Task failed')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRedeemAll = async () => {
    setError('')
    setSuccess('')
    setActionLoading(true)
    setTaskLogs([])

    const taskList = Object.entries(selectedTasks)
      .filter(([_, enabled]) => enabled)
      .map(([taskType]) => taskType)

    if (taskList.length === 0) {
      setError('Please select at least one task')
      setActionLoading(false)
      return
    }

    try {
      const result = await tasks.runAll(selectedAccount, taskList)
      if (result.error) {
        setError(result.error)
      } else {
        const successCount = result.results.filter((r) => r.success).length
        setSuccess(`Completed ${successCount}/${result.results.length} tasks`)
        loadHistory()
      }
    } catch (err) {
      setError(err.message || 'Failed to run tasks')
    } finally {
      setActionLoading(false)
    }
  }

  const getTaskLabel = (taskType) => {
    switch (taskType) {
      case 'CLAIM_MISSIONS':
        return 'Claim Daily Missions'
      case 'OPEN_PACKS':
        return 'Use pack stamina to open booster packs'
      case 'WONDER_PICK':
        return 'Wonder pick 1 time'
      case 'BATTLE':
        return 'Participate in 1 battle'
      default:
        return taskType
    }
  }

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString()
  }

  const getLogColor = (level) => {
    switch (level) {
      case 'error':
        return theme.palette.error.main
      case 'warn':
        return theme.palette.warning.main
      case 'info':
        return theme.palette.success.main
      default:
        return theme.palette.text.secondary
    }
  }

  if (loading) {
    return <TablePageSkeleton />
  }

  return (
    <FadeIn>
    <Box>
      {/* Header */}
      <PageHeader
        icon={<TaskIcon />}
        title="Daily Tasks"
        subtitle="Run automated tasks on your linked accounts"
      />

      {linkedAccounts.length === 0 ? (
        <EmptyState
          icon={<TaskIcon sx={{ fontSize: 64 }} />}
          title="No Accounts Linked"
          description="Go to Link Account to add an account first."
          action={<Button variant="contained" href="/accounts">Link Account</Button>}
        />
      ) : (
        <>
          {/* Task Selection */}
          <Box sx={{ ...cardSx, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  bgcolor: `${theme.palette.primary.main}22`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TaskIcon sx={{ color: theme.palette.primary.main, fontSize: 18 }} />
              </Box>
              <Typography variant="subtitle1" fontWeight={700}>
                Task Selection
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.5 }}>
              <FormControl sx={{ minWidth: 200 }}>
                <InputLabel>Select Account</InputLabel>
                <Select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  label="Select Account"
                >
                  {linkedAccounts.map((account) => (
                    <MenuItem key={account.id} value={account.id.toString()}>
                      {account.nickname || `Account ${account.id}`}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Button
                variant="contained"
                startIcon={actionLoading ? <CircularProgress size={20} color="inherit" /> : <RedeemIcon />}
                onClick={handleRedeemAll}
                disabled={actionLoading}
                sx={{
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  '&:hover': {
                    background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.dark})`,
                  },
                }}
              >
                Redeem ALL
              </Button>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }} onClose={() => setError('')}>
                {error}
              </Alert>
            )}
            {success && (
              <Alert severity="success" sx={{ mb: 2, borderRadius: '10px' }} onClose={() => setSuccess('')}>
                {success}
              </Alert>
            )}

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Please check the missions you want to complete today:
            </Typography>

            <FormGroup>
              {Object.entries(selectedTasks).map(([taskType, checked]) => (
                <Box
                  key={taskType}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    py: 1.25,
                    px: 1,
                    borderRadius: '10px',
                    mb: 0.5,
                    border: `1px solid ${isDark ? 'rgba(124,138,255,0.06)' : 'rgba(0,0,0,0.04)'}`,
                    bgcolor: checked
                      ? isDark
                        ? 'rgba(124,138,255,0.06)'
                        : 'rgba(92,106,196,0.04)'
                      : 'transparent',
                    transition: 'all 0.15s ease',
                    '&:hover': {
                      bgcolor: isDark ? 'rgba(124,138,255,0.08)' : 'rgba(0,0,0,0.03)',
                    },
                  }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={checked}
                        onChange={() => handleTaskToggle(taskType)}
                        disabled={actionLoading}
                      />
                    }
                    label={
                      <Typography variant="body2" fontWeight={checked ? 500 : 400}>
                        {getTaskLabel(taskType)}
                      </Typography>
                    }
                  />
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => handleRunTask(taskType)}
                    disabled={actionLoading}
                    sx={{ borderRadius: '8px', minWidth: 56 }}
                  >
                    Run
                  </Button>
                </Box>
              ))}
            </FormGroup>
          </Box>

          {/* Task Logs */}
          {taskLogs.length > 0 && (
            <Box sx={{ ...cardSx, mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    bgcolor: `${theme.palette.info.main}22`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <TerminalIcon sx={{ color: theme.palette.info.main, fontSize: 18 }} />
                </Box>
                <Typography variant="subtitle1" fontWeight={700}>
                  Task Progress
                </Typography>
              </Box>
              <Box
                sx={{
                  bgcolor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.03)',
                  border: `1px solid ${isDark ? 'rgba(124,138,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
                  borderRadius: '10px',
                  p: 2,
                  maxHeight: 200,
                  overflow: 'auto',
                  fontFamily: 'monospace',
                  fontSize: 12,
                }}
              >
                {taskLogs.map((log, index) => (
                  <Box
                    key={index}
                    sx={{
                      mb: 0.5,
                      color: getLogColor(log.level),
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    [{formatTime(log.timestamp)}] {log.message}
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* Task History */}
          <Box sx={cardSx}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  bgcolor: `${theme.palette.secondary.main}22`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <HistoryIcon sx={{ color: theme.palette.secondary.main, fontSize: 18 }} />
              </Box>
              <Typography variant="subtitle1" fontWeight={700}>
                Recent Task History
              </Typography>
            </Box>

            {taskHistory.length === 0 ? (
              <EmptyState
                icon={<HistoryIcon sx={{ fontSize: 48 }} />}
                title="No Tasks Executed Yet"
                description="Run a task above to see history here."
                minHeight={150}
              />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {taskHistory.map((task) => (
                  <Box
                    key={task.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 1.5,
                      borderRadius: '10px',
                      border: `1px solid ${isDark ? 'rgba(124,138,255,0.06)' : 'rgba(0,0,0,0.04)'}`,
                      bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                      '&:hover': {
                        bgcolor: isDark ? 'rgba(124,138,255,0.06)' : 'rgba(0,0,0,0.03)',
                      },
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <Box sx={{ flex: 1 }}>
                      <Typography variant="body2" fontWeight={500}>
                        {task.task_type.replace(/_/g, ' ')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(task.created_at).toLocaleString()}
                        {task.result && ` - ${JSON.parse(task.result).message}`}
                      </Typography>
                    </Box>
                    <Chip
                      label={task.status}
                      color={
                        task.status === 'completed'
                          ? 'success'
                          : task.status === 'failed'
                          ? 'error'
                          : 'warning'
                      }
                      size="small"
                    />
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        </>
      )}
    </Box>
    </FadeIn>
  )
}

export default Tasks
