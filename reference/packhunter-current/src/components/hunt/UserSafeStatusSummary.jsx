import React from 'react';
import { Box, Chip, Stack, Typography } from '@mui/material';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AutorenewIcon from '@mui/icons-material/Autorenew';

function summarizeStatus({ issueCount = 0, criticalCount = 0, hasBackendLag = false, hasFetchStale = false }) {
  if (hasBackendLag || hasFetchStale || criticalCount > 0) {
    return {
      title: 'Worker Status',
      chipLabel: 'Monitoring an issue',
      icon: <AutorenewIcon fontSize="small" />,
      message:
        'Some activity may be slower than normal. Recovery is being handled automatically.',
      severity: 'warning',
    };
  }

  if (issueCount > 0) {
    return {
      title: 'Worker Status',
      chipLabel: 'Minor temporary issues',
      icon: <InfoOutlinedIcon fontSize="small" />,
      message:
        'A few temporary issues were detected, but the system is still running normally.',
      severity: 'info',
    };
  }

  return {
    title: 'Worker Status',
    chipLabel: 'Running normally',
    icon: <CheckCircleOutlineIcon fontSize="small" />,
    message: 'Everything looks normal right now.',
    severity: 'success',
  };
}

export default function UserSafeStatusSummary({
  issueCount = 0,
  criticalCount = 0,
  hasBackendLag = false,
  hasFetchStale = false,
}) {
  const summary = summarizeStatus({
    issueCount,
    criticalCount,
    hasBackendLag,
    hasFetchStale,
  });

  const chipColor =
    summary.severity === 'success'
      ? 'success'
      : summary.severity === 'warning'
      ? 'warning'
      : 'info';

  return (
    <Box
      sx={{
        mb: 2,
        p: 2,
        borderRadius: 2,
        border: theme => `1px solid ${theme.palette.divider}`,
        bgcolor: theme =>
          theme.palette.mode === 'dark'
            ? 'rgba(255,255,255,0.02)'
            : 'rgba(0,0,0,0.02)',
      }}
    >
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 1 }}
      >
        <Typography variant="subtitle1" fontWeight={700}>
          {summary.title}
        </Typography>

        <Chip
          size="small"
          color={chipColor}
          icon={summary.icon}
          label={summary.chipLabel}
          variant="filled"
        />
      </Stack>

      <Typography variant="body2" color="text.secondary">
        {summary.message}
      </Typography>
    </Box>
  );
}
