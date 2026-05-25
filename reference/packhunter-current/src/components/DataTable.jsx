/**
 * DataTable - Unified reusable data table component for admin pages
 *
 * Features:
 * - Sortable columns with asc/desc toggle and arrow indicators
 * - Built-in client-side search bar with search icon
 * - Sticky header that stays fixed when scrolling table body
 * - Row hover highlight with subtle indigo glow
 * - Pagination with page size selector and navigation
 * - Empty state with centered message and icon
 * - Loading state with 5 skeleton shimmer rows
 * - Glassmorphism styled container
 * - Staggered row entrance animations via framer-motion
 *
 * Column definition:
 *   {
 *     id: string          -- field key in row data (also used as React key)
 *     label: string       -- header text
 *     sortable?: boolean  -- enable click-to-sort on this column
 *     minWidth?: number   -- CSS minWidth in px
 *     width?: number|string
 *     align?: 'left' | 'center' | 'right'
 *     render?: (row) => ReactNode            -- full custom cell renderer
 *     format?: (value, row) => ReactNode     -- value formatter (simpler than render)
 *     comparator?: (a, b, colId) => number   -- custom sort comparator
 *   }
 *
 * Usage:
 *   <DataTable
 *     columns={[
 *       { id: 'name', label: 'Name', sortable: true, minWidth: 150 },
 *       { id: 'status', label: 'Status', sortable: true, render: (row) => <Chip ... /> },
 *       { id: 'date', label: 'Date', sortable: true, format: (val) => new Date(val).toLocaleDateString() },
 *     ]}
 *     rows={data}
 *     loading={false}
 *     searchable={true}
 *     searchPlaceholder="Search users..."
 *     defaultSort={{ column: 'name', direction: 'asc' }}
 *     pageSize={25}
 *     emptyMessage="No data found"
 *     emptyIcon={<SearchIcon />}
 *     onRowClick={(row) => handleClick(row)}
 *     rowKey="id"
 *   />
 */

import { useState, useMemo, useCallback } from 'react'
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Skeleton,
  Typography,
  InputAdornment,
  Select,
  MenuItem,
  FormControl,
  Pagination as MuiPagination,
  useTheme,
} from '@mui/material'
import {
  Search as SearchIcon,
  Inbox as InboxIcon,
} from '@mui/icons-material'
import { motion, AnimatePresence } from 'framer-motion'
import { useThemeMode } from '../contexts/ThemeContext'

// ---------------------------------------------------------------------------
// Design system tokens (theme-aware)
// ---------------------------------------------------------------------------
const getColors = (isDark, theme) => ({
  primary: theme?.palette?.primary?.main || '#7C8AFF',
  secondary: theme?.palette?.secondary?.light || '#A78BFA',
  darkBg: isDark ? '#111827' : '#ffffff',
  paper: isDark ? '#1A2035' : '#ffffff',
  glassBg: isDark ? 'rgba(26, 32, 53, 0.7)' : 'rgba(255, 255, 255, 0.7)',
  hoverGlow: isDark ? 'rgba(124, 138, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
  hoverBorder: isDark ? 'rgba(124, 138, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)',
  headerBg: isDark ? 'rgba(17, 24, 39, 0.85)' : 'rgba(245, 245, 245, 0.85)',
  borderColor: isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
  searchBg: isDark ? 'rgba(17, 24, 39, 0.5)' : 'rgba(0, 0, 0, 0.03)',
  skeletonBg: isDark ? 'rgba(124, 138, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
  skeletonShine: isDark ? 'rgba(124, 138, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
  scrollThumb: isDark ? 'rgba(124, 138, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
  scrollThumbHover: isDark ? 'rgba(124, 138, 255, 0.35)' : 'rgba(0, 0, 0, 0.35)',
  paginationSelected: isDark ? 'rgba(124, 138, 255, 0.15)' : 'rgba(124, 138, 255, 0.1)',
  paginationSelectedHover: isDark ? 'rgba(124, 138, 255, 0.25)' : 'rgba(124, 138, 255, 0.2)',
})

// ---------------------------------------------------------------------------
// Framer Motion - staggered fade-in for each table row
// ---------------------------------------------------------------------------
const MotionTableRow = motion(TableRow)

