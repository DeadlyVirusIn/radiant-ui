import { useState, useEffect } from 'react'
import PageHeader from '../components/PageHeader'
import {
  Box,
  Typography,
  Button,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  CircularProgress,
  TextField,
  Divider,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  ToggleButton,
  ToggleButtonGroup,
  useTheme,
} from '@mui/material'
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  CloudUpload as UploadIcon,
  Link as LinkIcon,
  OpenInNew as OpenInNewIcon,
  Check as CheckIcon,
  ContentCopy as CopyIcon,
  InfoOutlined as InfoIcon,
  LinkOff as LinkOffIcon,
} from '@mui/icons-material'
import { accounts } from '../services/api'
import { formatDateTime } from '../utils/dateFormat'
import { useLanguage } from '../contexts/LanguageContext'
import { FadeIn } from '../components/Animations'
import { EmptyState } from '../components/EmptyState'
import { FormPageSkeleton } from '../components/skeletons/PageSkeletons'
import { useSectionStyles } from '../components/SectionCard'

function AccountLink({ user }) {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const { t } = useLanguage()
  const [linkedAccounts, setLinkedAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // Link method: 'xml' = XML + dc.bin (preferred), 'nintendo' = Nintendo OAuth + dc.bin (fallback)
  const [linkMethod, setLinkMethod] = useState('xml')

  // Manual entry form state
  const [deviceAccount, setDeviceAccount] = useState('')
  const [devicePassword, setDevicePassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Friend code state (trade-tier)
  const [friendCode, setFriendCode] = useState('')

  // Unified file upload state
  const [xmlFile, setXmlFile] = useState(null)
  const [dcbinFile, setDcbinFile] = useState(null)
  const [accountType, setAccountType] = useState('main')

  // Nintendo OAuth state
  const [nintendoStep, setNintendoStep] = useState(0)
  const [authUrl, setAuthUrl] = useState('')
  const [codeVerifier, setCodeVerifier] = useState('')
  const [nintendoRedirectUrl, setNintendoRedirectUrl] = useState('')
  const [nintendoNickname, setNintendoNickname] = useState('')
  const [parsedTokenInfo, setParsedTokenInfo] = useState(null)
  const [copied, setCopied] = useState(false)

  // Edit dialog
  const [editDialog, setEditDialog] = useState(false)
  const [editAccount, setEditAccount] = useState(null)
  const [editNickname, setEditNickname] = useState('')

  // Delete dialog
  const [deleteDialog, setDeleteDialog] = useState(false)
  const [deleteAccount, setDeleteAccount] = useState(null)

  useEffect(() => {
    loadAccounts()
  }, [])

  const loadAccounts = async () => {
    try {
      const data = await accounts.list()
      setLinkedAccounts(data.accounts || [])
    } catch (err) {
      setError('Failed to load accounts')
    } finally {
      setLoading(false)
    }
  }

  // Manual entry handlers
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setSubmitting(true)

    try {
      const data = await accounts.add(deviceAccount, devicePassword, nickname)
      if (data.error) {
        setError(data.error)
      } else {
        setSuccess('Account linked successfully!')
        setDeviceAccount('')
        setDevicePassword('')
        setNickname('')
        loadAccounts()
      }
    } catch (err) {
      setError(err.message || 'Failed to link account')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle XML file selection
  const handleXmlSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setXmlFile(file)
      setError('')
    }
  }

  // Handle dc.bin file selection
  const handleDcbinSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setDcbinFile(file)
      setError('')
    }
  }

  // Unified upload - requires BOTH files
  const handleUnifiedUpload = async () => {
    if (!xmlFile || !dcbinFile) {
      setError('Both XML and dc.bin files are required to link an account')
      return
    }

    setError('')
    setSuccess('')
    setSubmitting(true)

    try {
      const data = await accounts.linkAccount(xmlFile, dcbinFile, accountType)
      if (data.error) {
        setError(data.error + (data.details ? `: ${data.details}` : ''))
      } else {
        setSuccess(data.message || `${accountType === 'alt' ? 'Alt' : 'Main'} account linked successfully!`)
        setXmlFile(null)
        setDcbinFile(null)
        setAccountType('main') // Reset to main after upload
        loadAccounts()
      }
    } catch (err) {
      setError(err.message || 'Failed to link account')
    } finally {
      setSubmitting(false)
    }
  }

  // Friend code handler (trade-tier)
  const handleFriendCodeSubmit = async () => {
    setError('')
    setSuccess('')
    setSubmitting(true)
    try {
      const data = await accounts.linkFriendCode(friendCode)
      if (data.error) {
        setError(data.error)
      } else {
        setSuccess(data.message || 'Friend code linked!')
        setFriendCode('')
        loadAccounts()
      }
    } catch (err) {
      setError(err.message || 'Failed to link friend code')
    } finally {
      setSubmitting(false)
    }
  }

  // Auto-format friend code with dashes
  const handleFriendCodeChange = (e) => {
    let value = e.target.value.replace(/[^0-9]/g, '')
    if (value.length > 16) value = value.slice(0, 16)
    // Insert dashes after every 4 digits
    const parts = value.match(/.{1,4}/g)
    setFriendCode(parts ? parts.join('-') : '')
  }

  // Nintendo OAuth handlers
  const handleGenerateAuthUrl = async () => {
    setError('')
    setSubmitting(true)

    try {
      const data = await accounts.getNintendoAuthUrl()
      if (data.error) {
        setError(data.error)
      } else {
        setAuthUrl(data.authUrl)
        setCodeVerifier(data.codeVerifier)
        // Store code verifier in sessionStorage for the callback page
        sessionStorage.setItem('nintendo_code_verifier', data.codeVerifier)
        setNintendoStep(1)
      }
    } catch (err) {
      setError(err.message || 'Failed to generate auth URL')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopyAuthUrl = async () => {
    try {
      await navigator.clipboard.writeText(authUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      setError('Failed to copy URL')
    }
  }

  const handleParseRedirectUrl = async () => {
    if (!nintendoRedirectUrl) {
      setError('Please paste the redirect URL')
      return
    }

    setError('')
    setSubmitting(true)

    try {
      const data = await accounts.parseNintendoUrl(nintendoRedirectUrl)
      if (data.error) {
        setError(data.error + (data.message ? `: ${data.message}` : ''))
      } else {
        setParsedTokenInfo(data.tokenInfo)
        if (data.valid) {
          setNintendoStep(3)
        } else {
          setError('Token has expired. Please start over with a new authorization.')
          setNintendoStep(0)
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to parse redirect URL')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLinkNintendo = async () => {
    setError('')
    setSuccess('')
    setSubmitting(true)

    try {
      const data = await accounts.linkNintendo(nintendoRedirectUrl, codeVerifier, nintendoNickname)
      if (data.error && !data.account) {
        setError(data.error + (data.message ? `: ${data.message}` : ''))
      } else {
        if (data.warning) {
          setSuccess(`${data.message} (Note: ${data.warning})`)
        } else {
          setSuccess(data.message || 'Nintendo account linked successfully!')
        }
        // Reset form
        setNintendoStep(0)
        setAuthUrl('')
        setCodeVerifier('')
        setNintendoRedirectUrl('')
        setNintendoNickname('')
        setParsedTokenInfo(null)
        loadAccounts()
      }
    } catch (err) {
      setError(err.message || 'Failed to link Nintendo account')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (account) => {
    setEditAccount(account)
    setEditNickname(account.nickname || '')
    setEditDialog(true)
  }

  const handleEditSave = async () => {
    try {
      await accounts.update(editAccount.id, { nickname: editNickname })
      setEditDialog(false)
      loadAccounts()
    } catch (err) {
      setError('Failed to update account')
    }
  }

  const handleDelete = (account) => {
    setDeleteAccount(account)
    setDeleteDialog(true)
  }

  const handleDeleteConfirm = async () => {
    try {
      await accounts.delete(deleteAccount.id)
      setDeleteDialog(false)
      loadAccounts()
    } catch (err) {
      setError('Failed to delete account')
    }
  }

  const { sectionBox: cardStyle } = useSectionStyles()

  const monoBoxStyle = {
    p: 2,
    borderRadius: '10px',
    border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.1)' : 'rgba(0, 0, 0, 0.07)'}`,
    bgcolor: isDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.03)',
  }

  const renderNintendoOAuthSteps = () => (
    <Stepper activeStep={nintendoStep} orientation="vertical">
      {/* Step 0: Generate Auth URL */}
      <Step>
        <StepLabel>Generate Authorization Link</StepLabel>
        <StepContent>
          <Typography variant="body2" color="text.secondary" paragraph>
            Click the button below to generate a Nintendo Account authorization link.
          </Typography>
          <Button
            variant="contained"
            onClick={handleGenerateAuthUrl}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={20} /> : <LinkIcon />}
          >
            Generate Auth Link
          </Button>
        </StepContent>
      </Step>

      {/* Step 1: Visit Auth URL */}
      <Step>
        <StepLabel>Authorize with Nintendo</StepLabel>
        <StepContent>
          <Typography variant="body2" color="text.secondary" paragraph>
            Click the link below to open Nintendo Account authorization. After authorizing:
          </Typography>
          <Box component="ol" sx={{ pl: 2, mb: 2 }}>
            <li>Log in to your Nintendo Account if prompted</li>
            <li>Click <strong>"Authorize"</strong> to grant access</li>
            <li>After the "Linking" screen, go back <strong>TWO pages</strong></li>
            <li>Right-click the <strong>"Select this account"</strong> button</li>
            <li>Choose <strong>"Copy link"</strong> (or long-press on mobile)</li>
          </Box>

          <Box sx={{ ...monoBoxStyle, mb: 2 }}>
            <Typography variant="caption" sx={{ wordBreak: 'break-all', fontFamily: 'monospace', color: 'text.secondary' }}>
              {authUrl}
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            <Button
              variant="contained"
              color="primary"
              startIcon={<OpenInNewIcon />}
              href={authUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open Authorization Page
            </Button>
            <Button
              variant="outlined"
              startIcon={copied ? <CheckIcon /> : <CopyIcon />}
              onClick={handleCopyAuthUrl}
            >
              {copied ? 'Copied!' : 'Copy Link'}
            </Button>
            <Button onClick={() => setNintendoStep(2)}>
              Next
            </Button>
          </Box>
        </StepContent>
      </Step>

      {/* Step 2: Paste Redirect URL */}
      <Step>
        <StepLabel>Paste Redirect URL</StepLabel>
        <StepContent>
          <Typography variant="body2" color="text.secondary" paragraph>
            Paste the URL you copied from the "Select this account" button below.
            It should start with <code>npf045ab1d9068381b3://</code>
          </Typography>

          <TextField
            fullWidth
            multiline
            rows={3}
            label="Nintendo Redirect URL"
            value={nintendoRedirectUrl}
            onChange={(e) => setNintendoRedirectUrl(e.target.value)}
            placeholder="npf045ab1d9068381b3://auth#session_token_code=..."
            margin="normal"
            sx={{ fontFamily: 'monospace' }}
          />

          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <Button
              variant="contained"
              onClick={handleParseRedirectUrl}
              disabled={submitting || !nintendoRedirectUrl}
              startIcon={submitting ? <CircularProgress size={20} /> : null}
            >
              Verify URL
            </Button>
            <Button onClick={() => setNintendoStep(1)}>
              Back
            </Button>
          </Box>
        </StepContent>
      </Step>

      {/* Step 3: Confirm & Link */}
      <Step>
        <StepLabel>Confirm & Link Account</StepLabel>
        <StepContent>
          {parsedTokenInfo && (
            <Box sx={{ ...monoBoxStyle, mb: 2 }}>
              <Typography variant="body2" gutterBottom>
                <strong>Nintendo User ID:</strong> {parsedTokenInfo.nintendoUserId}
              </Typography>
              <Typography variant="body2" gutterBottom>
                <strong>Token Expires:</strong> {formatDateTime(parsedTokenInfo.expiresAt)}
              </Typography>
              <Typography variant="body2">
                <strong>Time Remaining:</strong> {parsedTokenInfo.expiresInSeconds}s
              </Typography>
            </Box>
          )}

          <TextField
            fullWidth
            label="Account Nickname (optional)"
            value={nintendoNickname}
            onChange={(e) => setNintendoNickname(e.target.value)}
            placeholder="e.g., My Main Account"
            margin="normal"
          />

          <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
            <Button
              variant="contained"
              color="success"
              onClick={handleLinkNintendo}
              disabled={submitting}
              startIcon={submitting ? <CircularProgress size={20} /> : <LinkIcon />}
            >
              Link Nintendo Account
            </Button>
            <Button onClick={() => setNintendoStep(2)}>
              Back
            </Button>
          </Box>
        </StepContent>
      </Step>
    </Stepper>
  )

  return (
    <FadeIn>
      <Box>
        {/* Header */}
        <PageHeader
          icon={<LinkIcon />}
          title="Link Account"
          subtitle="Connect your game accounts to start tracking and hunting"
        />

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
            {error}
          </Alert>
        )}
        {success && (
          <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
            {success}
          </Alert>
        )}

        {user?.subscriptionTier === 'trade' ? (
          /* Simple friend code form for trade-tier users */
          <Box sx={{ ...cardStyle, mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '8px',
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark || theme.palette.primary.main})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <LinkIcon sx={{ color: 'white', fontSize: 16 }} />
              </Box>
              <Typography variant="subtitle1" fontWeight={600}>Link Friend Code</Typography>
            </Box>
            <Alert severity="info" sx={{ mb: 2, borderRadius: '10px' }}>
              Enter your in-game Friend Code. When you request a card, a bot will send you
              a friend request. Accept it in-game, then accept the trade/gift.
            </Alert>
            <TextField
              fullWidth
              label="Friend Code"
              value={friendCode}
              onChange={handleFriendCodeChange}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              inputProps={{ maxLength: 19 }}
              sx={{ mb: 2 }}
              size="small"
            />
            <Button
              variant="contained"
              onClick={handleFriendCodeSubmit}
              disabled={submitting || friendCode.replace(/[-\s]/g, '').length !== 16}
              startIcon={submitting ? <CircularProgress size={20} /> : <LinkIcon />}
              fullWidth
            >
              {submitting ? 'Linking...' : 'Link Friend Code'}
            </Button>
          </Box>
        ) : (
          /* Full file upload UI for premium/admin users */
          <>
            {/* Method selector - above the card */}
            <Box sx={{ mb: 2 }}>
              <ToggleButtonGroup
                value={linkMethod}
                exclusive
                onChange={(e, v) => v && setLinkMethod(v)}
                fullWidth
                sx={{ '& .MuiToggleButton-root': { borderRadius: '10px', textTransform: 'none' } }}
              >
                <ToggleButton value="xml">XML + dc.bin (Recommended)</ToggleButton>
                <ToggleButton value="nintendo">Nintendo OAuth + dc.bin</ToggleButton>
              </ToggleButtonGroup>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, textAlign: 'center' }}>
                {linkMethod === 'xml'
                  ? 'Upload both files from your emulator. This is the most reliable method.'
                  : 'Use this only if you cannot get the XML file. Requires Nintendo Account login.'}
              </Typography>
            </Box>

            {/* Link Game Account Card */}
            <Box sx={{ ...cardStyle, mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                <Box sx={{ width: 32, height: 32, borderRadius: '8px', background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark || theme.palette.primary.main})`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UploadIcon sx={{ color: 'white', fontSize: 16 }} />
                </Box>
                <Typography variant="subtitle1" fontWeight={600}>
                  {linkMethod === 'xml' ? 'Link Account (XML + dc.bin)' : 'Link Account (Nintendo OAuth + dc.bin)'}
                </Typography>
              </Box>

              {linkMethod === 'xml' ? (
                /* ===== METHOD 1: XML + dc.bin (Preferred) ===== */
                <>
                  <Alert severity="info" sx={{ mb: 2, borderRadius: '10px' }}>
                    <Typography variant="body2">
                      Upload both files from your emulator. They must be from the same account.
                    </Typography>
                  </Alert>

                  <Box sx={{ ...monoBoxStyle, mb: 3 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom><strong>1. XML File:</strong></Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', wordBreak: 'break-all', display: 'block', mb: 2, color: 'text.primary' }}>
                      /data/data/jp.pokemon.pokemontcgp/shared_prefs/deviceAccount.xml
                    </Typography>
                    <Typography variant="body2" color="text.secondary" gutterBottom><strong>2. dc.bin File:</strong></Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', wordBreak: 'break-all', display: 'block', color: 'text.primary' }}>
                      /data/data/jp.pokemon.pokemontcgp/files/dc.bin
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Button component="label" variant={xmlFile ? 'contained' : 'outlined'} color={xmlFile ? 'success' : 'primary'} startIcon={xmlFile ? <CheckIcon /> : <UploadIcon />} disabled={submitting} sx={{ minWidth: 200, borderRadius: '10px' }}>
                        {xmlFile ? xmlFile.name : 'Select XML File'}
                        <input type="file" hidden accept=".xml" onChange={handleXmlSelect} />
                      </Button>
                      {xmlFile && <Chip label="XML Ready" color="success" size="small" />}
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Button component="label" variant={dcbinFile ? 'contained' : 'outlined'} color={dcbinFile ? 'success' : 'primary'} startIcon={dcbinFile ? <CheckIcon /> : <UploadIcon />} disabled={submitting} sx={{ minWidth: 200, borderRadius: '10px' }}>
                        {dcbinFile ? dcbinFile.name : 'Select dc.bin File'}
                        <input type="file" hidden accept=".bin" onChange={handleDcbinSelect} />
                      </Button>
                      {dcbinFile && <Chip label="dc.bin Ready" color="success" size="small" />}
                    </Box>
                  </Box>

                  <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle2" gutterBottom color="text.secondary">Account Type:</Typography>
                    <ToggleButtonGroup value={accountType} exclusive onChange={(e, v) => v && setAccountType(v)} fullWidth sx={{ '& .MuiToggleButton-root': { borderRadius: '10px' } }}>
                      <ToggleButton value="main">Main Account</ToggleButton>
                      <ToggleButton value="alt">Alt Account</ToggleButton>
                    </ToggleButtonGroup>
                  </Box>

                  <Button variant="contained" color="primary" size="large" fullWidth onClick={handleUnifiedUpload} disabled={submitting || !xmlFile || !dcbinFile} startIcon={submitting ? <CircularProgress size={20} /> : <LinkIcon />} sx={{ borderRadius: '10px' }}>
                    {submitting ? 'Linking Account...' : `Link ${accountType === 'alt' ? 'Alt' : 'Main'} Account`}
                  </Button>
                  {(!xmlFile || !dcbinFile) && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
                      Select both files above to enable the Link Account button
                    </Typography>
                  )}
                </>
              ) : (
                /* ===== METHOD 2: Nintendo OAuth + dc.bin (Fallback) ===== */
                <>
                  <Alert severity="warning" sx={{ mb: 2, borderRadius: '10px' }}>
                    <Typography variant="body2">
                      <strong>Alternative method:</strong> Use this only if you cannot extract the XML file.
                      You still need the <strong>dc.bin</strong> file from your emulator.
                    </Typography>
                  </Alert>

                  <Typography variant="subtitle2" sx={{ mb: 1 }} color="text.secondary">Step 1: Upload dc.bin file</Typography>
                  <Box sx={{ ...monoBoxStyle, mb: 2 }}>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', wordBreak: 'break-all', display: 'block', color: 'text.primary' }}>
                      /data/data/jp.pokemon.pokemontcgp/files/dc.bin
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                    <Button component="label" variant={dcbinFile ? 'contained' : 'outlined'} color={dcbinFile ? 'success' : 'primary'} startIcon={dcbinFile ? <CheckIcon /> : <UploadIcon />} disabled={submitting} sx={{ minWidth: 200, borderRadius: '10px' }}>
                      {dcbinFile ? dcbinFile.name : 'Select dc.bin File'}
                      <input type="file" hidden accept=".bin" onChange={handleDcbinSelect} />
                    </Button>
                    {dcbinFile && <Chip label="dc.bin Ready" color="success" size="small" />}
                  </Box>

                  <Divider sx={{ mb: 2 }} />
                  <Typography variant="subtitle2" sx={{ mb: 1 }} color="text.secondary">Step 2: Link Nintendo Account</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Log in with your Nintendo Account to authenticate. This replaces the XML file.
                  </Typography>
                  {renderNintendoOAuthSteps()}
                </>
              )}
            </Box>
          </>
        )}

        {/* Linked Accounts List */}
        <Box sx={cardStyle}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
            <Box
              sx={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <LinkIcon sx={{ color: 'white', fontSize: 16 }} />
            </Box>
            <Typography variant="subtitle1" fontWeight={600}>
              Linked Accounts ({linkedAccounts.length})
            </Typography>
          </Box>

          {loading ? (
            <FormPageSkeleton />
          ) : linkedAccounts.length === 0 ? (
            <EmptyState
              icon={<LinkOffIcon />}
              title="No Accounts Linked"
              description="No accounts linked yet. Add one above."
            />
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {linkedAccounts.map((account) => (
                <Box
                  key={account.id}
                  sx={{
                    p: 2,
                    borderRadius: '10px',
                    border: `1px solid ${isDark ? 'rgba(124, 138, 255, 0.1)' : 'rgba(0, 0, 0, 0.07)'}`,
                    bgcolor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.015)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 2,
                    transition: 'border-color 0.2s',
                    '&:hover': {
                      borderColor: isDark ? 'rgba(124, 138, 255, 0.25)' : 'rgba(92, 106, 196, 0.2)',
                    },
                  }}
                >
                  {/* Left: account status accent bar */}
                  <Box
                    sx={{
                      width: 4,
                      alignSelf: 'stretch',
                      borderRadius: 2,
                      bgcolor: account.is_active ? 'success.main' : 'grey.500',
                      flexShrink: 0,
                      minHeight: 40,
                    }}
                  />

                  {/* Content */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    {/* Name + chips row */}
                    <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75, mb: 0.5 }}>
                      <Chip
                        label={account.account_type === 'alt' ? 'Alt' : 'Main'}
                        color={account.account_type === 'alt' ? 'secondary' : 'primary'}
                        size="small"
                        variant="outlined"
                      />
                      <Typography variant="body2" fontWeight={600}>
                        {account.nickname || `Account ${account.id}`}
                      </Typography>
                      <Chip
                        label={account.is_active ? 'Active' : 'Inactive'}
                        color={account.is_active ? 'success' : 'default'}
                        size="small"
                      />
                      {account.has_dcbin && (
                        <Chip label="dc.bin" color="success" size="small" variant="outlined" />
                      )}
                      {account.auth_method === 'nintendo' && (
                        <Chip label="Nintendo" color="info" size="small" />
                      )}
                      {account.auth_method === 'friend_code' && (
                        <Chip label="Friend Code" color="warning" size="small" />
                      )}
                    </Box>

                    {/* Details */}
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                      {account.device_account && (
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary' }}>
                          {account.device_account}
                        </Typography>
                      )}
                      {account.nintendo_user_id && (
                        <Typography variant="caption" color="text.secondary">
                          Nintendo ID: {account.nintendo_user_id}
                        </Typography>
                      )}
                      {account.player_id && (
                        <Typography variant="caption" color="text.secondary">
                          Player ID: {account.player_id}
                        </Typography>
                      )}
                      {account.friend_id && (
                        <Typography variant="caption" color="text.secondary">
                          Friend ID: {account.friend_id}
                        </Typography>
                      )}
                    </Box>
                  </Box>

                  {/* Actions */}
                  <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
                    <IconButton
                      size="small"
                      onClick={() => handleEdit(account)}
                      aria-label="Edit account"
                      sx={{ borderRadius: '8px' }}
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    {user?.isAdmin && (
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(account)}
                      color="error"
                      aria-label="Delete account"
                      sx={{ borderRadius: '8px' }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                    )}
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </Box>

        {/* Edit Dialog */}
        <Dialog open={editDialog} onClose={() => setEditDialog(false)} PaperProps={{ sx: { borderRadius: '14px' } }}>
          <DialogTitle>Edit Account</DialogTitle>
          <DialogContent>
            <TextField
              fullWidth
              label="Nickname"
              value={editNickname}
              onChange={(e) => setEditNickname(e.target.value)}
              margin="normal"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEditDialog(false)}>Cancel</Button>
            <Button onClick={handleEditSave} variant="contained">Save</Button>
          </DialogActions>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={deleteDialog} onClose={() => setDeleteDialog(false)} PaperProps={{ sx: { borderRadius: '14px' } }}>
          <DialogTitle>Delete Account</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to unlink this account?
            </Typography>
            {deleteAccount && (
              <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', display: 'block', mt: 1 }}>
                {deleteAccount.device_account || deleteAccount.nintendo_user_id || deleteAccount.friend_id}
              </Typography>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialog(false)}>Cancel</Button>
            <Button onClick={handleDeleteConfirm} color="error" variant="contained">
              Delete
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </FadeIn>
  )
}

export default AccountLink
