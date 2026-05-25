/**
 * InstallAppButton — Platform-aware PWA install trigger.
 *
 * Uses window.__PWA__ helper exposed by index.html install script.
 * Hides entirely when app is already installed (standalone mode).
 *
 * Behavior by platform:
 *  - Android Chrome: click calls deferredPrompt.prompt() → native install dialog
 *  - iOS Safari: click opens modal with Share → Add to Home Screen instructions
 *  - In-app browsers / unsupported: shows "Open in Chrome/Safari" hint
 *
 * Variants:
 *  - variant="button" (default) — standard outlined button
 *  - variant="subtle" — text button for inline use (TopBar, Dashboard banner)
 *  - variant="card" — full card with title + description (Settings/Profile)
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Typography, Box, Card, CardContent,
  IconButton, useTheme,
} from '@mui/material';
import {
  GetApp as DownloadIcon,
  Close as CloseIcon,
  IosShare as ShareIcon,
  AddBox as AddBoxIcon,
  CheckCircle as CheckIcon,
  MoreVert as MoreVertIcon,
  InstallMobile as InstallMobileIcon,
} from '@mui/icons-material';

export default function InstallAppButton({ variant = 'button', sx }) {
  const theme = useTheme();
  const [canInstall, setCanInstall] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [showAndroidHelp, setShowAndroidHelp] = useState(false);
  const [showManualHelp, setShowManualHelp] = useState(false);

  useEffect(() => {
    const pwa = window.__PWA__;
    if (!pwa) return;
    setInstalled(pwa.isStandalone);
    setIsIOS(pwa.isIOS);
    setIsAndroid(pwa.isAndroid);
    setIsInAppBrowser(pwa.isInAppBrowser);
    const check = () => setCanInstall(pwa.canPromptInstall());
    check();
    const t = setInterval(check, 2000);

    // Also listen for the install event
    const onInstalled = () => setInstalled(true);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      clearInterval(t);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleClick = useCallback(async () => {
    if (installed) return;
    if (isIOS) { setShowIosHelp(true); return; }
    if (isInAppBrowser) { setShowManualHelp(true); return; }

    const pwa = window.__PWA__;
    if (!pwa) { setShowManualHelp(true); return; }

    // Native install dialog available → use it
    if (pwa.canPromptInstall()) {
      const result = await pwa.triggerInstall();
      if (result?.outcome === 'unavailable') {
        // Prompt was consumed or expired — fall back to platform-specific help
        if (isAndroid) setShowAndroidHelp(true);
        else setShowManualHelp(true);
      }
      return;
    }

    // No deferred prompt available. Chrome on Android sometimes doesn't
    // fire beforeinstallprompt (already-installed-once, engagement not met,
    // or fired before listener attached). Give Android users actionable
    // menu-path instructions that always work.
    if (isAndroid) {
      setShowAndroidHelp(true);
      return;
    }
    setShowManualHelp(true);
  }, [installed, isIOS, isAndroid, isInAppBrowser]);

  // Never render if already installed
  if (installed) return null;

  // Always show the button when not installed. Click handler handles every
  // path (native prompt, iOS instructions, in-app browser, unsupported).
  const label = isIOS ? 'Install on iPhone' : 'Install App';

  const button = (() => {
    if (variant === 'subtle') {
      return (
        <Button
          size="small"
          variant="text"
          startIcon={<DownloadIcon sx={{ fontSize: 16 }} />}
          onClick={handleClick}
          sx={{ textTransform: 'none', fontSize: '0.75rem', ...sx }}
        >
          {label}
        </Button>
      );
    }

    if (variant === 'card') {
      return (
        <Card
          onClick={handleClick}
          sx={{
            cursor: 'pointer',
            background: `linear-gradient(135deg, ${theme.palette.primary.main}15, ${theme.palette.secondary.main}10)`,
            border: `1px solid ${theme.palette.primary.main}30`,
            transition: 'transform 0.15s, border-color 0.15s',
            '&:hover': {
              transform: 'translateY(-2px)',
              borderColor: theme.palette.primary.main,
            },
            ...sx,
          }}
        >
          <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}>
            <Box
              sx={{
                width: 44, height: 44, borderRadius: '12px',
                background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <DownloadIcon sx={{ color: '#fff' }} />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" fontWeight={600}>
                Install as App
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {isIOS
                  ? 'Add to Home Screen for faster access'
                  : 'Runs like a native app, works offline'}
              </Typography>
            </Box>
            <Button size="small" variant="outlined" sx={{ flexShrink: 0 }}>
              Install
            </Button>
          </CardContent>
        </Card>
      );
    }

    // Default: button variant
    return (
      <Button
        variant="outlined"
        startIcon={<DownloadIcon />}
        onClick={handleClick}
        sx={{ textTransform: 'none', ...sx }}
      >
        {label}
      </Button>
    );
  })();

  return (
    <>
      {button}

      {/* iOS Help Dialog */}
      <Dialog open={showIosHelp} onClose={() => setShowIosHelp(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
          Install on iPhone
          <IconButton size="small" onClick={() => setShowIosHelp(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            To install this app on your iPhone, follow these steps in Safari:
          </Typography>
          <Step num={1} icon={<ShareIcon />}>
            Tap the <strong>Share</strong> button at the bottom of Safari
          </Step>
          <Step num={2} icon={<AddBoxIcon />}>
            Scroll down and tap <strong>Add to Home Screen</strong>
          </Step>
          <Step num={3} icon={<CheckIcon />}>
            Tap <strong>Add</strong> in the top-right corner
          </Step>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, fontStyle: 'italic' }}>
            Note: iOS only supports this in Safari — other browsers cannot install apps.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowIosHelp(false)}>Got it</Button>
        </DialogActions>
      </Dialog>

      {/* Android Help Dialog — used when beforeinstallprompt hasn't fired
          (engagement heuristics not met, previously installed, or event lost) */}
      <Dialog open={showAndroidHelp} onClose={() => setShowAndroidHelp(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
          Install on Android
          <IconButton size="small" onClick={() => setShowAndroidHelp(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Install Pack Hunter directly from Chrome&apos;s menu:
          </Typography>
          <Step num={1} icon={<MoreVertIcon />}>
            Tap the <strong>⋮</strong> menu in the top-right of Chrome
          </Step>
          <Step num={2} icon={<InstallMobileIcon />}>
            Tap <strong>Install app</strong> (or <strong>Add to Home screen</strong>)
          </Step>
          <Step num={3} icon={<CheckIcon />}>
            Confirm by tapping <strong>Install</strong>
          </Step>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 2, fontStyle: 'italic' }}>
            The in-page prompt only appears after a few seconds of use. Using the browser menu works right away.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowAndroidHelp(false)}>Got it</Button>
        </DialogActions>
      </Dialog>

      {/* Manual / Unsupported Help Dialog */}
      <Dialog open={showManualHelp} onClose={() => setShowManualHelp(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pr: 1 }}>
          Install this app
          <IconButton size="small" onClick={() => setShowManualHelp(false)}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {isInAppBrowser ? (
            <>
              <Typography variant="body2" sx={{ mb: 2 }}>
                This page is open inside an embedded browser (like Discord or Instagram).
                In-app browsers can&apos;t install apps.
              </Typography>
              <Typography variant="body2" fontWeight={600}>
                To install:
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                1. Tap the <strong>•••</strong> menu in this browser
              </Typography>
              <Typography variant="body2">
                2. Choose <strong>Open in Chrome</strong> (Android) or <strong>Open in Safari</strong> (iPhone)
              </Typography>
            </>
          ) : (
            <>
              <Typography variant="body2" sx={{ mb: 2 }}>
                The install prompt isn&apos;t available right now. This can happen if:
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>• You already dismissed it earlier</Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>• Your browser doesn&apos;t support PWA install (Firefox mobile)</Typography>
              <Typography variant="body2" sx={{ mb: 2 }}>• The page needs a moment to become eligible</Typography>
              <Typography variant="body2" fontWeight={600} sx={{ mb: 1 }}>
                Try:
              </Typography>
              <Typography variant="body2" sx={{ mb: 0.5 }}>• Opening in Chrome or Edge</Typography>
              <Typography variant="body2">• Using your browser&apos;s menu → &quot;Install app&quot; or &quot;Add to Home Screen&quot;</Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowManualHelp(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

function Step({ num, icon, children }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, mb: 1.5 }}>
      <Box sx={{
        width: 28, height: 28, borderRadius: '50%',
        bgcolor: 'primary.main', color: '#fff',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontWeight: 700, fontSize: '0.8rem', flexShrink: 0,
      }}>
        {num}
      </Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', pt: 0.25 }}>
        {icon && <Box sx={{ display: 'flex', color: 'primary.main', '& svg': { fontSize: 18 } }}>{icon}</Box>}
        <Typography variant="body2">{children}</Typography>
      </Box>
    </Box>
  );
}
