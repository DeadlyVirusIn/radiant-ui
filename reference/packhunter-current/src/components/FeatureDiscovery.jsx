/**
 * FeatureDiscovery - Widget for helping users discover features
 *
 * Features:
 * - Tip rotation
 * - Persistent dismissal
 * - Contextual tips
 * - New feature badges
 */

import { useState, useEffect, useMemo } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  IconButton,
  Button,
  Chip,
  Tooltip,
  Collapse,
  Badge,
} from '@mui/material'
import {
  LightbulbOutlined as TipIcon,
  Close as CloseIcon,
  ArrowForward as ArrowIcon,
  NavigateNext as NextIcon,
  NavigateBefore as PrevIcon,
  Keyboard as KeyboardIcon,
  Notifications as NotificationIcon,
  Speed as SpeedIcon,
  Stars as StarsIcon,
  Search as SearchIcon,
} from '@mui/icons-material'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

const TIPS_DISMISSED_KEY = 'ptcgp-tips-dismissed'
const TIPS_INDEX_KEY = 'ptcgp-tips-index'

// Feature tips configuration
const TIPS = [
  {
    id: 'command-palette',
    icon: KeyboardIcon,
    title: 'Quick Navigation',
    description: 'Press Ctrl+K (or Cmd+K on Mac) to open the command palette and quickly navigate anywhere.',
    action: { label: 'Try it now', type: 'keyboard', shortcut: 'Ctrl+K' },
  },
  {
    id: 'notifications',
    icon: NotificationIcon,
    title: 'Browser Notifications',
    description: 'Enable browser notifications to get alerts when God Packs are found, even when the tab is in the background.',
    action: { label: 'Enable', type: 'navigate', path: '/settings' },
  },
  {
    id: 'card-tracker',
    icon: StarsIcon,
    title: 'Card Tracker',
    description: 'Track your card collection across sets and see which cards you still need.',
    action: { label: 'View Tracker', type: 'navigate', path: '/tracker' },
  },
  {
    id: 'auto-gift',
    icon: SpeedIcon,
    title: 'Auto Gift for Commons',
    description: 'Request common cards (1D-4D) from the bot pool and receive them automatically via gifting.',
    action: { label: 'Try Auto Gift', type: 'navigate', path: '/auto-gift' },
  },
  {
    id: 'search-cards',
    icon: SearchIcon,
    title: 'Card Search',
    description: 'Search for any card by name across all expansions. Filter by rarity, type, and more.',
    action: { label: 'Search Cards', type: 'navigate', path: '/cards' },
  },
]

