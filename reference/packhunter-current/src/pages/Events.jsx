import { useState, useEffect } from 'react'
import PageHeader from '../components/PageHeader'
import LoadingButton from '../components/LoadingButton'
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Chip,
  Grid,
  LinearProgress,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import {
  Sync as SyncIcon,
  Event as EventIcon,
  Timer as TimerIcon,
  SportsEsports as BattleIcon,
  AutoAwesome as FeedIcon,
  CardGiftcard as RewardIcon,
  CheckCircle as CheckIcon,
  Schedule as ScheduleIcon,
  Bolt as PowerIcon,
  Star as StarIcon,
} from '@mui/icons-material'
import { accounts as accountsApi, tasks as tasksApi, inventory as inventoryApi } from '../services/api'
import { useLanguage } from '../contexts/LanguageContext'
import { FadeIn } from '../components/Animations'
import { EmptyState } from '../components/EmptyState'
import { DashboardSkeleton } from '../components/skeletons/PageSkeletons'

// Format countdown timer with urgency info
const formatCountdown = (targetDate) => {
  if (!targetDate) return null
  const now = new Date()
  const target = new Date(targetDate)
  const diff = target - now

  if (diff <= 0) return { text: 'Expired', urgency: 'expired' }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  const seconds = Math.floor((diff % (1000 * 60)) / 1000)

  // Urgency levels for color coding
  const totalHours = diff / (1000 * 60 * 60)
  let urgency = 'relaxed' // >24h = green
  if (totalHours <= 1) urgency = 'critical' // <1h = red
  else if (totalHours <= 24) urgency = 'warning' // <24h = amber

  let text
  if (days > 0) text = `${days}d ${hours}h remaining`
  else if (hours > 0) text = `${hours}h ${minutes}m remaining`
  else text = `${minutes}m ${seconds}s remaining`

  return { text, urgency }
}

// Urgency color mapping
const URGENCY_COLORS = {
  relaxed: { bg: '#43a047', text: '#fff', border: '#2e7d32' },    // green >24h
  warning: { bg: '#f57c00', text: '#fff', border: '#e65100' },    // amber <24h
  critical: { bg: '#d32f2f', text: '#fff', border: '#b71c1c' },   // red <1h
  expired: { bg: '#616161', text: '#fff', border: '#424242' },     // grey expired
}

// Event type -> MUI palette key mapping
const EVENT_COLOR_MAP = {
  battle: 'error',
  feed: 'secondary',
  pass: 'warning',
  reward: 'success',
}

// Glass card style helper
const glassCardSx = (isDark) => ({
  borderRadius: '14px',
  border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
  bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
  backdropFilter: 'blur(12px)',
})

