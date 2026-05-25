/* ════════════════════════════════════════════════════════════════════
 * LAYOUT SYSTEM CHECKLIST  (REQUIRED reading for any UI change)
 * ════════════════════════════════════════════════════════════════════
 * Authoritative layout rules for the WebUI. Every layout change, new
 * page, new scroll container, and any mobile UI work MUST be validated
 * against this checklist BEFORE merge. Violations of this checklist
 * caused the cross-page mobile bottom-nav scroll bug; the rules below
 * exist so that class of bug never returns.
 *
 * Full reference: docs/layout-system.md
 * Source of truth for offset constants: components/MobileBottomNav.jsx
 * Source of truth for global rules: contexts/ThemeContext.jsx
 *   (cssBaselineOverrides — wired into both light + dark themes)
 *
 * ─────────────────────────────────────────────────────────────────────
 *  1. SINGLE SOURCE OF TRUTH FOR FIXED ELEMENTS
 *     - All fixed UI elements (bottom nav, headers, overlays) MUST
 *       expose shared constants.
 *     - No duplicated hard-coded values across files.
 *     - No magic numbers (96px, 72px, etc.).
 *     - All offsets MUST derive from exported constants + CSS variables.
 *
 *  2. MOBILE NAV OFFSET RULE
 *     - Always reserve space using `var(--mobile-nav-offset)`.
 *     - Must include: nav height + buffer + safe-area inset.
 *     - Never manually recreate this calculation in any page.
 *
 *  3. NO RAW 100vh USAGE
 *     - Do NOT use `height: 100vh` for page containers (breaks scroll
 *       + safe-area behavior). Use the layout shell, flex layout, or
 *       `minHeight: 100%`. `100dvh` on the OUTER shell only is allowed.
 *
 *  4. SHORT PAGE SAFETY
 *     - Pages must scroll correctly even if content is small/collapsed.
 *     - The shell guarantees `html, body, #root { height: 100% }` and
 *       `main { min-height: 100% }`. Never override these.
 *     - Never assume content height will create scroll.
 *
 *  5. SCROLL CONTAINER RULE
 *     - Default scroll = main / body.
 *     - If a component uses its own scroll, the inner overflow Box
 *       MUST add `data-scroll-container`. No exceptions.
 *
 *  6. SCROLL INTO VIEW SAFETY
 *     - All scroll containers MUST respect
 *       `scrollPaddingBottom: var(--mobile-nav-offset)`.
 *     - Already enforced globally for `main` and
 *       `[data-scroll-container]` in contexts/ThemeContext.jsx
 *       (cssBaselineOverrides). Don't re-set.
 *
 *  7. PAGE ROOT CONTRACT
 *     - Page root containers with bespoke max-width / column layout
 *       MUST use `data-page-root` to opt-in to the bottom reserve.
 *     - This is the ONLY place where bottom padding is applied at
 *       the page-root level.
 *
 *  8. NO GLOBAL CONTAINER OVERRIDES
 *     - NEVER apply layout padding/margin rules to `.MuiContainer-root`
 *       globally. Causes nested layout bugs (doubled padding inside
 *       wrapped containers). Drift-test enforces this.
 *
 *  9. SAFE AREA COMPLIANCE
 *     - Always use `env(safe-area-inset-bottom, 0px)`.
 *     - Must degrade cleanly on Android (env() returns 0px).
 *     - Must work in PWA standalone mode (viewport-fit=cover is set).
 *
 * 10. NO PER-PAGE HACKS
 *     - If a page needs extra spacing, INVESTIGATE root cause —
 *       do NOT add a `pb: 12` band-aid.
 *     - Fix goes into the shared layout system.
 *
 * 11. NESTED SCROLL AUDIT RULE
 *     - Any introduction of `overflow: 'auto' | 'scroll'` (Y axis)
 *       must be reviewed for: (a) correct container tagging,
 *       (b) no double-scroll conflict with body scroll.
 *
 * 12. FIXED ELEMENT COLLISION RULE
 *     - Any new fixed UI element must declare its size + integrate
 *       with the layout offset chain. Never "float above" content
 *       without offset consideration.
 *
 * 13. TEST + VALIDATION RULE
 *     Every layout change must verify:
 *       - last element fully visible above nav
 *       - collapsed sections still scrollable
 *       - short pages scroll correctly
 *       - scrollIntoView lands above nav
 *       - mobile + desktop both clean
 *     Run `node tests/mobileBottomNavOffset.test.js` before merge.
 * ════════════════════════════════════════════════════════════════════
 */
import { useState, useEffect, lazy, Suspense } from 'react'
import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import {
  Box,
  Typography,
  useMediaQuery,
  useTheme,
  CircularProgress,
} from '@mui/material'
import {
  Home as HomeIcon,
  Link as LinkIcon,
  SmartToy as BotIcon,
  CheckCircle as TaskIcon,
  CatchingPokemon as PokeballIcon,
  Style as StyleIcon,
  Checklist as ChecklistIcon,
  CardGiftcard as PackIcon,
  Redeem as GiftIcon,
  People as PeopleIcon,
  Speed as SpeedIcon,
  Star as StarIcon,
  Analytics as AnalyticsIcon,
  SportsEsports as BattleIcon,
  SwapHoriz as TradeIcon,
  Inventory as InventoryIcon,
  Schedule as ScheduleIcon,
  AutoAwesome as WonderIcon,
  AdminPanelSettings as AdminIcon,
  Description as LogIcon,
  LocalFireDepartment as StaminaIcon,
  ShoppingCart as ShopIcon,
  EmojiEvents as AchievementIcon,
  Event as EventIcon,
  AccountBalanceWallet as WalletIcon,
  FavoriteBorder as WishlistIcon,
  Settings as SettingsIcon,
  MonitorHeart as HealthIcon,
  // 2026-04-20 Phase 3 UX polish — distinct admin icons so adjacent
  // items don't all share HealthIcon and blur into each other.
  Shield as ShieldIcon,
  Storage as StorageIcon,
  Insights as InsightsIcon,
  Restore as RestoreIcon,
} from '@mui/icons-material'
import { useThemeMode } from './contexts/ThemeContext'
import { useLanguage } from './contexts/LanguageContext'
import { AccountProvider } from './contexts/AccountContext'
import { OverlayProvider, OverlayBridge } from './contexts/OverlayContext'
import { auth } from './services/api'
import { initBotSocket, disconnectSocket } from './services/socket'
import GlobalActivityBridge from './components/GlobalActivityBridge'
import GlobalStatusBar from './components/GlobalStatusBar'
import { HuntStatsProvider } from './contexts/HuntStatsContext'

