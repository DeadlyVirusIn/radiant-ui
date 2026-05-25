/**
 * WorkerTable — Diagnostic worker/instance table.
 * Features: container column, sortable headers, sticky header,
 * row striping, right-aligned numbers, error/stale row highlighting,
 * filter chips.
 */
import { memo, useState, useMemo, useEffect } from 'react'
import { Box, Typography, Chip, useTheme } from '@mui/material'
import {
  ArrowUpward as ArrowUpIcon,
  ArrowDownward as ArrowDownIcon,
} from '@mui/icons-material'
import StatusDot from '../StatusDot'
import { getContainerColor, STATUS, FONT } from './huntConstants'
import { formatNumber, tabularNumStyle, monoStyle } from '../../utils/formatNumber'

const COLUMNS = [
  { key: 'containerGroup', label: 'Container', align: 'left', width: 80, sortable: true },
  { key: 'id', label: 'Worker', align: 'left', width: 70, sortable: true },
  { key: 'status', label: 'Status', align: 'left', width: 80, sortable: false },
  { key: 'packMode', label: 'Pack', align: 'left', width: 100, sortable: false },
  { key: 'packsOpened', label: 'Packs', align: 'right', width: 80, sortable: true },
  { key: 'accountsProcessed', label: 'Accounts', align: 'right', width: 100, sortable: true },
  { key: 'godPacksFound', label: 'God Packs', align: 'right', width: 80, sortable: true },
  { key: 'packsPerMinute', label: 'PPM', align: 'right', width: 65, sortable: true },
  { key: 'accountsPerMinute', label: 'Accts/min', align: 'right', width: 75, sortable: true },
  { key: 'errors', label: 'Errors', align: 'right', width: 65, sortable: true },
]

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'errors', label: 'Errors' },
  { key: 'gp', label: 'God Packs' },
]

