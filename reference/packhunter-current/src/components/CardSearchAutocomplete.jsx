/**
 * CardSearchAutocomplete Component
 * Debounced card search with autocomplete for trade requests
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Autocomplete,
  TextField,
  Box,
  Typography,
  Chip,
  CircularProgress,
  Paper,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { autoTrade } from '../services/api';
import { RARITY_COLORS } from '../constants/gameData';
import { RARITY_CHIP_TEXT } from '../constants/rarityConfig';

// Debounce hook
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export default function CardSearchAutocomplete({ onSelect, disabled = false }) {
  const [inputValue, setInputValue] = useState('');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const debouncedInput = useDebounce(inputValue, 300);

  // Search cards when input changes
  useEffect(() => {
    if (debouncedInput.length < 2) {
      setOptions([]);
      return;
    }

    const searchCards = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await autoTrade.searchCards(debouncedInput);
        setOptions(result.cards || []);
      } catch (err) {
        console.error('Card search error:', err);
        setError('Failed to search cards');
        setOptions([]);
      } finally {
        setLoading(false);
      }
    };

    searchCards();
  }, [debouncedInput]);

  const handleSelect = useCallback((event, value) => {
    if (value && onSelect) {
      onSelect(value);
    }
    // Clear input after selection
    setInputValue('');
  }, [onSelect]);

  // Render option with card details
  const renderOption = (props, option) => {
    const { key, ...otherProps } = props;
    return (
      <Box
        key={key}
        component="li"
        {...otherProps}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          py: 1,
        }}
      >
        {/* Card image placeholder or icon */}
        <Box
          sx={{
            width: 40,
            height: 56,
            bgcolor: 'grey.200',
            borderRadius: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {option.expansion_id || '?'}
          </Typography>
        </Box>

        {/* Card info */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography noWrap fontWeight="medium">
            {option.card_name}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Chip
              size="small"
              label={option.rarity_code}
              sx={{
                bgcolor: RARITY_COLORS[option.rarity_code] || 'grey.500',
                color: RARITY_CHIP_TEXT[option.rarity_code] || '#fff',
                fontWeight: 'bold',
                fontSize: '0.6875rem',
                height: 20,
              }}
            />
            <Typography variant="caption" color="text.secondary">
              {option.expansion_name || option.expansion_id}
            </Typography>
          </Box>
        </Box>

        {/* Availability indicator */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          {option.isAvailable ? (
            <>
              <CheckCircleIcon color="success" fontSize="small" />
              <Typography variant="caption" color="success.main">
                Available
              </Typography>
            </>
          ) : (
            <>
              <CancelIcon color="error" fontSize="small" />
              <Typography variant="caption" color="error.main">
                None available
              </Typography>
            </>
          )}
        </Box>

        {/* Sand cost */}
        {option.sandCost > 0 && (
          <Chip
            size="small"
            label={`${option.sandCost} sand`}
            variant="outlined"
            sx={{ fontSize: '0.7rem' }}
          />
        )}
      </Box>
    );
  };

  return (
    <Autocomplete
      freeSolo
      disablePortal
      options={options}
      loading={loading}
      disabled={disabled}
      inputValue={inputValue}
      onInputChange={(event, newValue) => setInputValue(newValue)}
      onChange={handleSelect}
      getOptionLabel={(option) => option.card_name || ''}
      isOptionEqualToValue={(option, value) => option.backend_id === value.backend_id}
      filterOptions={(x) => x} // Disable client-side filtering (server handles it)
      renderOption={renderOption}
      PaperComponent={(props) => (
        <Paper {...props} elevation={8} sx={{ mt: 1 }} />
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          label="Search for a card to request"
          placeholder="Type at least 2 characters..."
          variant="outlined"
          error={!!error}
          helperText={error}
          InputProps={{
            ...params.InputProps,
            startAdornment: (
              <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />
            ),
            endAdornment: (
              <>
                {loading && <CircularProgress size={20} />}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
      noOptionsText={
        inputValue.length < 2
          ? 'Type to search...'
          : loading
          ? 'Searching...'
          : 'No tradeable cards found'
      }
    />
  );
}
