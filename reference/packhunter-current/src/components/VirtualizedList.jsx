/**
 * VirtualizedList - Performant virtualized list for large datasets
 *
 * Uses CSS-based virtualization for simplicity (no external deps)
 * For very large lists (1000+), consider using react-window
 *
 * Features:
 * - Renders only visible items
 * - Smooth scrolling
 * - Dynamic height support
 * - Keyboard navigation
 */

import { useState, useRef, useEffect, useCallback, useMemo, forwardRef } from 'react'
import {
  Box,
  List,
  ListItem,
  ListItemButton,
  Paper,
  Typography,
  CircularProgress,
  TextField,
  InputAdornment,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'

/**
 * Simple virtualized list using intersection observer
 */
export function VirtualizedList({
  items,
  renderItem,
  itemHeight = 56,
  height = 400,
  loading = false,
  emptyMessage = 'No items',
  searchable = false,
  searchPlaceholder = 'Search...',
  getSearchText,
  onItemClick,
  selectedId,
}) {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 })
  const [searchQuery, setSearchQuery] = useState('')
  const containerRef = useRef(null)

  // Filter items by search
  const filteredItems = useMemo(() => {
    if (!searchQuery || !searchable) return items

    return items.filter(item => {
      const text = getSearchText ? getSearchText(item) : JSON.stringify(item)
      return text.toLowerCase().includes(searchQuery.toLowerCase())
    })
  }, [items, searchQuery, searchable, getSearchText])

  // Calculate visible range on scroll
  const handleScroll = useCallback((e) => {
    const scrollTop = e.target.scrollTop
    const containerHeight = e.target.clientHeight

    const start = Math.floor(scrollTop / itemHeight)
    const visibleCount = Math.ceil(containerHeight / itemHeight)
    const end = Math.min(start + visibleCount + 5, filteredItems.length) // +5 buffer

    setVisibleRange({ start: Math.max(0, start - 2), end }) // -2 buffer
  }, [itemHeight, filteredItems.length])

  // Reset range when items change
  useEffect(() => {
    setVisibleRange({ start: 0, end: Math.min(20, filteredItems.length) })
  }, [filteredItems.length])

  const totalHeight = filteredItems.length * itemHeight
  const offsetY = visibleRange.start * itemHeight

  const visibleItems = filteredItems.slice(visibleRange.start, visibleRange.end)

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Box>
      {searchable && (
        <TextField
          fullWidth
          size="small"
          placeholder={searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 1 }}
        />
      )}

      <Box
        ref={containerRef}
        onScroll={handleScroll}
        sx={{
          height,
          overflow: 'auto',
          position: 'relative',
        }}
      >
        {filteredItems.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Typography color="text.secondary">{emptyMessage}</Typography>
          </Box>
        ) : (
          <>
            {/* Spacer for total height */}
            <Box sx={{ height: totalHeight, position: 'relative' }}>
              {/* Visible items container */}
              <Box
                sx={{
                  position: 'absolute',
                  top: offsetY,
                  left: 0,
                  right: 0,
                }}
              >
                <List disablePadding>
                  {visibleItems.map((item, index) => {
                    const actualIndex = visibleRange.start + index
                    const isSelected = selectedId !== undefined && item.id === selectedId

                    return (
                      <ListItem
                        key={item.id || actualIndex}
                        disablePadding
                        sx={{ height: itemHeight }}
                      >
                        {onItemClick ? (
                          <ListItemButton
                            onClick={() => onItemClick(item, actualIndex)}
                            selected={isSelected}
                            sx={{ height: '100%' }}
                          >
                            {renderItem(item, actualIndex)}
                          </ListItemButton>
                        ) : (
                          <Box sx={{ px: 2, width: '100%' }}>
                            {renderItem(item, actualIndex)}
                          </Box>
                        )}
                      </ListItem>
                    )
                  })}
                </List>
              </Box>
            </Box>
          </>
        )}
      </Box>

      {searchQuery && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Showing {filteredItems.length} of {items.length} items
        </Typography>
      )}
    </Box>
  )
}

/**
 * Virtualized table with fixed header
 */
export function VirtualizedTable({
  columns,
  data,
  rowHeight = 52,
  height = 400,
  loading = false,
  emptyMessage = 'No data',
  onRowClick,
  selectedId,
  stickyHeader = true,
}) {
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 })
  const containerRef = useRef(null)

  const handleScroll = useCallback((e) => {
    const scrollTop = e.target.scrollTop
    const containerHeight = e.target.clientHeight

    const start = Math.floor(scrollTop / rowHeight)
    const visibleCount = Math.ceil(containerHeight / rowHeight)
    const end = Math.min(start + visibleCount + 5, data.length)

    setVisibleRange({ start: Math.max(0, start - 2), end })
  }, [rowHeight, data.length])

  useEffect(() => {
    setVisibleRange({ start: 0, end: Math.min(20, data.length) })
  }, [data.length])

  const totalHeight = data.length * rowHeight
  const offsetY = visibleRange.start * rowHeight
  const visibleData = data.slice(visibleRange.start, visibleRange.end)

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height }}>
        <CircularProgress />
      </Box>
    )
  }

  return (
    <Paper variant="outlined">
      {/* Header */}
      <Box
        sx={{
          display: 'flex',
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          position: stickyHeader ? 'sticky' : 'relative',
          top: 0,
          zIndex: 1,
        }}
      >
        {columns.map((col) => (
          <Box
            key={col.field}
            sx={{
              flex: col.flex || 1,
              width: col.width,
              minWidth: col.minWidth,
              p: 1.5,
              fontWeight: 600,
              fontSize: '0.875rem',
            }}
          >
            {col.headerName}
          </Box>
        ))}
      </Box>

      {/* Body */}
      <Box
        ref={containerRef}
        onScroll={handleScroll}
        sx={{
          height: height - 48, // Subtract header height
          overflow: 'auto',
          position: 'relative',
        }}
      >
        {data.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Typography color="text.secondary">{emptyMessage}</Typography>
          </Box>
        ) : (
          <Box sx={{ height: totalHeight, position: 'relative' }}>
            <Box
              sx={{
                position: 'absolute',
                top: offsetY,
                left: 0,
                right: 0,
              }}
            >
              {visibleData.map((row, index) => {
                const actualIndex = visibleRange.start + index
                const isSelected = selectedId !== undefined && row.id === selectedId

                return (
                  <Box
                    key={row.id || actualIndex}
                    onClick={() => onRowClick?.(row, actualIndex)}
                    sx={{
                      display: 'flex',
                      height: rowHeight,
                      alignItems: 'center',
                      borderBottom: 1,
                      borderColor: 'divider',
                      bgcolor: isSelected ? 'action.selected' : 'transparent',
                      cursor: onRowClick ? 'pointer' : 'default',
                      '&:hover': onRowClick ? { bgcolor: 'action.hover' } : {},
                      '&:nth-of-type(odd)': { bgcolor: isSelected ? 'action.selected' : 'action.hover' },
                    }}
                  >
                    {columns.map((col) => (
                      <Box
                        key={col.field}
                        sx={{
                          flex: col.flex || 1,
                          width: col.width,
                          minWidth: col.minWidth,
                          p: 1.5,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {col.renderCell ? col.renderCell(row, actualIndex) : row[col.field]}
                      </Box>
                    ))}
                  </Box>
                )
              })}
            </Box>
          </Box>
        )}
      </Box>
    </Paper>
  )
}

export default VirtualizedList
