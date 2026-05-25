import { useState, useEffect } from 'react'
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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  useTheme,
} from '@mui/material'
import {
  Sync as SyncIcon,
  ShoppingCart as ShopIcon,
  HourglassEmpty as HourglassIcon,
  ConfirmationNumber as TicketIcon,
  CheckCircle as CheckIcon,
  LocalOffer as OfferIcon,
  History as HistoryIcon,
} from '@mui/icons-material'
import { accounts as accountsApi, tasks as tasksApi } from '../services/api'
import { useLanguage } from '../contexts/LanguageContext'
import { EmptyState } from '../components/EmptyState'
import { FadeIn, StaggerContainer, StaggerItem } from '../components/Animations'
import { CardGridSkeleton } from '../components/LoadingSkeleton'
import PageHeader from '../components/PageHeader'

// Shop products (hourglass purchases) - from Frida capture Feb 2026
// Pack HG = packPowerChargers (for opening packs)
// WP HG = challengePowerChargers (for Wonder Pick)
const SHOP_PRODUCTS = [
  {
    id: 'free_daily',
    name: 'Free Daily Gift',
    description: 'Claim 1 free WP hourglass + 1 shop ticket daily',
    price: 0,
    currency: 'Free',
    reward: 1,
    rewardType: 'WP hourglass + ticket',
    monthlyLimit: 1,
    tag: 'FREE',
    color: '#ff9800',
  },
  {
    id: 'discounted_6pack',
    name: 'Hourglasses (6-Pack) - Discounted',
    description: 'Best value! 6 hourglasses at a discounted price',
    price: 12,
    currency: 'Shop Tickets',
    reward: 6,
    rewardType: 'hourglasses',
    monthlyLimit: 10,
    tag: 'BEST VALUE',
    color: '#4caf50',
  },
  {
    id: 'individual_pack',
    name: 'Pack Hourglass',
    description: '1 pack hourglass for opening packs (monthly seasonal)',
    price: 3,
    currency: 'Shop Tickets',
    reward: 1,
    rewardType: 'pack hourglass',
    monthlyLimit: 10,
    tag: 'PACK',
    colorKey: 'primary.main',
  },
  {
    id: 'individual_wp',
    name: 'WP Hourglass',
    description: '1 Wonder Pick hourglass (monthly seasonal)',
    price: 3,
    currency: 'Shop Tickets',
    reward: 1,
    rewardType: 'WP hourglass',
    monthlyLimit: 10,
    tag: 'WONDER PICK',
    colorKey: 'secondary.light',
  },
  {
    id: 'regular_6pack_pack',
    name: 'Pack Hourglasses (6-Pack)',
    description: '6 pack hourglasses for opening packs',
    price: 18,
    currency: 'Shop Tickets',
    reward: 6,
    rewardType: 'pack hourglasses',
    monthlyLimit: 10,
    tag: 'PACK',
    color: '#f44336',
  },
  {
    id: 'regular_6pack_wp',
    name: 'WP Hourglasses (6-Pack)',
    description: '6 Wonder Pick hourglasses',
    price: 18,
    currency: 'Shop Tickets',
    reward: 6,
    rewardType: 'WP hourglasses',
    monthlyLimit: 10,
    tag: 'WONDER PICK',
    color: '#2196f3',
  },
]

// Helper to resolve product color (supports colorKey or direct color)
const resolveProductColor = (product, theme) => {
  if (product.colorKey) {
    const [palette, shade] = product.colorKey.split('.')
    return theme.palette[palette]?.[shade] || theme.palette.primary.main
  }
  return product.color
}

