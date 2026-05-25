import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Grid,
  Button,
  Alert,
  Chip,
  CircularProgress,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Badge,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Pagination,
  useTheme,
} from '@mui/material'
import {
  CardGiftcard as GiftIcon,
  Redeem as RedeemIcon,
  Refresh as RefreshIcon,
  HourglassEmpty as HourglassIcon,
  AutoAwesome as ShinedustIcon,
  LocalActivity as TicketIcon,
  Style as CardIcon,
  Paid as CoinIcon,
  Inventory2 as PackIcon,
  CheckBox as CheckBoxIcon,
  CheckBoxOutlineBlank as CheckBoxBlankIcon,
  History as HistoryIcon,
  Person as PersonIcon,
  Timer as TimerIcon,
  LocalOffer as SourceIcon,
  Close as CloseIcon,
  NewReleases as NewIcon,
} from '@mui/icons-material'
import { presents, cards as cardsApi } from '../services/api'
import { useAccount } from '../contexts/AccountContext'
import { RARITY_COLORS } from '../constants/gameData'
import { getRarityChipTextColor } from '../constants/rarityConfig'
import { useLanguage } from '../contexts/LanguageContext'
import { FadeIn } from '../components/Animations'
import { EmptyState } from '../components/EmptyState'
import { DashboardSkeleton } from '../components/skeletons/PageSkeletons'
import PageHeader from '../components/PageHeader'
import AccountSelector from '../components/AccountSelector'
import CollapsibleHelp from '../components/CollapsibleHelp'
import { useSectionStyles } from '../components/SectionCard'

// Category icons and palette keys (resolved at render time via theme)
const CATEGORY_CONFIG = {
  cards: { icon: <CardIcon />, colorKey: 'secondary', label: 'Cards' },
  coins: { icon: <CoinIcon />, colorKey: 'warning', label: 'Coins' },
  packs: { icon: <PackIcon />, colorKey: 'primary', label: 'Packs' },
  tickets: { icon: <TicketIcon />, colorKey: 'error', label: 'Tickets' },
  shinedust: { icon: <ShinedustIcon />, colorKey: 'secondary', label: 'Shinedust' },
  hourglasses: { icon: <HourglassIcon />, colorKey: 'warning', label: 'Hourglasses' },
  other: { icon: <GiftIcon />, colorKey: 'info', label: 'Other' },
}

// Helper to resolve category color from theme
const getCategoryColor = (category, theme) => {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other
  return theme.palette[config.colorKey]?.main || theme.palette.primary.main
}

