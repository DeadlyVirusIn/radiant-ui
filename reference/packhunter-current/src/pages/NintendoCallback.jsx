import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Box,
  Typography,
  CircularProgress,
  Alert,
  Button,
  TextField,
  Paper,
} from '@mui/material'
import { Link as LinkIcon } from '@mui/icons-material'
import { accounts } from '../services/api'
import GlassCard from '../components/GlassCard'
import { FadeIn } from '../components/Animations'

/**
 * Nintendo OAuth Callback Page
 *
 * This page handles the Nintendo OAuth redirect. Since Nintendo uses a custom
 * app scheme (npf045ab1d9068381b3://auth), browsers can't directly handle it.
 *
 * Two approaches:
 * 1. User manually pastes the redirect URL (what we support)
 * 2. JavaScript attempts to capture the URL before the scheme redirect
 */
function NintendoCallback() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [redirectUrl, setRedirectUrl] = useState('')
  const [tokenInfo, setTokenInfo] = useState(null)

  // Check if we have URL fragment data (some browsers might preserve it)
  useEffect(() => {
    // Check for hash fragment (Nintendo puts data in fragment)
    const hash = window.location.hash
    if (hash && hash.includes('session_token_code=')) {
      // Reconstruct the full redirect URL
      const fullUrl = `npf045ab1d9068381b3://auth${hash}`
      setRedirectUrl(fullUrl)
      handleParseUrl(fullUrl)
    }

    // Also check URL params (in case they come through query string)
    const code = searchParams.get('session_token_code')
    if (code) {
      const fullUrl = `npf045ab1d9068381b3://auth#session_token_code=${code}`
      setRedirectUrl(fullUrl)
      handleParseUrl(fullUrl)
    }
  }, [searchParams])

  const handleParseUrl = async (url) => {
    if (!url) return

    setLoading(true)
    setError('')

    try {
      const data = await accounts.parseNintendoUrl(url)
      if (data.error) {
        setError(data.error + (data.message ? `: ${data.message}` : ''))
      } else {
        setTokenInfo(data.tokenInfo)
        if (!data.valid) {
          setError('Token has expired. Please try linking again.')
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to parse URL')
    } finally {
      setLoading(false)
    }
  }

  const handleLink = async () => {
    if (!redirectUrl) {
      setError('Please paste the redirect URL')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      // Get code verifier from session storage (if we stored it during auth URL generation)
      const codeVerifier = sessionStorage.getItem('nintendo_code_verifier')

      const data = await accounts.linkNintendo(redirectUrl, codeVerifier, '')

      if (data.error && !data.account) {
        setError(data.error + (data.message ? `: ${data.message}` : ''))
      } else {
        setSuccess(data.message || 'Account linked successfully!')
        // Clear stored code verifier
        sessionStorage.removeItem('nintendo_code_verifier')
        // Redirect to accounts page after success
        setTimeout(() => {
          navigate('/accounts')
        }, 2000)
      }
    } catch (err) {
      setError(err.message || 'Failed to link account')
    } finally {
      setLoading(false)
    }
  }

  const handleManualInput = (e) => {
    const value = e.target.value
    setRedirectUrl(value)

    // Auto-parse when URL looks complete
    if (value.includes('session_token_code=') && value.length > 100) {
      handleParseUrl(value)
    }
  }

  return (
    <FadeIn>
    <Box sx={{ maxWidth: 600, mx: 'auto', mt: 4 }}>
      <GlassCard title="Link Nintendo Account" icon={<LinkIcon />} accent="primary">

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}

          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {success}
              <Typography variant="body2" sx={{ mt: 1 }}>
                Redirecting to accounts page...
              </Typography>
            </Alert>
          )}

          {!success && (
            <>
              <Typography variant="body2" color="text.secondary" paragraph>
                After authorizing with Nintendo, paste the redirect URL below.
                It should start with <code>npf045ab1d9068381b3://</code>
              </Typography>

              <TextField
                fullWidth
                multiline
                rows={4}
                label="Nintendo Redirect URL"
                value={redirectUrl}
                onChange={handleManualInput}
                placeholder="npf045ab1d9068381b3://auth#session_token_code=..."
                margin="normal"
                helperText="Paste the URL you copied from the 'Select this account' button"
              />

              {tokenInfo && (
                <Paper variant="outlined" sx={{ p: 2, mt: 2, bgcolor: 'background.default' }}>
                  <Typography variant="body2" color="success.main" gutterBottom>
                    URL Valid
                  </Typography>
                  <Typography variant="body2">
                    <strong>Nintendo ID:</strong> {tokenInfo.nintendoUserId}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Expires:</strong> {new Date(tokenInfo.expiresAt).toLocaleString()}
                  </Typography>
                  <Typography variant="body2">
                    <strong>Time Left:</strong> {tokenInfo.expiresInSeconds}s
                  </Typography>
                </Paper>
              )}

              <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleLink}
                  disabled={loading || !redirectUrl || !tokenInfo}
                  fullWidth
                >
                  {loading ? <CircularProgress size={24} /> : 'Link Account'}
                </Button>

                <Button
                  variant="outlined"
                  onClick={() => navigate('/accounts')}
                  disabled={loading}
                >
                  Cancel
                </Button>
              </Box>

              <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                Don't have the URL yet?{' '}
                <Button
                  size="small"
                  onClick={() => navigate('/accounts')}
                >
                  Go to Link Account page
                </Button>
              </Typography>
            </>
          )}
      </GlassCard>
    </Box>
    </FadeIn>
  )
}

export default NintendoCallback
