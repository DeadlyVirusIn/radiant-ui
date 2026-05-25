/**
 * AdminEditUserDialog — Extracted from AdminUsers.jsx.
 * Self-contained dialog for editing user info and managing linked accounts.
 *
 * Owns all form state internally. Parent only controls open/close and receives callbacks.
 */

import { useState, useEffect } from 'react';
import {
  Box, Typography, Button, Chip, CircularProgress, Paper,
  Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, FormControl, InputLabel, Select, MenuItem,
  Divider, IconButton, Tooltip,
} from '@mui/material';
import {
  Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon,
} from '@mui/icons-material';
import adminApi from './adminUsersApi';

export default function AdminEditUserDialog({
  open,
  user,       // The user object being edited (with .accounts array)
  onClose,    // () => void
  onSaved,    // () => void — called after successful save (parent refreshes data)
  setError,   // (msg) => void — shared snackbar
  setSuccess, // (msg) => void — shared snackbar
}) {
  // Form state — reset when user changes
  const [userForm, setUserForm] = useState({ discord_id: '', discord_username: '', subscription_tier: 'free' });
  const [accountForms, setAccountForms] = useState({});
  const [saving, setSaving] = useState(false);
  const [fetchingPlayerId, setFetchingPlayerId] = useState({});

  // Add account state
  const [addAccountVisible, setAddAccountVisible] = useState(false);
  const [addAccountForm, setAddAccountForm] = useState({ account_type: 'main', player_id: '', friend_id: '' });
  const [addAccountSaving, setAddAccountSaving] = useState(false);

  // Local copy of user for account removal without closing dialog
  const [localUser, setLocalUser] = useState(null);

  // Initialize form when user changes or dialog opens
  useEffect(() => {
    if (user && open) {
      setUserForm({
        discord_id: user.discord_id || '',
        discord_username: user.discord_username || '',
        subscription_tier: user.subscription_tier || 'free',
      });
      const acctForms = {};
      for (const acct of (user.accounts || [])) {
        acctForms[acct.account_id] = {
          player_id: acct.player_id || '',
          friend_id: acct.friend_id || '',
        };
      }
      setAccountForms(acctForms);
      setAddAccountVisible(false);
      setAddAccountForm({ account_type: 'main', player_id: '', friend_id: '' });
      setAddAccountSaving(false);
      setLocalUser(user);
    }
  }, [user, open]);

  const accounts = localUser?.accounts || [];

  const handleSave = async () => {
    if (!localUser) return;
    setSaving(true);
    try {
      // Save user fields if changed
      const userChanges = {};
      if (userForm.discord_id !== (localUser.discord_id || '')) userChanges.discord_id = userForm.discord_id;
      if (userForm.discord_username !== (localUser.discord_username || '')) userChanges.discord_username = userForm.discord_username;
      if (userForm.subscription_tier !== (localUser.subscription_tier || 'free')) userChanges.subscription_tier = userForm.subscription_tier;

      if (Object.keys(userChanges).length > 0) {
        const userRes = await adminApi.editUser(localUser.id, userChanges);
        if (userRes.error) {
          setError(userRes.error);
          setSaving(false);
          return;
        }
      }

      // Save account fields if changed
      let acctErrors = [];
      for (const acct of accounts) {
        const form = accountForms[acct.account_id];
        if (!form) continue;
        const acctChanges = {};
        if (form.player_id !== (acct.player_id || '')) acctChanges.player_id = form.player_id;
        if (form.friend_id !== (acct.friend_id || '')) acctChanges.friend_id = form.friend_id;

        if (Object.keys(acctChanges).length > 0) {
          const acctRes = await adminApi.editAccount(localUser.id, acct.account_id, acctChanges);
          if (acctRes.error) acctErrors.push(`Account #${acct.account_id}: ${acctRes.error}`);
        }
      }

      if (acctErrors.length > 0) {
        setError(acctErrors.join('; '));
      } else {
        setSuccess('User updated successfully');
        onClose();
        onSaved();
      }
    } catch (err) {
      setError(`Save failed: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleFetchPlayerId = async (accountId) => {
    if (!localUser) return;
    setFetchingPlayerId(prev => ({ ...prev, [accountId]: true }));
    try {
      const res = await adminApi.fetchPlayerIdAdmin(localUser.id, accountId);
      if (res.error) {
        setError(res.error);
      } else {
        setAccountForms(prev => ({
          ...prev,
          [accountId]: {
            player_id: res.player_id || prev[accountId]?.player_id || '',
            friend_id: res.friend_id || prev[accountId]?.friend_id || '',
          }
        }));
        setSuccess(`Fetched: player_id=${res.player_id}, nickname=${res.nickname || 'N/A'}`);
      }
    } catch (err) {
      setError(`Fetch failed: ${err.message}`);
    } finally {
      setFetchingPlayerId(prev => ({ ...prev, [accountId]: false }));
    }
  };

  const handleDeleteAccount = async (accountId, accountType) => {
    if (!localUser) return;
    if (!window.confirm(`Remove ${accountType || 'main'} account (#${accountId}) from ${localUser.username || localUser.discord_username}?\n\nThis will unlink the account and remove its collection data.`)) return;
    try {
      const res = await adminApi.deleteAccount(accountId);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(`Removed ${accountType || 'main'} account from ${localUser.username || localUser.discord_username}`);
        setLocalUser(prev => ({
          ...prev,
          accounts: (prev.accounts || []).filter(a => a.account_id !== accountId),
        }));
      }
    } catch (err) {
      setError(`Delete failed: ${err.message}`);
    }
  };

  const handleCreateAccount = async () => {
    if (!localUser) return;
    setAddAccountSaving(true);
    try {
      const payload = { account_type: addAccountForm.account_type };
      if (addAccountForm.player_id.trim()) payload.player_id = addAccountForm.player_id.trim();
      if (addAccountForm.friend_id.trim()) payload.friend_id = addAccountForm.friend_id.trim();
      const res = await adminApi.createAccount(localUser.id, payload);
      if (res.error) {
        setError(res.error);
      } else {
        setSuccess(`Created ${payload.account_type} account for ${localUser.username || localUser.discord_username || 'user'}`);
        setAddAccountVisible(false);
        onClose();
        onSaved();
      }
    } catch (err) {
      setError(`Create account failed: ${err.message}`);
    } finally {
      setAddAccountSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EditIcon color="primary" />
          Edit User: {localUser?.username}
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {localUser && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            {/* User Info Section */}
            <Typography variant="subtitle2" color="text.secondary">User Info</Typography>
            <TextField
              label="Discord ID"
              value={userForm.discord_id}
              onChange={(e) => setUserForm(prev => ({ ...prev, discord_id: e.target.value }))}
              size="small" fullWidth
              placeholder="e.g. 123456789012345678"
              helperText="15-22 digit numeric string"
            />
            <TextField
              label="Discord Username"
              value={userForm.discord_username}
              onChange={(e) => setUserForm(prev => ({ ...prev, discord_username: e.target.value }))}
              size="small" fullWidth
            />
            <FormControl size="small" fullWidth>
              <InputLabel>Subscription Tier</InputLabel>
              <Select
                value={userForm.subscription_tier}
                label="Subscription Tier"
                onChange={(e) => setUserForm(prev => ({ ...prev, subscription_tier: e.target.value }))}
              >
                <MenuItem value="free">Free</MenuItem>
                <MenuItem value="trade">Trade</MenuItem>
                <MenuItem value="premium">Premium</MenuItem>
                <MenuItem value="admin">Admin</MenuItem>
              </Select>
            </FormControl>

            {/* Linked Accounts Section */}
            {accounts.length > 0 && (
              <>
                <Divider sx={{ mt: 1 }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Linked Accounts ({accounts.length})
                </Typography>
                {accounts.map((acct) => (
                  <Paper key={acct.account_id} variant="outlined" sx={{ p: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      <Chip label={acct.account_type || 'main'} size="small" color={acct.account_type === 'alt' ? 'secondary' : 'primary'} />
                      {acct.nickname && <Typography variant="caption" color="text.secondary">{acct.nickname}</Typography>}
                      <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>#{acct.account_id}</Typography>
                      <Tooltip title={`Remove ${acct.account_type || 'main'} account`}>
                        <IconButton size="small" color="error" onClick={() => handleDeleteAccount(acct.account_id, acct.account_type)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                        <TextField
                          label="Player ID"
                          value={accountForms[acct.account_id]?.player_id || ''}
                          onChange={(e) => setAccountForms(prev => ({
                            ...prev,
                            [acct.account_id]: { ...prev[acct.account_id], player_id: e.target.value }
                          }))}
                          size="small" fullWidth placeholder="UUID format"
                          sx={{ '& input': { fontFamily: 'monospace', fontSize: '0.8rem' } }}
                        />
                        <Tooltip title="Fetch Player ID from game API">
                          <span>
                            <Button
                              variant="outlined" size="small"
                              onClick={() => handleFetchPlayerId(acct.account_id)}
                              disabled={fetchingPlayerId[acct.account_id] || !acct.has_xml}
                              sx={{ minWidth: 80, whiteSpace: 'nowrap' }}
                            >
                              {fetchingPlayerId[acct.account_id] ? <CircularProgress size={16} /> : 'Fetch'}
                            </Button>
                          </span>
                        </Tooltip>
                      </Box>
                      <TextField
                        label="Friend ID"
                        value={accountForms[acct.account_id]?.friend_id || ''}
                        onChange={(e) => setAccountForms(prev => ({
                          ...prev,
                          [acct.account_id]: { ...prev[acct.account_id], friend_id: e.target.value }
                        }))}
                        size="small" fullWidth placeholder="XXXX-XXXX-XXXX-XXXX"
                        sx={{ '& input': { fontFamily: 'monospace', fontSize: '0.8rem' } }}
                      />
                    </Box>
                    {!acct.has_xml && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        No XML credentials — Fetch Player ID unavailable
                      </Typography>
                    )}
                  </Paper>
                ))}
              </>
            )}

            {accounts.length === 0 && (
              <>
                <Divider sx={{ mt: 1 }} />
                <Typography variant="body2" color="text.secondary">No linked accounts</Typography>
              </>
            )}

            {/* Add Account — only if user has < 2 accounts */}
            {accounts.length < 2 && (
              <>
                <Divider sx={{ mt: 2, mb: 1 }} />
                {!addAccountVisible ? (
                  <Button size="small" startIcon={<AddIcon />}
                    onClick={() => {
                      const existingTypes = accounts.map(a => a.account_type);
                      const suggestedType = existingTypes.includes('main') ? 'alt' : 'main';
                      setAddAccountForm({ account_type: suggestedType, player_id: '', friend_id: '' });
                      setAddAccountVisible(true);
                    }}
                  >
                    Add Account
                  </Button>
                ) : (
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="subtitle2" sx={{ mb: 1.5 }}>Add New Account</Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <FormControl size="small" fullWidth>
                        <InputLabel>Account Type</InputLabel>
                        <Select value={addAccountForm.account_type} label="Account Type"
                          onChange={(e) => setAddAccountForm(prev => ({ ...prev, account_type: e.target.value }))}
                        >
                          <MenuItem value="main">Main</MenuItem>
                          <MenuItem value="alt">Alt</MenuItem>
                        </Select>
                      </FormControl>
                      <TextField label="Player ID (optional)" value={addAccountForm.player_id}
                        onChange={(e) => setAddAccountForm(prev => ({ ...prev, player_id: e.target.value }))}
                        size="small" fullWidth placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                        sx={{ '& input': { fontFamily: 'monospace', fontSize: '0.8rem' } }}
                      />
                      <TextField label="Friend ID (optional)" value={addAccountForm.friend_id}
                        onChange={(e) => setAddAccountForm(prev => ({ ...prev, friend_id: e.target.value }))}
                        size="small" fullWidth placeholder="XXXX-XXXX-XXXX-XXXX"
                        sx={{ '& input': { fontFamily: 'monospace', fontSize: '0.8rem' } }}
                      />
                      <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                        <Button variant="contained" size="small" onClick={handleCreateAccount} disabled={addAccountSaving}
                          startIcon={addAccountSaving ? <CircularProgress size={14} /> : <AddIcon />}
                        >Create</Button>
                        <Button size="small" onClick={() => setAddAccountVisible(false)} disabled={addAccountSaving}>Cancel</Button>
                      </Box>
                    </Box>
                  </Paper>
                )}
              </>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave} disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : null}
        >Save Changes</Button>
      </DialogActions>
    </Dialog>
  );
}
