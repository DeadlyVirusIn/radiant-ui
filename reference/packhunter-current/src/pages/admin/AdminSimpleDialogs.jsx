/**
 * Simple confirmation/form dialogs extracted from AdminUsers.jsx
 *
 * 1. DeleteUserDialog
 * 2. StopAllBotsDialog
 * 3. StartAllBotsDialog
 * 4. AdminToggleDialog
 * 5. GrantTrialDialog
 */

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Alert,
  Chip,
  TextField,
  CircularProgress,
} from '@mui/material';
import {
  Stop as StopIcon,
  PlayArrow as PlayIcon,
  CardGiftcard as TrialIcon,
} from '@mui/icons-material';

/* ─── 1. Delete Confirmation Dialog ─── */
export function DeleteUserDialog({ open, user, onClose, onConfirm, loading = false }) {
  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onClose}
      disableEscapeKeyDown={loading}
    >
      <DialogTitle>Delete User</DialogTitle>
      <DialogContent>
        <Typography>
          Are you sure you want to delete user <strong>{user?.username}</strong>
          {user?.id ? ` (ID: ${user.id})` : ''}?
        </Typography>
        <Typography color="error" variant="body2" sx={{ mt: 1 }}>
          This will permanently remove the user and all linked game accounts,
          schedules, and activity. Audit logs are preserved.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button
          color="error"
          variant="contained"
          onClick={onConfirm}
          disabled={loading || !user?.id}
          startIcon={loading ? <CircularProgress size={16} /> : null}
        >
          {loading ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ─── 2. Stop All Friend Bots Confirmation Dialog ─── */
export function StopAllBotsDialog({ open, onClose, onConfirm, loading }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
    >
      <DialogTitle>Stop All Friend Bots</DialogTitle>
      <DialogContent>
        <Typography>
          Are you sure you want to force-stop <strong>all running friend bots</strong>?
        </Typography>
        <Typography color="warning.main" variant="body2" sx={{ mt: 1 }}>
          This will immediately stop all friend acceptor bots for all users, freeing bandwidth.
          Users will need to manually restart their bots.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          color="error"
          variant="contained"
          onClick={onConfirm}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : <StopIcon />}
        >
          {loading ? 'Stopping...' : 'Stop All Bots'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ─── 3. Start All Active Bots Confirmation Dialog ─── */
export function StartAllBotsDialog({ open, onClose, onConfirm, loading }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
    >
      <DialogTitle>Start All Active Bots</DialogTitle>
      <DialogContent>
        <Typography>
          Start friend acceptor bots for <strong>all active hunt participants</strong>?
        </Typography>
        <Typography color="info.main" variant="body2" sx={{ mt: 1 }}>
          Only participants who are active, have a linked account with valid credentials (device account + DC.bin),
          and don't already have a running bot will be started.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          color="success"
          variant="contained"
          onClick={onConfirm}
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : <PlayIcon />}
        >
          {loading ? 'Starting...' : 'Start All Bots'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ─── 4. Admin Toggle Confirmation Dialog ─── */
export function AdminToggleDialog({ open, user, newIsAdmin, onClose, onConfirm }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
    >
      <DialogTitle>{newIsAdmin ? 'Grant Admin' : 'Revoke Admin'}</DialogTitle>
      <DialogContent>
        <Typography>
          Are you sure you want to {newIsAdmin ? 'grant admin privileges to' : 'revoke admin privileges from'}{' '}
          <strong>{user?.username}</strong>?
        </Typography>
        {newIsAdmin && (
          <Typography color="warning.main" variant="body2" sx={{ mt: 1 }}>
            This will give the user full admin access including user management and system controls.
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          color={newIsAdmin ? 'warning' : 'primary'}
          variant="contained"
          onClick={onConfirm}
        >
          {newIsAdmin ? 'Grant Admin' : 'Revoke Admin'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* ─── 5. Grant Trial Dialog ─── */
export function GrantTrialDialog({ open, user, onClose, onConfirm, trialDays, setTrialDays, trialNotes, setTrialNotes, saving }) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrialIcon color="warning" />
          Grant Free Trial: {user?.username}
        </Box>
      </DialogTitle>
      <DialogContent>
        {user && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            {/* Warning if user already has active premium */}
            {user.subscription_tier === 'premium' && (
              <Alert severity="warning">
                This user already has premium access{user.trial_granted_by ? ' (trial)' : ''}. Granting a trial will overwrite their current expiry date.
              </Alert>
            )}

            {/* Preset day chips */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>Trial Duration</Typography>
              <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                {[7, 14, 30].map(d => (
                  <Chip
                    key={d}
                    label={`${d} days`}
                    color={trialDays === d ? 'primary' : 'default'}
                    variant={trialDays === d ? 'filled' : 'outlined'}
                    onClick={() => setTrialDays(d)}
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Box>
              <TextField
                label="Custom days"
                type="number"
                size="small"
                value={trialDays}
                onChange={(e) => {
                  const v = parseInt(e.target.value);
                  if (v >= 1 && v <= 365) setTrialDays(v);
                }}
                inputProps={{ min: 1, max: 365 }}
                fullWidth
              />
            </Box>

            {/* Notes field */}
            <TextField
              label="Notes (optional)"
              size="small"
              value={trialNotes}
              onChange={(e) => setTrialNotes(e.target.value)}
              placeholder="e.g. Testing potential conversion"
              fullWidth
            />

            {/* Summary */}
            <Alert severity="info">
              <strong>{user.username}</strong> will receive Premium for <strong>{trialDays} days</strong>, expiring{' '}
              <strong>{new Date(Date.now() + trialDays * 86400000).toLocaleDateString()}</strong>.
              A proxy slot will be assigned.
            </Alert>
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          color="warning"
          onClick={onConfirm}
          disabled={saving || !trialDays}
          startIcon={saving ? <CircularProgress size={16} /> : <TrialIcon />}
        >
          Grant Trial
        </Button>
      </DialogActions>
    </Dialog>
  );
}