const ROW_ANIMATION_LIMIT = 20 // Only animate first 20 rows to avoid frame drops with 100+ rows

const rowVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.03,
      duration: 0.25,
      ease: 'easeOut',
    },
  }),
}

// No-animation variant for rows beyond the limit — renders immediately
const rowVariantsImmediate = {
  hidden: { opacity: 1, y: 0 },
  visible: { opacity: 1, y: 0, transition: { duration: 0 } },
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/**
 * Generic comparator for sorting.
 * Handles strings, numbers, booleans, dates, null/undefined gracefully.
 */
function defaultComparator(a, b, columnId) {
  const valA = a[columnId]
  const valB = b[columnId]

  // Nullish values sort to the end
  if (valA == null && valB == null) return 0
  if (valA == null) return 1
  if (valB == null) return -1

  // String comparison (case-insensitive)
  if (typeof valA === 'string' && typeof valB === 'string') {
    return valA.localeCompare(valB, undefined, { sensitivity: 'base' })
  }

  // Numeric / boolean / date fallback
  if (valA < valB) return -1
  if (valA > valB) return 1
  return 0
}

/**
 * Searches a row against the query string.
 * Checks every column's raw value (stringified) against the lowercase query.
 */
function matchesSearch(row, columns, query) {
  if (!query) return true
  const lowerQuery = query.toLowerCase()
  return columns.some((col) => {
    const val = row[col.id]
    if (val == null) return false
    return String(val).toLowerCase().includes(lowerQuery)
  })
}

// Stable skeleton widths so they don't recalculate on re-render
const SKELETON_WIDTHS = ['70%', '55%', '60%', '45%', '65%']

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Skeleton loading rows */
function LoadingRows({ columns, count = 5, COLORS }) {
  return Array.from({ length: count }).map((_, rowIdx) => (
    <TableRow key={`skeleton-${rowIdx}`}>
      {columns.map((col, colIdx) => (
        <TableCell
          key={col.id}
          sx={{ py: 1.5, px: 2, borderBottom: `1px solid ${COLORS.borderColor}` }}
        >
          <Skeleton
            variant="rounded"
            height={20}
            width={colIdx === 0 ? '70%' : SKELETON_WIDTHS[(rowIdx + colIdx) % SKELETON_WIDTHS.length]}
            animation="wave"
            sx={{
              bgcolor: COLORS.skeletonBg,
              '&::after': {
                background: `linear-gradient(90deg, transparent, ${COLORS.skeletonShine}, transparent)`,
              },
            }}
          />
        </TableCell>
      ))}
    </TableRow>
  ))
}

/** Empty state displayed when no rows match */
function TableEmptyState({ icon, message, colSpan }) {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan}
        sx={{ borderBottom: 'none', py: 8 }}
      >
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 1.5,
          }}
        >
          <Box sx={{ color: 'text.secondary', opacity: 0.5 }}>
            {icon || <InboxIcon sx={{ fontSize: 56 }} />}
          </Box>
          <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 500 }}>
            {message || 'No data found'}
          </Typography>
        </Box>
      </TableCell>
    </TableRow>
  )
}

