/**
 * AccountContext - Global account state management
 *
 * Provides:
 * - accounts: Array of all accounts
 * - selectedAccount: Currently selected account (persisted to localStorage)
 * - selectAccount: Function to change selected account
 * - refreshAccounts: Function to reload accounts from API
 * - loading: Boolean indicating if accounts are being fetched
 * - error: Error message if account fetch failed
 */

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { accounts as accountsApi } from '../services/api'

const AccountContext = createContext()

const STORAGE_KEY = 'selected-account-id'

export function AccountProvider({ children }) {
  const [accounts, setAccounts] = useState([])
  const [selectedAccountId, setSelectedAccountId] = useState(() => {
    // Initialize from localStorage
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? parseInt(saved, 10) : null
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Fetch accounts from API
  const refreshAccounts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await accountsApi.list()
      const accountsList = data.accounts || []
      setAccounts(accountsList)

      // Auto-select MAIN account if none selected or selected account no longer exists
      if (accountsList.length > 0) {
        const currentExists = accountsList.some(a => a.id === selectedAccountId)
        if (!currentExists) {
          // Prefer 'main' account, fall back to first
          const mainAccount = accountsList.find(a => a.account_type === 'main') || accountsList[0]
          setSelectedAccountId(mainAccount.id)
          localStorage.setItem(STORAGE_KEY, mainAccount.id.toString())
        }
      } else {
        // No accounts, clear selection
        setSelectedAccountId(null)
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch (err) {
      console.error('Failed to fetch accounts:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [selectedAccountId])

  // Load accounts on mount
  useEffect(() => {
    refreshAccounts()
  }, []) // Only run once on mount, not when refreshAccounts changes

  // Select an account
  const selectAccount = useCallback((accountOrId) => {
    const id = typeof accountOrId === 'object' ? accountOrId?.id : accountOrId
    if (id) {
      setSelectedAccountId(id)
      localStorage.setItem(STORAGE_KEY, id.toString())
    } else {
      setSelectedAccountId(null)
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [])

  // Derive selected account object from ID
  const selectedAccount = useMemo(() => {
    if (!selectedAccountId) return null
    return accounts.find(a => a.id === selectedAccountId) || null
  }, [accounts, selectedAccountId])

  const value = useMemo(() => ({
    accounts,
    selectedAccount,
    selectedAccountId,
    selectAccount,
    refreshAccounts,
    loading,
    error,
  }), [accounts, selectedAccount, selectedAccountId, selectAccount, refreshAccounts, loading, error])

  return (
    <AccountContext.Provider value={value}>
      {children}
    </AccountContext.Provider>
  )
}

export function useAccount() {
  const context = useContext(AccountContext)
  if (!context) {
    throw new Error('useAccount must be used within AccountProvider')
  }
  return context
}

export default AccountContext
