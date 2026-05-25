# Lovable Instructions — PackHunter Redesign

Use this repo's **root scaffold** (TanStack Start + React 19 + Tailwind v4 + shadcn/ui + TypeScript) to redesign the PackHunter WebUI. The `reference/packhunter-current/` folder is the **current** app (React 18 + Vite + MUI + JSX), included **read-only** for understanding — not for direct porting.

## Steps
1. **Read** `reference/packhunter-current/docs/LOVABLE_UI_GUIDE.md` — page inventory, route map, component hierarchy, and all user/admin/Gold Flair/Gift/Regular-trade/dashboard flows.
2. **Read** `reference/packhunter-current/docs/LOVABLE_REDESIGN_BRIEF.md` — how to analyze the snapshot and what to produce.
3. **Do not port MUI directly.** Rebuild every component in the root stack (Tailwind + shadcn/ui). MUI/Emotion/JSX patterns are reference only.
4. **Build in the existing root scaffold** (TanStack/Tailwind/TS). Do not introduce MUI, Vite-JSX, or a second framework. Do not overwrite the scaffold's config.
5. **Preserve PackHunter routes and user flows conceptually** — same information architecture, route paths, tier (`trade`/`premium`) and admin gating, and data-model field names described in the guide.
6. **Do not build backend logic** — no API, auth, bot/hunt/gRPC/DB code. None is present and none should be created.
7. **Use mock data** where the UI needs values to render (cards, trade requests, hunt stats, etc.).

## Priority redesign targets (from the brief)
1. Gold Flair flow clarity (instant vs will-mint vs unavailable; honest progress timeline; trustworthy failure messages).
2. Unified card tile (`CardGrid` equivalent) with clear availability + ownership semantics.
3. Dashboard hierarchy.
4. Admin console grouping (~17 routes).
5. Responsive app shell + command palette, preserving all routes.