/** Pagination controls: page size selector + row info + page navigation */
function PaginationControls({
  page,
  pageSize,
  totalRows,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
  COLORS,
}) {
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))
  const startRow = totalRows === 0 ? 0 : (page - 1) * pageSize + 1
  const endRow = Math.min(page * pageSize, totalRows)

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 2,
        px: 2,
        py: 1.5,
        borderTop: `1px solid ${COLORS.borderColor}`,
      }}
    >
      {/* Left: page size selector */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }} id="rows-per-page-label">
          Rows per page:
        </Typography>
        <FormControl size="small" variant="outlined">
          <Select
            value={pageSize}
            aria-labelledby="rows-per-page-label"
            onChange={(e) => {
              onPageSizeChange(Number(e.target.value))
              onPageChange(1)
            }}
            sx={{
              minWidth: 70,
              fontSize: '0.8125rem',
              '& .MuiOutlinedInput-notchedOutline': {
                borderColor: COLORS.borderColor,
              },
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: COLORS.hoverBorder,
              },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                borderColor: COLORS.primary,
              },
            }}
          >
            {pageSizeOptions.map((opt) => (
              <MenuItem key={opt} value={opt}>
                {opt}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Center: row count info */}
      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
        {totalRows === 0 ? '0 results' : `${startRow}\u2013${endRow} of ${totalRows}`}
      </Typography>

      {/* Right: page navigation */}
      <MuiPagination
        count={totalPages}
        page={page}
        onChange={(_, newPage) => onPageChange(newPage)}
        size="small"
        shape="rounded"
        sx={{
          '& .MuiPaginationItem-root': {
            color: 'text.secondary',
            borderColor: COLORS.borderColor,
            '&.Mui-selected': {
              bgcolor: COLORS.paginationSelected,
              color: COLORS.primary,
              borderColor: COLORS.primary,
              '&:hover': {
                bgcolor: COLORS.paginationSelectedHover,
              },
            },
            '&:hover': {
              bgcolor: COLORS.hoverGlow,
            },
          },
        }}
      />
    </Box>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function DataTable({
  columns = [],
  rows = [],
  loading = false,
  searchable = true,
  searchPlaceholder = 'Search...',
  defaultSort = null,
  pageSize: initialPageSize = 25,
  pageSizeOptions = [10, 25, 50, 100],
  emptyMessage = 'No data found',
  emptyIcon = null,
  onRowClick = null,
  rowKey = 'id',
  stickyHeader = true,
  maxHeight = 'calc(100vh - 300px)',
  title = null,
}) {
  // -- Theme-aware colors ----------------------------------------------------
  const { isDark } = useThemeMode()
  const theme = useTheme()
  const COLORS = getColors(isDark, theme)

  // -- State -----------------------------------------------------------------
  const [searchQuery, setSearchQuery] = useState('')
  const [sortColumn, setSortColumn] = useState(defaultSort?.column || null)
  const [sortDirection, setSortDirection] = useState(defaultSort?.direction || 'asc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(initialPageSize)

  // -- Sorting handler -------------------------------------------------------
  const handleSort = useCallback(
    (columnId) => {
      if (sortColumn === columnId) {
        setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      } else {
        setSortColumn(columnId)
        setSortDirection('asc')
      }
      setPage(1)
    },
    [sortColumn],
  )

  // -- Derived data: filter -> sort -> paginate ------------------------------
  const filteredRows = useMemo(() => {
    return rows.filter((row) => matchesSearch(row, columns, searchQuery))
  }, [rows, columns, searchQuery])

  const sortedRows = useMemo(() => {
    if (!sortColumn) return filteredRows

    const col = columns.find((c) => c.id === sortColumn)
    const comparator = col?.comparator || defaultComparator
    const dir = sortDirection === 'asc' ? 1 : -1

    return [...filteredRows].sort((a, b) => dir * comparator(a, b, sortColumn))
  }, [filteredRows, sortColumn, sortDirection, columns])

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize
    return sortedRows.slice(start, start + pageSize)
  }, [sortedRows, page, pageSize])

  // Reset page when search query changes
  const handleSearchChange = useCallback((e) => {
    setSearchQuery(e.target.value)
    setPage(1)
  }, [])

  // -- Render ----------------------------------------------------------------
  return (
    <Box
      sx={{
        background: COLORS.glassBg,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderRadius: 3,
        border: `1px solid ${COLORS.borderColor}`,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Search bar */}
      {searchable && (
        <Box sx={{ px: 2, pt: 2, pb: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder={searchPlaceholder}
            value={searchQuery}
            onChange={handleSearchChange}
            aria-label="Search table"
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                bgcolor: COLORS.searchBg,
                borderRadius: 2,
                '& fieldset': {
                  borderColor: COLORS.borderColor,
                },
                '&:hover fieldset': {
                  borderColor: COLORS.hoverBorder,
                },
                '&.Mui-focused fieldset': {
                  borderColor: COLORS.primary,
                  borderWidth: 1,
                },
              },
              '& .MuiInputBase-input': {
                fontSize: '0.875rem',
                '&::placeholder': {
                  color: 'text.secondary',
                  opacity: 0.7,
                },
              },
            }}
          />
        </Box>
      )}

      {/* Table */}
      <TableContainer
        sx={{
          maxHeight: stickyHeader ? maxHeight : 'none',
          flex: 1,
          '&::-webkit-scrollbar': {
            width: 6,
            height: 6,
          },
          '&::-webkit-scrollbar-track': {
            bgcolor: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            bgcolor: COLORS.scrollThumb,
            borderRadius: 3,
            '&:hover': {
              bgcolor: COLORS.scrollThumbHover,
            },
          },
        }}
      >
        <Table stickyHeader={stickyHeader} size="small" aria-label={title || 'Data table'}>
          {/* ---- Header ---- */}
          <TableHead>
            <TableRow>
              {columns.map((col) => (
                <TableCell
                  key={col.id}
                  sx={{
                    bgcolor: COLORS.headerBg,
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    borderBottom: `1px solid ${COLORS.borderColor}`,
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'text.secondary',
                    py: 1.5,
                    px: 2,
                    whiteSpace: 'nowrap',
                    minWidth: col.minWidth || 'auto',
                    width: col.width || 'auto',
                    ...(col.align && { textAlign: col.align }),
                  }}
                  sortDirection={sortColumn === col.id ? sortDirection : false}
                >
                  {col.sortable ? (
                    <TableSortLabel
                      active={sortColumn === col.id}
                      direction={sortColumn === col.id ? sortDirection : 'asc'}
                      onClick={() => handleSort(col.id)}
                      sx={{
                        '&.MuiTableSortLabel-root': {
                          color: 'text.secondary',
                          '&:hover': {
                            color: COLORS.primary,
                          },
                        },
                        '&.MuiTableSortLabel-root.Mui-active': {
                          color: COLORS.primary,
                          '& .MuiTableSortLabel-icon': {
                            color: `${COLORS.primary} !important`,
                          },
                        },
                      }}
                    >
                      {col.label}
                    </TableSortLabel>
                  ) : (
                    col.label
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          {/* ---- Body ---- */}
          <TableBody>
            {loading ? (
              <LoadingRows columns={columns} count={5} COLORS={COLORS} />
            ) : paginatedRows.length === 0 ? (
              <TableEmptyState
                icon={emptyIcon}
                message={searchQuery ? `No results for "${searchQuery}"` : emptyMessage}
                colSpan={columns.length}
              />
            ) : (
              <AnimatePresence mode="popLayout">
                {paginatedRows.map((row, idx) => {
                  const key = row[rowKey] != null ? String(row[rowKey]) : `row-${idx}`

                  return (
                    <MotionTableRow
                      key={key}
                      custom={idx}
                      variants={idx < ROW_ANIMATION_LIMIT ? rowVariants : rowVariantsImmediate}
                      initial="hidden"
                      animate="visible"
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      onKeyDown={onRowClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onRowClick(row); } } : undefined}
                      role={onRowClick ? 'button' : undefined}
                      tabIndex={onRowClick ? 0 : undefined}
                      sx={{
                        cursor: onRowClick ? 'pointer' : 'default',
                        transition: 'background-color 0.15s ease',
                        '&:hover': {
                          bgcolor: COLORS.hoverGlow,
                        },
                      }}
                    >
                      {columns.map((col) => {
                        // Determine cell content via render > format > raw value
                        let content
                        if (col.render) {
                          content = col.render(row)
                        } else if (col.format) {
                          content = col.format(row[col.id], row)
                        } else {
                          content = row[col.id] ?? '\u2014'
                        }

                        return (
                          <TableCell
                            key={col.id}
                            sx={{
                              borderBottom: `1px solid ${COLORS.borderColor}`,
                              py: 1.5,
                              px: 2,
                              fontSize: '0.8125rem',
                              color: 'text.primary',
                              minWidth: col.minWidth || 'auto',
                              width: col.width || 'auto',
                              ...(col.align && { textAlign: col.align }),
                            }}
                          >
                            {content}
                          </TableCell>
                        )
                      })}
                    </MotionTableRow>
                  )
                })}
              </AnimatePresence>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      {!loading && (
        <PaginationControls
          page={page}
          pageSize={pageSize}
          totalRows={filteredRows.length}
          pageSizeOptions={pageSizeOptions}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          COLORS={COLORS}
        />
      )}
    </Box>
  )
}

export { DataTable }
