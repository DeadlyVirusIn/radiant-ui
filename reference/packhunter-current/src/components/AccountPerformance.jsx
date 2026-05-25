/**
 * AccountPerformance — Collapsible per-account performance breakdown with anomaly detection.
 *
 * Takes a list of requests (trade or gift) and groups by user_account_id.
 * Shows: request count, success rate, avg time, failure count per account.
 * Flags accounts where performance is >2x worse than the group average.
 *
 * Collapsed by default — doesn't increase page density unless expanded.
 */

import { useMemo } from 'react';
import { Box, Typography, Chip, Tooltip } from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import MetricStrip from './MetricStrip';
import SectionPanel from './SectionPanel';

const TERMINAL = new Set(['COMPLETED', 'FAILED', 'CANCELLED']);

function computeAccountStats(requests, accounts) {
  const byAccount = new Map();
  for (const req of requests) {
    const acctId = req.user_account_id || req.account_id || 'unknown';
    if (!byAccount.has(acctId)) byAccount.set(acctId, []);
    byAccount.get(acctId).push(req);
  }

  const nameMap = new Map();
  for (const acct of (accounts || [])) {
    nameMap.set(String(acct.id), acct.nickname || acct.friend_id || `Account ${acct.id}`);
  }

  const results = [];
  for (const [acctId, reqs] of byAccount) {
    const terminal = reqs.filter(r => TERMINAL.has(r.status));
    const completed = terminal.filter(r => r.status === 'COMPLETED');
    const failed = terminal.filter(r => r.status === 'FAILED');
    const active = reqs.filter(r => !TERMINAL.has(r.status));

    const successRate = terminal.length > 0
      ? Math.round((completed.length / terminal.length) * 100) : null;

    const times = completed
      .filter(r => r.requested_at && r.completed_at)
      .map(r => new Date(r.completed_at).getTime() - new Date(r.requested_at).getTime())
      .filter(ms => ms > 0 && ms < 30 * 60 * 1000);
    const avgMs = times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : null;
    const avgText = avgMs ? (avgMs < 60000 ? `${Math.round(avgMs / 1000)}s` : `${Math.round(avgMs / 60000)}m`) : '—';

    results.push({
      accountId: acctId,
      name: nameMap.get(String(acctId)) || `Account ${String(acctId).slice(-4)}`,
      total: reqs.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      successRate,
      avgMs,
      avgTime: avgText,
    });
  }

  results.sort((a, b) => b.total - a.total);

  // Compute group averages for anomaly detection (accounts with >= 3 terminal requests)
  const withData = results.filter(a => a.successRate != null && a.total >= 3);
  const groupAvgRate = withData.length > 0
    ? withData.reduce((sum, a) => sum + a.successRate, 0) / withData.length : null;
  const withTime = results.filter(a => a.avgMs != null);
  const groupAvgMs = withTime.length > 0
    ? withTime.reduce((sum, a) => sum + a.avgMs, 0) / withTime.length : null;

  // Flag anomalies: success rate < groupAvg/2, or avgTime > groupAvg*2
  // Anomaly detection with severity levels:
  //   critical — account is likely broken (success < 20% or failures > 3x completions)
  //   warning  — account is underperforming (success < avg/2 or time > avg*2)
  for (const acct of results) {
    const anomalies = [];
    // Critical: very low success rate with sufficient data
    if (acct.successRate != null && acct.total >= 5 && acct.successRate < 20) {
      anomalies.push({ severity: 'critical', message: `Success rate ${acct.successRate}% — account may need re-linking` });
    } else if (groupAvgRate != null && acct.successRate != null && acct.total >= 3 && acct.successRate < groupAvgRate / 2) {
      anomalies.push({ severity: 'warning', message: `Success rate ${acct.successRate}% vs ${Math.round(groupAvgRate)}% average` });
    }
    // Critical: failure ratio extreme
    if (acct.total >= 5 && acct.failed > acct.completed * 3) {
      anomalies.push({ severity: 'critical', message: `${acct.failed} failures vs ${acct.completed} completions — check credentials` });
    } else if (acct.total >= 5 && acct.failed > acct.completed * 2) {
      anomalies.push({ severity: 'warning', message: `${acct.failed} failures vs ${acct.completed} completions` });
    }
    // Warning: slow execution
    if (groupAvgMs != null && acct.avgMs != null && acct.avgMs > groupAvgMs * 2) {
      anomalies.push({ severity: 'warning', message: `Avg time ${Math.round(acct.avgMs / 1000)}s vs group ${Math.round(groupAvgMs / 1000)}s` });
    }
    acct.anomalies = anomalies;
    acct.maxSeverity = anomalies.some(a => a.severity === 'critical') ? 'critical' : anomalies.length > 0 ? 'warning' : null;
  }

  const criticalCount = results.filter(a => a.maxSeverity === 'critical').length;
  const warningCount = results.filter(a => a.maxSeverity === 'warning').length;

  return { accounts: results, criticalCount, warningCount, groupAvgRate, groupAvgMs };
}

