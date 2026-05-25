/**
 * SectionPanel — Shared collapsible section header + content wrapper.
 *
 * Replaces the repeated pattern in RequestFunnel, AccountPerformance,
 * and AutoGift's local sectionHeader. Provides consistent:
 *   - Icon + title + chip row + action slot
 *   - Collapse toggle with smooth animation
 *   - Content fade-in on expand
 *
 * Props:
 *   icon       — React element (small, 16px)
 *   title      — Section title (uppercase caption)
 *   chips      — Array of { label, color?, variant? } chip descriptors
 *   action     — Right-aligned React element (button, etc.)
 *   defaultOpen — Initial expand state (default: false)
 *   children   — Collapsible content
 */

import { useState } from 'react';
import { Box, Typography, Chip, IconButton, Collapse } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { motion, AnimatePresence } from 'framer-motion';

export default function SectionPanel({
  icon,
  title,
  chips = [],
  action,
  defaultOpen = false,
  children,
  sx,
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Box sx={{ mb: 2, ...sx }}>
      {/* Header bar */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          cursor: 'pointer',
          py: 0.5,
          opacity: 0.85,
          '&:hover': { opacity: 1 },
          transition: 'opacity 0.2s',
          userSelect: 'none',
        }}
        onClick={() => setOpen(prev => !prev)}
        role="button"
        aria-expanded={open}
      >
        {icon && <Box sx={{ display: 'flex', color: 'text.secondary', '& svg': { fontSize: 16 } }}>{icon}</Box>}
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            color: 'text.secondary',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontSize: '0.65rem',
          }}
        >
          {title}
        </Typography>
        {chips.map((chip, i) => (
          <Chip
            key={i}
            icon={chip.icon || undefined}
            label={chip.label}
            size="small"
            color={chip.color || 'default'}
            variant={chip.variant || 'outlined'}
            sx={{ height: 18, fontSize: '0.55rem', ...(chip.sx || {}) }}
          />
        ))}
        {action && (
          <Box sx={{ ml: 'auto', display: 'flex', alignItems: 'center' }} onClick={e => e.stopPropagation()}>
            {action}
          </Box>
        )}
        <IconButton size="small" sx={{ p: 0.25, ml: action ? 0 : 'auto' }}>
          {open ? <ExpandLessIcon sx={{ fontSize: 16 }} /> : <ExpandMoreIcon sx={{ fontSize: 16 }} />}
        </IconButton>
      </Box>

      {/* Collapsible content with fade-in */}
      <Collapse in={open}>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, delay: 0.05 }}
            >
              <Box sx={{ mt: 1 }}>
                {children}
              </Box>
            </motion.div>
          )}
        </AnimatePresence>
      </Collapse>
    </Box>
  );
}