// Event Card component
const EventCard = ({ event, type }) => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'

  const colorKey = EVENT_COLOR_MAP[type] || 'info'
  const color = theme.palette[colorKey]?.main || theme.palette.info.main

  const getEventIcon = () => {
    switch (type) {
      case 'battle': return <BattleIcon />
      case 'feed': return <FeedIcon />
      case 'pass': return <StarIcon />
      case 'reward': return <RewardIcon />
      default: return <EventIcon />
    }
  }

  const countdown = formatCountdown(event.endAt || event.expireAt)
  const isExpired = countdown?.urgency === 'expired'
  const urgencyColors = countdown ? URGENCY_COLORS[countdown.urgency] : null

  return (
    <Box
      sx={{
        p: 2.5,
        ...glassCardSx(isDark),
        borderColor: isDark ? `${color}22` : `${color}30`,
        height: '100%',
        position: 'relative',
        opacity: isExpired ? 0.6 : 1,
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        borderLeft: `3px solid ${isExpired ? theme.palette.text.disabled : color}`,
        '&:hover': {
          transform: 'translateY(-3px)',
          boxShadow: isDark
            ? `0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px ${color}30`
            : `0 8px 24px rgba(0,0,0,0.08), 0 0 0 1px ${color}20`,
          borderColor: `${color}50`,
        },
      }}
    >
      {event.isNew && (
        <Chip
          label="NEW"
          size="small"
          sx={{
            position: 'absolute',
            top: -10,
            right: 16,
            background: 'linear-gradient(135deg, #d32f2f, #f44336)',
            color: 'white',
            fontWeight: 600,
            fontSize: '0.65rem',
          }}
        />
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
        <Box
          sx={{
            width: 44,
            height: 44,
            borderRadius: '12px',
            background: `linear-gradient(135deg, ${color}30, ${color}15)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Box sx={{ color, display: 'flex' }}>{getEventIcon()}</Box>
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '0.95rem', lineHeight: 1.3 }}>
            {event.name || event.title || `${type} Event`}
          </Typography>
          <Chip
            label={`${type.charAt(0).toUpperCase() + type.slice(1)} Event`}
            size="small"
            sx={{
              mt: 0.5,
              height: 20,
              fontSize: '0.65rem',
              fontWeight: 600,
              background: `linear-gradient(135deg, ${color}40, ${color}20)`,
              color: isDark ? '#fff' : color,
              border: `1px solid ${color}30`,
            }}
          />
        </Box>
      </Box>

      {event.description && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.5 }}>
          {event.description}
        </Typography>
      )}

      {/* Progress if available */}
      {event.progress !== undefined && (
        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="caption" color="text.secondary">Progress</Typography>
            <Typography variant="caption" sx={{ fontWeight: 600 }}>{Math.round(event.progress * 100)}%</Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={event.progress * 100}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              '& .MuiLinearProgress-bar': {
                borderRadius: 3,
                background: event.progress >= 1
                  ? `linear-gradient(90deg, ${theme.palette.success.main}, ${theme.palette.success.light})`
                  : event.progress >= 0.5
                    ? `linear-gradient(90deg, ${theme.palette.warning.main}, ${theme.palette.primary.main})`
                    : `linear-gradient(90deg, ${theme.palette.primary.main}, ${theme.palette.secondary.light})`,
              },
            }}
          />
        </Box>
      )}

      {/* Power/Stamina if available */}
      {event.power !== undefined && (
        <Box sx={{ mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
            <PowerIcon sx={{ fontSize: 16, color: 'warning.main' }} />
            <Typography variant="body2">
              Power: <strong>{event.power}/{event.maxPower || 5}</strong>
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={event.maxPower ? (event.power / event.maxPower) * 100 : 0}
            sx={{
              height: 4,
              borderRadius: 2,
              bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
              '& .MuiLinearProgress-bar': {
                borderRadius: 2,
                background: event.power === event.maxPower
                  ? `linear-gradient(90deg, ${theme.palette.success.main}, ${theme.palette.success.light})`
                  : `linear-gradient(90deg, ${theme.palette.warning.main}, ${theme.palette.warning.light})`,
              },
            }}
          />
        </Box>
      )}

      {/* Remaining count */}
      {event.remainingCount !== undefined && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <CheckIcon sx={{ fontSize: 16, color: 'success.main' }} />
          <Typography variant="body2">
            Attempts remaining: <strong>{event.remainingCount}</strong>
          </Typography>
        </Box>
      )}

      {/* Countdown timer - prominent with color-coded urgency */}
      {countdown && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
          <TimerIcon sx={{
            fontSize: 18,
            color: isExpired ? 'text.disabled' : urgencyColors?.bg || 'warning.main',
          }} />
          <Chip
            label={countdown.text}
            size="small"
            sx={{
              fontWeight: 700,
              fontSize: '0.72rem',
              letterSpacing: '0.02em',
              bgcolor: urgencyColors?.bg || 'action.disabledBackground',
              color: urgencyColors?.text || 'text.disabled',
              border: `1px solid ${urgencyColors?.border || 'transparent'}`,
              ...(countdown.urgency === 'critical' && {
                boxShadow: `0 0 8px ${urgencyColors.bg}40`,
              }),
            }}
          />
        </Box>
      )}
    </Box>
  )
}

function Events({ user }) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const { t } = useLanguage()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const [loading, setLoading] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [userAccounts, setUserAccounts] = useState([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [error, setError] = useState('')
  const [events, setEvents] = useState({
    battleEvents: [],
    feedChallenges: [],
    passEvents: [],
    rewardEvents: [],
  })
  const [lastRefresh, setLastRefresh] = useState(null)

  // Load user accounts on mount
  useEffect(() => {
    loadAccounts()
  }, [])

  // Load events when account is selected
  useEffect(() => {
    if (selectedAccount) {
      loadEvents()
    }
  }, [selectedAccount])

  // Auto-refresh timer - every 30s for countdown accuracy
  useEffect(() => {
    const interval = setInterval(() => {
      if (selectedAccount && !loadingData) {
        // Force re-render for countdown updates
        setLastRefresh(new Date())
      }
    }, 30000) // Update every 30s for better countdown precision

    return () => clearInterval(interval)
  }, [selectedAccount, loadingData])

  const loadAccounts = async () => {
    try {
      const data = await accountsApi.list()
      const activeAccounts = (data.accounts || []).filter(a => a.is_active)
      setUserAccounts(activeAccounts)

      if (activeAccounts.length === 1) {
        setSelectedAccount(activeAccounts[0].id)
      }
    } catch (err) {
      console.error('Failed to load accounts:', err)
      setError('Failed to load accounts')
    } finally {
      setLoading(false)
    }
  }

  const loadEvents = async () => {
    if (!selectedAccount) return

    setLoadingData(true)
    setError('')

    try {
      // Fetch Wonder Pick data (contains feed challenges and challenge power)
      let wonderPickData = null
      try {
        wonderPickData = await tasksApi.getWonderPicks(selectedAccount)
      } catch (e) {
      }

      // Fetch inventory data for power chargers and reward tickets
      let inventoryData = null
      try {
        inventoryData = await inventoryApi.getAll(selectedAccount)
      } catch (e) {
      }

      // Extract feed challenges with time-limited info from Wonder Pick
      const feedChallenges = (wonderPickData?.wonderPicks || [])
        .filter(pick => pick.challengeInfo)
        .map(pick => ({
          id: pick.feedId,
          name: pick.title || 'Wonder Pick Challenge',
          description: `Stamina cost: ${pick.challengeInfo?.requireFeedStamina || 0}`,
          endAt: pick.challengeInfo?.endAt,
          startAt: pick.challengeInfo?.startAt,
          remainingCount: pick.challengeInfo?.remainingCount,
          isNew: pick.isNew,
          power: wonderPickData?.challengePower?.amount,
          maxPower: 5,
        }))

      // Event battles from inventory event power chargers
      const inventory = inventoryData?.inventory || {}
      const eventPower = inventory.eventPower || []
      const battleEvents = eventPower.map((power, idx) => ({
        id: `event_power_${power.id || idx}`,
        name: `Event Power #${power.id || idx + 1}`,
        description: `Event power charger with ${power.amount || 0} remaining`,
        power: power.amount || 0,
        maxPower: 5,
        expireAt: power.expireAt,
      })).filter(event => event.power > 0)

      // Trade power from inventory
      const tradePower = inventory.tradePower || []
      const tradePowerEvents = tradePower.map((power, idx) => ({
        id: `trade_power_${power.id || idx}`,
        name: `Trade Power #${power.id || idx + 1}`,
        description: `Trade power charger with ${power.amount || 0} remaining`,
        power: power.amount || 0,
        maxPower: 5,
      })).filter(event => event.power > 0)

      // Challenge power from inventory
      const challengePower = inventory.challengePower || []
      const challengePowerEvents = challengePower.map((power, idx) => ({
        id: `challenge_power_${power.type || idx}`,
        name: `Challenge Power`,
        description: `Wonder Pick challenge power: ${power.amount || 0} remaining`,
        power: power.amount || 0,
        maxPower: 5,
      })).filter(event => event.power > 0)

      // Reward tickets from inventory
      const rewardTickets = inventory.rewardTickets || []
      const rewardEvents = rewardTickets.map((ticket, idx) => ({
        id: `ticket_${ticket.id || idx}`,
        name: 'Event Reward Ticket',
        description: `Type: ${ticket.type || 'Unknown'} - Amount: ${ticket.amount || 1}`,
        expireAt: ticket.expireAt,
      }))

      // Combine all power events
      const allBattleEvents = [...battleEvents, ...tradePowerEvents, ...challengePowerEvents]

      setEvents({
        battleEvents: allBattleEvents,
        feedChallenges,
        passEvents: [], // No mock data - pass events require live session
        rewardEvents,
      })

      setLastRefresh(new Date())

    } catch (err) {
      console.error('Failed to load events:', err)
      setError(`Failed to load events: ${err.message}`)
    } finally {
      setLoadingData(false)
    }
  }

  const totalActiveEvents =
    events.battleEvents.length +
    events.feedChallenges.length +
    events.passEvents.length +
    events.rewardEvents.length

  if (loading) {
    return <DashboardSkeleton />
  }

  const sectionHeaderSx = {
    fontWeight: 600,
    fontSize: '0.85rem',
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    color: 'text.secondary',
    display: 'flex',
    alignItems: 'center',
    gap: 1,
    mb: 2,
  }

  return (
    <FadeIn>
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <PageHeader
          icon={<EventIcon />}
          title={t('nav.events') || 'Events'}
          subtitle="View active events, limited-time challenges, and special rewards"
        />

        <Alert severity="info" sx={{ mt: 2, mb: 2, borderRadius: '10px' }}>
          Events are fetched from your game account. This includes power chargers, wonder pick challenges, and reward tickets.
        </Alert>

        {/* Control bar */}
        <Box
          sx={{
            p: 2,
            ...glassCardSx(isDark),
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          <FormControl size="small" sx={{ minWidth: 200, ...(isMobile && { width: '100%' }) }}>
            <InputLabel>Select Account</InputLabel>
            <Select
              value={selectedAccount}
              label="Select Account"
              onChange={(e) => setSelectedAccount(e.target.value)}
            >
              {userAccounts.map((account) => (
                <MenuItem key={account.id} value={account.id}>
                  {account.nickname || account.device_account?.substring(0, 8) || `Account ${account.id}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <LoadingButton
            loading={loadingData}
            startIcon={<SyncIcon />}
            onClick={loadEvents}
            disabled={!selectedAccount || loadingData}
            fullWidth={isMobile}
            color="primary"
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.light})`,
              '&:hover': { background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.main})` },
            }}
          >
            {loadingData ? 'Loading...' : 'Refresh'}
          </LoadingButton>

          {selectedAccount && !isMobile && (
            <Chip
              icon={<EventIcon sx={{ fontSize: 16 }} />}
              label={`${totalActiveEvents} Active Events`}
              color="primary"
              variant="outlined"
              size="small"
              sx={{ ml: 'auto' }}
            />
          )}
        </Box>

        {/* Mobile active events count */}
        {selectedAccount && isMobile && totalActiveEvents > 0 && (
          <Box sx={{ mt: 1, textAlign: 'center' }}>
            <Chip
              icon={<EventIcon sx={{ fontSize: 16 }} />}
              label={`${totalActiveEvents} Active Events`}
              color="primary"
              variant="outlined"
              size="small"
            />
          </Box>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: '10px' }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* No account selected */}
      {!selectedAccount && (
        <EmptyState
          icon={<EventIcon />}
          title="No Account Selected"
          description="Select an account to view active events"
        />
      )}

      {/* Loading */}
      {selectedAccount && loadingData && (
        <DashboardSkeleton />
      )}

      {/* Events content */}
      {selectedAccount && !loadingData && (
        <>
          {totalActiveEvents === 0 ? (
            <EmptyState
              icon={<ScheduleIcon />}
              title="No Active Events"
              description="No active events at this time. Check back later!"
              action={
                <LoadingButton
                  loading={loadingData}
                  startIcon={<SyncIcon />}
                  onClick={loadEvents}
                  color="primary"
                >
                  Refresh Events
                </LoadingButton>
              }
            />
          ) : (
            <>
              {/* Battle Events */}
              {events.battleEvents.length > 0 && (
                <Box sx={{ mb: 4 }}>
                  <Typography sx={sectionHeaderSx}>
                    <BattleIcon sx={{ fontSize: 16, color: 'error.main' }} />
                    Event Battles
                    <Chip
                      label={events.battleEvents.length}
                      size="small"
                      sx={{
                        ml: 0.5,
                        height: 20,
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        background: 'linear-gradient(135deg, #c62828, #ef5350)',
                        color: '#fff',
                      }}
                    />
                  </Typography>
                  <Grid container spacing={2}>
                    {events.battleEvents.map((event) => (
                      <Grid item xs={12} sm={6} md={4} key={event.id}>
                        <EventCard event={event} type="battle" />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}

              {/* Feed Challenges */}
              {events.feedChallenges.length > 0 && (
                <Box sx={{ mb: 4 }}>
                  <Typography sx={sectionHeaderSx}>
                    <FeedIcon sx={{ fontSize: 16, color: 'secondary.main' }} />
                    Wonder Pick Challenges
                    <Chip
                      label={events.feedChallenges.length}
                      size="small"
                      sx={{
                        ml: 0.5,
                        height: 20,
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        background: `linear-gradient(135deg, ${theme.palette.secondary.main}, ${theme.palette.secondary.light})`,
                        color: '#fff',
                      }}
                    />
                  </Typography>
                  <Grid container spacing={2}>
                    {events.feedChallenges.map((event) => (
                      <Grid item xs={12} sm={6} md={4} key={event.id}>
                        <EventCard event={event} type="feed" />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}

              {/* Pass/Season Events */}
              {events.passEvents.length > 0 && (
                <Box sx={{ mb: 4 }}>
                  <Typography sx={sectionHeaderSx}>
                    <StarIcon sx={{ fontSize: 16, color: 'warning.main' }} />
                    Season Pass
                    <Chip
                      label={events.passEvents.length}
                      size="small"
                      sx={{
                        ml: 0.5,
                        height: 20,
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        background: 'linear-gradient(135deg, #ef6c00, #ffa726)',
                        color: '#fff',
                      }}
                    />
                  </Typography>
                  <Grid container spacing={2}>
                    {events.passEvents.map((event) => (
                      <Grid item xs={12} sm={6} md={4} key={event.id}>
                        <EventCard event={event} type="pass" />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}

              {/* Reward Events */}
              {events.rewardEvents.length > 0 && (
                <Box sx={{ mb: 4 }}>
                  <Typography sx={sectionHeaderSx}>
                    <RewardIcon sx={{ fontSize: 16, color: 'success.main' }} />
                    Limited-Time Rewards
                    <Chip
                      label={events.rewardEvents.length}
                      size="small"
                      sx={{
                        ml: 0.5,
                        height: 20,
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        background: 'linear-gradient(135deg, #2e7d32, #66bb6a)',
                        color: '#fff',
                      }}
                    />
                  </Typography>
                  <Grid container spacing={2}>
                    {events.rewardEvents.map((event) => (
                      <Grid item xs={12} sm={6} md={4} key={event.id}>
                        <EventCard event={event} type="reward" />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}
            </>
          )}

          {/* Last refresh indicator */}
          {lastRefresh && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 2 }}>
              Last updated: {lastRefresh.toLocaleTimeString()}
            </Typography>
          )}
        </>
      )}
    </Box>
    </FadeIn>
  )
}

export default Events
