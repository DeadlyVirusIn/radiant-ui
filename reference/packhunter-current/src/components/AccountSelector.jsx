/**
 * AccountSelector — Shared account dropdown component
 *
 * Replaces 8+ duplicate FormControl+Select+MenuItem patterns across pages.
 * Uses AccountContext by default, or accepts props for custom account lists.
 */

import { FormControl, InputLabel, Select, MenuItem } from '@mui/material'
import { useAccount } from '../contexts/AccountContext'

const getDisplayName = (account) =>
  account.nickname || account.player_name || `Account ${account.id}`

/**
 * @param {Object} props
 * @param {string}  [props.label='Account']       - Dropdown label
 * @param {string}  [props.size='small']           - MUI size
 * @param {number}  [props.minWidth=180]           - Minimum width
 * @param {boolean} [props.fullWidth=false]         - Full width
 * @param {boolean} [props.activeOnly=true]         - Show only active accounts
 * @param {boolean} [props.hideIfSingle=true]       - Hide if only 1 account
 * @param {Array}   [props.accounts]                - Override account list (uses context if omitted)
 * @param {string|number} [props.value]             - Override selected value (uses context if omitted)
 * @param {Function} [props.onChange]               - Override onChange (uses context if omitted)
 * @param {Object}  [props.sx]                      - Additional sx props for FormControl
 */
export default function AccountSelector({
  label = 'Account',
  size = 'small',
  minWidth = 180,
  fullWidth = false,
  activeOnly = true,
  hideIfSingle = true,
  accounts: accountsProp,
  value: valueProp,
  onChange: onChangeProp,
  sx = {},
}) {
  const ctx = useAccount()
  const accounts = accountsProp || ctx.accounts || []
  const value = valueProp !== undefined ? valueProp : (ctx.selectedAccountId || '')
  const onChange = onChangeProp || ((val) => ctx.selectAccount(val))

  const filtered = activeOnly ? accounts.filter(a => a.is_active) : accounts

  if (hideIfSingle && filtered.length <= 1) return null

  return (
    <FormControl size={size} sx={{ minWidth, ...sx }} fullWidth={fullWidth}>
      <InputLabel>{label}</InputLabel>
      <Select
        value={value}
        label={label}
        onChange={(e) => onChange(e.target.value)}
      >
        {filtered.map(acc => (
          <MenuItem key={acc.id} value={acc.id}>
            {getDisplayName(acc)}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}
