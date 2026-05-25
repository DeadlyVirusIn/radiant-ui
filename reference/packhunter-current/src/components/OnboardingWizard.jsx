/**
 * OnboardingWizard - First-time user onboarding flow
 *
 * Features:
 * - Welcome screen
 * - Account linking guide
 * - Feature introduction
 * - Progress tracking
 * - Skippable steps
 */

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  Alert,
  Chip,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  useMediaQuery,
  useTheme,
  TextField,
} from '@mui/material'
import {
  Close as CloseIcon,
  CheckCircle as CheckCircleIcon,
  Link as LinkIcon,
  CatchingPokemon as HuntIcon,
  CardGiftcard as GiftIcon,
  Analytics as AnalyticsIcon,
  ArrowForward as ArrowForwardIcon,
  ArrowBack as ArrowBackIcon,
  RocketLaunch as RocketLaunchIcon,
  Forum as DiscordIcon,
} from '@mui/icons-material'
import { FileUploadForm } from './FileUploadForm'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'

const ONBOARDING_KEY = 'ptcgp-onboarding-completed'
const ONBOARDING_STEP_KEY = 'ptcgp-onboarding-step'

// Onboarding steps configuration
const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Pack Hunter',
    icon: RocketLaunchIcon,
  },
  {
    id: 'link-account',
    title: 'Link Your Account',
    icon: LinkIcon,
  },
  {
    id: 'features',
    title: 'Key Features',
    icon: HuntIcon,
  },
  {
    id: 'discord',
    title: 'Discord Notifications',
    icon: DiscordIcon,
  },
]

export function OnboardingWizard({ open, onClose, forceShow = false }) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))
  const navigate = useNavigate()
  const [activeStep, setActiveStep] = useState(0)
  const [completed, setCompleted] = useState({})
  const [accountLinked, setAccountLinked] = useState(false)
  const [discordUsername, setDiscordUsername] = useState('')

  // Load saved progress
  useEffect(() => {
    const savedStep = localStorage.getItem(ONBOARDING_STEP_KEY)
    if (savedStep) {
      setActiveStep(parseInt(savedStep, 10))
    }
  }, [])

  // Save progress
  useEffect(() => {
    localStorage.setItem(ONBOARDING_STEP_KEY, activeStep.toString())
  }, [activeStep])

  const handleNext = () => {
    setCompleted(prev => ({ ...prev, [activeStep]: true }))
    setActiveStep(prev => Math.min(prev + 1, STEPS.length - 1))
  }

  const handleBack = () => {
    setActiveStep(prev => Math.max(prev - 1, 0))
  }

  const handleComplete = () => {
    localStorage.setItem(ONBOARDING_KEY, 'true')
    onClose()
  }

  const handleSkip = () => {
    localStorage.setItem(ONBOARDING_KEY, 'skipped')
    onClose()
  }

  const handleGoToAccounts = () => {
    handleComplete()
    navigate('/accounts')
  }

  const progress = ((activeStep + 1) / STEPS.length) * 100

  return (
    <Dialog
      open={open}
      onClose={handleSkip}
      maxWidth="sm"
      fullWidth
      fullScreen={isMobile}
      PaperProps={{
        sx: {
          borderRadius: isMobile ? 0 : 3,
          overflow: 'hidden',
        },
      }}
    >
      {/* Progress bar */}
      <LinearProgress
        variant="determinate"
        value={progress}
        sx={{ height: 4 }}
      />

      {/* Close button */}
      <IconButton
        onClick={handleSkip}
        sx={{
          position: 'absolute',
          right: 8,
          top: 8,
          zIndex: 1,
        }}
        aria-label="Skip onboarding"
      >
        <CloseIcon />
      </IconButton>

      <DialogContent sx={{ p: 0 }}>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {activeStep === 0 && <WelcomeStep />}
            {activeStep === 1 && (
              <LinkAccountStep
                onSuccess={() => {
                  setAccountLinked(true)
                  // Auto-advance after successful link
                  setTimeout(() => handleNext(), 1000)
                }}
                accountLinked={accountLinked}
                onSkip={handleNext}
              />
            )}
            {activeStep === 2 && <FeaturesStep />}
            {activeStep === 3 && (
              <DiscordStep
                discordUsername={discordUsername}
                setDiscordUsername={setDiscordUsername}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </DialogContent>

      <DialogActions sx={{ p: 2, gap: 1 }}>
        {/* Step indicator */}
        <Box sx={{ flex: 1, display: 'flex', gap: 0.5 }}>
          {STEPS.map((_, index) => (
            <Box
              key={index}
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: index <= activeStep ? 'primary.main' : 'action.disabled',
                transition: 'background-color 0.2s',
              }}
            />
          ))}
        </Box>

        <Button onClick={handleSkip} color="inherit" size="small">
          Skip
        </Button>

        {activeStep > 0 && (
          <Button onClick={handleBack} startIcon={<ArrowBackIcon />}>
            Back
          </Button>
        )}

        {activeStep < STEPS.length - 1 ? (
          <Button
            variant="contained"
            onClick={handleNext}
            endIcon={<ArrowForwardIcon />}
          >
            Next
          </Button>
        ) : (
          <Button
            variant="contained"
            onClick={handleComplete}
            color="success"
            endIcon={<CheckCircleIcon />}
          >
            Get Started
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

// Step 1: Welcome
function WelcomeStep() {
  return (
    <Box sx={{ p: 4, textAlign: 'center' }}>
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', duration: 0.5 }}
      >
        <Box
          sx={{
            width: 100,
            height: 100,
            borderRadius: '50%',
            bgcolor: 'primary.light',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 3,
          }}
        >
          <RocketLaunchIcon sx={{ fontSize: 50, color: 'primary.main' }} />
        </Box>
      </motion.div>

      <Typography variant="h4" fontWeight="bold" gutterBottom>
        Welcome to Pack Hunter
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
        Your automation dashboard for TCG Pocket. Hunt for God Packs,
        manage cards, and automate gameplay—all in one place.
      </Typography>

      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Chip icon={<HuntIcon />} label="God Pack Hunting" />
        <Chip icon={<GiftIcon />} label="Auto Trading" />
        <Chip icon={<AnalyticsIcon />} label="Collection Tracking" />
      </Box>
    </Box>
  )
}

// Step 2: Link Account (Interactive)
function LinkAccountStep({ onSuccess, accountLinked, onSkip }) {
  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <LinkIcon sx={{ fontSize: 48, color: accountLinked ? 'success.main' : 'primary.main', mb: 1 }} />
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          {accountLinked ? 'Account Linked!' : 'Link Your Game Account'}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {accountLinked
            ? 'Great! Your account is now connected.'
            : 'Upload your game files to connect your TCG Pocket account.'}
        </Typography>
      </Box>

      {accountLinked ? (
        <Alert severity="success" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>Your account has been linked successfully!</strong>
            <br />
            You can now use all automation features.
          </Typography>
        </Alert>
      ) : (
        <>
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>What you'll need:</strong>
              <br />
              <code>deviceAccount.xml</code> from <code>/shared_prefs/</code>
              <br />
              <code>dc.bin</code> from <code>/files/</code>
            </Typography>
          </Alert>

          <FileUploadForm
            compact
            showAccountType={false}
            onSuccess={onSuccess}
          />

          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Button
              variant="text"
              color="inherit"
              size="small"
              onClick={onSkip}
            >
              Skip for now - I'll do this later
            </Button>
          </Box>
        </>
      )}
    </Box>
  )
}

// Step 3: Features
function FeaturesStep() {
  const features = [
    {
      icon: HuntIcon,
      title: 'God Pack Hunting',
      description: 'Automatically open packs across multiple accounts to find ultra-rare God Packs.',
    },
    {
      icon: GiftIcon,
      title: 'Auto Gift & Trade',
      description: 'Request common cards from the pool and trade with other users automatically.',
    },
    {
      icon: AnalyticsIcon,
      title: 'Collection Tracking',
      description: 'Track your card collection, view missing cards, and monitor progress.',
    },
  ]

  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          Key Features
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Here's what you can do with Pack Hunter
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {features.map((feature, index) => (
          <motion.div
            key={feature.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 2,
              }}
            >
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  bgcolor: 'primary.light',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <feature.icon color="primary" />
              </Box>
              <Box>
                <Typography variant="subtitle1" fontWeight="bold">
                  {feature.title}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {feature.description}
                </Typography>
              </Box>
            </Paper>
          </motion.div>
        ))}
      </Box>
    </Box>
  )
}