// Format expiration countdown
const formatExpiry = (expireAt) => {
  if (!expireAt) return null
  const expireTime = new Date(expireAt * 1000)
  const now = new Date()
  const diff = expireTime - now

  if (diff <= 0) return 'Expired'

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function PresentBox({ user }) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const { t } = useLanguage()
  const { accounts: linkedAccounts, selectedAccountId, selectAccount, loading: accountsLoading } = useAccount()
  const selectedAccount = selectedAccountId ? String(selectedAccountId) : ''
  const [loading, setLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Presents data
  const [presentsList, setPresentsList] = useState([])
  const [byCategory, setByCategory] = useState({})
  const [presentsPage, setPresentsPage] = useState(1)
  const PRESENTS_PER_PAGE = 30
  const [selectedPresents, setSelectedPresents] = useState([])
  const [history, setHistory] = useState([])

  // Pack results dialog
  const [packResults, setPackResults] = useState([])
  const [showPackResults, setShowPackResults] = useState(false)

  // Tab state
  const [tab, setTab] = useState(0)

  const { sectionBox: cardSx } = useSectionStyles()

  useEffect(() => {
    if (selectedAccount) {
      loadPresents()
    }
  }, [selectedAccount])

  const loadPresents = async () => {
    if (!selectedAccount) return

    setError('')
    setActionLoading(true)
    try {
      const data = await presents.list(selectedAccount)
      setPresentsList(data.presents || [])
      setByCategory(data.byCategory || {})
      setSelectedPresents([])
    } catch (err) {
      console.error('Failed to load presents:', err)
      setError('Failed to load presents from game')
    } finally {
      setActionLoading(false)
    }
  }

  const loadHistory = async () => {
    try {
      const data = await presents.history(50, 0, selectedAccount || null)
      setHistory(data.history || [])
    } catch (err) {
      console.error('Failed to load history:', err)
    }
  }

  // Toggle present selection
  const togglePresentSelection = (presentId) => {
    setSelectedPresents(prev => {
      if (prev.includes(presentId)) {
        return prev.filter(id => id !== presentId)
      }
      return [...prev, presentId]
    })
  }

  // Select all presents
  const selectAllPresents = () => {
    if (selectedPresents.length === presentsList.length) {
      setSelectedPresents([])
    } else {
      setSelectedPresents(presentsList.map(p => p.id))
    }
  }

  // Select all in category
  const selectCategory = (category) => {
    const categoryPresents = byCategory[category] || []
    const categoryIds = categoryPresents.map(p => p.id)
    const allSelected = categoryIds.every(id => selectedPresents.includes(id))

    if (allSelected) {
      setSelectedPresents(prev => prev.filter(id => !categoryIds.includes(id)))
    } else {
      setSelectedPresents(prev => [...new Set([...prev, ...categoryIds])])
    }
  }

  // Claim selected presents
  const handleClaimSelected = async () => {
    if (selectedPresents.length === 0) {
      setError('Please select at least one present to claim')
      return
    }

    setError('')
    setSuccess('')
    setActionLoading(true)

    try {
      const result = await presents.claim(selectedAccount, selectedPresents)
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(result.message || `Claimed ${result.claimed} presents!`)
        if (result.packResults?.length > 0) {
          setPackResults(result.packResults)
          setShowPackResults(true)
        }
        loadPresents()
        loadHistory()
      }
    } catch (err) {
      setError(err.message || 'Failed to claim presents')
    } finally {
      setActionLoading(false)
    }
  }

  // Claim all presents
  const handleClaimAll = async () => {
    if (presentsList.length === 0) {
      setError('No presents to claim')
      return
    }

    setError('')
    setSuccess('')
    setActionLoading(true)

    try {
      const result = await presents.claimAll(selectedAccount)
      if (result.error) {
        setError(result.error)
      } else {
        setSuccess(result.message || `Claimed ${result.claimed} presents!`)
        if (result.packResults?.length > 0) {
          setPackResults(result.packResults)
          setShowPackResults(true)
        }
        loadPresents()
        loadHistory()
      }
    } catch (err) {
      setError(err.message || 'Failed to claim presents')
    } finally {
      setActionLoading(false)
    }
  }

  // Present item component
  const PresentItem = ({ present }) => {
    const category = CATEGORY_CONFIG[present.type] || CATEGORY_CONFIG.other
    const color = getCategoryColor(present.type, theme)
    const isSelected = selectedPresents.includes(present.id)
    const expiryText = formatExpiry(present.expireAt)

    return (
      <ListItem
        button
        onClick={() => togglePresentSelection(present.id)}
        sx={{
          border: '1px solid',
          borderColor: isSelected ? color : isDark ? 'rgba(124,138,255,0.08)' : 'rgba(0,0,0,0.06)',
          borderRadius: '10px',
          mb: 1,
          bgcolor: isSelected ? `${color}12` : 'transparent',
          transition: 'all 0.2s ease',
          '&:hover': {
            borderColor: color,
            bgcolor: `${color}08`,
          },
        }}
      >
        <ListItemIcon>
          <Checkbox
            checked={isSelected}
            icon={<CheckBoxBlankIcon />}
            checkedIcon={<CheckBoxIcon />}
            sx={{ color }}
          />
        </ListItemIcon>
        <ListItemIcon sx={{ minWidth: 40 }}>
          <Box
            sx={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              bgcolor: `${color}22`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              '& svg': { color, fontSize: 20 },
            }}
          >
            {category.icon}
          </Box>
        </ListItemIcon>
        <ListItemText
          primary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body1" fontWeight={500}>
                {present.rewardType}
              </Typography>
              {present.routeLabel && present.routeLabel !== 'Gift' && (
                <Chip
                  icon={<SourceIcon sx={{ fontSize: '14px !important' }} />}
                  label={present.routeLabel}
                  size="small"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.65rem' }}
                />
              )}
            </Box>
          }
          secondary={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              {present.sender?.nickname && (
                <Tooltip title="From">
                  <Chip
                    icon={<PersonIcon sx={{ fontSize: '14px !important' }} />}
                    label={present.sender.nickname}
                    size="small"
                    variant="outlined"
                    sx={{ height: 18, fontSize: '0.65rem' }}
                  />
                </Tooltip>
              )}
              {expiryText && !present.isForever && (
                <Tooltip title={expiryText === 'Expired' ? 'This present has expired' : 'Expires in'}>
                  <Chip
                    icon={<TimerIcon sx={{ fontSize: '14px !important' }} />}
                    label={expiryText}
                    size="small"
                    color={expiryText === 'Expired' ? 'error' : 'warning'}
                    variant="outlined"
                    sx={{ height: 18, fontSize: '0.65rem' }}
                  />
                </Tooltip>
              )}
              {present.isForever && (
                <Chip
                  label="No Expiry"
                  size="small"
                  color="success"
                  variant="outlined"
                  sx={{ height: 18, fontSize: '0.65rem' }}
                />
              )}
              {present.description && (
                <Typography variant="caption" color="text.secondary">
                  {present.description}
                </Typography>
              )}
            </Box>
          }
        />
        <Chip
          label={`x${present.rewardAmount}`}
          size="small"
          sx={{
            bgcolor: `${color}22`,
            color,
            fontWeight: 600,
          }}
        />
      </ListItem>
    )
  }

  // Category summary card
  const CategoryCard = ({ category, items }) => {
    const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other
    const color = getCategoryColor(category, theme)
    const isAllSelected = items.length > 0 && items.every(p => selectedPresents.includes(p.id))

    return (
      <Box
        onClick={() => selectCategory(category)}
        sx={{
          cursor: 'pointer',
          p: 2,
          borderRadius: '14px',
          border: `2px solid ${isAllSelected ? color : isDark ? 'rgba(124,138,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
          bgcolor: isAllSelected ? `${color}10` : isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
          textAlign: 'center',
          transition: 'all 0.2s ease',
          '&:hover': {
            transform: 'translateY(-2px)',
            borderColor: color,
            bgcolor: `${color}08`,
          },
        }}
      >
        <Box
          sx={{
            width: 48,
            height: 48,
            borderRadius: '50%',
            bgcolor: `${color}22`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 1,
            '& svg': { color, fontSize: 28 },
          }}
        >
          {config.icon}
        </Box>
        <Typography variant="h5" fontWeight={700} sx={{ color }}>
          {items.length}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {config.label}
        </Typography>
      </Box>
    )
  }

  if (loading || accountsLoading) {
    return <DashboardSkeleton />
  }

  return (
    <FadeIn>
    <Box>
      {/* Header */}
      <PageHeader
        icon={<GiftIcon />}
        title="Present Box"
        subtitle="Claim your presents from the game"
        accent={theme.palette.warning.main}
        chips={presentsList.length > 0 ? [
          { label: `${presentsList.length} claimable`, color: theme.palette.warning.main },
        ] : []}
        action={
          <IconButton onClick={loadPresents} disabled={actionLoading} aria-label="Refresh presents">
            <RefreshIcon />
          </IconButton>
        }
      />

      {/* Help Info */}
      <CollapsibleHelp>
        <ul>
          <li><strong>Category cards:</strong> Click to select/deselect all presents of that type</li>
          <li><strong>Individual items:</strong> Click any present to add it to your selection</li>
          <li><strong>Claim Selected:</strong> Claims only your selected presents</li>
          <li><strong>Claim All:</strong> Claims everything in one click</li>
          <li><strong>Expiring presents:</strong> Presents with timers will expire - claim these first!</li>
          <li><strong>History tab:</strong> Shows all previously claimed presents</li>
        </ul>
      </CollapsibleHelp>

      {linkedAccounts.length === 0 ? (
        <Alert severity="info">
          No accounts linked. Go to "Link Account" to add an account first.
        </Alert>
      ) : (
        <>
          {/* Account Selection & Actions */}
          <Box sx={{ ...cardSx, mb: 3 }}>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={4}>
                <AccountSelector label="Select Account" fullWidth hideIfSingle={false} />
              </Grid>
              <Grid item xs={12} sm={4}>
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  startIcon={actionLoading ? <CircularProgress size={20} color="inherit" /> : <GiftIcon />}
                  onClick={handleClaimAll}
                  disabled={actionLoading || presentsList.length === 0}
                  sx={{
                    background: `linear-gradient(135deg, ${theme.palette.warning.main}, ${theme.palette.warning.dark})`,
                    fontWeight: 700, fontSize: '0.95rem', py: 1.25,
                  }}
                >
                  Claim All ({presentsList.length})
                </Button>
              </Grid>
              <Grid item xs={6} sm={4}>
                <Button
                  fullWidth
                  variant="outlined"
                  size="small"
                  startIcon={actionLoading ? <CircularProgress size={16} color="inherit" /> : <RedeemIcon />}
                  onClick={handleClaimSelected}
                  disabled={actionLoading || selectedPresents.length === 0}
                >
                  Claim Selected ({selectedPresents.length})
                </Button>
              </Grid>
            </Grid>
          </Box>

          {/* Alerts */}
          {error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: '12px' }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mb: 2, borderRadius: '12px' }} onClose={() => setSuccess('')}>
              {success}
            </Alert>
          )}

          {/* Category Summary */}
          <Grid container spacing={2} sx={{ mb: 3 }}>
            {Object.entries(byCategory).map(([category, items]) => (
              items.length > 0 && (
                <Grid item xs={6} sm={4} md={2} key={category}>
                  <CategoryCard category={category} items={items} />
                </Grid>
              )
            ))}
          </Grid>

          {/* Tabs */}
          <Tabs
            value={tab}
            onChange={(e, v) => { setTab(v); if (v === 1) loadHistory(); }}
            sx={{ mb: 3 }}
          >
            <Tab
              label={
                <Badge badgeContent={presentsList.length} color="primary">
                  <Box sx={{ pr: presentsList.length > 0 ? 2 : 0 }}>Presents</Box>
                </Badge>
              }
            />
            <Tab label="History" icon={<HistoryIcon />} iconPosition="start" />
          </Tabs>

          {/* Presents List */}
          {tab === 0 && (
            <>
              {actionLoading && presentsList.length === 0 ? (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <CircularProgress />
                  <Typography sx={{ mt: 2 }} color="text.secondary">
                    Loading presents from game...
                  </Typography>
                </Box>
              ) : presentsList.length === 0 ? (
                <EmptyState
                  icon={<GiftIcon />}
                  title="No Presents Available"
                  description="Check back later for new presents!"
                />
              ) : (
                <Box sx={cardSx}>
                  <List disablePadding>
                    {presentsList.slice((presentsPage - 1) * PRESENTS_PER_PAGE, presentsPage * PRESENTS_PER_PAGE).map((present) => (
                      <PresentItem key={present.id} present={present} />
                    ))}
                  </List>
                  {presentsList.length > PRESENTS_PER_PAGE && (
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                        {(presentsPage - 1) * PRESENTS_PER_PAGE + 1}–{Math.min(presentsPage * PRESENTS_PER_PAGE, presentsList.length)} of {presentsList.length}
                      </Typography>
                      <Pagination count={Math.ceil(presentsList.length / PRESENTS_PER_PAGE)} page={presentsPage} onChange={(_, p) => setPresentsPage(p)} size="small" />
                    </Box>
                  )}
                </Box>
              )}
            </>
          )}

          {/* History Tab */}
          {tab === 1 && (
            <Box sx={cardSx}>
              {history.length === 0 ? (
                <EmptyState
                  icon={<HistoryIcon />}
                  title="No Claim History"
                  description="No claim history yet"
                />
              ) : (
                <List disablePadding>
                  {history.map((item) => {
                    const category = CATEGORY_CONFIG[item.present_type] || CATEGORY_CONFIG.other
                    const historyColor = getCategoryColor(item.present_type, theme)
                    return (
                      <ListItem
                        key={item.id}
                        sx={{
                          borderBottom: `1px solid ${isDark ? 'rgba(124,138,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
                          '&:last-child': { borderBottom: 'none' },
                          '&:hover': { bgcolor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' },
                        }}
                      >
                        <ListItemIcon>
                          <Box
                            sx={{
                              width: 36,
                              height: 36,
                              borderRadius: '50%',
                              bgcolor: `${historyColor}22`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              '& svg': { color: historyColor, fontSize: 20 },
                            }}
                          >
                            {category.icon}
                          </Box>
                        </ListItemIcon>
                        <ListItemText
                          primary={item.reward_type}
                          secondary={`${item.account_nickname || 'Account'} - ${new Date(item.claimed_at).toLocaleString()}`}
                        />
                        <Chip
                          label={`x${item.reward_amount}`}
                          size="small"
                          sx={{ bgcolor: `${historyColor}22`, color: historyColor }}
                        />
                      </ListItem>
                    )
                  })}
                </List>
              )}
            </Box>
          )}
        </>
      )}

      {/* Pack Results Dialog */}
      <Dialog
        open={showPackResults}
        onClose={() => setShowPackResults(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <PackIcon sx={{ color: theme.palette.primary.main }} />
          Pack Opening Results
          <Box sx={{ flexGrow: 1 }} />
          <IconButton size="small" onClick={() => setShowPackResults(false)} aria-label="Close">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {packResults.map((pack, packIdx) => (
            <Box key={packIdx} sx={{ mb: packIdx < packResults.length - 1 ? 3 : 0 }}>
              {packResults.length > 1 && (
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  Pack {packIdx + 1}
                </Typography>
              )}
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', justifyContent: 'center' }}>
                {pack.cards.map((card, cardIdx) => (
                  <Box
                    key={cardIdx}
                    sx={{
                      width: { xs: 80, sm: 100, md: 110 },
                      textAlign: 'center',
                    }}
                  >
                    <Box
                      sx={{
                        position: 'relative',
                        width: '100%',
                        aspectRatio: '5/7',
                        borderRadius: 1.5,
                        overflow: 'hidden',
                        border: `2px solid ${RARITY_COLORS[card.rarityCode] || '#666'}`,
                        boxShadow: `0 2px 8px ${RARITY_COLORS[card.rarityCode] || '#666'}44`,
                        mb: 0.5,
                      }}
                    >
                      <Box
                        component="img"
                        src={cardsApi.getImageUrl(card.cardId)}
                        alt={card.cardName || card.cardId}
                        sx={{
                          width: '100%',
                          height: '100%',
                          objectFit: 'cover',
                        }}
                        onError={(e) => { e.target.src = '/card-placeholder.png' }}
                      />
                      {card.isNew && (
                        <Chip
                          label="NEW"
                          size="small"
                          color="success"
                          sx={{
                            position: 'absolute',
                            top: 2,
                            left: 2,
                            height: 18,
                            fontSize: '0.6rem',
                            fontWeight: 700,
                          }}
                        />
                      )}
                      <Box
                        sx={{
                          position: 'absolute',
                          bottom: 2,
                          right: 2,
                          bgcolor: RARITY_COLORS[card.rarityCode] || '#666',
                          color: getRarityChipTextColor(card.rarityCode),
                          borderRadius: 0.5,
                          px: 0.5,
                          py: 0.15,
                          fontSize: '0.6rem',
                          fontWeight: 700,
                        }}
                      >
                        {card.rarityCode || card.rarity}
                      </Box>
                    </Box>
                    <Typography variant="caption" noWrap sx={{ fontSize: '0.65rem', display: 'block' }}>
                      {card.cardName || card.cardId}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                {pack.cards.length} cards received
                {pack.cards.filter(c => c.isNew).length > 0 &&
                  ` (${pack.cards.filter(c => c.isNew).length} new)`}
              </Typography>
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPackResults(false)} variant="contained">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
    </FadeIn>
  )
}

export default PresentBox
