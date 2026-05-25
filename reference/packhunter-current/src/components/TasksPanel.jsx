/**
 * TasksPanel — Extracted from Tasks.jsx for integration into Missions page.
 * Provides task selection checkboxes, individual Run buttons, Redeem All, logs, and history.
 *
 * Props:
 *   selectedAccount - account ID string (from parent)
 *   linkedAccounts  - array of account objects (for empty state messaging)
 */

import { useState, useEffect, useCallback } from 'react'
import {
  Box,
  Typography,
  Button,
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
import { tasks } from '../services/api'
import { onTaskStatus, onTaskLog, offTaskStatus, offTaskLog } from '../services/socket'
import { EmptyState } from './EmptyState'
import { useSectionStyles } from './SectionCard'

const TASK_OPTIONS = {
  CLAIM_MISSIONS: { label: 'Claim Daily Missions', defaultOn: true },
  OPEN_PACKS: { label: 'Use pack stamina to open booster packs', defaultOn: false },
  WONDER_PICK: { label: 'Wonder pick 1 time', defaultOn: false },
  BATTLE: { label: 'Participate in 1 battle', defaultOn: true },
}

export default function TasksPanel({ selectedAccount, linkedAccounts = [] }) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const { sectionBox: cardSx } = useSectionStyles()

  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [taskLogs, setTaskLogs] = useState([])
  const [taskHistory, setTaskHistory] = useState([])
  const [selectedTasks, setSelectedTasks] = useState(
    Object.fromEntries(Object.entries(TASK_OPTIONS).map(([k, v]) => [k, v.defaultOn]))
  )

  const loadHistory = useCallback(async () => {
    try {
      const data = await tasks.getHistory(20, selectedAccount || null)
      setTaskHistory(data.history || [])
    } catch (err) {
      console.error('Failed to load task history:', err)
    }
  }, [selectedAccount])

  useEffect(() => {
    loadHistory()
  }, [loadHistory])

  // Socket listeners for task progress
  useEffect(() => {
    const handleTaskStatus = (data) => {
      if (data.status === 'completed') {
        setSuccess(`Task ${(data.taskType || '').replace(/_/g, ' ')} completed!`)
      } else if (data.status === 'failed') {
        setError(`Task failed: ${data.error}`)
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
  }, [loadHistory])

  const handleTaskToggle = (taskType) => {
    setSelectedTasks((prev) => ({ ...prev, [taskType]: !prev[taskType] }))
  }

  const handleRunTask = async (taskType) => {
    setError('')
    setSuccess('')
    setActionLoading(true)
    setTaskLogs([])

    try {
      let result
      switch (taskType) {
        case 'CLAIM_MISSIONS': result = await tasks.claimMissions(selectedAccount); break
        case 'OPEN_PACKS': result = await tasks.openPacks(selectedAccount); break
        case 'WONDER_PICK': result = await tasks.wonderPick(selectedAccount); break
        case 'BATTLE': result = await tasks.battle(selectedAccount); break
        default: throw new Error(`Unknown task: ${taskType}`)
      }
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(`${taskType.replace(/_/g, ' ')} completed!`)
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

  const formatTime = (timestamp) => new Date(timestamp).toLocaleTimeString()

  const getLogColor = (level) => {
    switch (level) {
      case 'error': return theme.palette.error.main
      case 'warn': return theme.palette.warning.main
      case 'info': return theme.palette.success.main
      default: return theme.palette.text.secondary
    }
  }

  if (!selectedAccount || linkedAccounts.length === 0) {
    return (
      <EmptyState
        icon={<TaskIcon sx={{ fontSize: 64 }} />}
        title="Select an Account"
        description="Choose an account above to run tasks."
        minHeight={200}
      />
    )
  }

  return (
    <Box>
      {/* Task Selection */}
      <Box sx={{ ...cardSx, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
          <Box
            sx={{
              width: 32, height: 32, borderRadius: '50%',
              bgcolor: `${theme.palette.primary.main}22`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <TaskIcon sx={{ color: theme.palette.primary.main, fontSize: 18 }} />
          </Box>
          <Typography variant="subtitle1" fontWeight={700}>Task Selection</Typography>
          <Button
            variant="contained"
            size="small"
            startIcon={actionLoading ? <CircularProgress size={16} color="inherit" /> : <RedeemIcon />}
            onClick={handleRedeemAll}
            disabled={actionLoading}
            sx={{
              ml: 'auto',
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

        <FormGroup>
          {Object.entries(TASK_OPTIONS).map(([taskType, config]) => (
            <Box
              key={taskType}
              sx={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                py: 1.25, px: 1, borderRadius: '10px', mb: 0.5,
                border: `1px solid ${theme.custom.glass.border}`,
                bgcolor: selectedTasks[taskType] ? theme.custom.glass.glow?.['06'] || 'transparent' : 'transparent',
                transition: 'all 0.15s ease',
                '&:hover': { bgcolor: theme.custom.glass.glow?.['08'] || 'transparent' },
              }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={selectedTasks[taskType]}
                    onChange={() => handleTaskToggle(taskType)}
                    disabled={actionLoading}
                  />
                }
                label={
                  <Typography variant="body2" fontWeight={selectedTasks[taskType] ? 500 : 400}>
                    {config.label}
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
                width: 32, height: 32, borderRadius: '50%',
                bgcolor: `${theme.palette.info.main}22`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <TerminalIcon sx={{ color: theme.palette.info.main, fontSize: 18 }} />
            </Box>
            <Typography variant="subtitle1" fontWeight={700}>Task Progress</Typography>
          </Box>
          <Box
            sx={{
              bgcolor: isDark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.03)',
              border: `1px solid ${theme.custom.glass.border}`,
              borderRadius: '10px', p: 2, maxHeight: 200, overflow: 'auto',
              fontFamily: 'monospace', fontSize: 12,
            }}
          >
            {taskLogs.map((log, index) => (
              <Box key={index} sx={{ mb: 0.5, color: getLogColor(log.level), whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
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
              width: 32, height: 32, borderRadius: '50%',
              bgcolor: `${theme.palette.secondary.main}22`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <HistoryIcon sx={{ color: theme.palette.secondary.main, fontSize: 18 }} />
          </Box>
          <Typography variant="subtitle1" fontWeight={700}>Recent Task History</Typography>
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
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  p: 1.5, borderRadius: '10px',
                  border: `1px solid ${theme.custom.glass.border}`,
                  bgcolor: theme.custom.glass.cardBg,
                  '&:hover': { bgcolor: theme.custom.glass.glow?.['06'] || 'transparent' },
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
                  color={task.status === 'completed' ? 'success' : task.status === 'failed' ? 'error' : 'warning'}
                  size="small"
                />
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  )
}
