import { useState, useEffect, useCallback } from 'react'
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
  Tooltip,
  Snackbar,
  useTheme,
} from '@mui/material'
import {
  Sync as SyncIcon,
  LocalFireDepartment as PackPowerIcon,
  AutoAwesome as ChallengePowerIcon,
  SwapHoriz as TradePowerIcon,
  EmojiEvents as EventPowerIcon,
  Timer as TimerIcon,
  HourglassEmpty as HourglassIcon,
  Healing as HealIcon,
} from '@mui/icons-material'
import { accounts as accountsApi, tasks as tasksApi } from '../services/api'
import useHealAction from '../hooks/useHealAction'
import { useTicker } from '../hooks/useTicker'
import { useLanguage } from '../contexts/LanguageContext'
import { FadeIn } from '../components/Animations'
import { EmptyState } from '../components/EmptyState'
import { DashboardSkeleton } from '../components/skeletons/PageSkeletons'
import PageHeader from '../components/PageHeader'
import { useSectionStyles } from '../components/SectionCard'

// Stamina type configurations - uses MUI palette keys resolved at render time
const STAMINA_TYPES = {
  pack: {
    label: 'Pack Power',
    description: 'Stamina used for opening packs',
    icon: PackPowerIcon,
    colorKey: 'success',
    max: 2,
    regenTime: '12 hours per point',
  },
  challenge: {
    label: 'Wonder Pick Stamina',
    description: 'Stamina used for Wonder Pick',
    icon: ChallengePowerIcon,
    colorKey: 'secondary',
    max: 5,
    regenTime: '12 hours per point',
  },
  trade: {
    label: 'Trade Power',
    description: 'Stamina used for trading cards',
    icon: TradePowerIcon,
    colorKey: 'info',
    max: 5,
    regenTime: '24 hours per point',
  },
  event: {
    label: 'Event Power',
    description: 'Charger items for event battles',
    icon: EventPowerIcon,
    colorKey: 'warning',
    max: 0,
    regenTime: 'Earned from events',
  },
}

// Format countdown time
const formatCountdown = (timestamp) => {
  if (!timestamp) return null

  const targetTime = typeof timestamp === 'number' ? timestamp * 1000 : new Date(timestamp).getTime()
  const now = Date.now()
  const diff = targetTime - now

  if (diff <= 0) return 'Ready!'

  const hours = Math.floor(diff / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  }
  return `${seconds}s`
}

// Get bar color based on stamina fill level
const getBarColor = (current, max) => {
  if (current <= 0) return '#ff5252'        // Red when empty
  if (current >= max) return '#34d399'       // Green when full
  if (current / max < 0.5) return '#fbbf24'  // Amber when < 50%
  return null                                 // null = use default theme color
}

