import { Box } from '@mui/material'

/**
 * BentoGrid — CSS Grid layout wrapper with asymmetric spanning support.
 * Replaces uniform MUI <Grid container> for dashboard layouts.
 */
const BentoGrid = ({ columns = 12, gap = 2, rowHeight = 80, children, sx = {} }) => (
  <Box
    sx={{
      display: 'grid',
      gridTemplateColumns: {
        xs: 'repeat(4, 1fr)',
        sm: 'repeat(6, 1fr)',
        md: `repeat(${columns}, 1fr)`,
      },
      gridAutoRows: `minmax(${rowHeight}px, auto)`,
      gap,
      ...sx,
    }}
  >
    {children}
  </Box>
)

/**
 * BentoItem — Grid child with column/row spanning.
 */
const BentoItem = ({ span = 1, rowSpan = 1, children, sx = {} }) => (
  <Box
    sx={{
      gridColumn: {
        xs: span > 4 ? 'span 4' : `span ${Math.min(span, 4)}`,
        sm: span > 6 ? 'span 6' : `span ${Math.min(span, 6)}`,
        md: `span ${span}`,
      },
      gridRow: `span ${rowSpan}`,
      minWidth: 0,
      ...sx,
    }}
  >
    {children}
  </Box>
)

export { BentoGrid, BentoItem }
export default BentoGrid
