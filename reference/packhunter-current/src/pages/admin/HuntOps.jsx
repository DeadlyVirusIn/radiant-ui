/**
 * Hunt Ops — dedicated admin page for hunt operational observability.
 *
 * Hosts the full Recovery System Status + Live Pack Retention panels
 * that previously lived inline on Hunt Monitor. Moved here so the
 * main Hunt Monitor stays focused on hunt execution signals (pack
 * metrics, container health, alignment), and so future admin-only
 * observability surfaces (incident audit, worker session debug,
 * trust/debug panels) have a natural home without recluttering the
 * operator-facing monitor.
 *
 * Scope: hunt-adjacent ops ONLY. If non-hunt admin observability
 * emerges later (billing ops, Discord bot ops, etc.), those get
 * their own page rather than mix in here.
 *
 * Deep-link support: URL hash `#recovery` or `#live-retention`
 * scrolls the matching section into view on load. The chips on
 * Hunt Monitor link here with those anchors.
 */

import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Box, Typography } from '@mui/material'
import { Build as OpsIcon } from '@mui/icons-material'
import PageHeader from '../../components/PageHeader'
import { FadeIn } from '../../components/Animations'
import RecoveryStatusPanel from '../../components/hunt/RecoveryStatusPanel'
import LivePackRetentionPanel from '../../components/hunt/LivePackRetentionPanel'
import TradeHostHealthPanel from '../../components/hunt/TradeHostHealthPanel'

export default function HuntOps() {
  const location = useLocation()

  // Scroll the anchor into view on load / hash change. Uses the
  // existing id="recovery" / id="live-retention" on each panel's
  // Card wrapper.
  useEffect(() => {
    const hash = (location.hash || '').replace(/^#/, '')
    if (!hash) return
    // Defer one frame so the panel's own skeleton has rendered and
    // the element exists in the DOM.
    const t = setTimeout(() => {
      const el = document.getElementById(hash)
      if (el && typeof el.scrollIntoView === 'function') {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 50)
    return () => clearTimeout(t)
  }, [location.hash])

  return (
    <Box>
      <PageHeader
        icon={<OpsIcon />}
        title="Hunt Ops"
        subtitle="Container recovery, god pack retention, and lifecycle visibility"
      />

      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        Admin-only observability for the hunt subsystem. Panels refresh automatically.
        Use the summary chips on Hunt Monitor for a compact at-a-glance view.
      </Typography>

      <FadeIn>
        <Box id="recovery">
          <RecoveryStatusPanel />
        </Box>
      </FadeIn>

      <FadeIn>
        <Box id="live-retention">
          <LivePackRetentionPanel />
        </Box>
      </FadeIn>

      <FadeIn>
        <Box id="trade-host-health">
          <TradeHostHealthPanel />
        </Box>
      </FadeIn>
    </Box>
  )
}
