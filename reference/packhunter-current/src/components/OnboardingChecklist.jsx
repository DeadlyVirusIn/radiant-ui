/**
 * OnboardingChecklist - Progress tracker for new users
 *
 * Features:
 * - Persistent progress tracking
 * - Collapsible UI
 * - Direct links to complete tasks
 * - Celebration on completion
 */

import { useState, useEffect, useMemo } from 'react'
import {
  Box,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  Checkbox,
  Collapse,
  IconButton,
  Button,
  Chip,
} from '@mui/material'
import {
  CheckCircle as CheckIcon,
  RadioButtonUnchecked as UncheckedIcon,
  ExpandMore as ExpandIcon,
  ExpandLess as CollapseIcon,
  Close as CloseIcon,
  Celebration as CelebrationIcon,
} from '@mui/icons-material'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import confetti from 'canvas-confetti'

const CHECKLIST_KEY = 'ptcgp-onboarding-checklist'
const CHECKLIST_HIDDEN_KEY = 'ptcgp-onboarding-checklist-hidden'

// Checklist items configuration
const CHECKLIST_ITEMS = [
  {
    id: 'link-account',
    title: 'Link your first account',
    description: 'Connect your TCG Pocket game account',
    path: '/accounts',
    checkFn: (data) => data.accountsLinked > 0,
  },
  {
    id: 'sync-collection',
    title: 'Sync your card collection',
    description: 'Import your cards to track your collection',
    path: '/collection',
    checkFn: (data) => data.collectionSynced,
  },
  {
    id: 'start-hunt',
    title: 'Start your first hunt',
    description: 'Configure hunt settings and join packs',
    path: '/hunt-settings',
    checkFn: (data) => data.huntsStarted > 0,
  },
  {
    id: 'request-card',
    title: 'Request a card',
    description: 'Try the auto-gift or trade system',
    path: '/auto-gift',
    checkFn: (data) => data.cardsRequested > 0,
  },
  {
    id: 'enable-notifications',
    title: 'Enable notifications',
    description: 'Get alerts for God Pack finds',
    path: '/settings',
    checkFn: (data) => data.notificationsEnabled,
  },
]

