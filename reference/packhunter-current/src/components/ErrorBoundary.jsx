/**
 * ErrorBoundary - Catches React component errors and displays a fallback UI
 * Prevents entire app from crashing when a single component fails
 */

import { Component } from 'react'
import { Box, Typography, Button, Paper, Alert } from '@mui/material'
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline'
import RefreshIcon from '@mui/icons-material/Refresh'
import HomeIcon from '@mui/icons-material/Home'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    // Log error to console for debugging
    console.error('[ErrorBoundary] Caught error:', error, errorInfo)
  }

  handleRefresh = () => {
    window.location.reload()
  }

  handleGoHome = () => {
    window.location.href = '/'
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: this.props.fullPage ? '100vh' : '400px',
            p: 3,
          }}
        >
          <Paper
            elevation={3}
            sx={{
              p: 4,
              maxWidth: 500,
              textAlign: 'center',
              borderRadius: 2,
            }}
          >
            <ErrorOutlineIcon
              sx={{
                fontSize: 64,
                color: 'error.main',
                mb: 2
              }}
            />

            <Typography variant="h5" gutterBottom fontWeight="bold">
              Something went wrong
            </Typography>

            <Typography color="text.secondary" sx={{ mb: 3 }}>
              {this.props.fallbackMessage ||
                "We're sorry, but something unexpected happened. Please try refreshing the page."}
            </Typography>

            {this.state.error && (
              <Alert
                severity="error"
                sx={{
                  mb: 3,
                  textAlign: 'left',
                  '& .MuiAlert-message': {
                    overflow: 'auto',
                    maxHeight: 100,
                  }
                }}
              >
                <Typography variant="body2" component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {this.state.error.toString()}
                </Typography>
              </Alert>
            )}

            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={this.handleRefresh}
              >
                Refresh Page
              </Button>

              <Button
                variant="outlined"
                startIcon={<HomeIcon />}
                onClick={this.handleGoHome}
              >
                Go Home
              </Button>

              {this.props.onRetry && (
                <Button
                  variant="text"
                  onClick={this.handleRetry}
                >
                  Try Again
                </Button>
              )}
            </Box>
          </Paper>
        </Box>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
