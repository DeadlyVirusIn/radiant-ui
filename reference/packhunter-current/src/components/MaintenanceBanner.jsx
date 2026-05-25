/**
 * MaintenanceBanner — shown in place of a broken/stale admin page.
 *
 * Does NOT trigger any data fetching. When rendered, the parent page
 * should return this component *instead of* its normal body so no SQL
 * or API calls execute.
 */

import { Box, Paper, Typography, Button } from '@mui/material';
import { Construction as MaintenanceIcon, Dashboard as DashboardIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

export default function MaintenanceBanner({
  title = 'Temporarily unavailable',
  message = 'This page is temporarily unavailable.',
  fleetLinkLabel = 'Go to Fleet Health',
}) {
  const navigate = useNavigate();
  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Paper
        variant="outlined"
        sx={{
          p: { xs: 3, md: 4 },
          borderRadius: 2,
          textAlign: 'center',
          maxWidth: 560,
          mx: 'auto',
          mt: { xs: 2, md: 6 },
        }}
      >
        <MaintenanceIcon sx={{ fontSize: 48, color: 'warning.main', mb: 2 }} />
        <Typography variant="h5" fontWeight={600} gutterBottom>{title}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {message}
        </Typography>
        <Button
          variant="contained"
          startIcon={<DashboardIcon />}
          onClick={() => navigate('/admin/fleet')}
        >
          {fleetLinkLabel}
        </Button>
      </Paper>
    </Box>
  );
}
