/**
 * SearchableSelect - Enhanced select with search and grouping
 *
 * Features:
 * - Built-in search filtering
 * - Option grouping
 * - Custom rendering
 * - Keyboard navigation
 * - Loading state
 */

import { useState, useMemo, useCallback } from 'react'
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Box,
  ListSubheader,
  InputAdornment,
  Typography,
  Chip,
  CircularProgress,
  Checkbox,
  ListItemText,
} from '@mui/material'
import SearchIcon from '@mui/icons-material/Search'
import ClearIcon from '@mui/icons-material/Clear'

export function SearchableSelect({
  label,
  value,
  onChange,
  options = [],
  getOptionLabel = (opt) => opt.label ?? opt.name ?? String(opt),
  getOptionValue = (opt) => opt.value ?? opt.id ?? opt,
  groupBy,
  renderOption,
  placeholder = 'Search...',
  loading = false,
  disabled = false,
  error = false,
  helperText,
  required = false,
  multiple = false,
  maxHeight = 300,
  size = 'medium',
  fullWidth = true,
  clearable = false,
  ...props
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [open, setOpen] = useState(false)

  // Filter options by search
  const filteredOptions = useMemo(() => {
    if (!searchQuery) return options

    return options.filter((opt) => {
      const label = getOptionLabel(opt)
      return label.toLowerCase().includes(searchQuery.toLowerCase())
    })
  }, [options, searchQuery, getOptionLabel])

  // Group filtered options
  const groupedOptions = useMemo(() => {
    if (!groupBy) return { ungrouped: filteredOptions }

    return filteredOptions.reduce((acc, opt) => {
      const group = groupBy(opt)
      if (!acc[group]) acc[group] = []
      acc[group].push(opt)
      return acc
    }, {})
  }, [filteredOptions, groupBy])

  // Handle change
  const handleChange = useCallback((event) => {
    const newValue = event.target.value
    onChange?.(event, newValue)
    if (!multiple) {
      setOpen(false)
    }
  }, [onChange, multiple])

  // Handle clear
  const handleClear = useCallback((e) => {
    e.stopPropagation()
    onChange?.({ target: { value: multiple ? [] : '' } }, multiple ? [] : '')
  }, [onChange, multiple])

  // Render selected value
  const renderValue = useCallback((selected) => {
    if (multiple) {
      if (!selected || selected.length === 0) {
        return <Typography color="text.secondary">Select options...</Typography>
      }

      return (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {selected.slice(0, 3).map((val) => {
            const option = options.find(opt => getOptionValue(opt) === val)
            return (
              <Chip
                key={val}
                label={option ? getOptionLabel(option) : val}
                size="small"
              />
            )
          })}
          {selected.length > 3 && (
            <Chip label={`+${selected.length - 3} more`} size="small" />
          )}
        </Box>
      )
    }

    const option = options.find(opt => getOptionValue(opt) === selected)
    return option ? getOptionLabel(option) : selected
  }, [multiple, options, getOptionLabel, getOptionValue])

  return (
    <FormControl
      fullWidth={fullWidth}
      size={size}
      error={error}
      disabled={disabled || loading}
      required={required}
      {...props}
    >
      <InputLabel>{label}</InputLabel>
      <Select
        value={value}
        onChange={handleChange}
        label={label}
        multiple={multiple}
        open={open}
        onOpen={() => setOpen(true)}
        onClose={() => {
          setOpen(false)
          setSearchQuery('')
        }}
        renderValue={renderValue}
        MenuProps={{
          autoFocus: false,
          PaperProps: {
            sx: { maxHeight },
          },
        }}
        endAdornment={
          <>
            {loading && (
              <InputAdornment position="end" sx={{ mr: 2 }}>
                <CircularProgress size={20} />
              </InputAdornment>
            )}
            {clearable && value && (value.length > 0 || value !== '') && (
              <InputAdornment
                position="end"
                sx={{ mr: 2, cursor: 'pointer' }}
                onClick={handleClear}
                role="button"
                tabIndex={0}
                aria-label="Clear selection"
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClear(e); } }}
              >
                <ClearIcon fontSize="small" />
              </InputAdornment>
            )}
          </>
        }
      >
        {/* Search input */}
        <ListSubheader sx={{ bgcolor: 'background.paper', pt: 1, pb: 1 }}>
          <TextField
            size="small"
            autoFocus
            placeholder={placeholder}
            fullWidth
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.stopPropagation()}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </ListSubheader>

        {/* No results */}
        {filteredOptions.length === 0 && (
          <MenuItem disabled>
            <Typography color="text.secondary">
              {searchQuery ? 'No matches found' : 'No options available'}
            </Typography>
          </MenuItem>
        )}

        {/* Grouped options */}
        {Object.entries(groupedOptions).map(([group, opts]) => [
          group !== 'ungrouped' && (
            <ListSubheader
              key={`group-${group}`}
              sx={{
                bgcolor: 'action.hover',
                fontWeight: 600,
                lineHeight: '36px',
              }}
            >
              {group}
            </ListSubheader>
          ),
          ...opts.map((opt) => {
            const optValue = getOptionValue(opt)
            const optLabel = getOptionLabel(opt)
            const isSelected = multiple
              ? Array.isArray(value) && value.includes(optValue)
              : value === optValue

            return (
              <MenuItem key={optValue} value={optValue}>
                {multiple && <Checkbox checked={isSelected} sx={{ mr: 1 }} />}
                {renderOption ? (
                  renderOption(opt, { selected: isSelected })
                ) : (
                  <ListItemText primary={optLabel} />
                )}
              </MenuItem>
            )
          }),
        ])}
      </Select>

      {helperText && (
        <Typography
          variant="caption"
          color={error ? 'error' : 'text.secondary'}
          sx={{ mt: 0.5, mx: 1.75 }}
        >
          {helperText}
        </Typography>
      )}
    </FormControl>
  )
}

/**
 * Simple autocomplete-style select for common use cases
 */
export function QuickSelect({
  label,
  value,
  onChange,
  options = [],
  placeholder = 'Select...',
  ...props
}) {
  return (
    <SearchableSelect
      label={label}
      value={value}
      onChange={(e, val) => onChange(val)}
      options={options.map(opt => typeof opt === 'string' ? { label: opt, value: opt } : opt)}
      placeholder={placeholder}
      {...props}
    />
  )
}

export default SearchableSelect
