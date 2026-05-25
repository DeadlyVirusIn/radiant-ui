import { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import adminApi from './adminUsersApi';

/**
 * useAdminUsers — owns data loading, filtering, sorting, and core mutation handlers
 * for the AdminUsers page. Does NOT own dialog state or dialog JSX.
 */
export default function useAdminUsers(user, navigate) {
  const routerLocation = useLocation();
  // ── Core data state ──
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [unregisteredSubs, setUnregisteredSubs] = useState([]);
  const [userSummary, setUserSummary] = useState({});
  const [subscribers, setSubscribers] = useState([]);
  const [huntParticipants, setHuntParticipants] = useState([]);

  // ── UI state ──
  // Phase 7 click-through: ?tab=hunters lands on the Hunters tab (index 1)
  // directly from Fleet Health alerts / tiles.
  const readInitialTab = () => {
    try {
      const t = new URLSearchParams(window.location.search).get('tab');
      if (t === 'hunters') return 1;
      return 0;
    } catch { return 0; }
  };
  const [tab, setTab] = useState(readInitialTab);

  // Phase 18 — HUNTERS NAV FIX.
  // Prior impl only read ?tab= at mount via `useState(readInitialTab)`.
  // When the user clicked "Hunters" in the sidebar while already on
  // /admin/users, React Router changed the query string but the tab
  // state never re-synced → the click appeared to do nothing.
  // Re-read on every location.search change so sidebar clicks from the
  // same page correctly switch tabs.
  useEffect(() => {
    const params = new URLSearchParams(routerLocation.search);
    const t = params.get('tab');
    setTab(t === 'hunters' ? 1 : 0);
  }, [routerLocation.search]);

  const [search, setSearch] = useState('');
  // Phase 18 — show test users opt-in toggle. Off by default so TEST/DEV
  // accounts don't pollute the admin view.
  const [showTestUsers, setShowTestUsers] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Phase 7 — hunter-state filter (?hunterState=warning|error|healthy|idle|all).
  // Read initial value from URL; filtering itself lives in the component
  // (uses deriveHunterStatus), so this is purely seed state.
  const readInitialHunterState = () => {
    try {
      const s = new URLSearchParams(window.location.search).get('hunterState');
      if (s && ['all', 'healthy', 'warning', 'error', 'idle'].includes(s)) return s;
      return 'all';
    } catch { return 'all'; }
  };
  const [hunterStateFilter, setHunterStateFilter] = useState(readInitialHunterState);

  // Unified Plan filter replaces the old tier/sub dropdowns on the merged
  // Users+Subscribers page. Accepts: all | premium | trade | trial | free | expired.
  // Seeded from URL (?plan=…) so the /admin/subscribers → /admin/users?plan=paid
  // redirect lands on a pre-filtered view.
  const readInitialPlan = () => {
    try {
      const p = new URLSearchParams(window.location.search).get('plan');
      if (!p) return 'all';
      if (p === 'paid') return 'premium'; // legacy subscribers compat
      if (['all', 'premium', 'trade', 'trial', 'free', 'expired'].includes(p)) return p;
      return 'all';
    } catch { return 'all'; }
  };
  const [userFilterPlan, setUserFilterPlan] = useState(readInitialPlan);

  // ── Filter & sort: Users table ──
  const [userFilterRole, setUserFilterRole] = useState('all');
  // Kept for back-compat with existing callers; the new UI uses userFilterPlan.
  const [userFilterTier, setUserFilterTier] = useState('all');
  const [userFilterSub, setUserFilterSub] = useState('all');
  const [userSortBy, setUserSortBy] = useState('username');
  const [userSortOrder, setUserSortOrder] = useState('asc');

  // ── Filter & sort: Subscribers table ──
  const [subFilterTier, setSubFilterTier] = useState('all');
  const [subFilterStatus, setSubFilterStatus] = useState('all');
  const [subSortBy, setSubSortBy] = useState('discord_username');
  const [subSortOrder, setSubSortOrder] = useState('asc');

  // ── Bot & friend state ──
  const [botStatuses, setBotStatuses] = useState({});
  const [actionLoading, setActionLoading] = useState({});
  const [friendCounts, setFriendCounts] = useState({});

  // ── Data issues state ──
  const [dataIssues, setDataIssues] = useState({ issues: [], summary: { total: 0 } });
  const [dataIssuesExpanded, setDataIssuesExpanded] = useState(false);
  const [dataIssuesLoading, setDataIssuesLoading] = useState(false);

  // ─────────────────────────────────────────────
  // Data loading
  // ─────────────────────────────────────────────

  const loadDataIssues = useCallback(async () => {
    try {
      setDataIssuesLoading(true);
      const res = await adminApi.getDataIssues();
      if (res.issues) setDataIssues(res);
    } catch (err) {
      console.error('Data issues load error:', err);
    } finally {
      setDataIssuesLoading(false);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [usersRes, subsRes, huntRes] = await Promise.all([
        adminApi.getUsers(),
        adminApi.getSubscribers().catch(() => ({ subscribers: [] })),
        adminApi.getHuntParticipants().catch(() => ({ participants: [] })),
      ]);

      if (usersRes.users) setUsers(usersRes.users);
      if (usersRes.unregistered_subscribers) setUnregisteredSubs(usersRes.unregistered_subscribers);
      if (usersRes.summary) setUserSummary(usersRes.summary);
      if (subsRes.subscribers) setSubscribers(subsRes.subscribers);
      if (huntRes.users) setHuntParticipants(huntRes.users);
    } catch (err) {
      setError('Failed to load user data');
      console.error('Load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Targeted refresh functions — reload only the affected data slice
  const refreshUsers = useCallback(async () => {
    try {
      const res = await adminApi.getUsers();
      if (res.users) setUsers(res.users);
      if (res.unregistered_subscribers) setUnregisteredSubs(res.unregistered_subscribers);
      if (res.summary) setUserSummary(res.summary);
    } catch (err) {
      console.error('refreshUsers error:', err);
    }
  }, []);

  const refreshSubscribers = useCallback(async () => {
    try {
      const res = await adminApi.getSubscribers();
      if (res.subscribers) setSubscribers(res.subscribers);
    } catch (err) {
      console.error('refreshSubscribers error:', err);
    }
  }, []);

  const refreshHuntParticipants = useCallback(async () => {
    try {
      const res = await adminApi.getHuntParticipants();
      if (res.users) setHuntParticipants(res.users);
    } catch (err) {
      console.error('refreshHuntParticipants error:', err);
    }
  }, []);

  // Initial data load + admin guard
  useEffect(() => {
    if (!user?.isAdmin) {
      navigate('/');
      return;
    }
    loadData();
    loadDataIssues();
  }, [user, loadData, loadDataIssues, navigate]);

  // NOTE: Bot status auto-load useEffect is placed AFTER fetchBotStatus definition
  // to avoid TDZ (temporal dead zone) — fetchBotStatus is a const declared later.
  const botStatusesRef = useRef(botStatuses);
  botStatusesRef.current = botStatuses;

  // ─────────────────────────────────────────────
  // Sort toggle handlers
  // ─────────────────────────────────────────────

  const handleUserSort = (column) => {
    if (userSortBy === column) {
      setUserSortOrder(userSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setUserSortBy(column);
      setUserSortOrder('asc');
    }
  };

  const handleSubSort = (column) => {
    if (subSortBy === column) {
      setSubSortOrder(subSortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSubSortBy(column);
      setSubSortOrder('asc');
    }
  };

  // ─────────────────────────────────────────────
  // Computed: filtered & sorted lists
  // ─────────────────────────────────────────────

  // Derive unified plan: premium | trade | trial | free | expired.
  // Used by both the Plan column and the plan filter.
  const getUserPlan = (u) => {
    if (!u) return 'free';
    if (u.trial_granted_by) return 'trial';
    if (u.subscription_source && !u.subscription_active) return 'expired';
    const t = u.subscription_tier;
    if (t === 'premium' || t === 'admin') return t === 'admin' ? 'premium' : 'premium';
    if (t === 'trade') return 'trade';
    return 'free';
  };

  const filteredUsers = users.filter(u => {
    // Phase 18 — hide test users unless explicitly opted in.
    if (u.is_test && !showTestUsers) return false;
    if (search) {
      const searchLower = search.toLowerCase();
      if (!(
        u.username?.toLowerCase().includes(searchLower) ||
        u.email?.toLowerCase().includes(searchLower) ||
        u.discord_username?.toLowerCase().includes(searchLower) ||
        u.discord_id?.includes(searchLower)
      )) return false;
    }
    if (userFilterRole !== 'all') {
      if (userFilterRole === 'owner' && !u.is_owner) return false;
      if (userFilterRole === 'admin' && (!u.is_admin || u.is_owner)) return false;
      if (userFilterRole === 'user' && u.is_admin) return false;
    }
    if (userFilterPlan !== 'all') {
      if (getUserPlan(u) !== userFilterPlan) return false;
    }
    // Legacy filters kept live for any lingering callers; UI no longer shows them.
    if (userFilterTier !== 'all') {
      const tier = u.subscription_tier || 'free';
      if (userFilterTier === 'free' && tier !== 'free') return false;
      if (userFilterTier !== 'free' && tier !== userFilterTier) return false;
    }
    if (userFilterSub !== 'all') {
      if (userFilterSub === 'active' && !u.subscription_active) return false;
      if (userFilterSub === 'expired' && (!u.subscription_source || u.subscription_active)) return false;
      if (userFilterSub === 'none' && u.subscription_source) return false;
    }
    return true;
  }).sort((a, b) => {
    const dir = userSortOrder === 'asc' ? 1 : -1;
    switch (userSortBy) {
      case 'username': return dir * (a.username || '').localeCompare(b.username || '');
      case 'role': {
        const roleRank = (u) => u.is_owner ? 2 : u.is_admin ? 1 : 0;
        return dir * (roleRank(a) - roleRank(b));
      }
      case 'tier': {
        const tierRank = { premium: 3, admin: 3, trade: 2, free: 1 };
        return dir * ((tierRank[a.subscription_tier] || 0) - (tierRank[b.subscription_tier] || 0));
      }
      case 'created_at': return dir * (new Date(a.created_at || 0) - new Date(b.created_at || 0));
      case 'subscription_end': {
        // Nulls always sort to the bottom regardless of direction so users
        // without a subscription don't dominate the top of "soonest expiring".
        const aT = a.subscription_end ? new Date(a.subscription_end).getTime() : null;
        const bT = b.subscription_end ? new Date(b.subscription_end).getTime() : null;
        if (aT === null && bT === null) return 0;
        if (aT === null) return 1;
        if (bT === null) return -1;
        return dir * (aT - bT);
      }
      default: return 0;
    }
  });

  const filteredSubscribers = subscribers.filter(s => {
    if (search) {
      const searchLower = search.toLowerCase();
      if (!(
        s.discord_username?.toLowerCase().includes(searchLower) ||
        s.discord_id?.includes(searchLower)
      )) return false;
    }
    if (subFilterTier !== 'all') {
      if ((s.subscription_tier || '') !== subFilterTier) return false;
    }
    if (subFilterStatus !== 'all') {
      const isExpired = new Date(s.subscription_end) < new Date();
      if (subFilterStatus === 'active' && isExpired) return false;
      if (subFilterStatus === 'expired' && !isExpired) return false;
    }
    return true;
  }).sort((a, b) => {
    const dir = subSortOrder === 'asc' ? 1 : -1;
    switch (subSortBy) {
      case 'discord_username': return dir * (a.discord_username || '').localeCompare(b.discord_username || '');
      case 'tier': {
        const tierRank = { premium: 2, trade: 1 };
        return dir * ((tierRank[a.subscription_tier] || 0) - (tierRank[b.subscription_tier] || 0));
      }
      case 'start': return dir * (new Date(a.subscription_start || 0) - new Date(b.subscription_start || 0));
      case 'end': return dir * (new Date(a.subscription_end || 0) - new Date(b.subscription_end || 0));
      case 'status': {
        const now = new Date();
        const aExp = new Date(a.subscription_end) < now ? 1 : 0;
        const bExp = new Date(b.subscription_end) < now ? 1 : 0;
        return dir * (aExp - bExp);
      }
      default: return 0;
    }
  });

  const filteredHuntParticipants = huntParticipants.filter(p => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      p.discord_username?.toLowerCase().includes(searchLower) ||
      p.discord_id?.includes(searchLower) ||
      p.packs?.some(pk => pk.pack_name?.toLowerCase().includes(searchLower))
    );
  });

  // ─────────────────────────────────────────────
  // Mutation handlers (API calls + loadData)
  // ─────────────────────────────────────────────

  const handleToggleActive = async (userId, currentIsActive) => {
    try {
      const result = await adminApi.toggleActive(userId, !currentIsActive);
      if (result.success) {
        setSuccess(result.message);
        refreshUsers();
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError(`Failed to update active status: ${err.message}`);
    }
  };

  const handleToggleHuntParticipant = async (discordId, packName, currentIsActive, accountType) => {
    const actionKey = `${discordId}_${packName}_${accountType || 'main'}`;
    try {
      setActionLoading(prev => ({ ...prev, [actionKey]: true }));
      const result = await adminApi.toggleHuntParticipant(discordId, packName, !currentIsActive, accountType);
      if (result.success) {
        setSuccess(result.message);
        refreshHuntParticipants();
      } else {
        setError(result.error || 'Failed to toggle hunt participant');
      }
    } catch (err) {
      setError(`Failed to toggle hunt participant: ${err.message}`);
    } finally {
      setActionLoading(prev => ({ ...prev, [actionKey]: false }));
    }
  };

  const fetchBotStatus = async (playerId, accountType = 'main', discordId = null) => {
    if (!playerId) return;
    const statusKey = `${playerId}_${accountType}`;
    try {
      setBotStatuses(prev => ({ ...prev, [statusKey]: { ...prev[statusKey], loading: true } }));
      const result = await adminApi.getBotStatus(playerId, accountType, discordId);
      if (result.success) {
        setBotStatuses(prev => ({
          ...prev,
          [statusKey]: {
            status: result.botStatus?.status,
            loading: false,
            accountId: result.accountId,
            userId: result.userId,
            username: result.username,
          }
        }));
        // Auto-fetch friend count when bot is running
        if (result.botStatus?.status === 'running') {
          fetchFriendCount(playerId, accountType);
        }
      } else {
        setBotStatuses(prev => ({
          ...prev,
          [statusKey]: { status: result.status || 'unknown', loading: false, message: result.message }
        }));
      }
    } catch (err) {
      setBotStatuses(prev => ({
        ...prev,
        [statusKey]: { status: 'error', loading: false, error: err.message }
      }));
    }
  };

  const handleStartBot = async (playerId, accountType = 'main', discordId = null) => {
    const statusKey = `${playerId}_${accountType}`;
    try {
      setBotStatuses(prev => ({ ...prev, [statusKey]: { ...prev[statusKey], loading: true } }));
      const result = await adminApi.startBot(playerId, accountType, discordId);
      if (result.success) {
        setSuccess(result.message);
        setTimeout(() => fetchBotStatus(playerId, accountType, discordId), 1000);
      } else {
        setError(result.error || 'Failed to start bot');
        setBotStatuses(prev => ({ ...prev, [statusKey]: { ...prev[statusKey], loading: false } }));
      }
    } catch (err) {
      setError(`Failed to start bot: ${err.message}`);
      setBotStatuses(prev => ({ ...prev, [statusKey]: { ...prev[statusKey], loading: false } }));
    }
  };

  const handleStopBot = async (playerId, accountType = 'main', discordId = null) => {
    const statusKey = `${playerId}_${accountType}`;
    try {
      setBotStatuses(prev => ({ ...prev, [statusKey]: { ...prev[statusKey], loading: true } }));
      const result = await adminApi.stopBot(playerId, accountType, discordId);
      if (result.success) {
        setSuccess(result.message);
        setTimeout(() => fetchBotStatus(playerId, accountType, discordId), 1000);
      } else {
        setError(result.error || 'Failed to stop bot');
        setBotStatuses(prev => ({ ...prev, [statusKey]: { ...prev[statusKey], loading: false } }));
      }
    } catch (err) {
      setError(`Failed to stop bot: ${err.message}`);
      setBotStatuses(prev => ({ ...prev, [statusKey]: { ...prev[statusKey], loading: false } }));
    }
  };

  const fetchFriendCount = async (playerId, accountType = 'main') => {
    if (!playerId) return;
    const statusKey = `${playerId}_${accountType}`;
    setFriendCounts(prev => ({ ...prev, [statusKey]: { ...prev[statusKey], loading: true } }));
    try {
      const result = await adminApi.getFriendCount(playerId, accountType);
      if (result.success) {
        setFriendCounts(prev => ({
          ...prev,
          [statusKey]: { count: result.friendCount, sent: result.sentCount, received: result.receivedCount, loading: false }
        }));
      } else {
        setFriendCounts(prev => ({ ...prev, [statusKey]: { count: null, loading: false } }));
      }
    } catch {
      setFriendCounts(prev => ({ ...prev, [statusKey]: { count: null, loading: false } }));
    }
  };

  // Load bot statuses when Hunt Participants tab is selected.
  // Phase 2 merged Users+Subscribers → Users is tab 0, Hunt Participants is tab 1.
  // Placed AFTER fetchBotStatus definition to avoid TDZ.
  useEffect(() => {
    if (tab === 1 && huntParticipants.length > 0) {
      const current = botStatusesRef.current;
      const seen = new Set();
      huntParticipants.forEach(p => {
        if (!p.player_id) return;
        const accountType = p.account_type || 'main';
        const statusKey = `${p.player_id}_${accountType}`;
        if (!seen.has(statusKey) && !current[statusKey]) {
          seen.add(statusKey);
          fetchBotStatus(p.player_id, accountType, p.discord_id);
        }
      });
    }
  }, [tab, huntParticipants, fetchBotStatus]);

  const handleRemoveSubscriber = async (discordUsername, discordId) => {
    try {
      // Phase 39.5 — pass discord_id as stable lookup key so the endpoint
      // can resolve the subscriber even when web_users.discord_username
      // carries the "#0" suffix the paid_subscribers row lacks.
      const result = await adminApi.removeSubscriber(discordUsername, discordId);
      if (result.success) {
        setSuccess('Subscriber removed successfully');
        refreshSubscribers();
      } else {
        setError(result.error || 'Failed to remove subscriber');
      }
    } catch (err) {
      setError(`Failed to remove subscriber: ${err.message}`);
    }
  };

  // ─────────────────────────────────────────────
  // Return everything the page needs
  // ─────────────────────────────────────────────

  return {
    // Core data
    loading,
    users,
    unregisteredSubs,
    userSummary,
    subscribers,
    huntParticipants,

    // UI state + setters
    tab, setTab,
    search, setSearch,
    error, setError,
    success, setSuccess,

    // User filter & sort
    userFilterRole, setUserFilterRole,
    userFilterPlan, setUserFilterPlan,
    hunterStateFilter, setHunterStateFilter,
    userFilterTier, setUserFilterTier,
    userFilterSub, setUserFilterSub,
    userSortBy, userSortOrder,
    handleUserSort,
    getUserPlan,

    // Subscriber filter & sort
    subFilterTier, setSubFilterTier,
    subFilterStatus, setSubFilterStatus,
    subSortBy, subSortOrder,
    handleSubSort,

    // Bot & friend state
    botStatuses,
    actionLoading,
    friendCounts,

    // Data issues
    dataIssues,
    dataIssuesExpanded, setDataIssuesExpanded,
    dataIssuesLoading,

    // Test-user toggle (Phase 18)
    showTestUsers, setShowTestUsers,

    // Computed filtered lists
    filteredUsers,
    filteredSubscribers,
    filteredHuntParticipants,

    // Data loading
    loadData,
    loadDataIssues,
    refreshUsers,
    refreshSubscribers,
    refreshHuntParticipants,

    // Mutation handlers
    handleToggleActive,
    handleToggleHuntParticipant,
    fetchBotStatus,
    handleStartBot,
    handleStopBot,
    fetchFriendCount,
    handleRemoveSubscriber,
  };
}
