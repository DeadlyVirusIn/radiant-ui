# PackHunter WebUI — Lovable UI Guide

> Frontend-only reference snapshot for redesign review. **No backend, no secrets, no bot/gRPC/DB code is included.** Pages are NOT wired to run standalone (API layer is live-only). This document explains the existing structure so a redesign can be generated from it.

## Stack (as-is)
- **React 18** + **Vite 5**, **plain JSX** (JavaScript — no TypeScript, no `tsconfig`).
- **MUI 5** (`@mui/material`, `@mui/icons-material`) + **Emotion** for styling. **No Tailwind.**
- **react-router-dom 6** (lazy-loaded routes), **framer-motion** (animation), **recharts** (charts, lazy), **socket.io-client** (realtime).
- API access: relative `/api/*` via a `fetchWithAuth` helper; realtime via socket.io. Dev proxy → `localhost:3005`.

> **Note for Lovable:** the target stack (Tailwind + shadcn + TS) differs from this app (MUI + JSX). Treat this as a *structure/flow/UX reference*, not a component library to port 1:1.

## Page inventory (~50 routed pages)
**Auth / landing:** `Login`, `ApexTerminalLanding`, `NintendoCallback`.
**Collection & trading (tier: trade/premium):** `Cards`, `Tracker`, `CollectionMissions`, `CardRequest`, `Wishlist`, `SharingCards` (auto-gift), `AccountLink`, `Profile`, `Settings`, `HelpCenter`, **`ManualGoldFlairTrade`** (`/collection/gold-flair-trade`).
**Premium gameplay:** `HuntMonitor`, `GodPackGallery`, `BotHub`, `Battles` (solo/event/random tabs), `BattleHistory`, `OpenPack`, `WonderPick`, `Friends`, `Missions`, `PresentBox`, `StaminaDashboard`, `ItemShop`, `PvpRankings`, `Achievements`, `Events`, `ResourceDashboard`, `BattleStats`, `TradeAnalytics`.
**Admin (gated by `user.isAdmin`):** `AdminUsers`, `AdminFleetHealth`, `AdminTrust`, `AutomationScheduler`, `TeamLogs` (activity logs), `HuntConfig`, `Observability`, `HuntBots`, `HybridControl`, `AuditLog`, `SystemHealth`, `admin/AdminHealth`, `admin/HuntOps`, `admin/SystemIntegrity`, `admin/CapacityVerdict`, `admin/MissionDebug`.
**Dev:** `DevDesignSystem` (`/dev/design-system` — living style reference).

## Route map
```
PUBLIC
  /login                         Login
  /apex-terminal                 ApexTerminalLanding   (/landing → redirect)
  *                              → /login

AUTHENTICATED (inside app shell/layout)
  /                              Home dashboard
  /cards /tracker /collection-missions /card-request /wishlist
  /sharing-cards (/auto-gift→)   /accounts /profile /settings /help /nintendo-callback
  Tier-gated via <TierGuard allowedTiers={['trade','premium']|['premium']}>
  /hunt /godpacks /bot-hub /battles (/solo|event|random-battle→tabs)
  /battle-history /open-pack /wonder-pick /friends /missions /presents
  /stamina /shop /pvp /achievements /events /resources /battle-stats /trade-analytics
  GOLD FLAIR
  /collection/gold-flair-trade   ManualGoldFlairTrade   (/admin/manual-gold-flair-trade → redirect)

ADMIN (user.isAdmin else → /)
  /admin → /admin/fleet
  /admin/users /admin/fleet /admin/trust /admin/scheduler /admin/activity-logs
  /admin/hunt-config /admin/observability /admin/hunt-bots /admin/hybrid-control
  /admin/audit-log /admin/system-health /admin/health /admin/hunt-ops
  /admin/integrity /admin/capacity /admin/mission-debug
  /dev/design-system
```

## Access tiers
- **Tiers:** `trade`, `premium` (enforced by `<TierGuard allowedTiers={...}>`; falls back to `UpgradeRequired`).
- **Admin:** boolean `user.isAdmin` gate on `/admin/*` (redirects non-admins to `/`).

## Navigation & layout
- Authenticated shell wraps all logged-in routes (sidebar/drawer nav + top bar). Lazy routes inside `<Suspense>` with page skeletons.
- Nav/utility components: `PageHeader`, `Breadcrumbs`, `CommandPalette` (⌘K), `QuickActionsFAB`, `AccountSelector` / `AccountBadge`, `LanguageSelector`, `InlineActivityStrip`, `SystemHealthDot`.

## Component hierarchy (by role)
- **Layout/nav:** `PageHeader`, `Breadcrumbs`, `CommandPalette`, `QuickActionsFAB`, `StickyToolbar`, `SectionCard`, `BentoGrid`.
- **Data display:** `DataTable`, `VirtualizedList`, `CardGrid` (card tiles — used by trade & Gold Flair), `StatCardV2`, `MetricCard`, `RarityChip`, `StatusDot`, `TrendBadge`, `DataFreshness`.
- **Cards/search:** `CardSearchAutocomplete`, `SearchableSelect`, `EnhancedCardModal`, `RecommendationCard`.
- **Hunt domain:** `hunt/PPMSparkline`, `hunt/GodPackTimeline`, `hunt/WorkerTable`, `hunt/UserSafeStatusSummary`.
- **Admin domain:** `admin/AdminEditUserDialog`, `admin/AdminDebugUserDialog`, `AdminSystemSnapshot`, `AdminRecommendations`, `SystemLogPanel`, `LogConsole`, `ExecutionLogView`.
- **Feedback/state:** `ToastContainer` (+ `useToast`), `LoadingButton`, `LoadingSkeleton`, `skeletons/PageSkeletons`, `ErrorBoundary`, `OfflineBanner`, `UpgradeRequired`, `TierGuard`.
- **Onboarding/help:** `OnboardingChecklist`, `FeatureDiscovery`, `CollapsibleHelp`, `HelpCenter`.
- **Motion:** `Animations.jsx` (framer-motion presets), `canvas-confetti` for celebrations.

