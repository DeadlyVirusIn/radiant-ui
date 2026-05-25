/**
 * ToastContainer - Renders toast notifications
 */

import { Snackbar, Alert, Stack, Slide } from '@mui/material'

function SlideTransition(props) {
  return <Slide {...props} direction="up" />
}

export function ToastContainer({ toasts, onRemove }) {
  return (
    <Stack
      spacing={1}
      sx={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        maxWidth: 400,
      }}
    >
      {toasts.map((toast) => (
        <Snackbar
          key={toast.id}
          open
          TransitionComponent={SlideTransition}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          sx={{ position: 'relative', transform: 'none !important' }}
        >
          <Alert
            severity={toast.severity}
            variant="filled"
            onClose={() => onRemove(toast.id)}
            sx={{
              width: '100%',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            }}
          >
            {toast.message}
          </Alert>
        </Snackbar>
      ))}
    </Stack>
  )
}

export default ToastContainer