// Format seconds into human-readable countdown
const formatSecondsCountdown = (totalSeconds) => {
  if (totalSeconds <= 0) return 'Ready!'
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = Math.floor(totalSeconds % 60)
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m ${seconds}s`
  return `${seconds}s`
}

// Circular SVG gauge for stamina display
const StaminaGauge = ({ current, max, color, size = 80, strokeWidth = 6 }) => {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0
  const r = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * r
  const offset = circumference - (pct / 100) * circumference
  return (
    <Box sx={{ position: 'relative', width: size, height: size, mx: 'auto' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
        <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color, lineHeight: 1 }}>{current}</Typography>
        <Typography sx={{ fontSize: '0.55rem', color: 'text.secondary' }}>/{max}</Typography>
      </Box>
    </Box>
  )
}

// Stamina Card component - themed Box with circular gauge hero visual
const StaminaCard = ({ type, current, max, healAt, healSecPerPower, autoHealLimit, manualHealLimit, isChargerCount, onHeal, healLoading }) => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const config = STAMINA_TYPES[type]
  const Icon = config.icon
  const defaultColor = theme.palette[config.colorKey]?.main || theme.palette.primary.main
  const isStamina = max > 0 && !isChargerCount

  // Color-coded gauge: green=full, amber=<50%, red=empty, default otherwise
  const gaugeColor = isStamina ? (getBarColor(current, max) || defaultColor) : defaultColor
  const color = defaultColor // keep icon/header color as theme default

  // Wave 3: countdown values are derived inline on every tick of the
  // shared 1s ticker. No more per-card setInterval; multiple StaminaCards
  // mounted on the page share ONE timer.
  const isCharging = isStamina && current < max
  useTicker({ enabled: isCharging })

  const { countdown, nextPointIn, fullIn } = (() => {
    if (!isCharging) return { countdown: null, nextPointIn: null, fullIn: null }
    const baseCountdown = formatCountdown(healAt)
    if (!healAt || !healSecPerPower) {
      return { countdown: baseCountdown, nextPointIn: null, fullIn: null }
    }
    const targetTime = typeof healAt === 'number' ? healAt * 1000 : new Date(healAt).getTime()
    const now = Date.now()
    const secsToNext = Math.max(0, Math.floor((targetTime - now) / 1000))
    const remainingAfterNext = max - current - 1
    const secsToFull = secsToNext + (remainingAfterNext * healSecPerPower)
    return {
      countdown: baseCountdown,
      nextPointIn: formatSecondsCountdown(secsToNext),
      fullIn: formatSecondsCountdown(secsToFull),
    }
  })()

  return (
    <Box
      sx={{
        p: 2.5,
        borderRadius: '14px',
        border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
        bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        '&:hover': {
          borderColor: isDark ? `${color}30` : `${color}40`,
          boxShadow: `0 0 20px ${color}10`,
        },
      }}
    >
      {/* Header row: icon + name + FULL chip */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '10px',
            background: `linear-gradient(135deg, ${color}cc, ${color}88)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon sx={{ color: 'white', fontSize: 18 }} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
            {config.label}
          </Typography>
          <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary', lineHeight: 1.3 }}>
            {config.description}
          </Typography>
        </Box>
        {current >= max && isStamina && (
          <Chip label="FULL" color="success" size="small" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 700 }} />
        )}
      </Box>

      {/* Circular Gauge - hero visual */}
      {isStamina ? (
        <Box sx={{ my: 1.5 }}>
          <StaminaGauge current={current} max={max} color={gaugeColor} size={80} strokeWidth={6} />
          {/* Percentage label */}
          <Typography
            sx={{
              textAlign: 'center',
              fontSize: '0.7rem',
              color: 'text.secondary',
              mt: 0.75,
              fontWeight: 500,
            }}
          >
            {Math.round(max > 0 ? (current / max) * 100 : 0)}% charged
          </Typography>
        </Box>
      ) : (
        /* Charger count display (event power) */
        <Box sx={{ textAlign: 'center', my: 2 }}>
          <Typography variant="h3" sx={{ fontWeight: 800, color, lineHeight: 1 }}>
            {current ?? '-'}
          </Typography>
          {isChargerCount && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              chargers
            </Typography>
          )}
        </Box>
      )}

      {/* Countdown Timers — Next point & Full recovery */}
      {isStamina && current < max && (nextPointIn || countdown) && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1.5 }}>
          {/* Next point timer */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <TimerIcon sx={{ fontSize: 15, color: 'warning.main' }} />
            <Typography variant="caption" color="text.secondary">Next in:</Typography>
            <Chip
              label={nextPointIn || countdown}
              size="small"
              color="warning"
              variant="outlined"
              sx={{ height: 18, fontSize: '0.65rem' }}
            />
          </Box>
          {/* Full recovery timer (only if more than 1 point away) */}
          {fullIn && (max - current) > 1 && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
              <HourglassIcon sx={{ fontSize: 15, color: 'info.main' }} />
              <Typography variant="caption" color="text.secondary">Full in:</Typography>
              <Chip
                label={fullIn}
                size="small"
                color="info"
                variant="outlined"
                sx={{ height: 18, fontSize: '0.65rem' }}
              />
            </Box>
          )}
        </Box>
      )}

      {/* Regen Info */}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, opacity: 0.7 }}>
        {config.regenTime}
      </Typography>

      {/* Heal Limits (if available) */}
      {(autoHealLimit !== undefined || manualHealLimit !== undefined) && (
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
          {autoHealLimit !== undefined && (
            <Tooltip title="Auto-heals remaining today">
              <Chip label={`Auto: ${autoHealLimit}`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
            </Tooltip>
          )}
          {manualHealLimit !== undefined && (
            <Tooltip title="Manual heals remaining today">
              <Chip label={`Manual: ${manualHealLimit}`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
            </Tooltip>
          )}
        </Box>
      )}

      {/* Spacer to push heal buttons to bottom */}
      <Box sx={{ flex: 1 }} />

      {/* Hourglass hint */}
      {isStamina && current < max && !onHeal && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
          <HourglassIcon sx={{ fontSize: 13, color: 'text.disabled' }} />
          <Typography sx={{ fontSize: '0.65rem', color: 'text.disabled' }}>
            Use hourglasses to restore faster
          </Typography>
        </Box>
      )}

      {/* Heal Buttons */}
      {onHeal && current < max && (
        <Box sx={{ display: 'flex', gap: 1, mt: 1.5 }}>
          <Tooltip title="Uses 12 chargers to restore 1 stamina point">
            <Button
              variant="outlined"
              size="small"
              startIcon={healLoading ? <CircularProgress size={12} /> : <HealIcon sx={{ fontSize: 14 }} />}
              disabled={healLoading}
              onClick={() => onHeal(12, 0)}
              sx={{
                textTransform: 'none',
                borderColor: color,
                color,
                fontSize: '0.75rem',
                py: 0.4,
                '&:hover': { borderColor: color, backgroundColor: `${color}10` },
              }}
            >
              +1 Stamina
            </Button>
          </Tooltip>
          <Tooltip title={`Uses ${(max - current) * 12} chargers to fully restore stamina`}>
            <Button
              variant="outlined"
              size="small"
              startIcon={healLoading ? <CircularProgress size={12} /> : <HealIcon sx={{ fontSize: 14 }} />}
              disabled={healLoading}
              onClick={() => onHeal((max - current) * 12, 0)}
              sx={{
                textTransform: 'none',
                borderColor: theme.palette.warning.main,
                color: theme.palette.warning.main,
                fontSize: '0.75rem',
                py: 0.4,
                '&:hover': {
                  borderColor: theme.palette.warning.dark,
                  backgroundColor: `${theme.palette.warning.main}14`,
                },
              }}
            >
              Full Refill
            </Button>
          </Tooltip>
        </Box>
      )}
    </Box>
  )
}