const WorkerTable = memo(({ instances, containerTab, externalFilter }) => {
  const theme = useTheme()
  const isDark = theme.palette.mode === 'dark'
  const [sortBy, setSortBy] = useState(null)
  const [sortDir, setSortDir] = useState('desc')
  const [filter, setFilter] = useState('all')

  // Reset filter to 'all' when container tab changes to avoid empty tables
  useEffect(() => { setFilter('all') }, [containerTab])

  // Accept external filter override (e.g. from AttentionPanel "Show in table" click)
  useEffect(() => {
    if (externalFilter) setFilter(externalFilter)
  }, [externalFilter])

  const handleSort = (col) => {
    if (!col.sortable) return
    if (sortBy === col.key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(col.key)
      setSortDir('desc')
    }
  }

  const filteredAndSorted = useMemo(() => {
    let result = [...(instances || [])]

    // Apply filter
    if (filter === 'active') result = result.filter(i => i.isActive)
    else if (filter === 'errors') result = result.filter(i => i.errors > 0)
    else if (filter === 'gp') result = result.filter(i => i.godPacksFound > 0)

    // Apply sort
    if (sortBy) {
      const dir = sortDir === 'asc' ? 1 : -1
      result.sort((a, b) => {
        const av = a[sortBy] ?? 0
        const bv = b[sortBy] ?? 0
        if (typeof av === 'string') return av.localeCompare(bv) * dir
        return ((av || 0) - (bv || 0)) * dir
      })
    }

    return result
  }, [instances, filter, sortBy, sortDir])

  const filterCounts = useMemo(() => ({
    all: (instances || []).length,
    active: (instances || []).filter(i => i.isActive).length,
    errors: (instances || []).filter(i => i.errors > 0).length,
    gp: (instances || []).filter(i => i.godPacksFound > 0).length,
  }), [instances])

  const borderColor = isDark ? 'rgba(124,138,255,0.08)' : 'rgba(0,0,0,0.06)'
  const hoverBg = isDark ? 'rgba(124,138,255,0.04)' : 'rgba(0,0,0,0.02)'
  const stripeBg = isDark ? 'rgba(124,138,255,0.02)' : 'rgba(0,0,0,0.015)'
  const headerBg = isDark ? 'rgba(15, 20, 35, 0.95)' : 'rgba(248, 249, 252, 0.98)'

  return (
    <Box>
      {/* Section header + filter chips */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography sx={{ fontSize: '1rem', fontWeight: 700, color: 'text.primary' }}>
            Workers
          </Typography>
          <Chip
            label={filterCounts.all}
            size="small"
            sx={{
              height: 22, fontWeight: 700, fontSize: FONT.label,
              bgcolor: `${theme.palette.primary.main}15`,
              color: theme.palette.primary.main,
              border: `1px solid ${theme.palette.primary.main}25`,
            }}
          />
          {containerTab && containerTab !== 'all' && (
            <Chip
              label={`Container ${containerTab}`}
              size="small"
              sx={{
                height: 20, fontSize: '0.65rem', fontWeight: 600,
                bgcolor: `${getContainerColor(containerTab)}15`,
                color: getContainerColor(containerTab),
                border: `1px solid ${getContainerColor(containerTab)}25`,
              }}
            />
          )}
        </Box>

        {/* Filter chips */}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {FILTERS.map(f => {
            const isActive = filter === f.key
            const count = filterCounts[f.key]
            return (
              <Chip
                key={f.key}
                label={`${f.label}${count > 0 && f.key !== 'all' ? ` (${count})` : ''}`}
                size="small"
                onClick={() => setFilter(f.key)}
                sx={{
                  cursor: 'pointer', height: 24, fontSize: '0.65rem', fontWeight: 600,
                  bgcolor: isActive ? `${theme.palette.primary.main}18` : 'transparent',
                  color: isActive ? theme.palette.primary.main : 'text.secondary',
                  border: `1px solid ${isActive ? `${theme.palette.primary.main}35` : borderColor}`,
                  '&:hover': { bgcolor: isActive ? undefined : hoverBg },
                }}
              />
            )
          })}
        </Box>
      </Box>

      {/* Table */}
      <Box sx={{
        borderRadius: '12px', overflow: 'hidden',
        bgcolor: isDark ? 'rgba(26, 32, 53, 0.7)' : 'rgba(255, 255, 255, 0.7)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        border: `1px solid ${borderColor}`,
        boxShadow: isDark ? '0 2px 12px rgba(0,0,0,0.15)' : '0 1px 6px rgba(0,0,0,0.04)',
      }}>
        <Box sx={{ overflowX: 'auto', maxHeight: 520 }}>
          <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', fontSize: FONT.value }}>
            {/* Sticky header */}
            <Box component="thead">
              <Box component="tr" sx={{
                position: 'sticky', top: 0, zIndex: 2,
                bgcolor: headerBg,
                backdropFilter: 'blur(8px)',
                borderBottom: `1px solid ${borderColor}`,
              }}>
                {COLUMNS.map(col => (
                  <Box
                    component="th"
                    key={col.key}
                    onClick={() => handleSort(col)}
                    sx={{
                      px: 1.5, py: 1.25,
                      textAlign: col.align,
                      fontWeight: 600,
                      fontSize: FONT.label,
                      color: sortBy === col.key ? theme.palette.primary.main : 'text.secondary',
                      whiteSpace: 'nowrap',
                      cursor: col.sortable ? 'pointer' : 'default',
                      userSelect: 'none',
                      minWidth: col.width,
                      '&:hover': col.sortable ? { color: theme.palette.primary.main } : {},
                      transition: 'color 0.15s',
                    }}
                  >
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25 }}>
                      {col.label}
                      {sortBy === col.key && (
                        sortDir === 'asc'
                          ? <ArrowUpIcon sx={{ fontSize: 14 }} />
                          : <ArrowDownIcon sx={{ fontSize: 14 }} />
                      )}
                    </Box>
                  </Box>
                ))}
              </Box>
            </Box>

            {/* Body */}
            <Box component="tbody">
              {filteredAndSorted.map((inst, idx) => {
                const containerColor = getContainerColor(inst.containerGroup)
                const hasError = inst.errors > 5
                const isInactive = !inst.isActive

                return (
                  <Box
                    component="tr"
                    key={inst.id}
                    sx={{
                      borderBottom: `1px solid ${isDark ? 'rgba(124,138,255,0.04)' : 'rgba(0,0,0,0.025)'}`,
                      bgcolor: hasError
                        ? (isDark ? 'rgba(255, 82, 82, 0.04)' : 'rgba(255, 82, 82, 0.02)')
                        : idx % 2 === 1 ? stripeBg : 'transparent',
                      opacity: isInactive ? 0.55 : 1,
                      transition: 'background-color 0.15s',
                      '&:hover': { bgcolor: hoverBg },
                    }}
                  >
                    {/* Container */}
                    <Box component="td" sx={{ px: 1.5, py: 0.75 }}>
                      <Chip
                        label={`C${inst.containerGroup}`}
                        size="small"
                        sx={{
                          height: 20, minWidth: 32, fontSize: '0.6rem', fontWeight: 700,
                          bgcolor: `${containerColor}12`, color: containerColor,
                          border: `1px solid ${containerColor}20`,
                        }}
                      />
                    </Box>

                    {/* Worker ID */}
                    <Box component="td" sx={{ px: 1.5, py: 0.75, fontWeight: 600, ...monoStyle, fontSize: FONT.value }}>
                      #{inst.id}
                    </Box>

                    {/* Status */}
                    <Box component="td" sx={{ px: 1.5, py: 0.75 }}>
                      <StatusDot
                        status={inst.isActive ? 'active' : inst.errors > 0 ? 'error' : 'idle'}
                        size={7}
                        label={inst.isActive ? 'Active' : 'Idle'}
                      />
                    </Box>

                    {/* Pack */}
                    <Box component="td" sx={{ px: 1.5, py: 0.75, color: 'text.secondary', fontSize: FONT.label }}>
                      {inst.packMode || 'RANDOM'}
                    </Box>

                    {/* Packs (right-aligned) */}
                    <Box component="td" sx={{ px: 1.5, py: 0.75, textAlign: 'right', fontWeight: 600, ...tabularNumStyle }}>
                      {formatNumber(inst.packsOpened || 0)}
                    </Box>

                    {/* Accounts */}
                    <Box component="td" sx={{ px: 1.5, py: 0.75, textAlign: 'right', ...tabularNumStyle }}>
                      {formatNumber(inst.accountsProcessed)}/{formatNumber(inst.accountsTotal)}
                    </Box>

                    {/* God Packs */}
                    <Box component="td" sx={{
                      px: 1.5, py: 0.75, textAlign: 'right', ...tabularNumStyle,
                      color: inst.godPacksFound > 0 ? '#FFD700' : 'text.primary',
                      fontWeight: inst.godPacksFound > 0 ? 700 : 400,
                    }}>
                      {inst.godPacksFound || 0}
                    </Box>

                    {/* PPM */}
                    <Box component="td" sx={{ px: 1.5, py: 0.75, textAlign: 'right', ...tabularNumStyle, fontWeight: 600 }}>
                      {inst.packsPerMinute || '-'}
                    </Box>

                    {/* Accts/min */}
                    <Box component="td" sx={{ px: 1.5, py: 0.75, textAlign: 'right', ...tabularNumStyle }}>
                      {inst.accountsPerMinute || '-'}
                    </Box>

                    {/* Errors */}
                    <Box component="td" sx={{
                      px: 1.5, py: 0.75, textAlign: 'right', ...tabularNumStyle,
                      color: inst.errors > 5 ? STATUS.CRITICAL : inst.errors > 0 ? STATUS.WARNING : 'text.secondary',
                      fontWeight: inst.errors > 0 ? 600 : 400,
                    }}>
                      {inst.errors || 0}
                    </Box>
                  </Box>
                )
              })}
            </Box>
          </Box>
        </Box>

        {filteredAndSorted.length === 0 && (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography sx={{ color: 'text.secondary', fontSize: FONT.value }}>
              No workers match the selected filter
            </Typography>
          </Box>
        )}
      </Box>
    </Box>
  )
})

WorkerTable.displayName = 'WorkerTable'
export default WorkerTable
