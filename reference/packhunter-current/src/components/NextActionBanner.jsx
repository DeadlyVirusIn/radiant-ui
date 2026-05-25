/**
 * NextActionBanner — Single prioritized action recommendation.
 *
 * Shows the most important thing the operator should do right now.
 * Dismissible (reappears when data changes or after 10 min).
 * Uses useNextAction hook for computation.
 */

import { useState, useEffect, useRef } from 'react';
import { Alert, Typography, Button, Box } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import { useNextAction } from '../hooks/useNextAction';

export default function NextActionBanner({ requests = [], accounts = [], onTabChange, type = 'trade' }) {
  const action = useNextAction(requests, accounts);
  const [dismissed, setDismissed] = useState(null); // stores dismissed priority
  const prevActionRef = useRef(null);

  // Reset dismissal when action changes to a different priority
  useEffect(() => {
    if (action && prevActionRef.current !== action.priority) {
      setDismissed(null);
    }
    prevActionRef.current = action?.priority ?? null;
  }, [action?.priority]);

  // Auto-reset dismissal after 10 minutes
  useEffect(() => {
    if (dismissed == null) return;
    const timer = setTimeout(() => setDismissed(null), 10 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [dismissed]);

  if (!action || dismissed === action.priority) return null;

  return (
    <Alert
      severity={action.severity}
      sx={{
        mb: 2,
        borderRadius: '10px',
        py: 0.75,
        alignItems: 'center',
        '& .MuiAlert-message': { flex: 1 },
      }}
      action={
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {action.actionLabel && onTabChange && (
            <Button
              size="small"
              color="inherit"
              onClick={() => onTabChange(action.actionValue)}
              sx={{ fontSize: '0.7rem', textTransform: 'none', fontWeight: 600 }}
            >
              {action.actionLabel}
            </Button>
          )}
          <IconButton size="small" onClick={() => setDismissed(action.priority)}>
            <CloseIcon sx={{ fontSize: 16 }} />
          </IconButton>
        </Box>
      }
    >
      <Typography variant="body2" sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
        {action.icon} {action.title}
      </Typography>
      <Typography variant="body2" sx={{ fontSize: '0.72rem', color: 'text.secondary', mt: 0.25 }}>
        {action.description}
      </Typography>
    </Alert>
  );
}