// Pages - Critical (loaded immediately)
import Login from './pages/Login'
// Phase 5.0 — public marketing landing page. Eager-imported (small,
// no auth dependency) so unauthenticated visitors don't pay the
// lazy-chunk hop on first paint.
import ApexTerminalLanding from './pages/ApexTerminalLanding'
import Dashboard from './pages/Dashboard'

// Auto-retry on chunk load failure (stale cache after deploy).
//
// When Vite rebuilds, old chunk filenames become invalid. Old clients
// can still be caching HTML that references those purged chunks. On iOS
// PWA this is especially bad because the service worker aggressively
// caches — a simple reload may re-serve the same stale HTML.
//
// Wave 9.1: three-stage recovery instead of one-shot retry:
//   Attempt 1: normal reload (fast path — works for most browsers)
//   Attempt 2: unregister SW + drop all caches + hard reload (breaks
//              the stale-HTML loop for iOS PWA)
//   Attempt 3 onward: surface the error to the ErrorBoundary, which
//              shows the "Refresh / Go Home" fallback. No more retries.
//
// Counter lives in sessionStorage so reloads don't infinite-loop.
const lazyRetry = (importFn) => lazy(() =>
  importFn().catch(async (err) => {
    const attempts = parseInt(sessionStorage.getItem('chunk_reload_attempts') || '0', 10)
    if (attempts === 0) {
      sessionStorage.setItem('chunk_reload_attempts', '1')
      window.location.reload()
      return new Promise(() => {})
    }
    if (attempts === 1) {
      // Nuclear option: unregister SW + drop all caches, THEN reload.
      // This fixes the iOS-PWA-stale-HTML-pointing-to-deleted-chunks case.
      sessionStorage.setItem('chunk_reload_attempts', '2')
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations()
          await Promise.all(regs.map(r => r.unregister()))
        }
        if ('caches' in window) {
          const keys = await caches.keys()
          await Promise.all(keys.map(k => caches.delete(k)))
        }
      } catch {}
      window.location.reload()
      return new Promise(() => {})
    }
    // Attempts >= 2: reset counter, let ErrorBoundary show.
    sessionStorage.removeItem('chunk_reload_attempts')
    throw err
  })
)

// Pages - Lazy loaded for better initial performance
const AccountLink = lazyRetry(() => import('./pages/AccountLink'))
const Bot = lazyRetry(() => import('./pages/Bot'))
const BotHub = lazyRetry(() => import('./pages/BotHub'))
const Missions = lazyRetry(() => import('./pages/Missions'))
const CollectionMissions = lazyRetry(() => import('./pages/CollectionMissions'))