function StaminaDashboard({ user }) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [userAccounts, setUserAccounts] = useState([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [error, setError] = useState('')
  const [staminaData, setStaminaData] = useState({
    pack: { current: 0, max: 5, healAt: null },
    challenge: { current: 0, max: 5, healAt: null },
    trade: { current: 0, max: 5, healAt: null },
    event: { current: 0, max: 5, healAt: null },
  })
  const [resources, setResources] = useState({ hourglasses: 0, shopTickets: 0 })
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' })

  const { sectionBox: cardSx } = useSectionStyles()

  // Load user accounts on mount
  useEffect(() => {
    loadAccounts()
  }, [])

  // Load stamina data when account is selected
  useEffect(() => {
    if (selectedAccount) {
      loadStaminaData()
    }
  }, [selectedAccount])

  const loadAccounts = async () => {
    try {
      const data = await accountsApi.list()
      const activeAccounts = (data.accounts || []).filter(a => a.is_active)
      setUserAccounts(activeAccounts)

      // Auto-select first account if only one
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

  const loadStaminaData = useCallback(async () => {
    if (!selectedAccount) return

    setLoadingData(true)
    setError('')

    try {
      // Fetch stamina data - resources endpoint now includes trade/challenge/event power
      const [picksData, resourcesData] = await Promise.all([
        tasksApi.getWonderPicks(selectedAccount).catch(() => null),
        tasksApi.getResources(selectedAccount).catch(() => null),
      ])

      // Challenge Power (Wonder Pick) - REAL stamina from wonder-picks endpoint
      // picksData.challengePower has real {current, max, healAt} from Feed/GetTimelineV1
      const challengePower = picksData?.challengePower || {}

      // Trade Power - REAL stamina from Trade/GetTradePowerV1 via resources endpoint
      const tradePower = resourcesData?.tradePower || {}

      // Event Power - charger item count (not real stamina)
      const eventPower = resourcesData?.eventPower || {}

      // Pack Power - REAL stamina from Pack/GetPackPowerV1 via resources endpoint
      const packPower = resourcesData?.packPower || {}

      setStaminaData({
        pack: {
          current: packPower.current ?? 0,
          max: packPower.max ?? 2,
          healAt: packPower.nextHealAt || null,
          healSecPerPower: packPower.healSecPerPower || 43200,
          manualHealLimit: packPower.manualHealLimit,
        },
        challenge: {
          current: challengePower.current ?? 0,
          max: challengePower.max ?? challengePower.autoHealLimit ?? 5,
          healAt: challengePower.healAt,
          healSecPerPower: challengePower.healSecPerPower || 43200,
        },
        trade: {
          current: tradePower.current ?? 0,
          max: tradePower.max ?? 5,
          healAt: tradePower.nextHealAt || null,
          healSecPerPower: tradePower.healSecPerPower || 86400,
        },
        event: {
          current: eventPower.current ?? 0,
          max: eventPower.isChargerCount ? 0 : (eventPower.max ?? 5),
          isChargerCount: eventPower.isChargerCount || false,
        },
      })

      setResources({
        hourglasses: resourcesData?.hourglasses ?? 0,
        wpChargers: resourcesData?.wpChargers ?? 0,
        gold: resourcesData?.gold ?? 0,
        shinedust: resourcesData?.shinedust ?? 0,
      })

    } catch (err) {
      console.error('Failed to load stamina data:', err)
      setError(`Failed to load stamina data: ${err.message}`)
    } finally {
      setLoadingData(false)
    }
  }, [selectedAccount])

  // Shared heal action hook (must be after loadStaminaData definition)
  const healApi = useCallback(
    (chargersAmount, vcAmount) => tasksApi.healChallengePower(selectedAccount, chargersAmount, vcAmount),
    [selectedAccount]
  )
  const { healLoading, handleHeal: doHeal } = useHealAction(healApi, loadStaminaData, 1000)

  // Handle challenge power heal (via shared hook)
  const handleChallengeHeal = async (chargersAmount, vcAmount) => {
    const result = await doHeal(chargersAmount, vcAmount)
    setSnackbar({
      open: true,
      message: result.success
        ? `Challenge power healed! Used ${chargersAmount} chargers. Refreshing...`
        : `Heal failed: ${result.error}`,
      severity: result.success ? 'success' : 'error',
    })
  }

  if (loading) {
    return <DashboardSkeleton />
  }

  return (
    <FadeIn>
    <Box>
      {/* Header */}
      <PageHeader
        icon={<PackPowerIcon />}
        title={t('nav.stamina') || 'Stamina Dashboard'}
        subtitle="Monitor all stamina types and recovery timers"
        accent={theme.palette.success.main}
      />

      {/* Control bar */}
      <Box
        sx={{
          ...cardSx,
          mb: 3,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <FormControl size="small" sx={{ minWidth: 200 }}>
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

        <Button
          variant="contained"
          startIcon={loadingData ? <CircularProgress size={16} color="inherit" /> : <SyncIcon />}
          onClick={loadStaminaData}
          disabled={!selectedAccount || loadingData}
          sx={{
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            '&:hover': {
              background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.dark})`,
            },
          }}
        >
          {loadingData ? 'Loading...' : 'Refresh'}
        </Button>

        {/* Resources display */}
        {selectedAccount && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 'auto' }}>
            <Tooltip title="Pack Hourglasses — used to open packs (12 = 1 pack)">
              <Chip
                icon={<HourglassIcon sx={{ fontSize: 16 }} />}
                label={`${resources.hourglasses || 0} Pack HG`}
                color="info"
                variant="outlined"
                size="small"
              />
            </Tooltip>
            <Tooltip title="Wonder Hourglasses — used to refill Wonder Pick stamina">
              <Chip
                icon={<ChallengePowerIcon sx={{ fontSize: 16 }} />}
                label={`${resources.wpChargers || 0} WP HG`}
                color="secondary"
                variant="outlined"
                size="small"
              />
            </Tooltip>
            <Tooltip title="Poke Gold — used for Gold Packs (25 = 1 pack)">
              <Chip
                label={`${resources.gold || 0} Gold`}
                color="warning"
                variant="outlined"
                size="small"
              />
            </Tooltip>
          </Box>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* No account selected message */}
      {!selectedAccount && (
        <EmptyState
          icon={<PackPowerIcon />}
          title="No Account Selected"
          description="Select an account to view stamina status"
        />
      )}

      {/* Loading state */}
      {selectedAccount && loadingData && (
        <DashboardSkeleton />
      )}

      {/* Stamina Cards Grid */}
      {selectedAccount && !loadingData && (
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={6}>
            <StaminaCard
              type="pack"
              current={staminaData.pack.current}
              max={staminaData.pack.max}
              healAt={staminaData.pack.healAt}
              healSecPerPower={staminaData.pack.healSecPerPower}
              autoHealLimit={staminaData.pack.autoHealLimit}
              manualHealLimit={staminaData.pack.manualHealLimit}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <StaminaCard
              type="challenge"
              current={staminaData.challenge.current}
              max={staminaData.challenge.max}
              healAt={staminaData.challenge.healAt}
              healSecPerPower={staminaData.challenge.healSecPerPower}
              onHeal={handleChallengeHeal}
              healLoading={healLoading}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <StaminaCard
              type="trade"
              current={staminaData.trade.current}
              max={staminaData.trade.max}
              healAt={staminaData.trade.healAt}
              healSecPerPower={staminaData.trade.healSecPerPower}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <StaminaCard
              type="event"
              current={staminaData.event.current}
              max={staminaData.event.max}
              healAt={staminaData.event.healAt}
              isChargerCount={staminaData.event.isChargerCount}
            />
          </Grid>
        </Grid>
      )}

      {/* Additional Info */}
      {selectedAccount && !loadingData && (
        <Box sx={{ ...cardSx, mt: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
            <HealIcon sx={{ color: theme.palette.success.main, fontSize: 18 }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              Stamina Recovery Tips
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            {[
              { label: 'Pack Power', desc: 'Each hourglass restores 1 pack power. Natural regen: 12 hours per point.' },
              { label: 'Challenge Power', desc: 'Regenerates every 12 hours per point. Each charger advances regen by 1 hour (12 chargers = 1 stamina).' },
              { label: 'Trade Power', desc: 'Regenerates once per day. Each trade consumes 1 trade power.' },
              { label: 'Event Power', desc: 'Used for special event battles. Regeneration varies by event.' },
            ].map((tip) => (
              <Typography key={tip.label} variant="body2" color="text.secondary">
                <Box component="span" sx={{ fontWeight: 600, color: 'text.primary' }}>{tip.label}:</Box>{' '}
                {tip.desc}
              </Typography>
            ))}
          </Box>
        </Box>
      )}

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
    </FadeIn>
  )
}

export default StaminaDashboard
