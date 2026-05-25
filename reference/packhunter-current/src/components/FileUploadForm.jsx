/**
 * FileUploadForm - Reusable file upload component for account linking
 *
 * Used in:
 * - AccountLink page (full version)
 * - OnboardingWizard (compact version)
 *
 * Features:
 * - XML + dc.bin file dropzones
 * - Upload progress and status
 * - Error handling
 * - Account type selection (main/alt)
 */

import { useState } from 'react'
import {
  Box,
  Button,
  Typography,
  Paper,
  Chip,
  Alert,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material'
import {
  CloudUpload as UploadIcon,
  Check as CheckIcon,
  Link as LinkIcon,
} from '@mui/icons-material'
import { accounts } from '../services/api'

export function FileUploadForm({
  onSuccess,
  onError,
  compact = false,
  showAccountType = true,
  defaultAccountType = 'main',
}) {
  const [xmlFile, setXmlFile] = useState(null)
  const [dcbinFile, setDcbinFile] = useState(null)
  const [accountType, setAccountType] = useState(defaultAccountType)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleXmlSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setXmlFile(file)
      setError('')
    }
  }

  const handleDcbinSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setDcbinFile(file)
      setError('')
    }
  }

  const handleUpload = async () => {
    if (!xmlFile || !dcbinFile) {
      const msg = 'Both XML and dc.bin files are required'
      setError(msg)
      onError?.(msg)
      return
    }

    setError('')
    setSuccess('')
    setSubmitting(true)

    try {
      const data = await accounts.linkAccount(xmlFile, dcbinFile, accountType)
      if (data.error) {
        const errorMsg = data.error + (data.details ? `: ${data.details}` : '')
        setError(errorMsg)
        onError?.(errorMsg)
      } else {
        const successMsg = data.message || `${accountType === 'alt' ? 'Alt' : 'Main'} account linked successfully!`
        setSuccess(successMsg)
        setXmlFile(null)
        setDcbinFile(null)
        onSuccess?.(data)
      }
    } catch (err) {
      const errorMsg = err.message || 'Failed to link account'
      setError(errorMsg)
      onError?.(errorMsg)
    } finally {
      setSubmitting(false)
    }
  }

  const isReady = xmlFile && dcbinFile

  // Compact mode for OnboardingWizard
  if (compact) {
    return (
      <Box>
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

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 2 }}>
          <Button
            component="label"
            variant={xmlFile ? "contained" : "outlined"}
            color={xmlFile ? "success" : "primary"}
            startIcon={xmlFile ? <CheckIcon /> : <UploadIcon />}
            disabled={submitting}
            fullWidth
            size="small"
          >
            {xmlFile ? `XML: ${xmlFile.name}` : 'Select XML File'}
            <input type="file" hidden accept=".xml" onChange={handleXmlSelect} />
          </Button>

          <Button
            component="label"
            variant={dcbinFile ? "contained" : "outlined"}
            color={dcbinFile ? "success" : "primary"}
            startIcon={dcbinFile ? <CheckIcon /> : <UploadIcon />}
            disabled={submitting}
            fullWidth
            size="small"
          >
            {dcbinFile ? `dc.bin: ${dcbinFile.name}` : 'Select dc.bin File'}
            <input type="file" hidden accept=".bin" onChange={handleDcbinSelect} />
          </Button>
        </Box>

        <Button
          variant="contained"
          color="primary"
          fullWidth
          onClick={handleUpload}
          disabled={submitting || !isReady}
          startIcon={submitting ? <CircularProgress size={16} color="inherit" /> : <LinkIcon />}
        >
          {submitting ? 'Linking...' : 'Link Account'}
        </Button>

        {!isReady && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
            Select both files to continue
          </Typography>
        )}
      </Box>
    )
  }

  // Full mode for AccountLink page
  return (
    <Box>
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

      <Alert severity="warning" sx={{ mb: 2 }}>
        <Typography variant="body2">
          <strong>Both files are required!</strong> Upload your XML file AND dc.bin file together.
        </Typography>
      </Alert>

      {/* File locations info */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3, bgcolor: '#1e1e1e' }}>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          <strong>1. XML File location:</strong>
        </Typography>
        <Typography variant="caption" sx={{ fontFamily: 'monospace', wordBreak: 'break-all', display: 'block', mb: 2 }}>
          /data/data/jp.pokemon.pokemontcgp/shared_prefs/deviceAccount.xml
        </Typography>

        <Typography variant="body2" color="text.secondary" gutterBottom>
          <strong>2. dc.bin File location:</strong>
        </Typography>
        <Typography variant="caption" sx={{ fontFamily: 'monospace', wordBreak: 'break-all', display: 'block' }}>
          /data/data/jp.pokemon.pokemontcgp/files/dc.bin
        </Typography>
      </Paper>

      {/* File upload buttons */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            component="label"
            variant={xmlFile ? "contained" : "outlined"}
            color={xmlFile ? "success" : "primary"}
            startIcon={xmlFile ? <CheckIcon /> : <UploadIcon />}
            disabled={submitting}
            sx={{ minWidth: 200 }}
          >
            {xmlFile ? xmlFile.name : 'Select XML File'}
            <input type="file" hidden accept=".xml" onChange={handleXmlSelect} />
          </Button>
          {xmlFile && (
            <Chip label="XML Ready" color="success" size="small" />
          )}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Button
            component="label"
            variant={dcbinFile ? "contained" : "outlined"}
            color={dcbinFile ? "success" : "primary"}
            startIcon={dcbinFile ? <CheckIcon /> : <UploadIcon />}
            disabled={submitting}
            sx={{ minWidth: 200 }}
          >
            {dcbinFile ? dcbinFile.name : 'Select dc.bin File'}
            <input type="file" hidden accept=".bin" onChange={handleDcbinSelect} />
          </Button>
          {dcbinFile && (
            <Chip label="dc.bin Ready" color="success" size="small" />
          )}
        </Box>
      </Box>

      {/* Account Type Selector */}
      {showAccountType && (
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Account Type:
          </Typography>
          <ToggleButtonGroup
            value={accountType}
            exclusive
            onChange={(e, newValue) => newValue && setAccountType(newValue)}
            aria-label="account type"
            fullWidth
          >
            <ToggleButton value="main" aria-label="main account">
              Main Account
            </ToggleButton>
            <ToggleButton value="alt" aria-label="alt account">
              Alt Account
            </ToggleButton>
          </ToggleButtonGroup>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
            {accountType === 'main'
              ? 'Main account is your primary game account'
              : 'Alt account is your secondary game account for hunting'}
          </Typography>
        </Box>
      )}

      {/* Link Account Button */}
      <Button
        variant="contained"
        color="primary"
        size="large"
        fullWidth
        onClick={handleUpload}
        disabled={submitting || !isReady}
        startIcon={submitting ? <CircularProgress size={20} /> : <LinkIcon />}
      >
        {submitting ? 'Linking Account...' : `Link ${accountType === 'alt' ? 'Alt' : 'Main'} Account`}
      </Button>

      {!isReady && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, textAlign: 'center' }}>
          Select both files above to enable the Link Account button
        </Typography>
      )}
    </Box>
  )
}

export default FileUploadForm
