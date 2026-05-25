import { Box, useTheme } from '@mui/material'

/**
 * SectionCard — themed container box replacing the duplicated sectionBox/cardSx/cardStyle pattern.
 *
 * Usage:
 *   <SectionCard>content</SectionCard>
 *   <SectionCard noPadding sx={{ mb: 3 }}>content</SectionCard>
 *
 * Also exports hook for pages that need the raw sx object (e.g. spreading into other components):
 *   const { sectionBox, tableContainerStyle, tableHeadStyle } = useSectionStyles()
 */
export default function SectionCard({ children, noPadding, sx, ...props }) {
  const theme = useTheme()
  const g = theme.custom.glass

  return (
    <Box
      sx={{
        p: noPadding ? 0 : theme.custom.spacing.card,
        borderRadius: `${theme.custom.radius.lg}px`,
        border: `1px solid ${g.border}`,
        bgcolor: g.cardBg,
        ...sx,
      }}
      {...props}
    >
      {children}
    </Box>
  )
}

/**
 * Hook returning the commonly-used style objects as raw sx values.
 * Use when you need to spread into non-SectionCard elements (e.g. TableContainer).
 */
export function useSectionStyles() {
  const theme = useTheme()
  const g = theme.custom.glass

  const sectionBox = {
    p: theme.custom.spacing.card,
    borderRadius: `${theme.custom.radius.lg}px`,
    border: `1px solid ${g.border}`,
    bgcolor: g.cardBg,
  }

  const tableContainerStyle = {
    borderRadius: `${theme.custom.radius.md}px`,
    border: `1px solid ${g.border}`,
    overflowX: 'auto',
    maxWidth: '100%',
    '& .MuiTableRow-root:hover': {
      bgcolor: g.rowHover,
      transition: `background-color ${theme.custom.transitions.fast}`,
    },
    '& .MuiTableCell-root': {
      px: { xs: 1, sm: 1.5, md: 2 },
      py: { xs: 0.75, sm: 1 },
      fontSize: { xs: '0.7rem', sm: '0.8rem', md: '0.875rem' },
    },
  }

  const tableHeadStyle = {
    bgcolor: g.tableHead,
  }

  return { sectionBox, tableContainerStyle, tableHeadStyle }
}
