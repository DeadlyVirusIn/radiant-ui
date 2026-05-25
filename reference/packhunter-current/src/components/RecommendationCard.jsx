/**
 * RecommendationCard — displays a single actionable recommendation.
 * Rule-based, explainable, dismissible. Max 1-2 per page.
 *
 * Severity colors: high=error, medium=warning, low=info
 * Dismissible recommendations persist dismiss state in localStorage.
 */

import { useState, useEffect, useCallback } from 'react'
import { Box, Typography, Button, IconButton, Chip, Collapse, useTheme } from '@mui/material'
import {
  Close as CloseIcon,
  ArrowForward as ActionIcon,
  Info as InfoIcon,
  Warning as WarningIcon,
  Error as ErrorIcon,
} from '@mui/icons-material'
import { useNavigate } from 'react-router-dom'

const SEVERITY_CONFIG = {
  high: { icon: ErrorIcon, color: 'error', label: 'Action needed' },
  medium: { icon: WarningIcon, color: 'warning', label: 'Suggestion' },
  low: { icon: InfoIcon, color: 'info', label: 'Tip' },
}

const DISMISS_KEY = 'vudoo_dismissed_recs'

function getDismissed() {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) || '{}')
  } catch { return {} }
}

function setDismissed(id, days = 7) {
  const dismissed = getDismissed()
  dismissed[id] = Date.now() + days * 24 * 60 * 60 * 1000
  localStorage.setItem(DISMISS_KEY, JSON.stringify(dismissed))
}

function isDismissed(id) {
  const dismissed = getDismissed()
  if (!dismissed[id]) return false
  if (Date.now() > dismissed[id]) {
    // Expired — clean up
    delete dismissed[id]
    localStorage.setItem(DISMISS_KEY, JSON.stringify(dismissed))
    return false
  }
  return true
}

export function useRecommendations() {
  const [recs, setRecs] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchRecs = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/recommendations', { credentials: 'include' })
      if (!res.ok) return
      const data = await res.json()
      // Filter out dismissed recommendations
      const active = (data.recommendations || []).filter(r => !isDismissed(r.id))
      setRecs(active)
    } catch { /* non-critical */ }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    fetchRecs()
    const id = setInterval(fetchRecs, 60000) // 60s poll
    return () => clearInterval(id)
  }, [fetchRecs])

  const dismiss = useCallback((recId, days = 7) => {
    setDismissed(recId, days)
    setRecs(prev => prev.filter(r => r.id !== recId))
  }, [])

  return { recommendations: recs, loading, dismiss, refresh: fetchRecs }
}

export default function RecommendationCard({ recommendation, onDismiss }) {
  const theme = useTheme()
  const navigate = useNavigate()
  const isDark = theme.palette.mode === 'dark'
  const [expanded, setExpanded] = useState(false)

  if (!recommendation) return null

  const config = SEVERITY_CONFIG[recommendation.severity] || SEVERITY_CONFIG.low
  const SeverityIcon = config.icon
  const color = theme.palette[config.color]?.main || theme.palette.info.main

  return (
    <Box sx={{
      display: 'flex', alignItems: 'flex-start', gap: 1.5,
      px: 2, py: 1.5, mb: 1.5, borderRadius: '10px',
      bgcolor: `${color}08`,
      border: `1px solid ${color}20`,
      transition: 'all 0.2s ease',
    }}>
      <SeverityIcon sx={{ fontSize: 18, color, mt: 0.25, flexShrink: 0 }} />

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
          <Chip label={config.label} size="small" sx={{
            height: 18, fontSize: '0.6rem', fontWeight: 700,
            bgcolor: `${color}15`, color, border: `1px solid ${color}30`,
          }} />
        </Box>

        <Typography variant="body2" sx={{ fontWeight: 600, fontSize: '0.8rem', mb: 0.25 }}>
          {recommendation.message}
        </Typography>

        <Collapse in={expanded}>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 0.75 }}>
            {recommendation.explanation}
          </Typography>
        </Collapse>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography
            variant="caption"
            onClick={() => setExpanded(!expanded)}
            sx={{ color: 'text.secondary', cursor: 'pointer', '&:hover': { color: 'text.primary' } }}
          >
            {expanded ? 'Less' : 'Why?'}
          </Typography>

          {recommendation.cta && (
            <Button
              size="small"
              endIcon={<ActionIcon sx={{ fontSize: 14 }} />}
              onClick={() => navigate(recommendation.cta.path)}
              sx={{
                textTransform: 'none', fontWeight: 600, fontSize: '0.7rem',
                color, px: 1, py: 0.25, minHeight: 24,
                '&:hover': { bgcolor: `${color}12` },
              }}
            >
              {recommendation.cta.label}
            </Button>
          )}
        </Box>
      </Box>

      {recommendation.dismissible && onDismiss && (
        <IconButton
          size="small"
          onClick={() => onDismiss(recommendation.id)}
          sx={{ color: 'text.disabled', p: 0.5, '&:hover': { color: 'text.secondary' } }}
        >
          <CloseIcon sx={{ fontSize: 14 }} />
        </IconButton>
      )}
    </Box>
  )
}
