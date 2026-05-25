/**
 * AccountBadge — shows which account is active, with type color coding.
 * Main = blue, Alt = orange. Shows warning chip during active operations.
 */
import { Chip, Tooltip } from '@mui/material'
import { useAccount } from '../contexts/AccountContext'

const TYPE_COLORS = {
  main: { bg: '#1976d220', color: '#1976d2', border: '#1976d250' },
  alt:  { bg: '#ed6c0220', color: '#ed6c02', border: '#ed6c0250' },
}

export default function AccountBadge({ activeCount = 0 }) {
  const { selectedAccount } = useAccount()
  if (!selectedAccount) return null

  const type = selectedAccount.account_type || 'main'
  const name = selectedAccount.nickname || `Account #${selectedAccount.id}`
  const colors = TYPE_COLORS[type] || TYPE_COLORS.main

  return (
    <>
      <Tooltip title={`Actions run on this account: ${name} (${type})`} arrow>
        <Chip
          label={`${type === 'main' ? '🏠' : '🔄'} ${name}`}
          size="small"
          sx={{
            height: 22, fontSize: '0.7rem', fontWeight: 600,
            bgcolor: colors.bg, color: colors.color,
            border: `1px solid ${colors.border}`,
          }}
        />
      </Tooltip>
      {activeCount > 0 && (
        <Chip
          label={`${activeCount} active`}
          size="small"
          sx={{
            height: 20, fontSize: '0.6rem', fontWeight: 700,
            bgcolor: '#ed6c0220', color: '#ed6c02',
            animation: 'pulse 2s infinite',
            '@keyframes pulse': { '0%,100%': { opacity: 1 }, '50%': { opacity: 0.6 } },
          }}
        />
      )}
    </>
  )
}