## Styling system
- **MUI theme** + Emotion. Design constants in `src/constants/designTokens.js` and `src/constants/rarityConfig.js`. Dark/light supported.
- `DevDesignSystem` page (`/dev/design-system`) is the in-app catalog of tokens/components — best single reference for visual language.
- Rarity colors/labels centralized (`RARITY_COLORS`, `RARITY_NAMES`) — important for card tiles.

## State & API consumers
- **Global state:** React Contexts — `AccountContext` (selected account), `HuntStatsContext` (live hunt metrics). Language context for i18n.
- **Data fetching:** `fetchWithAuth` (relative `/api/...`, JWT in header), `hooks/useCachedFetch`, `hooks/useLocalizedCards`, `hooks/useHealAction`, `hooks/useForm`, `hooks/useNetworkStatus`.
- **Realtime:** `socket.io-client` for live trade/hunt progress events (status timelines).
- **External:** `services/tcgdexApi.js` — TCGdex card images/metadata (public API).

## Data models used by the UI (shapes, not backend)
- **Card:** `backend_id`, `card_name`, `rarity_code` (C/U/R/AR/SR/SAR/SSR), `card_number`, `set_code`/`setName`, `image_filename`, `maxCopies` (top-bot copies), `user_owned`, `status` (`trade_ready`/`reserve_low`/`not_eligible`), `tradeReady`/`isAvailable`, `alreadyFramed`/`observedFrameStock`, `mintRequired`, `sandCost`.
- **Trade request:** `id`, `card_name`, `rarity`, `expansion_id`, `status` (PENDING/MATCHING/COMPLETED/FAILED/…), `trade_mode`, `matched_player_id`, `trade_session_id`, progress timeline events.
- **Pack stats:** `setCode`, `setName`, `tradeable11Plus`/`strictTradeable11Plus` (ready), `observedFrameStock` (instant frames), `eligible10Plus` (legacy).
- **Hunt/fleet:** PPM, workers, god-pack timeline, account health.

## Flows

### User flow (first run)
`/login` → tier resolved → `/` dashboard → onboarding checklist → browse `/cards`, manage `/accounts`, configure `/settings`.

### Dashboard flow
`/` home (bento stat cards, activity strip, system health dot) → drill into `/hunt`, `/resources`, `/trade-analytics`, `/battle-stats`.

### Regular trade flow
`/cards` (browse via `CardGrid`) → `/card-request` (request a card) → `/tracker` (request status) → `/sharing-cards`/`/wishlist` (offers). Status surfaced through socket.io progress events.

### Gift flow
`/sharing-cards` (auto-gift list) and `/card-request` (gift a card to a user) → `/presents` (`PresentBox` — incoming gifts). Bot sends a friend request → user accepts in-game → gift delivered.

### Gold Flair flow (`/collection/gold-flair-trade`)
1. **Select pack** (dropdown chips: *Ready cards N*, *Instant frames N* + tooltip "Ready = bot can deliver by minting or using an existing frame; Instant = a bot already owns the frame").
2. **Filter** by status: *Ready to send / Low stock / Unavailable*.
3. **Pick card** (`CardGrid` flairMode: "Top bot: N copies", "Frame in stock" / "Will mint" / "Need 11 copies").
4. **Confirm** (irreversible warning: bot burns 10 duplicates to mint the gold frame if needed; user accepts in-game).
5. **Progress timeline:** Finding a bot → (Preparing your gold-framed card) → "Bot sent a friend request — accept it in-game" → Friend accepted → "Trade ready in-game — review and accept it" → Completed.
6. **Failure** states surfaced as user-facing messages (network hiccup / no bot has enough copies / frame unavailable).

### Admin flow
`/admin` → `/admin/fleet` (fleet health) → `/admin/users` (manage subscribers/tiers, edit/debug dialogs) → ops: `/admin/hunt-ops`, `/admin/hunt-config`, `/admin/observability`, `/admin/system-health`, `/admin/integrity`, `/admin/capacity` → governance: `/admin/trust`, `/admin/audit-log`, `/admin/activity-logs`.

## Known UX pain points (for redesign focus)
- Availability semantics historically conflated stock vs deliverability (recently relabeled: "Top bot: N copies", "Ready to send / Low stock / Unavailable", "Ready cards / Instant frames").
- Gold Flair: users couldn't tell *instant* (frame exists) vs *will-mint* (~1–2 min) vs *unavailable* — a primary redesign target.
- Progress wording previously implied premature success ("Trade accepted! Confirming…").
- Large admin surface (~17 routes) — needs information hierarchy.
