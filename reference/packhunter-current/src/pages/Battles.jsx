/**
 * Battles — Shared parent page for Solo, Event, and Random battles.
 * Provides a tabbed interface with deep link support (?tab=solo|event|random).
 * Each battle type is rendered as a tab panel using the existing page components.
 */

import { useState, useMemo, lazy, Suspense } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Box,
  Tabs,
  Tab,
  CircularProgress,
  IconButton,
  Tooltip,
  Button,
  Alert,
  Chip,
  Typography,
  useTheme,
  useMediaQuery,
} from '@mui/material'
import {
  SportsEsports as SoloBattleIcon,
  EmojiEvents as EventBattleIcon,
  Casino as RandomBattleIcon,
  Refresh as RefreshIcon,
  PlayArrow as PlayIcon,
  Warning as WarningIcon,
  AccessTime as TimeIcon,
  CheckCircle as CheckIcon,
} from '@mui/icons-material'
import { missions as missionsApi } from '../services/api'
import { useAccount } from '../contexts/AccountContext'
import PageHeader from '../components/PageHeader'
import { FadeIn } from '../components/Animations'
import { useSectionStyles } from '../components/SectionCard'
import BattleHistory from '../components/BattleHistory'
import AccountSelector from '../components/AccountSelector'
import { CHIP } from '../constants/designTokens'

// Lazy-load battle pages for code splitting
const SoloBattle = lazy(() => import('./SoloBattle'))
const EventBattle = lazy(() => import('./EventBattle'))
const RandomBattle = lazy(() => import('./RandomBattle'))

const TAB_MAP = { solo: 0, event: 1, random: 2 }
const TAB_NAMES = ['solo', 'event', 'random']

