/**
 * ConfirmDialog - Reusable confirmation dialog for destructive actions
 *
 * Usage:
 *   <ConfirmDialog
 *     open={showConfirm}
 *     title="Delete Item?"
 *     message="This action cannot be undone."
 *     confirmText="Delete"
 *     confirmColor="error"
 *     onConfirm={() => { deleteItem(); setShowConfirm(false); }}
 *     onCancel={() => setShowConfirm(false)}
 *   />
 */

import { useState, useCallback, useEffect } from 'react'
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  Checkbox,
  FormControlLabel,
} from '@mui/material'
import WarningAmberIcon from '@mui/icons-material/WarningAmber'
import DeleteIcon from '@mui/icons-material/Delete'
import InfoIcon from '@mui/icons-material/Info'

export function ConfirmDialog({
  open,
  title = 'Confirm Action',
  message = 'Are you sure you want to continue?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmColor = 'primary',
  variant = 'warning', // 'warning', 'danger', 'info'
  onConfirm,
  onCancel,
  loading = false,
  confirmIcon = null,
  children, // For custom content
  // Phase WP-FixE — when set, render a checkbox the user must tick
  // before the Confirm button enables. Forces explicit acknowledgement
  // for destructive overrides (e.g. removing protected friends).
  requireCheckbox = null,
}) {
  const [ack, setAck] = useState(false);
  // Reset acknowledgement every time the dialog opens so the previous
  // confirmation doesn't carry over between unrelated invocations.
  useEffect(() => { if (open) setAck(false); }, [open]);
  const checkboxBlocking = !!requireCheckbox && !ack;
  const getVariantConfig = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: <DeleteIcon sx={{ fontSize: 48, color: 'error.main' }} />,
          iconBg: 'error.lighter',
          defaultConfirmColor: 'error',
        }
      case 'info':
        return {
          icon: <InfoIcon sx={{ fontSize: 48, color: 'info.main' }} />,
          iconBg: 'info.lighter',
          defaultConfirmColor: 'primary',
        }
      case 'warning':
      default:
        return {
          icon: <WarningAmberIcon sx={{ fontSize: 48, color: 'warning.main' }} />,
          iconBg: 'warning.lighter',
          defaultConfirmColor: 'warning',
        }
    }
  }

  const config = getVariantConfig()
  const finalConfirmColor = confirmColor || config.defaultConfirmColor

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onCancel}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', pt: 2 }}>
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: config.iconBg,
              mb: 2,
            }}
          >
            {config.icon}
          </Box>
          <Typography variant="h6" component="span" textAlign="center">
            {title}
          </Typography>
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Phase 5.1 — `children` (React node) wins over `message`
            (string) so callers can pass <ConfirmationSummary /> for the
            standardized outcome/will-not/risk/meta layout. Plain-string
            callers keep working unchanged. */}
        {children || (
          <DialogContentText sx={{ mb: 1, whiteSpace: 'pre-line', textAlign: message && message.length > 100 ? 'left' : 'center' }}>
            {message}
          </DialogContentText>
        )}
        {requireCheckbox && (
          <Box sx={{ mt: 2, p: 1.5, border: 1, borderColor: 'warning.main', borderRadius: 1, bgcolor: 'warning.lighter' }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={ack}
                  onChange={(e) => setAck(e.target.checked)}
                  color="warning"
                  size="small"
                  disabled={loading}
                />
              }
              label={
                <Typography variant="body2" color="text.primary">
                  {requireCheckbox}
                </Typography>
              }
            />
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3, justifyContent: 'center', gap: 1 }}>
        <Button
          onClick={onCancel}
          variant="outlined"
          disabled={loading}
          autoFocus={variant !== 'info'}
          sx={{ minWidth: 100 }}
        >
          {cancelText}
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color={finalConfirmColor}
          disabled={loading || checkboxBlocking}
          autoFocus={variant === 'info'}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : confirmIcon}
          sx={{ minWidth: 100 }}
        >
          {loading ? 'Processing...' : confirmText}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

/**
 * useConfirmDialog - Hook for easy confirm dialog management
 *
 * Usage:
 *   const { confirm, ConfirmDialogComponent } = useConfirmDialog()
 *
 *   const handleDelete = async () => {
 *     const confirmed = await confirm({
 *       title: 'Delete Item?',
 *       message: 'This cannot be undone.',
 *       variant: 'danger',
 *     })
 *     if (confirmed) {
 *       // Do the delete
 *     }
 *   }
 *
 *   return (
 *     <>
 *       <Button onClick={handleDelete}>Delete</Button>
 *       {ConfirmDialogComponent}
 *     </>
 *   )
 */

export function useConfirmDialog() {
  const [dialogState, setDialogState] = useState({
    open: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    confirmColor: 'primary',
    variant: 'warning',
    resolve: null,
  })

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      setDialogState({
        open: true,
        title: options.title || 'Confirm Action',
        message: options.message || 'Are you sure?',
        // Phase 5.1 — optional React body for the standardized
        // ConfirmationSummary pattern. When provided, replaces the
        // multi-line `message` text inside DialogContent.
        body: options.body || null,
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        confirmColor: options.confirmColor || 'primary',
        variant: options.variant || 'warning',
        // Phase WP-FixE — explicit-acknowledgement checkbox
        requireCheckbox: options.requireCheckbox || null,
        resolve,
      })
    })
  }, [])

  const handleConfirm = useCallback(() => {
    dialogState.resolve?.(true)
    setDialogState((prev) => ({ ...prev, open: false }))
  }, [dialogState.resolve])

  const handleCancel = useCallback(() => {
    dialogState.resolve?.(false)
    setDialogState((prev) => ({ ...prev, open: false }))
  }, [dialogState.resolve])

  const ConfirmDialogComponent = (
    <ConfirmDialog
      open={dialogState.open}
      title={dialogState.title}
      message={dialogState.message}
      confirmText={dialogState.confirmText}
      cancelText={dialogState.cancelText}
      confirmColor={dialogState.confirmColor}
      variant={dialogState.variant}
      requireCheckbox={dialogState.requireCheckbox}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    >
      {/* Phase 5.1 — pass-through for the structured body slot */}
      {dialogState.body || null}
    </ConfirmDialog>
  )

  return { confirm, ConfirmDialogComponent }
}

export default ConfirmDialog