export function FeatureDiscoveryWidget({ onDismiss }) {
  const navigate = useNavigate()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  // Load saved state
  useEffect(() => {
    const wasDismissed = localStorage.getItem(TIPS_DISMISSED_KEY)
    if (wasDismissed === 'true') {
      setDismissed(true)
    }

    const savedIndex = localStorage.getItem(TIPS_INDEX_KEY)
    if (savedIndex) {
      setCurrentIndex(parseInt(savedIndex, 10) % TIPS.length)
    }
  }, [])

  // Save index when changed
  useEffect(() => {
    localStorage.setItem(TIPS_INDEX_KEY, currentIndex.toString())
  }, [currentIndex])

  // Auto-rotate tips
  useEffect(() => {
    if (isHovered) return

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % TIPS.length)
    }, 10000) // 10 seconds

    return () => clearInterval(interval)
  }, [isHovered])

  const handleDismiss = () => {
    localStorage.setItem(TIPS_DISMISSED_KEY, 'true')
    setDismissed(true)
    onDismiss?.()
  }

  const handleAction = (action) => {
    if (action.type === 'navigate') {
      navigate(action.path)
    } else if (action.type === 'keyboard') {
      // Trigger command palette
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    }
  }

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % TIPS.length)
  }

  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + TIPS.length) % TIPS.length)
  }

  if (dismissed) return null

  const currentTip = TIPS[currentIndex]
  const TipIconComponent = currentTip.icon

  return (
    <Card
      component={motion.div}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      sx={{
        position: 'relative',
        overflow: 'visible',
        background: 'linear-gradient(135deg, rgba(25, 118, 210, 0.08) 0%, rgba(156, 39, 176, 0.08) 100%)',
        border: '1px solid',
        borderColor: 'primary.light',
      }}
    >
      {/* Dismiss button */}
      <IconButton
        size="small"
        onClick={handleDismiss}
        sx={{
          position: 'absolute',
          top: 4,
          right: 4,
          opacity: 0.6,
          '&:hover': { opacity: 1 },
        }}
        aria-label="Dismiss tips"
      >
        <CloseIcon fontSize="small" />
      </IconButton>

      <CardContent sx={{ pb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              bgcolor: 'primary.main',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <TipIconComponent sx={{ color: 'white', fontSize: 20 }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="caption" color="primary.main" fontWeight={600}>
              💡 Did you know?
            </Typography>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentTip.id}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
                  {currentTip.title}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
                  {currentTip.description}
                </Typography>
              </motion.div>
            </AnimatePresence>
          </Box>
        </Box>

        {/* Action button */}
        {currentTip.action && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
            <Button
              size="small"
              onClick={() => handleAction(currentTip.action)}
              endIcon={<ArrowIcon fontSize="small" />}
            >
              {currentTip.action.label}
            </Button>

            {/* Navigation */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <IconButton size="small" onClick={handlePrev} aria-label="Previous tip">
                <PrevIcon fontSize="small" />
              </IconButton>
              <Typography variant="caption" color="text.secondary">
                {currentIndex + 1}/{TIPS.length}
              </Typography>
              <IconButton size="small" onClick={handleNext} aria-label="Next tip">
                <NextIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * New feature badge for navigation items
 */
export function NewFeatureBadge({ children, featureId, show = true }) {
  const [seen, setSeen] = useState(false)

  useEffect(() => {
    const seenFeatures = JSON.parse(localStorage.getItem('ptcgp-seen-features') || '[]')
    setSeen(seenFeatures.includes(featureId))
  }, [featureId])

  const markAsSeen = () => {
    const seenFeatures = JSON.parse(localStorage.getItem('ptcgp-seen-features') || '[]')
    if (!seenFeatures.includes(featureId)) {
      seenFeatures.push(featureId)
      localStorage.setItem('ptcgp-seen-features', JSON.stringify(seenFeatures))
      setSeen(true)
    }
  }

  if (!show || seen) return children

  return (
    <Badge
      badgeContent="New"
      color="secondary"
      onClick={markAsSeen}
      sx={{
        '& .MuiBadge-badge': {
          fontSize: '0.6rem',
          height: 16,
          minWidth: 28,
        },
      }}
    >
      {children}
    </Badge>
  )
}

/**
 * Contextual tooltip for feature education
 */
export function FeatureTooltip({ title, description, children, placement = 'top' }) {
  return (
    <Tooltip
      title={
        <Box sx={{ p: 0.5 }}>
          <Typography variant="subtitle2" fontWeight="bold">
            {title}
          </Typography>
          <Typography variant="body2">
            {description}
          </Typography>
        </Box>
      }
      placement={placement}
      arrow
    >
      {children}
    </Tooltip>
  )
}

/**
 * Hook to reset feature discovery
 */
export function useFeatureDiscovery() {
  const resetTips = () => {
    localStorage.removeItem(TIPS_DISMISSED_KEY)
    localStorage.removeItem(TIPS_INDEX_KEY)
    localStorage.removeItem('ptcgp-seen-features')
  }

  const markFeatureSeen = (featureId) => {
    const seenFeatures = JSON.parse(localStorage.getItem('ptcgp-seen-features') || '[]')
    if (!seenFeatures.includes(featureId)) {
      seenFeatures.push(featureId)
      localStorage.setItem('ptcgp-seen-features', JSON.stringify(seenFeatures))
    }
  }

  return { resetTips, markFeatureSeen }
}

export default FeatureDiscoveryWidget
