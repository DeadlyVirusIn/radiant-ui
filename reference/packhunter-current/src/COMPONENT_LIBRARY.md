# Component Library Specification

## Foundation

### Design Tokens (`constants/designTokens.js`)
| Token | Value | Usage |
|-------|-------|-------|
| SPACING.xs | 4px (0.5) | Tight internal gaps |
| SPACING.sm | 8px (1) | Between related elements |
| SPACING.md | 16px (2) | Card padding, section gaps |
| SPACING.lg | 24px (3) | Between sections |
| SPACING.xl | 32px (4) | Page-level spacing |

### Typography Scale
| Level | Size | Weight | Usage |
|-------|------|--------|-------|
| Metric | 1.3rem | 800 | Large numbers, KPIs |
| Section Title | 0.75rem | 700 | Section headers (uppercase) |
| Body | 0.78rem | 400-500 | Descriptions, labels |
| Label | 0.65rem | 600 | Captions, small labels |
| Meta | 0.6rem | 400 | Timestamps, IDs |

### Status Colors
| Status | Color | Usage |
|--------|-------|-------|
| Success | #22c55e | Completed, healthy |
| Warning | #f59e0b | Action needed, degraded |
| Error | #ef4444 | Failed, issues |
| Info | #3b82f6 | Processing, in progress |
| Neutral | #6b7280 | Pending, disabled |

### Motion
| Transition | Duration | Easing | Usage |
|------------|----------|--------|-------|
| Hover | 120ms | ease-out | Button, card hover |
| Expand | 200ms | ease-out | Collapse, accordion |
| Pulse | 800ms | ease-in-out | Active indicators |
| Fade In | 150ms | ease-out | Content entry |

---

## Components

### StatusIndicator
**Purpose:** 4-state visual indicator for request lifecycle.
**Props:** `status: string`, `type: 'trade'|'gift'`, `errorMessage?: string`, `compact?: boolean`
**States:** Queued (gray) → Action Needed (yellow) → Processing (blue pulse) → Done (green) / Failed (red)
**Tokens:** CHIP.height, STATUS colors, MOTION.pulse
**Accessibility:** Status label always visible as text, not just color.

### AccountBadge
**Purpose:** Shows which account is active with type color coding.
**Props:** `activeCount?: number`
**States:** Default (static chip), Active (pulse animation when activeCount > 0)
**Tokens:** Main=#1976d2, Alt=#ed6c02
**Accessibility:** Tooltip explains full context.

### ActivityFeed
**Purpose:** Last 20 trade/gift actions for selected account.
**Props:** None (uses AccountContext internally)
**States:** Loading (spinner), Empty ("No recent activity"), Populated (list)
**Tokens:** SPACING.sm between items, STATUS colors for chips, FONT.body for text
**Accessibility:** Each item has type + card name + status as readable text.

### InlineActivityStrip
**Purpose:** Compact horizontal bar showing last 5 actions on Trade/Gift pages.
**Props:** None (uses activityStore)
**States:** Hidden (no events), Visible (1-5 chips)
**Tokens:** CHIP sizing, SPACING.sm gap, LAYER backgrounds
**Accessibility:** Chips are clickable, announce scroll-to action.

### RequestTimeline
**Purpose:** Per-request 5-step horizontal timeline.
**Props:** `request: Object`, `type: 'trade'|'gift'`
**States:** Each step: completed (green ✓) / current (blue pulse) / failed (red ✗) / pending (gray)
**Tokens:** Dot=12px, line=2px, step minWidth=56px, STATUS colors
**Accessibility:** Tooltip on each dot shows step name + timestamp.

### InsightCards
**Purpose:** System-wide metrics with trend indicators.
**Props:** `isAdmin?: boolean`
**States:** Loading (skeleton), Populated (3-5 cards)
**Tokens:** CARD padding=16px, FONT.metric for values, STATUS colors
**Accessibility:** Each card has label + value as readable text.

### AdaptiveHints
**Purpose:** Personalized proactive hints based on request history.
**Props:** `requests: Array`, `type: 'trade'|'gift'`
**States:** Hidden (no matching rule or dismissed), Visible (1 hint, Alert component)
**Tokens:** MUI Alert severity colors
**Accessibility:** Dismissible via close button, re-shows after 24h.

### OptimizationCards
**Purpose:** Per-card success rate, avg completion time, best/worst cards.
**Props:** `requests: Array`
**States:** Hidden (<5 requests), Visible (3-5 metric chips)
**Tokens:** CHIP sizing, STATUS colors for metric values
**Accessibility:** Tooltip on each chip shows full value.

### SystemHealthDot
**Purpose:** Global system health indicator in TopBar.
**Props:** None
**States:** Healthy (green), Degraded (yellow), Issues (red), Unknown (gray)
**Tokens:** STATUS colors, 10px dot with shadow
**Accessibility:** Rich tooltip with breakdown, click refreshes.

### AdminDebugPanel
**Purpose:** Admin-only filterable table of recent requests with inspect drawer.
**Props:** None
**States:** Loading, Empty, Populated, Drawer open
**Tokens:** TABLE.rowHeight=42px, zebra striping, FONT sizes for cells
**Accessibility:** Table headers, row hover, keyboard-navigable drawer.

### AdminSystemSnapshot
**Purpose:** 4 metric cards showing system-wide 24h stats for admin.
**Props:** None
**States:** Loading (skeleton), Populated
**Tokens:** CARD padding=16px, FONT.metric, STATUS colors
**Accessibility:** Each card labeled with metric name.

### AdminRecommendations
**Purpose:** Rule-based recommendations from insights data.
**Props:** None
**States:** Hidden (no triggered rules), Visible (1-3 Alert items)
**Tokens:** MUI Alert severity
**Accessibility:** Each recommendation has severity + message + action text.

---

## Patterns

### DashboardLayout
Snapshot row → Activity section → Content sections. Full-width cards.

### AdminLayout
Snapshot → Recommendations + Insights (split) → Debug table (full-width).

### InspectDrawer
Side drawer (desktop) / full-screen (mobile). Timeline → Details grid → Error → Actions.

---

## Storybook Structure (future)
```
stories/
  Foundation/
    Colors.stories.jsx
    Typography.stories.jsx
    Spacing.stories.jsx
  Components/
    StatusIndicator.stories.jsx
    AccountBadge.stories.jsx
    ActivityFeed.stories.jsx
    RequestTimeline.stories.jsx
    InsightCards.stories.jsx
    AdaptiveHints.stories.jsx
    SystemHealthDot.stories.jsx
  Patterns/
    DashboardLayout.stories.jsx
    AdminInspectDrawer.stories.jsx
```