const Cards = lazyRetry(() => import('./pages/Cards'))
const Tracker = lazyRetry(() => import('./pages/Tracker'))
const OpenPack = lazyRetry(() => import('./pages/OpenPack'))
const WonderPick = lazyRetry(() => import('./pages/WonderPick'))
const Friends = lazyRetry(() => import('./pages/Friends'))
const NintendoCallback = lazyRetry(() => import('./pages/NintendoCallback'))
const HuntMonitor = lazyRetry(() => import('./pages/HuntMonitor'))
const HuntSettings = lazyRetry(() => import('./pages/HuntSettings'))
const GodPackGallery = lazyRetry(() => import('./pages/GodPackGallery'))
const AccountAnalytics = lazyRetry(() => import('./pages/AccountAnalytics'))
// 2026-04-24 — Account Pool truth-table merged into AdminFleetHealth
// (Operations > Fleet Status). No standalone route — drill-down lives
// where admins land first when "fleet not making packs".
const BattleHistory = lazyRetry(() => import('./pages/BattleHistory'))
const Battles = lazyRetry(() => import('./pages/Battles'))
const SoloBattle = lazyRetry(() => import('./pages/SoloBattle'))
const EventBattle = lazyRetry(() => import('./pages/EventBattle'))
const RandomBattle = lazyRetry(() => import('./pages/RandomBattle'))
// SystemHealth removed — merged into Admin Dashboard
const AutomationScheduler = lazyRetry(() => import('./pages/AutomationScheduler'))
const PresentBox = lazyRetry(() => import('./pages/PresentBox'))
const CardRequest = lazyRetry(() => import('./pages/CardRequest'))
const Settings = lazyRetry(() => import('./pages/Settings'))
// DailyScheduler removed — unused
const Profile = lazyRetry(() => import('./pages/Profile'))
const Admin = lazyRetry(() => import('./pages/Admin'))
const AdminUsers = lazyRetry(() => import('./pages/AdminUsers'))
const AdminFleetHealth = lazyRetry(() => import('./pages/AdminFleetHealth'))
// Phase 26 Stage 1 — drift detector dashboard.
const AdminTrust = lazyRetry(() => import('./pages/AdminTrust'))
const DevDesignSystem = lazyRetry(() => import('./pages/DevDesignSystem'))
const HuntConfig = lazyRetry(() => import('./pages/HuntConfig'))
const Observability = lazyRetry(() => import('./pages/Observability'))
const HuntBots = lazyRetry(() => import('./pages/HuntBots'))
// Phase 19 — Data Health Engine admin panel.
const AdminHealth = lazyRetry(() => import('./pages/admin/AdminHealth'))
// Apr 2026 — Hunt Ops admin page. Hosts Recovery Status + Live Pack
// Retention panels relocated from Hunt Monitor.
const HuntOps = lazyRetry(() => import('./pages/admin/HuntOps'))
// 2026-04-20 — System Integrity Dashboard. Admin-only integrity-first
// monitoring for Gift + Trade systems. Reads /api/admin/integrity/overview.
const SystemIntegrity = lazyRetry(() => import('./pages/admin/SystemIntegrity'))
// 2026-04-28 — Capacity Verdict (Hunt-5 readiness). Read-only admin page.
const CapacityVerdict = lazyRetry(() => import('./pages/admin/CapacityVerdict'))
// Phase 34 — Mission Debug Panel (admin-only, read-only).
const MissionDebug = lazyRetry(() => import('./pages/admin/MissionDebug'))
// 2026-05-03 — Gold Flair Trade page (Collection group, premium+admin only).
// File still lives under pages/admin/ to avoid breaking the import path.
const ManualGoldFlairTrade = lazyRetry(() => import('./pages/admin/ManualGoldFlairTrade'))
// Wave B — AutoGift renamed to SharingCards. /auto-gift redirects to
// /sharing-cards for backward compatibility with existing bookmarks.
// Hybrid Control restored — migrations 031 (hunt_assignment_metadata) and
// 032 (hunt_assignment_audit) were applied 2026-04-14; `pinned`,
// `assignment_mode`, `last_moved_at`, `moved_by` now exist in postgres.
const HybridControl = lazyRetry(() => import('./pages/HybridControl'))
// LogViewer removed — merged into TeamLogs as "System Logs" tab
const AuditLog = lazyRetry(() => import('./pages/AuditLog'))
const SystemHealth = lazyRetry(() => import('./pages/SystemHealth'))
const StaminaDashboard = lazyRetry(() => import('./pages/StaminaDashboard'))
const ItemShop = lazyRetry(() => import('./pages/ItemShop'))
const PvpRankings = lazyRetry(() => import('./pages/PvpRankings'))
const Achievements = lazyRetry(() => import('./pages/Achievements'))
const Events = lazyRetry(() => import('./pages/Events'))
const ResourceDashboard = lazyRetry(() => import('./pages/ResourceDashboard'))
const BattleStats = lazyRetry(() => import('./pages/BattleStats'))
const TradeAnalytics = lazyRetry(() => import('./pages/TradeAnalytics'))
const SharingCards = lazyRetry(() => import('./pages/SharingCards'))
const Wishlist = lazyRetry(() => import('./pages/Wishlist'))
const HelpCenter = lazyRetry(() => import('./pages/HelpCenter'))
const TeamLogs = lazyRetry(() => import('./pages/TeamLogs'))

// Components
// QuickActionsFAB removed — actions duplicated the sidebar nav and one
// action ("Sync Collection") was permanently dead (no onSync wired).
import ErrorBoundary from './components/ErrorBoundary'
import Breadcrumbs from './components/Breadcrumbs'
import CommandPalette from './components/CommandPalette'
import MobileBottomNav, {
  MOBILE_BOTTOM_NAV_HEIGHT_PX,
  MOBILE_BOTTOM_NAV_BUFFER_PX,
} from './components/MobileBottomNav'
import useIsMobileDevice from './hooks/useIsMobileDevice'
import { OfflineBanner } from './components/OfflineBanner'
import { OnboardingWizard, useOnboarding } from './components/OnboardingWizard'
import { SocketProvider } from './contexts/SocketContext'
import TierGuard from './components/TierGuard'
import { motion, useReducedMotion } from 'framer-motion'
import Sidebar, { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED } from './components/Sidebar'
import TopBar from './components/TopBar'
import DebugStrip from './components/DebugStrip'