export function OnboardingChecklist({ userData = {}, isNewUser = false }) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(true)
  const [hidden, setHidden] = useState(false)
  const [completedItems, setCompletedItems] = useState([])
  const [showCelebration, setShowCelebration] = useState(false)

  // Load saved state
  useEffect(() => {
    const savedHidden = localStorage.getItem(CHECKLIST_HIDDEN_KEY)
    if (savedHidden === 'true') {
      setHidden(true)
    }

    const savedCompleted = localStorage.getItem(CHECKLIST_KEY)
    if (savedCompleted) {
      setCompletedItems(JSON.parse(savedCompleted))
    }
  }, [])

  // Check completion status
  const completionStatus = useMemo(() => {
    return CHECKLIST_ITEMS.map(item => ({
      ...item,
      completed: completedItems.includes(item.id) || item.checkFn(userData),
    }))
  }, [completedItems, userData])

  const completedCount = completionStatus.filter(item => item.completed).length
  const totalCount = CHECKLIST_ITEMS.length
  const progress = (completedCount / totalCount) * 100
  const isAllComplete = completedCount === totalCount

  // Auto-update completed items based on userData
  useEffect(() => {
    const newCompleted = CHECKLIST_ITEMS
      .filter(item => item.checkFn(userData))
      .map(item => item.id)

    if (newCompleted.length > completedItems.length) {
      const updated = [...new Set([...completedItems, ...newCompleted])]
      setCompletedItems(updated)
      localStorage.setItem(CHECKLIST_KEY, JSON.stringify(updated))

      // Check if just completed all
      if (updated.length === totalCount && completedItems.length < totalCount) {
        triggerCelebration()
      }
    }
  }, [userData, completedItems])

  // Don't show checklist for existing users (only new users)
  // This check must be AFTER all hooks to comply with React's rules of hooks
  if (!isNewUser) {
    return null
  }

  const triggerCelebration = () => {
    setShowCelebration(true)

    // Confetti animation
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    })

    // Hide after 3 seconds
    setTimeout(() => setShowCelebration(false), 3000)
  }

  const handleItemClick = (item) => {
    if (!item.completed) {
      navigate(item.path)
    }
  }

  const handleManualComplete = (itemId) => {
    const updated = [...completedItems, itemId]
    setCompletedItems(updated)
    localStorage.setItem(CHECKLIST_KEY, JSON.stringify(updated))
  }

  const handleHide = () => {
    setHidden(true)
    localStorage.setItem(CHECKLIST_HIDDEN_KEY, 'true')
  }

  const handleShow = () => {
    setHidden(false)
    localStorage.removeItem(CHECKLIST_HIDDEN_KEY)
  }

  // Don't show if all complete and hidden
  if (hidden && isAllComplete) {
    return null
  }

  // Minimized state
  if (hidden) {
    return (
      <Card
        component={motion.div}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        sx={{ cursor: 'pointer' }}
        onClick={handleShow}
      >
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">
              Getting Started
            </Typography>
            <Chip
              size="small"
              label={`${completedCount}/${totalCount}`}
              color={isAllComplete ? 'success' : 'primary'}
            />
          </Box>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      component={motion.div}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <CardContent sx={{ pb: 1 }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="subtitle1" fontWeight="bold">
              Getting Started
            </Typography>
            <Chip
              size="small"
              label={`${completedCount}/${totalCount}`}
              color={isAllComplete ? 'success' : 'default'}
            />
          </Box>
          <Box>
            <IconButton
              size="small"
              onClick={() => setExpanded(!expanded)}
              aria-label={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <CollapseIcon /> : <ExpandIcon />}
            </IconButton>
            <IconButton
              size="small"
              onClick={handleHide}
              aria-label="Hide checklist"
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {/* Progress bar */}
        <Box sx={{ mb: 1 }}>
          <LinearProgress
            variant="determinate"
            value={progress}
            sx={{
              height: 6,
              borderRadius: 3,
              bgcolor: 'action.hover',
              '& .MuiLinearProgress-bar': {
                borderRadius: 3,
                bgcolor: isAllComplete ? 'success.main' : 'primary.main',
              },
            }}
          />
        </Box>

        {/* Celebration message */}
        <AnimatePresence>
          {showCelebration && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  p: 1.5,
                  bgcolor: 'success.light',
                  borderRadius: 1,
                  mb: 1,
                }}
              >
                <CelebrationIcon color="success" />
                <Typography variant="body2" fontWeight="bold" color="success.dark">
                  Congratulations! You've completed the setup!
                </Typography>
              </Box>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Checklist items */}
        <Collapse in={expanded}>
          <List dense disablePadding>
            {completionStatus.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <ListItem
                  disablePadding
                  secondaryAction={
                    !item.completed && (
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleManualComplete(item.id)
                        }}
                        aria-label="Mark as complete"
                      >
                        <UncheckedIcon fontSize="small" />
                      </IconButton>
                    )
                  }
                >
                  <ListItemButton
                    onClick={() => handleItemClick(item)}
                    disabled={item.completed}
                    sx={{
                      py: 0.75,
                      opacity: item.completed ? 0.7 : 1,
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      {item.completed ? (
                        <CheckIcon color="success" fontSize="small" />
                      ) : (
                        <UncheckedIcon fontSize="small" color="disabled" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.title}
                      secondary={item.description}
                      primaryTypographyProps={{
                        variant: 'body2',
                        fontWeight: item.completed ? 400 : 500,
                        sx: {
                          textDecoration: item.completed ? 'line-through' : 'none',
                        },
                      }}
                      secondaryTypographyProps={{
                        variant: 'caption',
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              </motion.div>
            ))}
          </List>
        </Collapse>

        {/* Completion message */}
        {isAllComplete && !showCelebration && (
          <Box sx={{ textAlign: 'center', py: 1 }}>
            <Typography variant="body2" color="success.main" fontWeight="bold">
              ✓ All done! You're ready to go.
            </Typography>
            <Button size="small" onClick={handleHide} sx={{ mt: 0.5 }}>
              Hide Checklist
            </Button>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Hook to manage onboarding checklist state
 */
export function useOnboardingChecklist() {
  const [completedItems, setCompletedItems] = useState([])

  useEffect(() => {
    const saved = localStorage.getItem(CHECKLIST_KEY)
    if (saved) {
      setCompletedItems(JSON.parse(saved))
    }
  }, [])

  const markComplete = (itemId) => {
    const updated = [...new Set([...completedItems, itemId])]
    setCompletedItems(updated)
    localStorage.setItem(CHECKLIST_KEY, JSON.stringify(updated))
  }

  const resetChecklist = () => {
    setCompletedItems([])
    localStorage.removeItem(CHECKLIST_KEY)
    localStorage.removeItem(CHECKLIST_HIDDEN_KEY)
  }

  const isComplete = (itemId) => completedItems.includes(itemId)

  return {
    completedItems,
    markComplete,
    resetChecklist,
    isComplete,
    progress: completedItems.length / CHECKLIST_ITEMS.length,
  }
}

export default OnboardingChecklist
