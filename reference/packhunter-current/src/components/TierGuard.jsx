/**
 * TierGuard - Route wrapper that checks subscription tier
 * Renders children if user has required tier, otherwise shows UpgradeRequired
 */
import UpgradeRequired from './UpgradeRequired'

export default function TierGuard({ user, allowedTiers, children }) {
  const userTier = user?.subscriptionTier || 'free'

  // Admin always has access
  if (userTier === 'admin') return children

  if (!allowedTiers.includes(userTier)) {
    return <UpgradeRequired currentTier={userTier} requiredTiers={allowedTiers} />
  }

  return children
}
