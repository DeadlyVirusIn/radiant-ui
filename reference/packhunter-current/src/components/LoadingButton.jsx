/**
 * LoadingButton - Button that shows loading state during async operations
 * Wraps MUI Button with consistent loading behavior across the app.
 *
 * Usage:
 *   <LoadingButton loading={isLoading} onClick={handleClick}>Start Hunt</LoadingButton>
 *   <LoadingButton loading={saving} variant="outlined" startIcon={<SaveIcon />}>Save</LoadingButton>
 *   <LoadingButton loading={deleting} color="error" confirmText="Are you sure?">Delete</LoadingButton>
 */
import { useState } from 'react'
import { Button, CircularProgress } from '@mui/material'

export default function LoadingButton({
  loading = false,
  disabled = false,
  children,
  startIcon,
  onClick,
  variant = 'contained',
  color = 'primary',
  size = 'medium',
  fullWidth = false,
  sx = {},
  ...props
}) {
  return (
    <Button
      variant={variant}
      color={color}
      size={size}
      fullWidth={fullWidth}
      disabled={loading || disabled}
      onClick={onClick}
      startIcon={loading ? <CircularProgress size={18} color="inherit" /> : startIcon}
      sx={{
        minWidth: 44,
        minHeight: 44,
        position: 'relative',
        ...sx,
      }}
      {...props}
    >
      {children}
    </Button>
  )
}
