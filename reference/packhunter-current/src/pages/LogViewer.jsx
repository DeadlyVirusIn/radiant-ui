/**
 * Log Viewer - View and monitor PM2/application logs
 *
 * Features:
 * - List all available log files
 * - View log content with tail (last N lines)
 * - Auto-refresh for real-time monitoring
 * - Clear log files
 * - Syntax highlighting for errors/warnings
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Grid,
  Chip,
  CircularProgress,
  Alert,
  Snackbar,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  TextField,
  InputAdornment,
  useTheme,
} from '@mui/material';
import {
  Description as LogIcon,
  Refresh as RefreshIcon,
  Delete as DeleteIcon,
  Error as ErrorIcon,

  Search as SearchIcon,
  Download as DownloadIcon,
  ContentCopy as CopyIcon,
  Check as CheckIcon,
} from '@mui/icons-material';
import { FadeIn } from '../components/Animations';
import { formatRelativeTime, formatDateTime } from '../utils/dateFormat';
import { useLanguage } from '../contexts/LanguageContext';
import { EmptyState } from '../components/EmptyState';
import { TablePageSkeleton } from '../components/skeletons/PageSkeletons';
import PageHeader from '../components/PageHeader';
import SystemLogPanel from '../components/SystemLogPanel';
import { useSectionStyles } from '../components/SectionCard';

// API helper
const logsApi = {
  list: () => fetch('/api/admin/logs', {
    credentials: 'include'
  }).then(r => r.json()),

  tail: (filename, lines = 200) => fetch(`/api/admin/logs/${encodeURIComponent(filename)}/tail?lines=${lines}`, {
    credentials: 'include'
  }).then(r => r.json()),

  clear: (filename) => fetch(`/api/admin/logs/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
    credentials: 'include'
  }).then(r => r.json()),
};

function LogViewer({ user }) {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const logContainerRef = useRef(null);

  const [loading, setLoading] = useState(true);
  const [logFiles, setLogFiles] = useState([]);
  const [selectedLog, setSelectedLog] = useState(null);
  const [logContent, setLogContent] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [lineCount, setLineCount] = useState(200);
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmClear, setConfirmClear] = useState(null);
  const [copied, setCopied] = useState(false);

  const { sectionBox: cardSx } = useSectionStyles();

  // Load log files list
  const loadLogFiles = useCallback(async () => {
    try {
      const result = await logsApi.list();
      if (result.success) {
        setLogFiles(result.logs);
      } else {
        setError(result.error || 'Failed to load logs');
      }
    } catch (err) {
      setError('Failed to load log files');
    }
  }, []);

  // Load selected log content
  const loadLogContent = useCallback(async () => {
    if (!selectedLog) return;

    try {
      setLoading(true);
      const result = await logsApi.tail(selectedLog.name, lineCount);
      if (result.success) {
        setLogContent(result.content);
        if (logContainerRef.current) {
          logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
      } else {
        setError(result.error || 'Failed to load log content');
      }
    } catch (err) {
      setError('Failed to load log content');
    } finally {
      setLoading(false);
    }
  }, [selectedLog, lineCount]);

  // Initial load
  useEffect(() => {
    if (!user?.isAdmin) {
      navigate('/');
      return;
    }
    loadLogFiles().finally(() => setLoading(false));
  }, [user, loadLogFiles, navigate]);

  // Load content when log selected
  useEffect(() => {
    if (selectedLog) {
      loadLogContent();
    }
  }, [selectedLog, loadLogContent]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh && selectedLog) {
      const interval = setInterval(loadLogContent, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, selectedLog, loadLogContent]);

  // Clear log file
  const handleClearLog = async () => {
    if (!confirmClear) return;

    try {
      const result = await logsApi.clear(confirmClear.name);
      if (result.success) {
        setSuccess(`Log file ${confirmClear.name} cleared`);
        setLogContent('');
        loadLogFiles();
      } else {
        setError(result.error || 'Failed to clear log');
      }
    } catch (err) {
      setError('Failed to clear log file');
    }
    setConfirmClear(null);
  };

  // Copy log content
  const handleCopy = () => {
    navigator.clipboard.writeText(logContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download log content
  const handleDownload = () => {
    if (!selectedLog || !logContent) return;

    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = selectedLog.name;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!user?.isAdmin) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">{t('logViewer.adminRequired')}</Alert>
      </Box>
    );
  }

  return (
    <FadeIn>
    <Box>
      <PageHeader
        icon={<LogIcon />}
        title={t('logViewer.title')}
        subtitle="Monitor and inspect application log files"
        action={
          <Button
            variant="contained"
            startIcon={<RefreshIcon />}
            onClick={() => {
              loadLogFiles();
              if (selectedLog) loadLogContent();
            }}
            sx={{
              background: (t) => `linear-gradient(135deg, ${t.palette.primary.main}, ${t.palette.secondary.main})`,
              '&:hover': { background: (t) => `linear-gradient(135deg, ${t.palette.primary.dark}, ${t.palette.secondary.dark})` },
            }}
          >
            {t('logViewer.refresh')}
          </Button>
        }
      />

      <SystemLogPanel
        logs={logContent}
        selectedFile={selectedLog}
        files={logFiles}
        onFileSelect={setSelectedLog}
        loading={loading}
        lineCount={lineCount}
        onLineCountChange={setLineCount}
        searchQuery={searchTerm}
        onSearchChange={setSearchTerm}
        onCopy={handleCopy}
        onDownload={handleDownload}
        onClear={setConfirmClear}
        autoRefresh={autoRefresh}
        onAutoRefreshToggle={setAutoRefresh}
        height="calc(100vh - 200px)"
        copied={copied}
        labels={{
          logFiles: t('logViewer.logFiles'),
          selectLogFile: t('logViewer.selectLogFile'),
          selectLogPrompt: t('logViewer.selectLogPrompt'),
          emptyLog: t('logViewer.emptyLog'),
          autoRefreshLabel: t('logViewer.autoRefresh'),
          autoRefreshOn: t('logViewer.autoRefreshOn'),
          autoRefreshOff: t('logViewer.autoRefreshOff'),
          lines: t('logViewer.lines'),
          copy: t('logViewer.copy'),
          copied: t('logViewer.copied'),
          download: t('logViewer.download'),
          clearLog: t('logViewer.clearLog'),
          size: t('logViewer.size'),
          modified: t('logViewer.modified'),
          noLogsFound: t('logViewer.noLogsFound'),
        }}
      />

      {/* Clear Confirmation Dialog */}
      <Dialog open={!!confirmClear} onClose={() => setConfirmClear(null)}>
        <DialogTitle>{t('logViewer.confirmClear')}</DialogTitle>
        <DialogContent>
          <Typography>
            {t('logViewer.confirmClearMessage')} "{confirmClear?.name}"
            <br />
            {t('logViewer.cannotUndo')}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmClear(null)}>{t('common.cancel')}</Button>
          <Button color="error" variant="contained" onClick={handleClearLog}>
            {t('logViewer.clearLog')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbars */}
      <Snackbar
        open={!!success}
        autoHideDuration={4000}
        onClose={() => setSuccess('')}
        message={success}
      />
      <Snackbar open={!!error} autoHideDuration={6000} onClose={() => setError('')}>
        <Alert severity="error" onClose={() => setError('')}>
          {error}
        </Alert>
      </Snackbar>
    </Box>
    </FadeIn>
  );
}

export default LogViewer;
