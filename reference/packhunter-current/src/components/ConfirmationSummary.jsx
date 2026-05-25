/**
 * Phase 5.1 (Apr 2026) — Reusable confirmation-summary block.
 *
 * Standard pattern for ALL bulk-action confirmation modals (Smart
 * Clear friend removal, gift batches, trade batches, anything where
 * the user is about to commit a destructive or high-volume action).
 *
 * Layout:
 *
 *   [outcome]              ← single bold sentence: "Remove 18 friends"
 *   [will / will-not list] ← bullets framed as outcomes, no jargon
 *   [risk]                 ← optional ⚠️ block when an opt-in is on
 *   [meta]                 ← time / count / footnote, smallest text
 *
 * Goals (from the Phase 5.1 spec):
 *   - Understandable in under 3 seconds
 *   - Outcome-focused (what will happen) + reassuring (what will NOT)
 *   - Calm tone — no internal flags, no "you accepted this risk"
 *     blame language, no server-side jargon
 *   - Premium feel — matches the landing page tone
 *
 * Drop-in usage with the existing useConfirmDialog hook (pass via
 * the new `body` prop — see ConfirmDialog.jsx Phase 5.1 extension):
 *
 *   confirm({
 *     title: 'Smart Clear',
 *     body: (
 *       <ConfirmationSummary
 *         outcome="Remove 18 friends"
 *         willHappen={[
 *           'All removals are medium-confidence',
 *         ]}
 *         willNotHappen={[
 *           '38 protected friends will not be touched',
 *         ]}
 *         risk="Some checks (wishlist, high-value) may not be fully verified."
 *         riskTitle="Partial confidence enabled"
 *         meta="Estimated time: ~18 seconds"
 *       />
 *     ),
 *     confirmText: 'Remove 18',
 *     confirmColor: 'error',
 *   })
 *
 * Pure presentation. No backend calls, no logic, no state.
 */

'use strict';

import React from 'react';
import { Box, Typography, Stack } from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

function BulletRow({ Icon, color, text }) {
  return (
    <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mb: 0.5 }}>
      <Icon sx={{ fontSize: 16, color, mt: '2px', flexShrink: 0 }} />
      <Typography variant="body2" sx={{ color: 'text.primary', lineHeight: 1.45 }}>
        {text}
      </Typography>
    </Stack>
  );
}

/**
 * @param {object} props
 * @param {string} props.outcome - single bold sentence summarising the action
 * @param {string[]} [props.willHappen] - things that WILL happen (green bullets)
 * @param {string[]} [props.willNotHappen] - things that will NOT happen (neutral bullets)
 * @param {string} [props.risk] - optional warning sentence
 * @param {string} [props.riskTitle] - optional warning headline
 * @param {string|React.ReactNode} [props.meta] - small footnote (time / count / etc)
 */
export default function ConfirmationSummary({
  outcome,
  willHappen = [],
  willNotHappen = [],
  risk = null,
  riskTitle = null,
  meta = null,
}) {
  return (
    <Box sx={{ textAlign: 'left', mt: 1 }}>
      {/* Outcome — single bold sentence, sits at top */}
      {outcome && (
        <Typography
          variant="subtitle1"
          sx={{ fontWeight: 700, mb: 1.5, color: 'text.primary' }}
        >
          {outcome}
        </Typography>
      )}

      {/* What will happen (green) */}
      {willHappen.length > 0 && (
        <Box sx={{ mb: willNotHappen.length > 0 ? 1 : 0 }}>
          {willHappen.map((line, i) => (
            <BulletRow
              key={`w-${i}`}
              Icon={CheckCircleOutlineIcon}
              color="success.main"
              text={line}
            />
          ))}
        </Box>
      )}

      {/* What will NOT happen (neutral / muted) */}
      {willNotHappen.length > 0 && (
        <Box sx={{ mb: risk ? 1.5 : 0 }}>
          {willNotHappen.map((line, i) => (
            <BulletRow
              key={`n-${i}`}
              Icon={RemoveCircleOutlineIcon}
              color="text.secondary"
              text={line}
            />
          ))}
        </Box>
      )}

      {/* Optional risk block */}
      {risk && (
        <Box
          sx={{
            mt: 0.5,
            p: 1.25,
            borderRadius: 1,
            border: 1,
            borderColor: 'warning.light',
            bgcolor: 'warning.lighter',
            display: 'flex',
            gap: 1,
            alignItems: 'flex-start',
          }}
        >
          <WarningAmberIcon sx={{ fontSize: 18, color: 'warning.main', mt: '2px', flexShrink: 0 }} />
          <Box sx={{ minWidth: 0 }}>
            {riskTitle && (
              <Typography variant="body2" sx={{ fontWeight: 600, color: 'warning.dark', lineHeight: 1.35 }}>
                {riskTitle}
              </Typography>
            )}
            <Typography variant="caption" sx={{ color: 'text.primary', lineHeight: 1.5, display: 'block', mt: riskTitle ? 0.25 : 0 }}>
              {risk}
            </Typography>
          </Box>
        </Box>
      )}

      {/* Meta footnote */}
      {meta && (
        <Typography
          variant="caption"
          sx={{ display: 'block', mt: 1.5, color: 'text.secondary' }}
        >
          {meta}
        </Typography>
      )}
    </Box>
  );
}