function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [sidebarExpanded, setSidebarExpanded] = useState(true)
  const navigate = useNavigate()
  const location = useLocation()
  const { isDark, toggleTheme } = useThemeMode()
  const prefersReducedMotion = useReducedMotion()
  const { t } = useLanguage()
  const theme = useTheme()
  const isDesktopViewport = useMediaQuery(theme.breakpoints.up('lg'))
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg'))
  const isMobileViewport = useMediaQuery(theme.breakpoints.down('md'))
  // Phase 24 Part 2 — physical-device detection (touch + pointer +
  // narrow-physical). A phone in "Request Desktop Site" mode reports a
  // lg viewport but is physically tiny; this hook catches it.
  const isPhysicalMobile = useIsMobileDevice()
  // Effective mobile = viewport mobile OR physical mobile. Desktop gate
  // flips off when EITHER signal says "touch device" — we don't want a
  // phone-in-desktop-mode user stuck with a permanent sidebar.
  const isMobile = isMobileViewport || isPhysicalMobile
  const isDesktop = isDesktopViewport && !isPhysicalMobile

  // IMPORTANT: All hooks must be called before any conditional returns
  const { showOnboarding, setShowOnboarding } = useOnboarding()
  // NOTE: Wave D will add a max-width:900px physical-viewport media query
  // here to force the mobile bottom nav visible even when MUI breakpoints
  // report `lg` (phone-in-desktop-mode). The prior "auto-open drawer on
  // first load" trick did NOT satisfy the request and has been removed.

  // Wave 9.1: once the app has successfully mounted, reset the chunk-retry
  // counter so a later deploy can retry cleanly instead of short-circuiting
  // straight to the cache-nuke path.
  useEffect(() => {
    try { sessionStorage.removeItem('chunk_reload_attempts') } catch {}
  }, [])

  useEffect(() => {
    if (auth.isLoggedIn()) {
      auth.getMe()
        .then((data) => {
          if (data.user) {
            setUser(data.user)
            // Main socket is now owned by <SocketProvider> below (Wave 2).
            // Only the bot-manager socket (separate proxied endpoint) is
            // still managed via the legacy service.
            initBotSocket(data.user.id)
            // Trade/gift → activity store wiring moved into
            // <GlobalActivityBridge>, rendered inside <SocketProvider>
            // so it can use useSocketEvent against the canonical socket
            // without racing the connect handshake.
          }
        })
        .catch(() => {
          auth.clearToken?.()
        })
        .finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [])

  const handleLogout = async () => {
    await auth.logout()
    disconnectSocket()
    setUser(null)
    navigate('/login')
  }

  // Helper: check if user tier has access
  const userTier = user?.subscriptionTier || 'free'
  const hasTier = (...tiers) => userTier === 'admin' || tiers.includes(userTier)

  // Grouped navigation structure with tier-based visibility
  const allNavGroups = [
    {
      id: 'home',
      text: t('nav.home'),
      icon: <HomeIcon />,
      color: '#7C8AFF',
      path: hasTier('premium') ? '/' : '/cards',
      tiers: ['trade', 'premium'],
    },
    {
      id: 'hunt',
      text: t('nav.hunt'),
      icon: <SpeedIcon />,
      color: '#34D399',
      tiers: ['premium'],
      items: [
        { text: t('nav.huntMonitor'), icon: <SpeedIcon />, path: '/hunt', color: '#34D399' },
        { text: t('nav.godpacks'), icon: <StarIcon />, path: '/godpacks', color: '#FBBF24' },
        { text: 'Bot Hub', icon: <BotIcon />, path: '/bot-hub', color: '#22D3EE' },
        // 2026-04-20 IA cleanup (Commit 1): Wishlist moved to Collection.
        { text: t('nav.friends'), icon: <PeopleIcon />, path: '/friends', color: '#7C8AFF' },
        { text: t('nav.wonderPick'), icon: <WonderIcon />, path: '/wonder-pick', color: '#A78BFA' },
        // 2026-04-20 Phase 2: Accounts relocated to the top-right profile
        // menu (TopBar). Users reach it via their avatar → My Accounts.
        // Rationale: linking device / game accounts is an onboarding /
        // profile action, not a hunt action. Route (/accounts) preserved.
      ],
    },
    {
      id: 'collection',
      text: t('nav.collection'),
      icon: <InventoryIcon />,
      color: '#A78BFA',
      tiers: ['trade', 'premium'],
      items: [
        // 2026-04-20 Phase 3 UX polish — "Cards" → "My Cards" for
        // plain ownership cue (first-person scopes the collection).
        { text: 'My Cards', icon: <StyleIcon />, path: '/cards', color: '#A78BFA' },
        { text: t('nav.tracker'), icon: <ChecklistIcon />, path: '/tracker', color: '#34D399', tiers: ['premium'] },
        // 2026-04-20 IA cleanup (Commit 1): Wishlist relocated here from
        // Hunt — users set it while reviewing their collection gaps.
        { text: 'Wishlist', icon: <WishlistIcon />, path: '/wishlist', color: '#EC4899' },
        // 2026-04-20 IA cleanup (Commit 1): "Trade Cards" + "Sharing Cards"
        // renamed to "Trade" + "Gift" so their distinct purpose is
        // obvious at a glance. URLs unchanged (/card-request + /sharing-cards).
        // Two flat items = the "tabs or equivalent" separation requested
        // without a page-level component change.
        { text: 'Trade', icon: <TradeIcon />, path: '/card-request', color: '#34D399' },
        { text: 'Gift',  icon: <GiftIcon />,  path: '/sharing-cards', color: '#F59E0B' },
        // Trade-pass + premium. Bot sends friend + trade proposal with gold
        // flair attached; user accepts in-game (manual mode for everyone).
        { text: 'Gold Flair Trade', icon: <InsightsIcon />, path: '/collection/gold-flair-trade', color: '#FFB300', tiers: ['trade', 'premium'] },
      ],
    },
    {
      id: 'battle',
      text: t('nav.battle'),
      icon: <BattleIcon />,
      path: '/battles',
      color: '#F87171',
      tiers: ['premium'],
    },
    {
      // 2026-04-20 IA cleanup (Commit 1): "Activities" → "Play".
      // The label "Activities" was overloaded (any user can think of
      // friends/trades/hunts as activities). "Play" cleanly scopes
      // this group to in-game actions (open pack, run missions, claim
      // presents, buy shop items, etc.). i18n key preserved for
      // back-compat; hard-coded label wins here.
      id: 'activities',
      text: 'Play',
      icon: <TaskIcon />,
      color: '#F59E0B',
      tiers: ['premium'],
      items: [
        // 2026-04-20 Phase 3 UX polish — "Missions" → "Daily Missions"
        // so users immediately know the cadence (vs. one-off Presents).
        { text: 'Daily Missions', icon: <TaskIcon />, path: '/missions', color: '#F59E0B' },
        { text: t('nav.presents'), icon: <GiftIcon />, path: '/presents', color: '#F87171' },
        { text: t('nav.openPack'), icon: <PackIcon />, path: '/open-pack', color: '#34D399' },
        // 2026-04-20 Phase 2: low-frequency items collapse under Wallet
        // so Play stays scannable. 2nd-level nesting now supported by
        // the Sidebar component (see renderNavItem). URLs unchanged.
        {
          text: 'Wallet',
          icon: <WalletIcon />,
          color: '#FBBF24',
          items: [
            { text: t('nav.stamina') || 'Stamina',           icon: <StaminaIcon />,     path: '/stamina',      color: '#34D399' },
            { text: t('nav.itemShop') || 'Item Shop',        icon: <ShopIcon />,        path: '/shop',         color: '#60A5FA' },
            { text: t('nav.achievements') || 'Achievements', icon: <AchievementIcon />, path: '/achievements', color: '#FBBF24' },
            { text: t('nav.resourceDashboard') || 'Resources', icon: <WalletIcon />,    path: '/resources',    color: '#FBBF24' },
          ],
        },
      ],
    },
    // 2026-04-20 IA cleanup (Commit 2) — admin sidebar regrouped from
    // 6 top-level entries (Fleet Health · Trust · Hunts · Users ·
    // Audit & Logs · Diagnostics) down to 4 verb-first groups:
    //
    //   Operations   "is it running?"   (Fleet · Operations Recovery)
    //   Hunts        "run the fleet"    (Hunters · Config · Scheduler · Bots · Hybrid)
    //   Integrity    "is it honest?"    (Dashboard · Data Health · Drift · Account Health)
    //   Platform     "who did what"     (Users · Observability · Audit Log · Activity Logs)
    //
    // Every URL is preserved — this is purely a sidebar shuffle.
    //
    // Hunts is kept as its own top-level group (rather than nested
    // under Operations as the original plan called for) because the
    // Sidebar component only supports one level of nesting. Inlining
    // all 5 hunt-admin items into Operations would overflow it to 7+
    // entries. 4 top-level groups with healthy child counts is the
    // cleaner outcome without a component change.
    //
    // Renames in this commit (all sidebar labels only — routes intact):
    //   "Hunt Ops"      → "Operations Recovery"  (→ /admin/hunt-ops)
    //   "System Health" → "Data Health"          (→ /admin/health)
    //   "Trust"         → "Drift"                (→ /admin/trust)
    ...(user?.isAdmin ? [
      {
        id: 'admin-operations',
        text: 'Operations',
        icon: <HealthIcon />,
        color: '#22c55e',
        tiers: ['admin'],
        items: [
          // 2026-04-20 Phase 3 UX polish — "Fleet" → "Fleet Status".
          // Signals the page answers "is the fleet running right now?"
          { text: 'Fleet Status',         icon: <HealthIcon />, path: '/admin/fleet',    color: '#22c55e' },
          // 2026-04-20 Phase 2 — Hunts (admin) nested inside Operations.
          // Sidebar component now supports a second nesting level via
          // renderNavItem. Admin top-level goes 4 → 3 (Operations,
          // Integrity, Platform), matching the approved 3-verb model.
          {
            text: 'Hunts',
            icon: <SpeedIcon />,
            color: '#FF9800',
            items: [
              { text: 'Hunters',        icon: <PeopleIcon />,   path: '/admin/users?tab=hunters', color: '#FF9800' },
              { text: 'Hunt Config',    icon: <SettingsIcon />, path: '/admin/hunt-config',       color: '#FF9800' },
              { text: 'Scheduler',      icon: <ScheduleIcon />, path: '/admin/scheduler',         color: '#A78BFA' },
              { text: 'Hunt Bots',      icon: <SpeedIcon />,    path: '/admin/hunt-bots',         color: '#34d399' },
              { text: 'Hybrid Control', icon: <SpeedIcon />,    path: '/admin/hybrid-control',    color: '#8B5CF6' },
            ],
          },
          // 2026-04-20 Phase 3 UX polish — swapped HealthIcon for
          // RestoreIcon so "Recovery" reads at a glance.
          { text: 'Operations Recovery',  icon: <RestoreIcon />, path: '/admin/hunt-ops', color: '#a78bfa' },
          // 2026-04-28 — Capacity Verdict (Hunt-5 readiness, read-only).
          { text: 'Capacity Verdict',     icon: <SpeedIcon />,   path: '/admin/capacity', color: '#06b6d4' },
        ],
      },
      {
        id: 'admin-integrity',
        text: 'Integrity',
        // 2026-04-20 Phase 3 UX polish — group icon now matches its
        // primary child (shield for integrity).
        icon: <ShieldIcon />,
        color: '#22c55e',
        tiers: ['admin'],
        items: [
          // 2026-04-20 — System Integrity Dashboard. Gift + Trade truthfulness.
          // Phase 3 polish: "Dashboard" → "Integrity Dashboard" so the
          // label stands alone if a user bookmarks it.
          { text: 'Integrity Dashboard', icon: <ShieldIcon />,   path: '/admin/integrity',     color: '#22c55e' },
          // Phase 19 — Data Health Engine. Phase 3 icon swap → StorageIcon
          // to differentiate from Fleet Status / Account Health.
          { text: 'Data Health',         icon: <StorageIcon />,  path: '/admin/health',        color: '#F59E0B' },
          // Phase 26 Stage 1 — drift detector dashboard. Phase 3:
          // "Drift" → "Drift Detection" + Insights icon.
          { text: 'Drift Detection',     icon: <InsightsIcon />, path: '/admin/trust',         color: '#a855f7' },
          // User-scoped executor health (trade/gift/battle) for the
          // viewer's own device accounts.
          { text: 'Account Health',      icon: <HealthIcon />,   path: '/admin/system-health', color: '#34d399' },
        ],
      },
      {
        id: 'admin-platform',
        text: 'Platform',
        icon: <PeopleIcon />,
        color: '#7C8AFF',
        tiers: ['admin'],
        items: [
          { text: 'Users',         icon: <PeopleIcon />, path: '/admin/users',         color: '#7C8AFF' },
          { text: 'Observability', icon: <SpeedIcon />,  path: '/admin/observability', color: '#26c6da' },
          { text: 'Audit Log',     icon: <LogIcon />,    path: '/admin/audit-log',     color: '#7C8AFF' },
          { text: 'Activity Logs', icon: <LogIcon />,    path: '/admin/activity-logs', color: '#F59E0B' },
        ],
      },
    ] : []),
  ]

  // Filter nav groups by user tier. All admin-* groups are admin-gated;
  // the prefix check preserves the previous `g.id === 'admin'` bypass.
  const navGroups = allNavGroups.filter(
    g => g.id.startsWith('admin') || hasTier(...(g.tiers || []))
  )

  // Compute sidebar width for layout offset
  const currentSidebarWidth = isDesktop
    ? (sidebarExpanded ? SIDEBAR_WIDTH : SIDEBAR_COLLAPSED)
    : 0

  if (loading) {
    return (
      <Box sx={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: isDark
          ? `linear-gradient(135deg, ${theme.palette.background.default} 0%, #111827 50%, #0F172A 100%)`
          : `linear-gradient(135deg, #F0F2F8 0%, #F8F9FC 50%, #EEF0F6 100%)`,
      }}>
        <Box sx={{ textAlign: 'center' }}>
          <PokeballIcon sx={{ fontSize: 64, color: theme.palette.primary.main, animation: 'spin 1s linear infinite' }} />
          <Typography sx={{ mt: 2, color: 'text.secondary' }}>Loading...</Typography>
        </Box>
        <style>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </Box>
    )
  }

  // Public routes (login)
  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<Login onLogin={setUser} />} />
        {/* Phase 5.0 — public marketing landing page. Lives outside
            the auth gate so it's shareable and discoverable without
            a session. Routes registered both here and in the auth'd
            block below so signed-in visitors can also navigate to
            the landing without being redirected to dashboard. */}
        <Route path="/apex-terminal" element={<ApexTerminalLanding />} />
        <Route path="/landing"        element={<Navigate to="/apex-terminal" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  // Protected routes
  return (
    <SocketProvider userId={user?.id}>
    {/* Wire global trade/gift events into the activity store.
        Renders no UI; must live inside SocketProvider so it can subscribe. */}
    <GlobalActivityBridge />
    <HuntStatsProvider enabled={!!user}>
    <AccountProvider>
    <OverlayProvider>
      <Box sx={{
        display: 'flex',
        minHeight: '100dvh',
        // Phase 25D edge hardening: clip any accidental horizontal
        // overflow from deeply-nested layouts so mobile Safari's
        // rubber-band scroll doesn't reveal white strips on the right
        // edge when a component widens past the viewport.
        overflowX: 'hidden',
        maxWidth: '100vw',
        // ── Mobile bottom-nav offset (single source of truth) ──
        // The fixed MobileBottomNav (and its safe-area Box) overlay
        // the bottom of the viewport on screens below `md`. Every
        // page that touches the bottom of the viewport must reserve
        // this much space so the last visible control isn't trapped
        // under the nav. Consumed below as `pb`, by the theme's
        // CssBaseline rules (scroll-padding-bottom on main + opt-in
        // [data-scroll-container]), and by [data-page-root] on page
        // wrappers that have their own bespoke max-width.
        //
        //   isMobile  → height + buffer + iOS safe-area
        //   md+       → 0px (no extra bottom space on desktop)
        '--mobile-nav-offset': isMobile
          ? `calc(${MOBILE_BOTTOM_NAV_HEIGHT_PX}px + ${MOBILE_BOTTOM_NAV_BUFFER_PX}px + env(safe-area-inset-bottom, 0px))`
          : '0px',
      }}>
      {/* Offline Banner */}
      <OfflineBanner />

      {/* Onboarding Wizard for first-time users */}
      <OnboardingWizard
        open={showOnboarding}
        onClose={() => setShowOnboarding(false)}
      />

      {/* Sidebar - Desktop: permanent, Tablet: temporary drawer */}
      {isDesktop && (
        <Sidebar
          navGroups={navGroups}
          user={user}
          hasTier={hasTier}
          variant="permanent"
          onExpandedChange={setSidebarExpanded}
        />
      )}
      {(isTablet || isMobile) && (
        <Sidebar
          navGroups={navGroups}
          user={user}
          hasTier={hasTier}
          variant="temporary"
          mobileOpen={mobileOpen}
          onClose={() => setMobileOpen(false)}
        />
      )}

      {/* Phase 25D — bridge the sidebar's local mobileOpen state to
          OverlayContext. When the user opens Notifications while the
          sidebar was open, this bridge auto-closes the sidebar (and
          vice versa) so two side-drawers never coexist on mobile. */}
      <OverlayBridge
        name="sidebar"
        isOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />

      {/* Global Status Bar — persistent 32px bar at top of every page */}
      <GlobalStatusBar user={user} />

      {/* TopBar — shifted down by 32px for status bar */}
      <TopBar
        user={user}
        onLogout={handleLogout}
        onMenuToggle={() => setMobileOpen(true)}
        showMenuButton={!isDesktop}
        sidebarWidth={currentSidebarWidth}
        statusBarOffset={32}
      />

      {/* Main Content — top padding = base spacer + iOS notch inset.
          pt previously was a flat 12/13 (96/104px) which worked in
          normal browser mode but left content under the notch when
          the app is installed as a PWA on a device with a dynamic
          island / notch. env(safe-area-inset-top) resolves to 0 in
          browser chrome and to the physical inset in standalone mode,
          so this change adds no vertical gap where none is needed. */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          pt: {
            xs: 'calc(96px + env(safe-area-inset-top, 0px))',
            sm: 'calc(104px + env(safe-area-inset-top, 0px))',
          },
          // Bottom inset = the canonical --mobile-nav-offset CSS
          // variable defined on the outer shell. Single source of
          // truth: changing nav height or buffer in MobileBottomNav.jsx
          // automatically propagates here (no magic-number drift).
          //
          // 2026-04-19: switched from breakpoint-keyed object
          // ({xs: 'var(--mobile-nav-offset)', sm: 4}) to the JS
          // isMobile ternary because the bottom nav can render at
          // wide viewports too (touchscreen laptops trigger
          // isPhysicalMobile via navigator.maxTouchPoints — see
          // useIsMobileDevice.js). On those devices the sm+
          // breakpoint kept pb at 32px while the nav was 96px tall,
          // hiding the last list row / pagination behind the nav.
          // Tying pb to the same isMobile signal that gates the nav
          // means whenever the nav renders, main reserves the full
          // offset — and desktop without touch still gets the
          // original 32px breathing space.
          pb: isMobile ? 'var(--mobile-nav-offset)' : 4,
          px: { xs: 1.5, sm: 2, md: 3 },
          // Wave 10: maxWidth must NOT constrain mobile. Was `1400` flat
          // which capped pages at 1400 even on a phone — fine in practice
          // because viewport is smaller, but breaks responsive intent.
          maxWidth: { xs: '100%', md: 1400 },
          mx: 'auto',
          minHeight: '100dvh',
          width: isDesktop ? `calc(100% - ${currentSidebarWidth}px)` : '100%',
          transition: 'width 0.2s ease',
        }}
      >
        <ErrorBoundary>
        <Suspense fallback={
          <Box sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '50vh', gap: 2 }}>
            <PokeballIcon sx={{ fontSize: 40, color: 'primary.main', animation: 'spin 1s linear infinite' }} />
            <Typography variant="body2" color="text.secondary">Loading page...</Typography>
          </Box>
        }>
        <motion.div
          key={location.pathname}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2, ease: 'easeOut' }}
        >
        <Breadcrumbs />
        <Routes>
          {/* Default route: trade tier goes to cards, premium/admin to dashboard */}
          <Route path="/" element={
            hasTier('premium') ? <Dashboard user={user} /> : <Navigate to="/cards" replace />
          } />

          {/* Phase 5.0 — public landing page reachable from inside an
              authenticated session as well, so marketing links shared
              by signed-in users still resolve. CTAs on the landing
              fall through to "/" which the route above honors. */}
          <Route path="/apex-terminal" element={<ApexTerminalLanding />} />
          <Route path="/landing"        element={<Navigate to="/apex-terminal" replace />} />

          {/* Trade-accessible routes (trade + premium + admin) */}
          <Route path="/cards" element={<TierGuard user={user} allowedTiers={['trade', 'premium']}><Cards /></TierGuard>} />
          <Route path="/tracker" element={<TierGuard user={user} allowedTiers={['trade', 'premium']}><Tracker user={user} /></TierGuard>} />
          <Route path="/collection-missions" element={<TierGuard user={user} allowedTiers={['trade', 'premium']}><CollectionMissions user={user} /></TierGuard>} />
          <Route path="/card-request" element={<TierGuard user={user} allowedTiers={['trade', 'premium']}><CardRequest user={user} /></TierGuard>} />
          <Route path="/wishlist" element={<TierGuard user={user} allowedTiers={['premium']}><Wishlist /></TierGuard>} />
          {/* Wave B — canonical Sharing Cards route */}
          <Route path="/sharing-cards" element={<TierGuard user={user} allowedTiers={['trade', 'premium']}><SharingCards user={user} /></TierGuard>} />
          {/* Legacy bookmarks: /auto-gift → /sharing-cards (302 equivalent) */}
          <Route path="/auto-gift" element={<Navigate to="/sharing-cards" replace />} />
          <Route path="/accounts" element={<TierGuard user={user} allowedTiers={['trade', 'premium']}><AccountLink user={user} /></TierGuard>} />
          <Route path="/profile" element={<TierGuard user={user} allowedTiers={['trade', 'premium']}><Profile user={user} /></TierGuard>} />
          <Route path="/settings" element={<Settings user={user} />} />
          <Route path="/nintendo-callback" element={<NintendoCallback />} />
          <Route path="/help" element={<HelpCenter />} />

          {/* Premium-only routes (premium + admin) */}
          <Route path="/hunt" element={<TierGuard user={user} allowedTiers={['premium']}><HuntMonitor user={user} /></TierGuard>} />
          <Route path="/godpacks" element={<TierGuard user={user} allowedTiers={['premium']}><GodPackGallery /></TierGuard>} />
          <Route path="/bot-hub" element={<TierGuard user={user} allowedTiers={['premium']}><BotHub /></TierGuard>} />
          {/* Old /team-logs → canonical /admin/activity-logs */}
          <Route path="/team-logs" element={<Navigate to="/admin/activity-logs" replace />} />
          <Route path="/hunt-settings" element={<Navigate to="/bot-hub" replace />} />
          <Route path="/battles" element={<TierGuard user={user} allowedTiers={['premium']}><Battles user={user} /></TierGuard>} />
          <Route path="/battle-history" element={<TierGuard user={user} allowedTiers={['premium']}><BattleHistory /></TierGuard>} />
          {/* Redirects: old battle routes → tabbed Battles page */}
          <Route path="/solo-battle" element={<Navigate to="/battles?tab=solo" replace />} />
          <Route path="/event-battle" element={<Navigate to="/battles?tab=event" replace />} />
          <Route path="/random-battle" element={<Navigate to="/battles?tab=random" replace />} />
          <Route path="/open-pack" element={<TierGuard user={user} allowedTiers={['premium']}><OpenPack user={user} /></TierGuard>} />
          <Route path="/wonder-pick" element={<TierGuard user={user} allowedTiers={['premium']}><WonderPick user={user} /></TierGuard>} />
          <Route path="/friends" element={<TierGuard user={user} allowedTiers={['premium']}><Friends user={user} /></TierGuard>} />
          <Route path="/bot" element={<Navigate to="/bot-hub" replace />} />
          <Route path="/missions" element={<TierGuard user={user} allowedTiers={['premium']}><Missions user={user} /></TierGuard>} />
          <Route path="/presents" element={<TierGuard user={user} allowedTiers={['premium']}><PresentBox user={user} /></TierGuard>} />
          <Route path="/stamina" element={<TierGuard user={user} allowedTiers={['premium']}><StaminaDashboard user={user} /></TierGuard>} />
          <Route path="/shop" element={<TierGuard user={user} allowedTiers={['premium']}><ItemShop user={user} /></TierGuard>} />
          <Route path="/pvp" element={<TierGuard user={user} allowedTiers={['premium']}><PvpRankings user={user} /></TierGuard>} />
          <Route path="/achievements" element={<TierGuard user={user} allowedTiers={['premium']}><Achievements user={user} /></TierGuard>} />
          <Route path="/events" element={<TierGuard user={user} allowedTiers={['premium']}><Events user={user} /></TierGuard>} />
          <Route path="/resources" element={<TierGuard user={user} allowedTiers={['premium']}><ResourceDashboard user={user} /></TierGuard>} />
          <Route path="/battle-stats" element={<TierGuard user={user} allowedTiers={['premium']}><BattleStats user={user} /></TierGuard>} />
          <Route path="/trade-analytics" element={<TierGuard user={user} allowedTiers={['premium']}><TradeAnalytics user={user} /></TierGuard>} />

          {/* Admin-only routes */}
          {/* Admin landing retired — Fleet Health replaces it */}
          <Route path="/admin" element={user?.isAdmin ? <Navigate to="/admin/fleet" replace /> : <Navigate to="/" replace />} />
          <Route path="/admin/users" element={user?.isAdmin ? <AdminUsers user={user} /> : <Navigate to="/" replace />} />
          {/* Phase 5: Fleet Health operational landing */}
          <Route path="/admin/fleet" element={user?.isAdmin ? <AdminFleetHealth user={user} /> : <Navigate to="/" replace />} />
          {/* Phase 26 Stage 1 — Trust / drift detector dashboard. */}
          <Route path="/admin/trust" element={user?.isAdmin ? <AdminTrust user={user} /> : <Navigate to="/" replace />} />
          {/* Phase 2 compat: Subscribers merged into Users */}
          <Route path="/admin/subscribers" element={<Navigate to="/admin/users?plan=premium" replace />} />
          {/* IA cleanup: canonical admin paths for scheduler + activity logs */}
          <Route path="/admin/scheduler" element={user?.isAdmin ? <AutomationScheduler /> : <Navigate to="/" replace />} />
          <Route path="/admin/activity-logs" element={user?.isAdmin ? <TeamLogs user={user} /> : <Navigate to="/" replace />} />
          {/* Old paths 302 to new canonical admin paths */}
          <Route path="/admin/logs" element={<Navigate to="/admin/activity-logs" replace />} />
          <Route path="/admin/hunt-config" element={user?.isAdmin ? <HuntConfig user={user} /> : <Navigate to="/" replace />} />
          <Route path="/admin/observability" element={user?.isAdmin ? <Observability /> : <Navigate to="/" replace />} />
          <Route path="/admin/hunt-bots" element={user?.isAdmin ? <HuntBots /> : <Navigate to="/" replace />} />
          <Route path="/admin/hybrid-control" element={user?.isAdmin ? <HybridControl /> : <Navigate to="/" replace />} />
          <Route path="/admin/audit-log" element={user?.isAdmin ? <AuditLog user={user} /> : <Navigate to="/" replace />} />
          <Route path="/admin/system-health" element={user?.isAdmin ? <SystemHealth user={user} /> : <Navigate to="/" replace />} />
          {/* Phase 19 — Data Health Engine */}
          <Route path="/admin/health" element={user?.isAdmin ? <AdminHealth /> : <Navigate to="/" replace />} />
          {/* Apr 2026 — Hunt Ops admin page (Recovery + Retention panels). */}
          <Route path="/admin/hunt-ops" element={user?.isAdmin ? <HuntOps /> : <Navigate to="/" replace />} />
          {/* 2026-04-20 — System Integrity Dashboard (Gift + Trade truthfulness). */}
          <Route path="/admin/integrity" element={user?.isAdmin ? <SystemIntegrity /> : <Navigate to="/" replace />} />
          {/* 2026-04-28 — Capacity Verdict (Hunt-5 readiness). Read-only. */}
          <Route path="/admin/capacity" element={user?.isAdmin ? <CapacityVerdict user={user} /> : <Navigate to="/" replace />} />
          {/* Phase 34 — admin mission debug panel. */}
          <Route path="/admin/mission-debug" element={user?.isAdmin ? <MissionDebug /> : <Navigate to="/" replace />} />
          {/* 2026-05-03 — Gold Flair Trade. Trade-pass + premium (manual mode for all). */}
          <Route path="/collection/gold-flair-trade" element={<TierGuard user={user} allowedTiers={['trade', 'premium']}><ManualGoldFlairTrade user={user} /></TierGuard>} />
          {/* Backward-compat redirect from old admin path. */}
          <Route path="/admin/manual-gold-flair-trade" element={<Navigate to="/collection/gold-flair-trade" replace />} />
          <Route path="/dev/design-system" element={user?.isAdmin ? <DevDesignSystem /> : <Navigate to="/" replace />} />
          {/* 2026-04-24 — Account Analytics RESTORED (admin-only). Production
              trust issue: operators need full account-pool visibility, not
              just fleet health. AccountAnalytics already exists; route was
              redirected to /admin/fleet which doesn't show pool data. */}
          <Route path="/analytics" element={user?.isAdmin ? <AccountAnalytics user={user} /> : <Navigate to="/" replace />} />
          {/* 2026-04-24 — Account Pool truth-table merged into Fleet
              Status (AdminFleetHealth). Old /admin/account-pool URL now
              redirects there for any operator with a stale tab open. */}
          <Route path="/admin/account-pool" element={<Navigate to="/admin/fleet" replace />} />
          {/* Old /scheduler → canonical /admin/scheduler */}
          <Route path="/scheduler" element={<Navigate to="/admin/scheduler" replace />} />
          <Route path="/daily-scheduler" element={<Navigate to="/" replace />} />
          <Route path="/health" element={<Navigate to="/admin/fleet" replace />} />

          {/* Catch-all: redirect to appropriate default */}
          <Route path="*" element={<Navigate to={hasTier('premium') ? '/' : '/cards'} replace />} />
        </Routes>
        </motion.div>
        </Suspense>
        </ErrorBoundary>
      </Box>

        {/* Command Palette (Cmd+K) */}
        <CommandPalette />

        {/* Mobile Bottom Navigation */}
        <MobileBottomNav />

        {/* Debug Strip — Ctrl+Shift+D or ?debug=1 to activate */}
        <DebugStrip />
      </Box>
    </OverlayProvider>
    </AccountProvider>
    </HuntStatsProvider>
    </SocketProvider>
  )
}

export default App