// Product Card component
const ProductCard = ({ product, shopTickets, onPurchase, purchasing, purchasedToday }) => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const productColor = resolveProductColor(product, theme)
  const isFree = product.price === 0
  const canAfford = isFree || shopTickets >= product.price
  const isLimitReached = purchasedToday >= product.monthlyLimit

  return (
    <Box
      sx={{
        p: 2.5,
        borderRadius: '14px',
        border: `1px solid ${isDark ? `${productColor}22` : `${productColor}30`}`,
        bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'visible',
        transition: 'all 0.2s ease',
        borderLeft: `3px solid ${productColor}`,
        '&:hover': {
          transform: 'translateY(-2px)',
          boxShadow: isDark
            ? `0 8px 24px rgba(0,0,0,0.4), 0 0 0 1px ${productColor}30`
            : `0 8px 24px rgba(0,0,0,0.08), 0 0 0 1px ${productColor}20`,
        },
      }}
    >
      {product.tag && (
        <Chip
          label={product.tag}
          size="small"
          sx={{
            position: 'absolute',
            top: -12,
            right: 16,
            bgcolor: productColor,
            color: 'white',
            fontWeight: 700,
            fontSize: '0.65rem',
          }}
        />
      )}

      <Box sx={{ flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: '12px',
              background: `linear-gradient(135deg, ${productColor}30, ${productColor}15)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <HourglassIcon sx={{ color: productColor, fontSize: 24 }} />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, fontSize: '0.95rem', lineHeight: 1.3 }}>
              {product.name}
            </Typography>
          </Box>
        </Box>

        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.5 }}>
          {product.description}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <TicketIcon sx={{ fontSize: 18, color: '#ff9800' }} />
          <Typography variant="h5" sx={{ fontWeight: 700 }}>
            {product.price}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {product.currency}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <Typography variant="body2" color="text.secondary">Reward:</Typography>
          <Chip
            icon={<HourglassIcon sx={{ fontSize: 14 }} />}
            label={`${product.reward} ${product.rewardType}`}
            size="small"
            color="primary"
            variant="outlined"
          />
        </Box>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
          Monthly limit: {purchasedToday}/{product.monthlyLimit}
        </Typography>
      </Box>

      <Box sx={{ pt: 2 }}>
        <Button
          fullWidth
          variant="contained"
          disabled={!canAfford || isLimitReached || purchasing}
          onClick={() => onPurchase(product)}
          sx={{
            bgcolor: productColor,
            borderRadius: '8px',
            '&:hover': { bgcolor: productColor, filter: 'brightness(0.9)' },
            '&:disabled': { bgcolor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' },
          }}
        >
          {purchasing ? (
            <CircularProgress size={20} color="inherit" />
          ) : isLimitReached ? (
            'Limit Reached'
          ) : !canAfford ? (
            'Not Enough Tickets'
          ) : isFree ? (
            'Claim'
          ) : (
            'Purchase'
          )}
        </Button>
      </Box>
    </Box>
  )
}

function ItemShop({ user }) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const { t } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [userAccounts, setUserAccounts] = useState([])
  const [selectedAccount, setSelectedAccount] = useState('')
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [purchasing, setPurchasing] = useState(false)
  const [purchaseHistory, setPurchaseHistory] = useState([])
  const [resources, setResources] = useState({
    shopTickets: 0,
    hourglasses: 0,
    premierTickets: 0,
  })
  const [purchaseCounts, setPurchaseCounts] = useState({
    free_daily: 0,
    discounted_6pack: 0,
    individual_pack: 0,
    individual_wp: 0,
    regular_6pack_pack: 0,
    regular_6pack_wp: 0,
  })

  // Confirmation dialog
  const [confirmDialog, setConfirmDialog] = useState({ open: false, product: null })

  // Load user accounts on mount
  useEffect(() => {
    loadAccounts()
  }, [])

  // Load shop data when account is selected
  useEffect(() => {
    if (selectedAccount) {
      loadShopData()
    }
  }, [selectedAccount])

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

  const loadShopData = async () => {
    if (!selectedAccount) return

    setLoadingData(true)
    setError('')

    try {
      const [resourcesData, summariesData] = await Promise.all([
        tasksApi.getResources(selectedAccount),
        tasksApi.getShopSummaries(selectedAccount).catch(() => ({ summaries: {} })),
      ])

      setResources({
        shopTickets: resourcesData?.shopTickets ?? 0,
        hourglasses: resourcesData?.hourglasses ?? 0,
        premierTickets: resourcesData?.premierShopTickets ?? 0,
        gold: resourcesData?.gold ?? 0,
      })

      // Update purchase counts from server summaries
      if (summariesData?.summaries) {
        const s = summariesData.summaries
        setPurchaseCounts(prev => ({
          ...prev,
          free_daily: s.free_daily?.purchased ?? prev.free_daily,
          discounted_6pack: s.discounted_6pack?.purchased ?? prev.discounted_6pack,
        }))
      }

    } catch (err) {
      console.error('Failed to load shop data:', err)
      setError(`Failed to load shop data: ${err.message}`)
    } finally {
      setLoadingData(false)
    }
  }

  const handlePurchase = async (product) => {
    setConfirmDialog({ open: true, product })
  }

  const confirmPurchase = async () => {
    const product = confirmDialog.product
    setConfirmDialog({ open: false, product: null })

    if (!product || !selectedAccount) return

    setPurchasing(true)
    setError('')

    try {
      const result = await tasksApi.shopPurchase(selectedAccount, product.id)

      setSuccessMessage(result.message || `Successfully purchased ${product.name}!`)

      // Refresh resources from server
      loadShopData()

      // Update purchase count locally
      setPurchaseCounts(prev => ({
        ...prev,
        [product.id]: (prev[product.id] || 0) + 1,
      }))

      // Add to history
      setPurchaseHistory(prev => [{
        id: Date.now(),
        product: product.name,
        price: product.price,
        reward: product.reward,
        timestamp: new Date().toISOString(),
      }, ...prev].slice(0, 20))

    } catch (err) {
      setError(`Purchase failed: ${err.message}`)
    } finally {
      setPurchasing(false)
    }
  }

  if (loading) {
    return <CardGridSkeleton count={6} />
  }

  const cardBoxSx = {
    p: 2.5,
    borderRadius: '14px',
    border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'}`,
    bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
  }

  return (
    <FadeIn duration={0.3}>
    <Box>
      <PageHeader
        icon={<ShopIcon />}
        title={t('nav.itemShop') || 'Item Shop'}
        subtitle="Exchange your shop tickets for useful items"
        accent="#F59E0B"
      />
      <Box sx={{ mb: 4 }}>

        {/* Control bar */}
        <Box
          sx={{
            ...cardBoxSx,
            mt: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            flexWrap: 'wrap',
          }}
        >
          {/* Account selector */}
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
            onClick={loadShopData}
            disabled={!selectedAccount || loadingData}
            sx={{
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
              '&:hover': { background: `linear-gradient(135deg, ${theme.palette.primary.dark}, ${theme.palette.secondary.dark})` },
            }}
          >
            {loadingData ? 'Loading...' : 'Refresh'}
          </Button>

          {/* Resources display */}
          {selectedAccount && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 'auto', flexWrap: 'wrap' }}>
              <Tooltip title="Shop Tickets - use to purchase items">
                <Chip
                  icon={<TicketIcon sx={{ fontSize: 16 }} />}
                  label={`${resources.shopTickets || 0} Shop Tickets`}
                  color="warning"
                  variant="outlined"
                  size="small"
                />
              </Tooltip>
              <Tooltip title="Your current hourglasses">
                <Chip
                  icon={<HourglassIcon sx={{ fontSize: 16 }} />}
                  label={`${resources.hourglasses || 0} Hourglasses`}
                  color="info"
                  variant="outlined"
                  size="small"
                />
              </Tooltip>
            </Box>
          )}
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: '10px' }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* No account selected message */}
      {!selectedAccount && (
        <Box sx={cardBoxSx}>
          <EmptyState
            icon={<ShopIcon sx={{ fontSize: 64 }} />}
            title="Select an account to browse the shop"
            description="Choose an account above to view available items"
          />
        </Box>
      )}

      {/* Loading state */}
      {selectedAccount && loadingData && (
        <CardGridSkeleton count={6} />
      )}

      {/* Shop Products Grid */}
      {selectedAccount && !loadingData && (
        <>
          <Typography
            sx={{
              mb: 2,
              fontWeight: 600,
              fontSize: '0.85rem',
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: 'text.secondary',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <OfferIcon sx={{ fontSize: 16, color: '#ff9800' }} />
            Hourglass Products
          </Typography>

          <StaggerContainer staggerDelay={0.05}>
            <Grid container spacing={2.5} sx={{ mb: 4 }}>
              {SHOP_PRODUCTS.map((product) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={product.id}>
                  <StaggerItem>
                    <ProductCard
                      product={product}
                      shopTickets={resources.shopTickets}
                      onPurchase={handlePurchase}
                      purchasing={purchasing}
                      purchasedToday={purchaseCounts[product.id] || 0}
                    />
                  </StaggerItem>
                </Grid>
              ))}
            </Grid>
          </StaggerContainer>

          {/* Info Section */}
          <Box sx={{ ...cardBoxSx, mb: 3 }}>
            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 700, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, pb: 1.5 }}>
              How to Get Shop Tickets
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              <strong>Wonder Pick:</strong> Complete Wonder Picks to earn shop tickets.
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              <strong>Missions:</strong> Daily and weekly missions reward shop tickets.
            </Typography>
            <Typography variant="body2" color="text.secondary">
              <strong>Events:</strong> Special events may offer bonus shop tickets.
            </Typography>
          </Box>

          {/* Purchase History */}
          {purchaseHistory.length > 0 && (
            <Box sx={cardBoxSx}>
              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1, borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`, pb: 1.5 }}>
                <HistoryIcon sx={{ fontSize: 20, color: theme.palette.secondary.main }} />
                Recent Purchases
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {purchaseHistory.slice(0, 5).map((purchase) => (
                  <Box
                    key={purchase.id}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      p: 1.5,
                      borderRadius: '10px',
                      bgcolor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      border: `1px solid ${isDark ? 'rgba(52,211,153,0.15)' : 'rgba(52,211,153,0.2)'}`,
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        transform: 'translateX(2px)',
                        boxShadow: '0 2px 8px rgba(52,211,153,0.15)',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <CheckIcon sx={{ color: theme.palette.success.main, fontSize: 18 }} />
                      <Typography variant="body2">{purchase.product}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Chip label={`+${purchase.reward} hourglasses`} size="small" color="success" variant="outlined" />
                      <Typography variant="caption" color="text.secondary">
                        {new Date(purchase.timestamp).toLocaleTimeString()}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>
          )}
        </>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={confirmDialog.open} onClose={() => setConfirmDialog({ open: false, product: null })}>
        <DialogTitle>{confirmDialog.product?.price === 0 ? 'Claim Free Gift' : 'Confirm Purchase'}</DialogTitle>
        <DialogContent>
          {confirmDialog.product && (
            <Box>
              <Typography paragraph>
                {confirmDialog.product.price === 0
                  ? <>Claim your <strong>{confirmDialog.product.name}</strong>?</>
                  : <>Are you sure you want to purchase <strong>{confirmDialog.product.name}</strong>?</>
                }
              </Typography>
              {confirmDialog.product.price > 0 && (
                <Typography variant="body2" color="text.secondary">
                  Cost: {confirmDialog.product.price} {confirmDialog.product.currency}
                </Typography>
              )}
              <Typography variant="body2" color="text.secondary">
                Reward: {confirmDialog.product.reward} {confirmDialog.product.rewardType}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialog({ open: false, product: null })}>Cancel</Button>
          <Button onClick={confirmPurchase} variant="contained" color="primary">
            {confirmDialog.product?.price === 0 ? 'Claim' : 'Confirm Purchase'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success Snackbar */}
      <Snackbar
        open={!!successMessage}
        autoHideDuration={3000}
        onClose={() => setSuccessMessage('')}
        message={successMessage}
      />
    </Box>
    </FadeIn>
  )
}

export default ItemShop