// Step 4: Discord (Optional)
function DiscordStep({ discordUsername, setDiscordUsername }) {
  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ textAlign: 'center', mb: 3 }}>
        <DiscordIcon sx={{ fontSize: 48, color: '#5865F2', mb: 1 }} />
        <Typography variant="h5" fontWeight="bold" gutterBottom>
          Discord Notifications
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Connect your Discord to receive hunt notifications (optional)
        </Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        <Typography variant="body2">
          <strong>Why connect Discord?</strong>
          <br />
          Get instant notifications when God Packs are found, receive trade alerts, and more.
        </Typography>
      </Alert>

      <TextField
        fullWidth
        label="Discord Username"
        value={discordUsername}
        onChange={(e) => setDiscordUsername(e.target.value)}
        placeholder="yourname"
        helperText="Your Discord username (not display name). You can add this later in Settings."
        margin="normal"
      />

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 3 }}>
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <Typography variant="h5">🔔</Typography>
            <Box>
              <Typography variant="subtitle2" fontWeight="bold">
                God Pack Alerts
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Get notified immediately when a God Pack is found
              </Typography>
            </Box>
          </Box>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <Typography variant="h5">🤝</Typography>
            <Box>
              <Typography variant="subtitle2" fontWeight="bold">
                Trade Notifications
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Know when trades complete or need attention
              </Typography>
            </Box>
          </Box>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
            <Typography variant="h5">📊</Typography>
            <Box>
              <Typography variant="subtitle2" fontWeight="bold">
                Daily Summaries
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Receive daily stats and activity reports
              </Typography>
            </Box>
          </Box>
        </motion.div>
      </Box>

      <Alert severity="success" sx={{ mt: 3 }}>
        <Typography variant="body2">
          <strong>You're all set!</strong> Click "Get Started" to begin using Pack Hunter.
        </Typography>
      </Alert>
    </Box>
  )
}

/**
 * Hook to check if onboarding should be shown
 */
export function useOnboarding() {
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    const completed = localStorage.getItem(ONBOARDING_KEY)
    if (!completed) {
      // Delay showing onboarding slightly for better UX
      const timer = setTimeout(() => setShowOnboarding(true), 500)
      return () => clearTimeout(timer)
    }
  }, [])

  const resetOnboarding = () => {
    localStorage.removeItem(ONBOARDING_KEY)
    localStorage.removeItem(ONBOARDING_STEP_KEY)
    setShowOnboarding(true)
  }

  return {
    showOnboarding,
    setShowOnboarding,
    resetOnboarding,
  }
}

export default OnboardingWizard