export default function Battles({ user }) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const { sectionBox } = useSectionStyles()
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = useMemo(() => TAB_MAP[searchParams.get('tab')] ?? 0, [])
  const [tab, setTab] = useState(initialTab)

  // Shared account state from context — no duplicate fetch
  const { accounts: linkedAccounts, selectedAccountId, selectAccount, loading: accountsLoading } = useAccount()
  const selectedAccount = selectedAccountId || ''

  // Quick Run Daily state
  const [quickRunning, setQuickRunning] = useState(false)
  const [quickResult, setQuickResult] = useState(null)
  const [quickResultTime, setQuickResultTime] = useState(null)

  const handleQuickRunDaily = async () => {
    if (!selectedAccount) return
    setQuickRunning(true)
    setQuickResult(null)
    setQuickResultTime(null)
    try {
      const result = await missionsApi.claimAllRewards(selectedAccount)
      if (result.error) {
        setQuickResult({ error: result.error })
      } else {
        setQuickResult(result.claimed || {})
        setQuickResultTime(new Date())
      }
    } catch (e) {
      setQuickResult({ error: e.message })
    }
    setQuickRunning(false)
  }

  const handleTabChange = (_, newTab) => {
    setTab(newTab)
    setSearchParams({ tab: TAB_NAMES[newTab] }, { replace: true })
  }

  const tabSx = {
    fontSize: '0.85rem',
    fontWeight: 600,
    textTransform: 'none',
    minHeight: 44,
  }

  const activeAccounts = linkedAccounts.filter(a => a.is_active)

  return (
    <FadeIn>
      <Box>
        <PageHeader
          icon={<SoloBattleIcon />}
          title="Battles"
          subtitle="Solo, event, and random battles"
        />

        {/* Quick Run Daily — runs battles + claims all daily rewards in one click */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 2, mb: 2, px: 2, py: 1.5,
          borderRadius: '12px',
          bgcolor: theme.palette.mode === 'dark' ? 'rgba(124,138,255,0.04)' : 'rgba(92,106,196,0.03)',
          border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(124,138,255,0.12)' : 'rgba(0,0,0,0.06)'}`,
          flexWrap: 'wrap',
        }}>
          <Button
            variant="contained"
            startIcon={quickRunning ? <CircularProgress size={16} color="inherit" /> : <PlayIcon />}
            onClick={handleQuickRunDaily}
            disabled={quickRunning || !selectedAccount}
            sx={{
              borderRadius: '10px', fontWeight: 700, textTransform: 'none',
              background: `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`,
            }}
          >
            {quickRunning ? 'Running...' : 'Quick Run Daily'}
          </Button>
          <Chip label="Runs battles + claims all daily rewards" size="small" variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
          {quickResult?.error && (
            <Alert severity="error" sx={{ flex: 1, py: 0, borderRadius: '8px' }} icon={<WarningIcon sx={{ fontSize: 16 }} />}>
              {quickResult.error}
            </Alert>
          )}
        </Box>

        {/* ── Quick Run Daily Result Card ── */}
        {quickResult && !quickResult.error && (
          <Box sx={{
            mb: 2, px: 2, py: 1.5, borderRadius: '12px',
            bgcolor: theme.palette.mode === 'dark' ? 'rgba(46, 125, 50, 0.06)' : 'rgba(46, 125, 50, 0.03)',
            border: `1px solid ${theme.palette.mode === 'dark' ? 'rgba(46, 125, 50, 0.2)' : 'rgba(46, 125, 50, 0.12)'}`,
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <CheckIcon sx={{ fontSize: 16, color: theme.palette.success.main }} />
              <Typography variant="caption" sx={{ fontWeight: 700, color: theme.palette.success.main, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Daily Run Complete
              </Typography>
              {quickResultTime && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.3, ml: 'auto' }}>
                  <TimeIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                  <Typography variant="caption" sx={{ color: 'text.disabled', fontSize: '0.6rem' }}>
                    {quickResultTime.toLocaleTimeString()}
                  </Typography>
                </Box>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
              {[
                quickResult.dailyBattles > 0 && { label: `${quickResult.dailyBattles} battles`, color: 'success' },
                quickResult.dailyRewards > 0 && { label: `${quickResult.dailyRewards} rewards`, color: 'warning' },
                quickResult.hourglasses > 0 && { label: `${quickResult.hourglasses} HG groups`, color: 'info' },
                quickResult.dailyGift && { label: 'Daily gift', color: 'secondary' },
                quickResult.presents > 0 && { label: `${quickResult.presents} presents`, color: 'default' },
                quickResult.shinedust > 0 && { label: `${quickResult.shinedust} shinedust`, color: 'primary' },
              ].filter(Boolean).map((item, i) => (
                <Chip key={i} label={item.label} size="small" color={item.color} sx={{ ...CHIP.md }} />
              ))}
            </Box>
          </Box>
        )}

        <Alert severity="warning" sx={{ mb: 2, borderRadius: '12px' }} icon={<WarningIcon />}>
          Running battles will trigger "another login detected" on mobile. Re-open the app after WebUI battles finish.
        </Alert>

        {/* Shared account selector */}
        {activeAccounts.length > 1 && (
          <Box sx={{ ...sectionBox, mb: 2, display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap', p: 1.5 }}>
            <AccountSelector />
          </Box>
        )}

        <Tabs
          value={tab}
          onChange={handleTabChange}
          variant={isMobile ? 'scrollable' : 'standard'}
          scrollButtons={isMobile ? 'auto' : false}
          allowScrollButtonsMobile
          sx={{ mb: 2 }}
        >
          <Tab icon={<SoloBattleIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Solo" sx={tabSx} />
          <Tab icon={<EventBattleIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Event" sx={tabSx} />
          <Tab icon={<RandomBattleIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Random" sx={tabSx} />
        </Tabs>

        {accountsLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Suspense fallback={
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          }>
            {tab === 0 && <SoloBattle user={user} embedded externalAccount={selectedAccount} externalAccounts={linkedAccounts} />}
            {tab === 1 && <EventBattle user={user} embedded externalAccount={selectedAccount} externalAccounts={linkedAccounts} />}
            {tab === 2 && <RandomBattle user={user} embedded externalAccount={selectedAccount} externalAccounts={linkedAccounts} />}
          </Suspense>
        )}

        {/* Battle History — persistent results across sessions */}
        <BattleHistory accountId={selectedAccount} />
      </Box>
    </FadeIn>
  )
}
