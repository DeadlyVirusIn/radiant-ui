# PackHunter WebUI — Lovable Redesign Brief

> Companion to `LOVABLE_UI_GUIDE.md`. This brief tells Lovable **how to analyze** this snapshot and **what to produce**. Redesign is NOT started here — this is the input package only.

## What this package is
A read-only snapshot of the existing PackHunter WebUI **frontend** (React 18 + Vite + MUI 5 + JSX). It contains real `src/`, `public/`, and build config — **no backend, no secrets, no API keys, no bot/gRPC/DB/automation code.** It is a *reference for structure, flows, and UX*, not a runnable or portable app.

## How Lovable should analyze the UI
1. **Start with `docs/LOVABLE_UI_GUIDE.md`** — page inventory, route map, component hierarchy, flows.
2. **Read `src/App.jsx`** for the authoritative route table, tier gating (`TierGuard`), and admin gating (`user.isAdmin`).
3. **Open `/dev/design-system` source (`src/pages/DevDesignSystem.jsx`)** + `src/constants/designTokens.js` + `rarityConfig.js` to learn the current visual language (colors, spacing, rarity palette).
4. **Trace the flagship flow** in `src/pages/admin/ManualGoldFlairTrade.jsx` + `src/components/CardGrid.jsx` — the Gold Flair experience is the priority redesign target.
5. **Catalog reusable patterns** from `src/components/**` (CardGrid, DataTable, StatCardV2, BentoGrid, PageHeader) — these define the design system to modernize.
6. **Ignore** data-fetching internals (`fetchWithAuth`, socket.io, contexts) for visual redesign — note them only to understand which screens are realtime vs static.

## Target stack for the redesign (Lovable-native)
- **Tailwind CSS + shadcn/ui + TypeScript** (Lovable default). Do NOT attempt to preserve MUI.
- Keep **route paths, page names, tier/admin gating, and information architecture** identical so the redesign drops into the existing router contract.
- Preserve **data model field names** (see guide) so API wiring is unchanged later.

## Redesign goals (priority order)
1. **Gold Flair clarity** — make instant-vs-mint-vs-unavailable obvious; honest progress timeline; trustworthy failure messaging. (Biggest known pain point.)
2. **Unified card tile** — one `CardGrid` tile design serving browse, regular trade, gift, and Gold Flair, with clear availability + ownership semantics.
3. **Dashboard hierarchy** — `/` home + analytics pages (resources, trade, battle stats) into a coherent, scannable overview.
4. **Admin console** — organize ~17 admin routes into grouped sections (fleet, users, ops, governance) with consistent layout.
5. **Navigation** — modern responsive shell (sidebar + command palette ⌘K) preserving all routes.

## Constraints
- **Do not change route paths or tier/admin gating.**
- **Do not invent backend endpoints**; keep existing data-model field names.
- **Do not redesign yet in this package** — output is a separate Lovable project.
- Keep accessibility (keyboard nav, ARIA) — current tiles already use `role="button"` + `aria-label`.

## Deliverables expected from Lovable (later, not now)
- A Tailwind/shadcn/TS redesign of: app shell + nav, `CardGrid` tile, Gold Flair flow, dashboard, admin console.
- A component/token mapping (old MUI component → new shadcn equivalent).
- Responsive + dark-mode parity with the current app.

## Out of scope
- Backend, API, auth, bot/hunt/gRPC/DB logic (not present and not to be created).
- Running the snapshot — it is reference-only.