export default function AccountPerformance({ requests = [], accounts = [], sx }) {
  const data = useMemo(() => computeAccountStats(requests, accounts), [requests, accounts]);

  if (data.accounts.length < 2) return null;

  const chips = [
    { label: `${data.accounts.length} accounts` },
    ...(data.criticalCount > 0 ? [{
      label: `${data.criticalCount} critical`,
      color: 'error',
      variant: 'outlined',
      icon: <ErrorIcon sx={{ fontSize: 12 }} />,
    }] : []),
    ...(data.warningCount > 0 ? [{
      label: `${data.warningCount} warning`,
      color: 'warning',
      variant: 'outlined',
      icon: <WarningIcon sx={{ fontSize: 12 }} />,
    }] : []),
  ];

  return (
    <SectionPanel
      icon={<BarChartIcon />}
      title="Per-Account Breakdown"
      chips={chips}
      sx={sx}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {data.accounts.map(acct => (
          <Box key={acct.accountId}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.7rem', color: 'text.primary' }}>
                {acct.name}
              </Typography>
              {acct.maxSeverity === 'critical' && (
                <Tooltip title={acct.anomalies.map(a => a.message).join(' • ')} arrow>
                  <Chip icon={<ErrorIcon sx={{ fontSize: 10 }} />} size="small" label="Critical" color="error" sx={{ height: 16, fontSize: '0.55rem', cursor: 'help' }} />
                </Tooltip>
              )}
              {acct.maxSeverity === 'warning' && (
                <Tooltip title={acct.anomalies.map(a => a.message).join(' • ')} arrow>
                  <Chip icon={<WarningIcon sx={{ fontSize: 10 }} />} size="small" label="Warning" color="warning" sx={{ height: 16, fontSize: '0.55rem', cursor: 'help' }} />
                </Tooltip>
              )}
            </Box>
            <MetricStrip
              items={[
                { label: 'Total', value: acct.total, color: 'primary.main' },
                { label: 'Active', value: acct.active, color: 'info.main' },
                {
                  label: 'Success',
                  value: acct.successRate != null ? `${acct.successRate}%` : '—',
                  color: acct.successRate >= 80 ? 'success.main' : acct.successRate >= 50 ? 'warning.main' : 'error.main',
                  tooltip: acct.successRate != null ? `${acct.completed} completed / ${acct.completed + acct.failed} terminal` : null,
                },
                { label: 'Avg Time', value: acct.avgTime, color: 'info.main' },
                { label: 'Failed', value: acct.failed, color: acct.failed > 0 ? 'error.main' : 'text.secondary' },
              ]}
            />
            {acct.anomalies.length > 0 && (
              <Box sx={{ mt: 0.5, pl: 1 }}>
                {acct.anomalies.map((a, i) => (
                  <Typography key={i} variant="caption" sx={{
                    fontSize: '0.6rem',
                    color: a.severity === 'critical' ? 'error.main' : 'warning.main',
                    display: 'block', lineHeight: 1.4,
                  }}>
                    {a.severity === 'critical' ? '🔴' : '⚠'} {a.message}
                  </Typography>
                ))}
              </Box>
            )}
          </Box>
        ))}
      </Box>
    </SectionPanel>
  );
}
