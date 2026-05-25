/**
 * PackSummary — deterministic rendering of a hunter's CURRENT active packs.
 *
 * Rules (spec-mandated):
 *   0 packs  → "Not currently hunting"
 *   1 pack   → pack name
 *   2 packs  → "A, B"
 *   3+ packs → "A, B +X more"
 *
 * Accepts either:
 *   - packs: [{ pack_name, is_active }]   (Hunters participant shape)
 *   - activePackNames: ['A', 'B', 'C']    (when caller pre-filters)
 *
 * Never renders inactive packs.
 */

import { Box, Chip, Typography } from '@mui/material';

/** Pure helper — testable without React. Returns the summary string or null. */
export function summarizePacks(input) {
  let names;
  if (Array.isArray(input?.activePackNames)) {
    names = input.activePackNames;
  } else if (Array.isArray(input?.packs)) {
    names = input.packs
      .filter(p => p && p.is_active)
      .map(p => p.pack_name)
      .filter(Boolean);
  } else if (Array.isArray(input)) {
    // Plain array of names or pack objects.
    names = input
      .map(p => (typeof p === 'string' ? p : (p?.is_active ? p.pack_name : null)))
      .filter(Boolean);
  } else {
    names = [];
  }

  if (names.length === 0) return { kind: 'empty' };
  if (names.length === 1) return { kind: 'list', names, extra: 0 };
  if (names.length === 2) return { kind: 'list', names, extra: 0 };
  return { kind: 'list', names: names.slice(0, 2), extra: names.length - 2 };
}

export default function PackSummary({ packs, activePackNames, dense = false }) {
  const summary = summarizePacks({ packs, activePackNames });

  if (summary.kind === 'empty') {
    return (
      <Chip
        label="Not currently hunting"
        size="small"
        variant="outlined"
        color="default"
        sx={{ fontWeight: 400 }}
      />
    );
  }

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap', minWidth: 0 }}>
      <Typography
        variant="body2"
        sx={{
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: dense ? 160 : 260,
        }}
      >
        {summary.names.join(', ')}
      </Typography>
      {summary.extra > 0 && (
        <Chip
          label={`+${summary.extra} more`}
          size="small"
          variant="outlined"
          sx={{ height: 18, fontSize: '0.7rem' }}
        />
      )}
    </Box>
  );
}
